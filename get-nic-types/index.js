'use strict'
exports.getNicTypes =
  process.platform === 'win32' ? require('./win32.js')
    : process.platform === 'darwin' ? require('./darwin.js')
      : require('./linux.js')
