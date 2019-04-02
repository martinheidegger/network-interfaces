'use strict'
const wmic = require('wmic')

module.exports = cb =>
  // Thanks to https://github.com/tomas/network/blob/626414497f5e79c8299e3379e58d952f6b07703f/lib/win32.js#L21
  wmic.get_value('nic', 'NetConnectionID', 'NetConnectionStatus = 2', (err, data) => {
    if (err) return cb(err, undefined) // Make sure that the result is undefined (not null or something like that)
    cb(null, data || undefined)
  })
