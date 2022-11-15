# @wharfkit/session

[![Unit Tests](https://github.com/wharfkit/session/actions/workflows/test.yml/badge.svg)]()

###### Antelope blockchain session management.

Authenticate and persist sessions using blockchain accounts within JavaScript and TypeScript applications. Each session can be used to interact with smart contracts using the authenticated account.

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

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

Clone the repository and run `make` to checkout all dependencies and build the project. The tests can be run using `make test` and can be continously tested during development with `make test/watch`.

See the [Makefile](./Makefile) for other useful targets.

Before submitting a pull request make sure to run `make check` and `make format`.

## Dependencies

-   [@greymass/eosio](https://github.com/greymass/eosio): Core library to provide Antelope data types.
-   [eosio-signing-request](https://github.com/greymass/eosio-signing-request): Antelope Signing Request Protocol.
-   [pako](https://github.com/nodeca/pako): zlib javascript port, used to compress signing requests.

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com).
