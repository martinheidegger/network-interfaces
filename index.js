'use strict'
const os = require('os')
const objectHash = require('object-hash')
const deepEquals = require('fast-deep-equal')
const { hasListener } = require('has-listener')
const { EventEmitter } = require('events')
const { Readable } = require('stream')

const { getActive } = require('./get-active/index.js')
const { getNicTypes } = require('./get-nic-types/index.js')

const NicType = require('./const/nic-type.js')
const Family = require('./const/family.js')
const JSONStringModes = require('./const/json-string-modes.js')
const ChangeType = require('./const/change-type.js')

const DEFAULT_MAX_AGE = 250

function keyForInfo (interfaceId, info) {
  return JSON.stringify([
    interfaceId,
    info.mac,
    info.family,
    info['scopeid'] || 0
  ])
}

function createNetworkInfo (interfaceId, activeInterfaceId, nicTypes) {
  const info = {
    id: interfaceId,
    active: interfaceId === activeInterfaceId,
    nicType: (nicTypes && nicTypes[interfaceId]) || NicType.other
  }
  info.hash = objectHash(info)
  return info
}

class NetworkInterfacesStream extends Readable {
  constructor (networkInterfaces, stringMode) {
    super({ objectMode: stringMode !== undefined })
    const listener = stringMode === undefined ? change => this.push(change) : change => this.push(stringMode({ time: Date.now(), ...change }))
    for (const change of networkInterfaces.state()) {
      listener(change)
    }
    this.on('resume', () => networkInterfaces.on('change', listener))
    this.on('paused', () => networkInterfaces.removeListener('change', listener))
  }

  _read () {}
}

class NetworkWarningStream extends Readable {
  constructor (networkInterfaces, stringMode) {
    super({ objectMode: stringMode !== undefined })
    const listener = stringMode === undefined ? change => this.push(change) : change => this.push(stringMode(change))
    networkInterfaces.on('warning', listener)
  }

  _read () {}
}

class NetworkInterfaces extends EventEmitter {
  constructor ({ maxAge }) {
    super()
    this._maxAge = maxAge
    this._localAddressByFamily = new Map()
    this._current = new Map()
    this._nextUpdate = Date.now()
    this._interfaces = new Map()

    let timeout
    hasListener(this, 'change', active => {
      this.hasChangeListener = active
      if (active) {
        const refreshTimeout = () => {
          timeout = setTimeout(() => {
            this.update()
            refreshTimeout()
          }, this._nextUpdate - Date.now())
        }
        refreshTimeout()
      } else {
        clearTimeout(timeout)
        timeout = undefined
      }
    })
  }

  * _collectAddresses (keys, interfaceId, infos) {
    for (const info of infos) {
      const key = keyForInfo(interfaceId, info)
      const entry = {
        ...info,
        key,
        hash: objectHash(info),
        interfaceId
      }
      if (keys.has(key)) {
        this.emit('warning', Object.assign(new Error(`Multiple network addresses with same key detected ${key}`), {
          a: keys.get(key),
          b: entry,
          interfaceId
        }))
        continue
      }
      keys.set(key, entry)
      yield entry
    }
  }

  * _collectInterfaces () {
    const keys = new Map()
    const rawInterfaces = os.networkInterfaces()
    for (const interfaceId in rawInterfaces) {
      yield {
        interfaceId,
        addresses: this._collectAddresses(keys, interfaceId, rawInterfaces[interfaceId])
      }
    }
  }

  get maxAge () {
    return this._maxAge
  }

  stream (stringMode) {
    return {
      changes: new NetworkInterfacesStream(this, stringMode),
      warnings: new NetworkWarningStream(this, stringMode)
    }
  }

  isLocalAddress (family, address) {
    this.checkUpdate()
    const localAddresses = this._localAddressByFamily.get(family)
    if (localAddresses === undefined) {
      return false
    }
    return localAddresses.has(address)
  }

  preferInternalForLocal (family, address) {
    const local = this.isLocalAddress(family, address)
    if (!local) {
      return address
    }
    for (const networkInterface of this._interfaces.values()) {
      for (const address of networkInterface.addresses.values()) {
        if (address.family === family && address.internal) {
          return address.address
        }
      }
    }
    return address
  }

  checkUpdate () {
    if (this._nextUpdate <= Date.now()) {
      this.update()
    }
  }

  updateActiveInterfaceId () {
    getActive((cause, activeInterfaceId) => {
      if (cause) {
        this.emit('warning', Object.assign(new Error(`Couldn't identify the active interface.`), {
          code: 'EACTIVEERR',
          cause: cause.stack || cause
        }))
      }
      if (this._activeInterfaceId !== activeInterfaceId) {
        this._activeInterfaceId = activeInterfaceId
        this._update()
      }
    })
  }

  updateNicTypes () {
    getNicTypes((cause, data) => {
      if (cause) {
        this.emit('warning', Object.assign(new Error(`Wasn't able to lookup the interfaces.`), {
          code: 'ENICTYPE',
          cause: cause.stack || cause
        }))
      }
      if (!deepEquals(this._nicTypes, data)) {
        this._nicTypes = data
        this._update()
      }
    })
  }

  update () {
    this.updateActiveInterfaceId()
    this.updateNicTypes()
    this._update()
  }

  _update () {
    const deletedInterfaces = new Set(this._interfaces.keys())
    for (const { interfaceId, addresses } of this._collectInterfaces()) {
      deletedInterfaces.delete(interfaceId)

      const networkInterface = this._interfaces.get(interfaceId)
      const isNew = networkInterface === undefined
      const info = createNetworkInfo(interfaceId, this._activeInterfaceId, this._nicTypes)
      if (isNew) {
        this._process({ type: 'add-interface', info })
      } else if (networkInterface.info.hash !== info.hash) {
        this._process({ type: 'update-interface', info, oldInfo: networkInterface.hash })
      }

      const deletedKeys = isNew ? undefined : new Set(networkInterface.addresses.keys())
      for (const address of addresses) {
        const { key, hash } = address
        const oldAddress = networkInterface && networkInterface.addresses.get(key)

        if (oldAddress !== undefined) {
          if (!isNew) deletedKeys.delete(key)
          if (oldAddress.hash === hash) {
            continue
          }
        }
        if (oldAddress !== undefined) {
          this._process({ type: 'update-address', address, oldAddress })
        } else {
          this._process({ type: 'add-address', address })
        }
      }

      if (deletedKeys !== undefined) {
        for (const deletedKey of deletedKeys) {
          this._process({ type: 'delete-address', address: networkInterface.addresses.get(deletedKey) })
        }
      }
    }
    for (const interfaceId of deletedInterfaces) {
      const networkInterface = this._interfaces.get(interfaceId)
      for (const address of networkInterface.addresses.values()) {
        this._process({ type: 'delete-address', address })
      }
      this._process({ type: 'delete-interface', info: networkInterface.info })
    }
  }

  _process (change) {
    const { type } = change
    let networkInterface, addresses
    switch (type) {
      case ChangeType.updateInterface:
        networkInterface = this._interfaces.get(change.info.id)
        networkInterface.info = change.info
        if (networkInterface.info.active) {
          this._active = networkInterface
        }
        break
      case ChangeType.addInterface:
        networkInterface = {
          info: change.info,
          addresses: new Map()
        }
        this._interfaces.set(change.info.id, networkInterface)
        if (change.info.active) {
          this._active = networkInterface
        }
        break
      case ChangeType.deleteInterface:
        this._interfaces.delete(change.info.id)
        if (this._active && this._active.info.id === change.info.id) {
          this._active = null
        }
        break
      case ChangeType.updateAddress:
        addresses = this._interfaces.get(change.address.interfaceId).addresses
        if (addresses.get(change.address.key) === change.address) {
          // Another change may have already taken this address, don't override previous changes.
          // TODO: this is a problematic edge case that should never occur, if it does - huh -
          //       not sure what to do about it...
          addresses.delete(change.address.key)
          this._deleteLocalLookup(change.oldAddress)
        }
        addresses.set(change.address.key, change.address)
        this._addLocalLookup(change.address)
        break
      case ChangeType.addAddress:
        addresses = this._interfaces.get(change.address.interfaceId).addresses
        addresses.set(change.address.key, change.address)
        this._addLocalLookup(change.address)
        break
      case ChangeType.deleteAddress:
        addresses = this._interfaces.get(change.address.interfaceId).addresses
        addresses.delete(change.address.key)
        this._deleteLocalLookup(change.address)
    }
    this.emit('change', change)
  }

  * state () {
    this.checkUpdate()
    for (const networkInterface of this._interfaces.values()) {
      yield { type: ChangeType.addInterface, info: networkInterface.info }
      for (const address of networkInterface.addresses.values()) {
        yield { type: ChangeType.addAddress, address }
      }
    }
  }

  async active () {
    await this.checkUpdate()
    return this._active
  }

  _deleteLocalLookup (entry) {
    const { family } = entry
    let localAddresses = this._localAddressByFamily.get(family)
    if (localAddresses === undefined) {
      return
    }
    localAddresses.delete(entry.address)
  }

  _addLocalLookup (entry) {
    const { family } = entry
    let localAddresses = this._localAddressByFamily.get(family)
    if (localAddresses === undefined) {
      localAddresses = new Set()
      this._localAddressByFamily.set(family, localAddresses)
    }
    localAddresses.add(entry.address)
  }
}

let instance

module.exports = {
  Family,
  NicType,
  ChangeType,
  JSONStringModes,
  NetworkInterfaces,
  get networkInterfaces () {
    if (instance === undefined) {
      instance = new NetworkInterfaces({ maxAge: DEFAULT_MAX_AGE })
    }
    return instance
  }
}
