'use strict'
module.exports = {
  lengthPrefixed: json => {
    const str = JSON.stringify(json)
    return `${str.length}${str}`
  },
  concatenated: json => JSON.stringify(json),
  recordSeparator: json => `\u001e${JSON.stringify(json)}\u000A`,
  line: json => `${JSON.stringify(json)}\n`
}
