# @wharfkit/session

[![Unit Tests](https://github.com/wharfkit/session/actions/workflows/test.yml/badge.svg)](https://github.com/wharfkit/session/actions/workflows/test.yml?query=branch%3Amaster)

###### Session Kit - An Antelope blockchain session management toolkit

Authenticate and persist sessions using blockchain accounts within JavaScript and TypeScript applications. Each session can be used to interact with smart contracts using the authenticated account.

## Installation

The `@wharfkit/session` package is distributed on [npm](https://www.npmjs.com/package/@wharfkit/session).

```
yarn add @wharfkit/session
# or
npm install --save @wharfkit/session
```

## Usage

Please refer to the documentation on [wharfkit.com](https://dev.wharfkit-website.pages.dev/docs).

## Autodocs

-   [API Documentation](https://wharfkit.github.io/session/)
-   [Code Coverage Report](https://wharfkit.github.io/session/coverage/)

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

The [`master`](https://github.com/wharfkit/session) branch will contain production release builds of the Session Kit. The [`dev`](https://github.com/wharfkit/session/tree/dev) branch will be where all development is performed and act as the staging area for the next release. All pull requests should be made against [`dev`](https://github.com/wharfkit/session/tree/dev).

Clone the repository and run `make` to checkout all dependencies and build the project. The tests can be run using `make test` and can be continuously tested during development with `make test/watch`.

See the [Makefile](./Makefile) for other useful targets.

Before submitting a pull request make sure to run `make check` and `make format`.

## Dependencies

-   [@wharfkit/antelope](https://github.com/wharfkit/antelope): Core library to provide Antelope data types.
-   [@wharfkit/signing-request](https://github.com/wharfkit/signing-request): Signing request protocol for Antelope blockchains.
-   [pako](https://github.com/nodeca/pako): zlib javascript port, used to compress signing requests.

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com).
