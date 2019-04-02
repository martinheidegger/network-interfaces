# network-interfaces

<a href="https://travis-ci.org/martinheidegger/network-interfaces"><img src="https://travis-ci.org/martinheidegger/network-interfaces.svg?branch=master" alt="Build Status"/></a>
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Maintainability](https://api.codeclimate.com/v1/badges/fe7f58777d60b93f2e42/maintainability)](https://codeclimate.com/github/martinheidegger/network-interfaces/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/fe7f58777d60b93f2e42/test_coverage)](https://codeclimate.com/github/martinheidegger/network-interfaces/test_coverage)

`network-interfaces` is similar to `os.networkInterfaces()` but offers a cross-platform util to listen to changes
in the network setup.

`npm i @leichtgewicht/network-interfaces --save`

## Usage

The simplest usage of it is by using creating a change-stream:

```javascript
const { networkInterfaces, JSONStringMode } = require('@leichtgewicht/network-interfaces')
const { changes, warnings } = networkInterfaces.stream(JSONStringMode.line)

changes.pipe(process.stdout)
warnings.pipe(process.stderr)
```

By the way, you can also get this through npx 😍

```sh
$ npx @leichtgewicht/network-interfaces
```

## API

For the time being, look into:

[./index.d.ts](./index.d.ts)


### License 

[MIT](./LICENSE)
