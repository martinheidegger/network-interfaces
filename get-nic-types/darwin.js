'use strict'
const cmd = 'networksetup -listallhardwareports'
const bgbash = require('bgbash')
const NicType = require('../const/nic-type.js')
const deviceReg = /Device: (.*)/
const portReg = /Hardware Port: (.*)/
const nicTypeReg = /(Ethernet)?(Wi-?Fi|AirPort)?(FireWire)?(Thunderbolt)?(Bluetooth)?/

function getPart (reg, block) {
  const parts = reg.exec(block)
  if (parts === null) {
    return null
  }
  return parts[1]
}

function determineNicType (str) {
  const parts = nicTypeReg.exec(str)
  if (parts[1]) return NicType.wired
  if (parts[2]) return NicType.wireless
  if (parts[3]) return NicType.firewire
  if (parts[4]) return NicType.thunderbolt
  if (parts[5]) return NicType.bluetooth
  return null
}

module.exports = cb => {
  bgbash.exec(cmd, (err, stdout) => {
    if (err) return cb(err, undefined)
    const str = stdout.toString()
    const result = {}
    str.split(/\n\s*\n/gm).forEach(block => {
      const interfaceId = getPart(deviceReg, block)
      if (interfaceId === null) {
        return false
      }
      const port = getPart(portReg, block)
      if (port === null) {
        return false
      }
      result[interfaceId] = determineNicType(port)
    })
    cb(null, result)
  })
}
