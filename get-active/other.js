'use strict'
// Thanks to https://github.com/tomas/network/blob/626414497f5e79c8299e3379e58d952f6b07703f/lib/darwin.js#L35-L46
const cmd = 'netstat -rn | grep UG | awk \'{print $6}\''
const bgbash = require('bgbash')

module.exports = cb => {
  bgbash.exec(cmd, (err, stdout) => {
    if (err) return cb(err, undefined)

    let str = stdout.toString()
    const index = str.indexOf('\n')
    if (index !== -1) {
      str = str.substr(0, index)
    }
    str = str.trim()
    if (str === '') {
      cb(null, undefined)
    }
    cb(null, str)
  })
}
