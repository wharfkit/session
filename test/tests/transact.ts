import {assert} from 'chai'
import zlib from 'pako'
import fetch from 'node-fetch'

import {PermissionLevel, Serializer, Signature} from '@greymass/eosio'
import {ResolvedSigningRequest, SigningRequest} from 'eosio-signing-request'

import SessionKit, {ChainDefinition, Session, SessionOptions} from '$lib'

import {makeClient} from '$test/utils/mock-provider'
import {makeWallet} from '$test/utils/mock-wallet'
import {makeMockAction, makeMockActions, makeMockTransaction} from '$test/utils/mock-transfer'
import {MockTransactPlugin, MockTransactResourceProviderPlugin} from '$test/utils/mock-hook'

const client = makeClient()
const wallet = makeWallet()

const mockSessionOptions: SessionOptions = {
    chain: ChainDefinition.from({
        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        url: 'https://jungle3.greymass.com',
    }),
    client,
    permissionLevel: PermissionLevel.from('wharfkit@session'),
    walletPlugin: wallet,
}

async function mockData() {
    const info = await client.v1.chain.get_info()
    const action = await makeMockAction()
    const actions = await makeMockActions()
    const transaction = await makeMockTransaction(info)
    const session = new Session(mockSessionOptions)
    return {
        action,
        actions,
        info,
        session,
        transaction,
    }
}

function assetValidTransactResponse(result) {
    assert.instanceOf(result.chain, ChainDefinition)
    assert.instanceOf(result.request, SigningRequest)
    assert.instanceOf(result.resolved, ResolvedSigningRequest)
    assert.instanceOf(result.signatures, Array)
    assert.instanceOf(result.signatures[0], Signature)
    assert.instanceOf(result.signer, PermissionLevel)
}

suite('transact', function () {
    suite('args', function () {
        suite('action', function () {
            test('typed', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action: Serializer.objectify(action)})
                assetValidTransactResponse(result)
            })
        })
        suite('actions', function () {
            test('typed', async function () {
                const {actions, session} = await mockData()
                const result = await session.transact({actions})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const {actions, session} = await mockData()
                const result = await session.transact({actions: Serializer.objectify(actions)})
                assetValidTransactResponse(result)
            })
        })
        suite('transaction', function () {
            test('typed', async function () {
                const {session, transaction} = await mockData()
                const result = await session.transact({transaction})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const {session, transaction} = await mockData()
                const result = await session.transact({
                    transaction: Serializer.objectify(transaction),
                })
                assetValidTransactResponse(result)
            })
            test('as typed param', async function () {
                const {session, transaction} = await mockData()
                const result = await session.transact(transaction)
                assetValidTransactResponse(result)
            })
            test('retain headers', async function () {
                const {session, transaction} = await mockData()
                const result = await session.transact(transaction)
                assetValidTransactResponse(result)
                if (result.transaction) {
                    assert.equal(transaction.delay_sec, result.transaction.delay_sec)
                    assert.equal(transaction.expiration, result.transaction.expiration)
                    assert.equal(transaction.ref_block_num, result.transaction.ref_block_num)
                    assert.equal(transaction.ref_block_prefix, result.transaction.ref_block_prefix)
                    assert.equal(
                        transaction.max_net_usage_words,
                        result.transaction.max_net_usage_words
                    )
                    assert.equal(transaction.max_cpu_usage_ms, result.transaction.max_cpu_usage_ms)
                } else {
                    assert.fail('Transaction was not returned in result.')
                }
            })
            test('as untyped param', async function () {
                const {session, transaction} = await mockData()
                const result = await session.transact(Serializer.objectify(transaction))
                assetValidTransactResponse(result)
            })
        })
        suite('signing request', async function () {
            test('string', async function () {
                const {session} = await mockData()
                const result = await session.transact({
                    request:
                        'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                })
                assetValidTransactResponse(result)
            })
            test('object', async function () {
                const {session} = await mockData()
                const result = await session.transact({
                    request: SigningRequest.from(
                        'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                        {zlib}
                    ),
                })
                assetValidTransactResponse(result)
            })
        })
        suite('invalid', function () {
            test('no abi for contract', async function () {
                const {action, session} = await mockData()
                const data = Serializer.objectify(action)
                data.account = ''
                session.transact({action: data}).catch((error) => {
                    assert.equal(error.message, 'No data for /v1/chain/get_abi')
                })
            })
        })
    })
    suite('options', async function () {
        suite('allowModify', function () {
            test('default: true', async function () {
                const {action, session} = await mockData()
                const result = await session.transact(
                    {action},
                    {
                        allowModify: true,
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 2)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('true', async function () {
                const {action, session} = await mockData()
                const result = await session.transact(
                    {action},
                    {
                        allowModify: true,
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 2)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('false', async function () {
                const {action, session} = await mockData()
                const result = await session.transact(
                    {action},
                    {
                        allowModify: false,
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 1)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
        })
        suite('broadcast', function () {
            test('default: true', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action})
                assetValidTransactResponse(result)
            })
            test('true', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action}, {broadcast: true})
                assetValidTransactResponse(result)
            })
            test('false', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action}, {broadcast: false})
                assetValidTransactResponse(result)
            })
        })
        suite('transactPlugins', function () {
            test('inherit', async function () {
                const {action} = await mockData()
                const session = new Session({
                    ...mockSessionOptions,
                    transactPlugins: [new MockTransactResourceProviderPlugin()],
                })
                const result = await session.transact({action})
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 2)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('override', async function () {
                const {action, session} = await mockData()
                const result = await session.transact(
                    {action},
                    {
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 2)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('triggers', async function () {
                const {action, session} = await mockData()
                const result = await session.transact(
                    {action},
                    {transactPlugins: [new MockTransactPlugin()]}
                )
                assetValidTransactResponse(result)
            })
        })
        suite('transactPluginsOptions', function () {
            test('transact', async function () {
                const {action} = await mockData()
                const session = new Session({
                    ...mockSessionOptions,
                    transactPlugins: [new MockTransactResourceProviderPlugin()],
                })
                const result = await session.transact(
                    {action},
                    {
                        transactPluginsOptions: {
                            disableExamplePlugin: true,
                        },
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 1)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('session constructor', async function () {
                const {action} = await mockData()
                const session = new Session({
                    ...mockSessionOptions,
                    transactPluginsOptions: {
                        disableExamplePlugin: true,
                    },
                    transactPlugins: [new MockTransactResourceProviderPlugin()],
                })
                const result = await session.transact({action})
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 1)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('kit constructor', async function () {
                const {action} = await mockData()
                const sessionKit = new SessionKit({
                    appName: 'demo.app',
                    chains: [
                        {
                            id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                            url: 'https://jungle3.greymass.com',
                        },
                    ],
                    fetch,
                    transactPlugins: [new MockTransactResourceProviderPlugin()],
                    transactPluginsOptions: {
                        disableExamplePlugin: true,
                    },
                    walletPlugins: [makeWallet()],
                })
                const session = await sessionKit.login({client})
                const result = await session.transact({action})
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 1)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
            test('login', async function () {
                const {action} = await mockData()
                const sessionKit = new SessionKit({
                    appName: 'demo.app',
                    chains: [
                        {
                            id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                            url: 'https://jungle3.greymass.com',
                        },
                    ],
                    fetch,
                    transactPlugins: [new MockTransactResourceProviderPlugin()],
                    walletPlugins: [makeWallet()],
                })
                const session = await sessionKit.login({
                    client,
                    transactPluginsOptions: {
                        disableExamplePlugin: true,
                    },
                })
                const result = await session.transact({action})
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 1)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
        })
    })
    suite('response', function () {
        test('type check', async function () {
            const {session, transaction} = await mockData()
            const result = await session.transact(transaction)
            assetValidTransactResponse(result)
        })
        test('decoded transaction', async function () {
            const {session} = await mockData()
            const result = await session.transact({
                request: SigningRequest.from(
                    'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                    {zlib}
                ),
            })
            assert.exists(result.transaction)
            if (result.transaction) {
                // Ensure transaction authority was templated
                assert.equal(
                    result.transaction.actions[0].authorization[0].actor,
                    PermissionLevel.from(mockSessionOptions.permissionLevel).actor
                )
                assert.equal(
                    result.transaction.actions[0].authorization[0].permission,
                    PermissionLevel.from(mockSessionOptions.permissionLevel).permission
                )
                // Ensure transaction data was templated
                assert.equal(
                    result.transaction.actions[0].data.from,
                    PermissionLevel.from(mockSessionOptions.permissionLevel).actor
                )
            } else {
                assert.fail('Decoded transaction was not returned in result.')
            }
        })
        test('resolved request', async function () {
            const {session} = await mockData()
            const result = await session.transact({
                request: SigningRequest.from(
                    'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                    {zlib}
                ),
            })
            assert.exists(result.resolved)
            const {resolved} = result
            // Ensure it returns resolved request with authority templated
            assert.equal(
                resolved?.transaction.actions[0].authorization[0].actor,
                PermissionLevel.from(mockSessionOptions.permissionLevel).actor
            )
            assert.equal(
                resolved?.transaction.actions[0].authorization[0].permission,
                PermissionLevel.from(mockSessionOptions.permissionLevel).permission
            )
        })
        test('valid signatures', async function () {
            const {action, session} = await mockData()
            const result = await session.transact({action})
            const transaction = result.resolved?.request.getRawTransaction()
            if (transaction) {
                const digest = transaction.signingDigest(mockSessionOptions.chain.id)
                const [signature] = result.signatures
                const publicKey = signature.recoverDigest(digest)
                assert.isTrue(publicKey.equals(wallet.privateKey.toPublic()))
            } else {
                assert.fail('Transaction was not resolved from request.')
            }
        })
    })
})
