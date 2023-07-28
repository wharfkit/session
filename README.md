# @wharfkit/session

[![Unit Tests](https://github.com/wharfkit/session/actions/workflows/test.yml/badge.svg)](https://github.com/wharfkit/session/actions/workflows/test.yml?query=branch%3Amain)

###### Session Kit - An Antelope blockchain session management toolkit

Authenticate and persist sessions using blockchain accounts within JavaScript and TypeScript applications. Each session can be used to interact with smart contracts using the authenticated account.

## IN DEVELOPMENT

This library is in very early development and everything is subject to change.

The [`master`](https://github.com/wharfkit/session) branch will contain early release builds of the Session Kit and will be published under the `beta` tag on npm. The [`dev`](https://github.com/wharfkit/session/tree/dev) branch will be the staging area for the next release, and all pull requests should be made against [`dev`](https://github.com/wharfkit/session/tree/dev).

No releases have yet been published of any version. Refer to the WharfKit organization on npm for all releases:

https://www.npmjs.com/org/wharfkit

## Installation

The `@wharfkit/session` package is distributed as a module on [npm](https://www.npmjs.com/package/PACKAGE).

```
yarn add @wharfkit/session
# or
npm install --save @wharfkit/session
```

## Usage

TODO

See [unit tests](https://github.com/wharfkit/session/tree/main/test) for usage examples during early development.

## Autodocs

-   [API Documentation](https://wharfkit.github.io/session/)
-   [Code Coverage Report](https://wharfkit.github.io/session/coverage/)

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

**All development should be done based on the [dev](https://github.com/wharfkit/session/tree/dev) branch.**

Clone the repository and run `make` to checkout all dependencies and build the project. The tests can be run using `make test` and can be continously tested during development with `make test/watch`.

See the [Makefile](./Makefile) for other useful targets.

Before submitting a pull request make sure to run `make check` and `make format`.

## Dependencies

-   [@wharfkit/antelope](https://github.com/wharfkit/antelope): Core library to provide Antelope data types.
-   [eosio-signing-request](https://github.com/greymass/eosio-signing-request): Antelope Signing Request Protocol.
-   [pako](https://github.com/nodeca/pako): zlib javascript port, used to compress signing requests.

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com).
