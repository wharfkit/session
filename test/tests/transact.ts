import {assert} from 'chai'
import zlib from 'pako'

import {PermissionLevel, Serializer, Signature, TimePointSec} from '@greymass/eosio'
import {ResolvedSigningRequest, SigningRequest} from 'eosio-signing-request'

import SessionKit, {
    ABICache,
    ChainDefinition,
    Session,
    TransactContext,
    TransactHookTypes,
} from '$lib'

import {makeClient} from '$test/utils/mock-client'
import {mockFetch} from '$test/utils/mock-fetch'
import {
    mockMetadataFooWriterPlugin,
    mockTransactActionPrependerPlugin,
    MockTransactPlugin,
    MockTransactResourceProviderPlugin,
} from '$test/utils/mock-hook'
import {makeMockAction, makeMockActions, makeMockTransaction} from '$test/utils/mock-transfer'
import {makeWallet} from '$test/utils/mock-wallet'
import {mockPermissionLevel} from '$test/utils/mock-config'
import {Transfer} from '$test/utils/setup/structs'
import {mockSessionArgs, mockSessionOptions} from '$test/utils/mock-session'
import {MockStorage} from '$test/utils/mock-storage'
import {MockUserInterface} from '$test/utils/mock-userinterface'

const client = makeClient()
const wallet = makeWallet()

async function mockData() {
    const info = await client.v1.chain.get_info()
    const action = await makeMockAction()
    const actions = await makeMockActions()
    const transaction = await makeMockTransaction(info)
    const session = new Session(mockSessionArgs, mockSessionOptions)
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
            test('string maintains payload metadata', async function () {
                const {session} = await mockData()
                const result = await session.transact(
                    {
                        request:
                            'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRgEnjpsHS30fM4DAhI2nLGACDRsnxsWq9Z6yZAVLMbC4-geDaPHyjMSitOzMEoXMYoWSjFSFpNTiEgUbY0YGRua0_HzmpMQiAA',
                    },
                    {
                        broadcast: false,
                        transactPlugins: [],
                    }
                )
                assert.equal(result.request.getInfoKey('foo'), 'bar')
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
            test('object maintains payload metadata', async function () {
                const {action, session} = await mockData()
                const abiProvider = new ABICache(this.client)
                const request = await SigningRequest.create(
                    {action},
                    {
                        abiProvider,
                        zlib,
                    }
                )
                request.setInfoKey('foo', 'bar')
                assert.equal(request.getInfoKey('foo'), 'bar')
                const result = await session.transact(
                    {request},
                    {
                        broadcast: false,
                        transactPlugins: [],
                    }
                )
                assert.equal(result.request.getInfoKey('foo'), 'bar')
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
                const {action} = await mockData()
                const session = new Session(mockSessionArgs, {
                    fetch: mockSessionOptions.fetch,
                })
                const result = await session.transact({action})
                assert.isDefined(result.response)
                assetValidTransactResponse(result)
            })
            test('true', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action}, {broadcast: true})
                assert.isDefined(result.response)
                assetValidTransactResponse(result)
            })
            test('false', async function () {
                const {action, session} = await mockData()
                const result = await session.transact({action}, {broadcast: false})
                assert.isUndefined(result.response)
                assetValidTransactResponse(result)
            })
        })
        suite('expireSeconds', function () {
            test('default: 120', async function () {
                const {action} = await mockData()
                const session = new Session(mockSessionArgs, mockSessionOptions)
                const result = await session.transact({action}, {broadcast: false})
                // Get the chain info to get the current head block time from test cache
                const {head_block_time} = await session.client.v1.chain.get_info()
                const expectedExpiration = head_block_time.toMilliseconds() + 120 * 1000
                assert.equal(
                    String(result.transaction?.expiration),
                    String(TimePointSec.fromMilliseconds(expectedExpiration))
                )
            })
            test('override: 60', async function () {
                const {action} = await mockData()
                const session = new Session(mockSessionArgs, mockSessionOptions)
                const expireSeconds = 60
                const result = await session.transact({action}, {broadcast: false, expireSeconds})
                // Get the chain info to get the current head block time from test cache
                const {head_block_time} = await session.client.v1.chain.get_info()
                const expectedExpiration = head_block_time.toMilliseconds() + expireSeconds * 1000
                assert.equal(
                    String(result.transaction?.expiration),
                    String(TimePointSec.fromMilliseconds(expectedExpiration))
                )
            })
        })
        suite('transactPlugins', function () {
            test('inherit', async function () {
                const {action} = await mockData()
                const session = new Session(mockSessionArgs, {
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
            test('override (class)', async function () {
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
            test('override (function)', async function () {
                const {action, session} = await mockData()
                // Pass in a simple hook to log after broadcast
                const debugHook = async (request: SigningRequest, context: TransactContext) => {
                    // Log the output
                    if (context.transactPluginsOptions.logging) {
                        // eslint-disable-next-line no-console
                        console.log(Serializer.objectify(request.getRawTransaction()))
                    }
                    // Return the request and no additional signatures
                    return {
                        request,
                        signatures: [],
                    }
                }
                const debugPlugin = {
                    id: 'debug-plugin',
                    register(context) {
                        context.addHook(TransactHookTypes.beforeSign, debugHook)
                        context.addHook(TransactHookTypes.afterSign, debugHook)
                        context.addHook(TransactHookTypes.afterBroadcast, debugHook)
                    },
                }
                // enable logging plugin
                const result = await session.transact(
                    {action},
                    {
                        transactPlugins: [new MockTransactResourceProviderPlugin(), debugPlugin],
                        transactPluginsOptions: {logging: false},
                    }
                )
                assetValidTransactResponse(result)
                if (result && result.transaction && result.transaction.actions) {
                    assert.lengthOf(result.transaction.actions, 2)
                } else {
                    assert.fail('Transaction with actions was not returned in result.')
                }
            })
        })
        suite('transactPluginsOptions', function () {
            test('transact', async function () {
                const {action} = await mockData()
                const session = new Session(mockSessionArgs, {
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
                const session = new Session(mockSessionArgs, {
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
                const sessionKit = new SessionKit(
                    {
                        appName: 'demo.app',
                        chains: [
                            {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                        ],
                        ui: new MockUserInterface(),
                        walletPlugins: [makeWallet()],
                    },
                    {
                        fetch: mockFetch, // Required for unit tests
                        storage: new MockStorage(),
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                        transactPluginsOptions: {
                            disableExamplePlugin: true,
                        },
                    }
                )
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
                })
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
                const sessionKit = new SessionKit(
                    {
                        appName: 'demo.app',
                        chains: [
                            {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                        ],
                        ui: new MockUserInterface(),
                        walletPlugins: [makeWallet()],
                    },
                    {
                        fetch: mockFetch, // Required for unit tests
                        storage: new MockStorage(),
                        transactPlugins: [new MockTransactResourceProviderPlugin()],
                    }
                )
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
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
    suite('plugins', function () {
        test('trigger', async function () {
            const {action, session} = await mockData()
            const result = await session.transact(
                {action},
                {transactPlugins: [new MockTransactPlugin()]}
            )
            assetValidTransactResponse(result)
        })
        test('multiple modifications', async function () {
            const {action, session} = await mockData()
            const result = await session.transact(
                {action},
                {
                    transactPlugins: [
                        mockTransactActionPrependerPlugin,
                        mockTransactActionPrependerPlugin,
                    ],
                }
            )
            assetValidTransactResponse(result)
            if (result && result.transaction && result.transaction.actions) {
                assert.lengthOf(result.transaction.actions, 3)
                assert.isTrue(result.transaction.actions[0].account.equals('greymassnoop'))
                assert.isTrue(result.transaction.actions[1].account.equals('greymassnoop'))
                assert.isTrue(result.transaction.actions[2].account.equals('eosio.token'))
                // Ensure these two authorizations are random and not the same
                assert.isTrue(
                    !result.transaction.actions[0].authorization[0].actor.equals(
                        result.transaction.actions[1].authorization[0].actor
                    )
                )
            } else {
                assert.fail('Transaction with actions was not returned in result.')
            }
        })
        test('metadata persists through mutation', async function () {
            const {session} = await mockData()
            const result = await session.transact(
                {
                    request:
                        'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRgEnjpsHS30fM4DAhI2nLGACDRsnxsWq9Z6yZAVLMbC4-geDaPHyjMSitOzMEoXMYoWSjFSFpNTiEgUbY0YGRua0_HzmpMQiAA',
                },
                {
                    broadcast: false,
                    transactPlugins: [mockTransactActionPrependerPlugin],
                }
            )
            assert.equal(result.request.getInfoKey('foo'), 'bar')
        })
        test('metadata preservation from original', async function () {
            const {session} = await mockData()
            const result = await session.transact(
                {
                    request:
                        'esr://gmNgZGBY1mTC_MoglIGBIVzX5uxZRgEnjpsHS30fM4DAhI2nLGACDRsnxsWq9Z6yZAVLMbC4-geDaPHyjMSitOzMEoXMYoWSjFSFpNTiEgUbY0YGRua0_HzmpMQiAA',
                },
                {
                    broadcast: false,
                    transactPlugins: [mockMetadataFooWriterPlugin],
                }
            )
            assert.equal(result.request.getInfoKey('foo'), 'bar')
        })
    })
    suite('response', function () {
        test('type check', async function () {
            const {session, transaction} = await mockData()
            const result = await session.transact(transaction, {broadcast: false})
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
                const resolvedPermission = result.transaction.actions[0].authorization[0]
                const resolvedData = Transfer.from(result.transaction.actions[0].data)
                const expectedPermission = PermissionLevel.from(mockPermissionLevel)
                // Ensure transaction authority was templated
                assert.isTrue(resolvedPermission.actor.equals(expectedPermission.actor))
                assert.isTrue(resolvedPermission.permission.equals(expectedPermission.permission))
                // Ensure transaction data was templated
                assert.isTrue(resolvedData.from.equals(expectedPermission.actor))
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
            if (resolved) {
                const resolvedPermission = resolved.transaction.actions[0].authorization[0]
                const expectedPermission = PermissionLevel.from(mockPermissionLevel)
                assert.isTrue(resolvedPermission.actor.equals(expectedPermission.actor))
                assert.isTrue(resolvedPermission.permission.equals(expectedPermission.permission))
            }
        })
        test('valid signatures', async function () {
            const {action, session} = await mockData()
            const result = await session.transact({action})
            const transaction = result.resolved?.transaction
            if (transaction) {
                const digest = transaction.signingDigest(mockSessionArgs.chain.id)
                const [signature] = result.signatures
                const publicKey = signature.recoverDigest(digest)
                assert.isTrue(publicKey.equals(wallet.data.privateKey.toPublic()))
            } else {
                assert.fail('Transaction was not resolved from request.')
            }
        })
    })
})
