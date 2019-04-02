'use strict'
exports.getActive = process.platform === 'win32' ? require('./win32.js') : require('./other.js')
