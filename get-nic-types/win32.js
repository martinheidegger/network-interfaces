'use strict'
const wmic = require('wmic')
const NicType = require('../const/nic-type.js')

module.exports = cb => {
  wmic.get_list('nic', (err, nics) => {
    if (err) return cb(err, undefined)

    cb(null, nics
      .filter(nic => nic.Name && nic.NetConnectionID)
      .reduce((result, nic) => {
        result[nic.NetConnectionID] = nic.Name.match(/wi-?fi|wireless/i) ? NicType.wireless : NicType.wired
        return result
      }, {})
    )
  })
}
