'use strict'
const os = require('os')
const getActiveModule = require('./get-active/index.js')
const getNicTypesModule = require('./get-nic-types/index.js')
const { test } = require('tap')

test('networkinterfaces', t => {
  let n

  const _backup = {
    networkInterfaces: os.networkInterfaces,
    getActive: getActiveModule.getActive,
    getNicTypes: getNicTypesModule.getNicTypes
  }

  let networkInterfaces
  let counter = 0
  os.networkInterfaces = function () {
    counter += 1
    return networkInterfaces
  }
  t.notEquals(os.networkInterfaces, _backup.networkInterfaces, 'interfaces mock enabled')

  const getActive = cb => setImmediate(cb, null, null)
  getActiveModule.getActive = cb => getActive(cb)
  t.pass('active mock enabled')

  const getNicTypes = cb => setImmediate(cb, null, {})
  getNicTypesModule.getNicTypes = cb => getNicTypes(cb)
  t.pass('nicTypes mock enabled')

  const { NetworkInterfaces } = require('./index.js')

  function reset () {
    counter = 0
    n = new NetworkInterfaces({ maxAge: 10000 })
  }

  // Cleaning up
  t.afterEach(async () => {
    n.removeAllListeners()
    counter = 0
  })

  t.test('empty network', async t => {
    reset()
    networkInterfaces = {}
    n.on('warning', err => t.fail(`Unexpected warning: ${err}`))
    n.on('address', change => t.fail(`Unexpected change: ${change}`))
    for (const update of n.state()) {
      t.fail(`Found unexpected update: ${update}`)
    }
    t.equals(counter, 1, 'networkInterfaces is called')
  })

  t.test('local address', async t => {
    networkInterfaces = {
      lo: [{
        family: 'a',
        mac: 'do'
      }]
    }
    const addAddress = {
      type: 'add-address',
      address: {
        interfaceId: 'lo',
        family: 'a',
        mac: 'do',
        key: '["lo","do","a",0]',
        hash: '74a54c7f060b434831a8d0c3df45ccba17b0ca35'
      }
    }
    const addInterface = {
      type: 'add-interface',
      info: {
        active: false,
        nicType: 'Other',
        id: 'lo',
        hash: '8836aeda5775c24f51f4b2eb5191631bf3ec2669'
      }
    }
    reset()
    n.on('warning', err => t.fail(err))
    await Promise.all([
      new Promise(resolve => {
        n.once('change', change => {
          t.deepEquals(change, addInterface)
          n.once('change', change => {
            t.deepEquals(change, addAddress, 'change was triggered')
            t.on('change', change => t.fail(change))
            setImmediate(resolve)
          })
        })
      }),
      n.update()
    ])
    t.deepEquals(Array.from(n.state()), [
      addInterface,
      addAddress
    ])
  })

  t.test('add/delete addresses', async t => {
    networkInterfaces = {
      lo: [{
        family: 'a',
        mac: 'do'
      }, {
        family: 'b',
        mac: 'bo'
      }]
    }
    reset()
    t.deepEquals(Array.from(n.state()), [
      {
        type: 'add-interface',
        info: {
          active: false,
          hash: '8836aeda5775c24f51f4b2eb5191631bf3ec2669',
          id: 'lo',
          nicType: 'Other'
        }
      },
      {
        type: 'add-address',
        address: {
          family: 'a',
          hash: '74a54c7f060b434831a8d0c3df45ccba17b0ca35',
          interfaceId: 'lo',
          key: '["lo","do","a",0]',
          mac: 'do'
        }
      },
      {
        type: 'add-address',
        address: {
          family: 'b',
          hash: 'd98c1364c3131ab8fe28a3698baacfd88cd9f34d',
          interfaceId: 'lo',
          key: '["lo","bo","b",0]',
          mac: 'bo'
        }
      }
    ])
    n.on('warning', err => t.fail(err))
    networkInterfaces = {
      lo: [{
        family: 'c',
        mac: 'do'
      }, {
        family: 'b',
        address: 'x',
        mac: 'bo'
      }]
    }
    const changes = []
    n.on('change', change => changes.push(change))
    n.update()
    t.deepEquals(changes, [
      { type: 'add-address', address: { family: 'c', mac: 'do', key: '["lo","do","c",0]', hash: '67f871cd6359b9b2cdcc321ac0a6c6d2acdae78f', interfaceId: 'lo' } },
      {
        type: 'update-address',
        address: { family: 'b', mac: 'bo', address: 'x', key: '["lo","bo","b",0]', hash: '3919b087a3f56f5c4bf969bc8d765af84563abe6', interfaceId: 'lo' },
        oldAddress: { family: 'b', mac: 'bo', key: '["lo","bo","b",0]', hash: 'd98c1364c3131ab8fe28a3698baacfd88cd9f34d', interfaceId: 'lo' }
      },
      { type: 'delete-address', address: { family: 'a', mac: 'do', key: '["lo","do","a",0]', hash: '74a54c7f060b434831a8d0c3df45ccba17b0ca35', interfaceId: 'lo' } }
    ], 'add/delete triggered change events')
  })

  t.test('preferInternalForLocal', async t => {
    networkInterfaces = {
      lo: [{
        family: 'IPv4',
        mac: 'do',
        address: 'internal-address',
        internal: true
      }],
      eth: [{
        family: 'IPv4',
        address: 'external-address'
      }]
    }
    reset()
    n.on('warning', err => t.fail(err))
    t.equals(await n.preferInternalForLocal('IPv4', 'internal-address'), 'internal-address', 'the internal address is our perfect choice')
    t.equals(await n.preferInternalForLocal('IPv4', 'external-address'), 'internal-address', 'the external address should be replaced by the internal address')
    t.equals(await n.preferInternalForLocal('IPv4', 'other-address'), 'other-address', 'the other address is not local, so it is just returned')
  })

  t.tearDown(async () => {
    os.networkInterfaces = _backup.networkInterfaces
    getActiveModule.getActive = _backup.getActive
    getNicTypesModule.getNicTypes = _backup.getNicTypes
  })
  t.end()
})
