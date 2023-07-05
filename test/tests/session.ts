import {assert} from 'chai'

import SessionKit, {BaseTransactPlugin, ChainDefinition, Session, SessionOptions} from '$lib'
import {
    ABI,
    ABIDef,
    Name,
    NameType,
    PermissionLevel,
    Signature,
    TimePointSec,
} from '@greymass/eosio'

import {mockFetch} from '@wharfkit/mock-data'
import {MockTransactPlugin, MockTransactResourceProviderPlugin} from '@wharfkit/mock-data'
import {nodejsUsage} from './use-cases/general/nodejs'
import {makeMockAction} from '@wharfkit/mock-data'
import {makeWallet} from '@wharfkit/mock-data'
import {mockPermissionLevel} from '@wharfkit/mock-data'
import {MockUserInterface} from '@wharfkit/mock-data'
import {makeClient} from '@wharfkit/mock-data'
import {mockSessionArgs} from '@wharfkit/mock-data'
import {MockStorage} from '@wharfkit/mock-data'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

const wallet = makeWallet()
const action = makeMockAction()

const mockSessionOptions: SessionOptions = {
    broadcast: false, // Disable broadcasting by default for tests, enable when required.
    fetch: mockFetch, // Required for unit tests
}

const mockTransactOptions = {
    transactPlugins: [new MockTransactResourceProviderPlugin()],
}

suite('session', function () {
    let session: Session
    setup(function () {
        // Establish new session before each test
        session = new Session(mockSessionArgs, mockSessionOptions)
    })
    nodejsUsage()
    suite('construct', function () {
        test('instance', function () {
            assert.instanceOf(session, Session)
        })
        suite('options', function () {
            suite('abiCache', function () {
                test('specify provider', function () {
                    const client = makeClient()
                    const abiCache = {
                        foo: 'bar',
                        cache: new Map(),
                        pending: new Map(),
                        getAbi: async (account) =>
                            ABI.from((await client.v1.chain.get_abi(account)).abi as ABIDef),
                        setAbi: () => {},
                    }
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        abiCache,
                    })
                    assert.equal(testSession.abiCache['foo'], 'bar')
                })
            })
            suite('abis', function () {
                test('passing for entire session', async function () {
                    const abi = {
                        version: 'eosio::abi/1.2',
                        types: [],
                        structs: [
                            {
                                name: 'transfer',
                                base: '',
                                fields: [
                                    {
                                        name: 'from',
                                        type: 'name',
                                    },
                                    {
                                        name: 'to',
                                        type: 'name',
                                    },
                                    {
                                        name: 'quantity',
                                        type: 'asset',
                                    },
                                    {
                                        name: 'memo',
                                        type: 'string',
                                    },
                                ],
                            },
                        ],
                        actions: [
                            {
                                name: 'transfer',
                                type: 'transfer',
                                ricardian_contract: '',
                            },
                        ],
                        tables: [],
                        ricardian_clauses: [],
                        error_messages: [],
                        abi_extensions: [],
                        variants: [],
                        action_results: [],
                    }
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        abis: [
                            {
                                account: 'eosio.token',
                                abi,
                            },
                        ],
                    })
                    assert.lengthOf(testSession.abis, 1)
                })
            })
            suite('allowModify', function () {
                test('default: true', async function () {
                    const result = await session.transact({action}, mockTransactOptions)
                    if (result && result.transaction && result.transaction.actions) {
                        assert.lengthOf(result.transaction.actions, 2)
                    } else {
                        assert.fail('Transaction with actions was not returned in result.')
                    }
                })
                test('true', async function () {
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        allowModify: true,
                    })
                    const result = await testSession.transact({action}, mockTransactOptions)
                    if (result && result.transaction && result.transaction.actions) {
                        assert.lengthOf(result.transaction.actions, 2)
                    } else {
                        assert.fail('Transaction with actions was not returned in result.')
                    }
                })
                test('false', async function () {
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        allowModify: false,
                    })
                    const result = await testSession.transact({action}, mockTransactOptions)
                    if (result && result.transaction && result.transaction.actions) {
                        assert.lengthOf(result.transaction.actions, 1)
                    } else {
                        assert.fail('Transaction with actions was not returned in result.')
                    }
                })
            })
            suite('broadcast', function () {
                test('default: true', async function () {
                    const testSession = new Session(mockSessionArgs, {
                        fetch: mockSessionOptions.fetch,
                    })
                    const result = await testSession.transact({action})
                    assert.isDefined(result.response)
                })
                test('true', async function () {
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        broadcast: true,
                    })
                    const result = await testSession.transact({action}, {broadcast: true})
                    assert.isDefined(result.response)
                })
                test('false', async function () {
                    const testSession = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        broadcast: false,
                    })
                    const result = await testSession.transact({action}, {broadcast: false})
                    assert.isUndefined(result.response)
                })
            })
            suite('expireSeconds', function () {
                test('default: 120', async function () {
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
                    const session = new Session(mockSessionArgs, {
                        ...mockSessionOptions,
                        expireSeconds: 60,
                    })
                    const expireSeconds = 60
                    const result = await session.transact({action}, {broadcast: false})
                    // Get the chain info to get the current head block time from test cache
                    const {head_block_time} = await session.client.v1.chain.get_info()
                    const expectedExpiration =
                        head_block_time.toMilliseconds() + expireSeconds * 1000
                    assert.equal(
                        String(result.transaction?.expiration),
                        String(TimePointSec.fromMilliseconds(expectedExpiration))
                    )
                })
            })
            // TODO: Implement for code coverage. This doesn't throw in v18+
            // suite('fetch', function () {
            //     test('unset', function () {
            //         assert.throw(
            //             () =>
            //                 new Session({
            //                     chain: ChainDefinition.from({
            //                         id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
            //                         url: 'https://jungle4.greymass.com',
            //                     }),
            //                     expireSeconds: 60,
            //                     permissionLevel: PermissionLevel.from(mockPermissionLevel),
            //                     walletPlugin: wallet,
            //                 })
            //         )
            //     })
            // })
            suite('authority', function () {
                suite('actor + permission', function () {
                    test('typed values', async function () {
                        const testSession = new Session(
                            {
                                ...mockSessionArgs,
                                actor: Name.from('account'),
                                permissionLevel: undefined,
                                permission: Name.from('permission'),
                            },
                            mockSessionOptions
                        )
                        assert.instanceOf(testSession, Session)
                    })
                    test('untyped values', async function () {
                        const testSession = new Session(
                            {
                                ...mockSessionArgs,
                                actor: 'account',
                                permissionLevel: undefined,
                                permission: 'permission',
                            },
                            mockSessionOptions
                        )
                        assert.instanceOf(testSession, Session)
                    })
                })
                suite('permissionLevel', function () {
                    test('typed values', async function () {
                        const testSession = new Session(
                            {
                                ...mockSessionArgs,
                                permissionLevel: PermissionLevel.from('account@permission'),
                            },
                            mockSessionOptions
                        )
                        assert.instanceOf(testSession, Session)
                    })
                    test('untyped values', async function () {
                        const testSession = new Session(
                            {
                                ...mockSessionArgs,
                                permissionLevel: 'account@permission',
                            },
                            mockSessionOptions
                        )
                        assert.instanceOf(testSession, Session)
                    })
                })
                test('undefined', function () {
                    assert.throws(() => {
                        new Session(
                            {
                                ...mockSessionArgs,
                                actor: undefined,
                                permissionLevel: undefined,
                                permission: undefined,
                            },
                            mockSessionOptions
                        )
                    })
                })
            })
            suite('passed as', function () {
                test('typed values', async function () {
                    const testSession = new Session(
                        {
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            permissionLevel: PermissionLevel.from('account@permission'),
                            walletPlugin: wallet,
                        },
                        mockSessionOptions
                    )
                    assert.instanceOf(testSession, Session)
                })
                test('untyped values', async function () {
                    const testSession = new Session(
                        {
                            chain: {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                            permissionLevel: 'account@permission',
                            walletPlugin: wallet,
                        },
                        mockSessionOptions
                    )
                    assert.instanceOf(testSession, Session)
                })
            })
            suite('transactPlugins', function () {
                test('default', async function () {
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
                        }
                    )
                    const {session} = await sessionKit.login({
                        permissionLevel: mockPermissionLevel,
                    })
                    assert.instanceOf(session, Session)
                    assert.lengthOf(session.transactPlugins, 1)
                    assert.instanceOf(session.transactPlugins[0], BaseTransactPlugin)
                })
                test('inherit', async function () {
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
                            transactPlugins: [new MockTransactPlugin()],
                        }
                    )
                    const {session} = await sessionKit.login({permissionLevel: mockPermissionLevel})
                    assert.instanceOf(session, Session)
                    assert.lengthOf(session.transactPlugins, 1)
                    assert.instanceOf(session.transactPlugins[0], MockTransactPlugin)
                })
                test('override', async function () {
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
                        }
                    )
                    const {session} = await sessionKit.login({
                        permissionLevel: mockPermissionLevel,
                        transactPlugins: [new MockTransactPlugin()],
                    })
                    assert.instanceOf(session, Session)
                    assert.lengthOf(session.transactPlugins, 1)
                    assert.instanceOf(session.transactPlugins[0], MockTransactPlugin)
                })
            })
        })
    })
    test('getters', function () {
        const expectedPermission = PermissionLevel.from(mockPermissionLevel)
        // Ensure transaction authority was templated
        assert.isTrue(session.actor.equals(expectedPermission.actor))
        assert.isTrue(session.permission.equals(expectedPermission.permission))
    })
    suite('ui', function () {
        test('override', async function () {
            const testSession = new Session(mockSessionArgs, {
                ...mockSessionOptions,
                ui: new MockUserInterface(),
            })
            assert.instanceOf(testSession.ui, MockUserInterface)
        })
    })
    suite('serialize', function () {
        test('returns valid json string', function () {
            const original = new Session(mockSessionArgs, mockSessionOptions)
            const serialized = original.serialize()
            assert.equal(
                JSON.stringify(serialized),
                JSON.stringify({
                    chain: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                    actor: 'wharfkit1111',
                    permission: 'test',
                    walletPlugin: {
                        id: 'wallet-plugin-privatekey',
                        data: {
                            privateKey: 'PVT_K1_25XP1Lt1Rt87hyymouSieBbgnUEAerS1yQHi9wqHC2Uek2mgzH',
                        },
                    },
                })
            )
            assert.doesNotThrow(() => {
                JSON.stringify(serialized)
            })
        })
    })
    suite('sign transaction', function () {
        test('able to sign transaction', async function () {
            // Start with a Session
            const testSession = new Session(
                {
                    chain: {
                        id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                        url: 'https://jungle4.greymass.com',
                    },
                    permissionLevel: 'account@permission',
                    walletPlugin: new WalletPluginPrivateKey(
                        '5Jtoxgny5tT7NiNFp1MLogviuPJ9NniWjnU4wKzaX4t7pL4kJ8s'
                    ),
                },
                {
                    fetch: mockFetch,
                }
            )
            // Get a fully formed transaction from mockData for use offline
            // This is actually an eosio.token:transfer, with a renamed contract/action to break unittest caching
            const transaction = {
                expiration: '2022-12-07T22:39:44',
                ref_block_num: 2035,
                ref_block_prefix: 2373626664,
                max_net_usage_words: 0,
                max_cpu_usage_ms: 0,
                delay_sec: 0,
                context_free_actions: [],
                actions: [
                    {
                        account: 'foo',
                        name: 'bar',
                        authorization: [
                            {
                                actor: 'wharfkit1111',
                                permission: 'test',
                            },
                        ],
                        data: '104208d9c1754de380b1915e5d268dca390500000000000004454f53000000001777686172666b6974206973207468652062657374203c33',
                    },
                ],
                transaction_extensions: [],
            }
            // Retrieve the signature(s), do not use the transact method path.
            const signatures = await testSession.signTransaction(transaction)
            // Ensure data is good
            assert.isArray(signatures)
            assert.instanceOf(signatures[0], Signature)
        })
    })
})
