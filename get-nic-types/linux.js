'use strict'
const fs = require('fs')
const NicType = require('../const/nic-type.js')
const ethReg = /^([:]+):/g

/**
 * Inter-| sta-|   Quality        |   Discarded packets               | Missed | WE
 *  face | tus | link level noise |  nwid  crypt   frag  retry   misc | beacon | 22
 * wlan1: 0000   21.  -66.  -256.       0      0      0      0      0        0
 */

// TODO: lshw -class network -json

module.exports = cb =>
  fs.readFile('/proc/net/wireless', 'utf-8', (err, data) => {
    if (err) return cb(err, undefined)
    ethReg.lastIndex = 0
    const result = {}
    let parts
    while ((parts = ethReg.exec(data)) !== null) {
      result[parts[1]] = NicType.wireless
    }
    cb(null, result)
  })
