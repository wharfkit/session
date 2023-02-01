import {assert} from 'chai'

import SessionKit, {
    ABICache,
    BaseTransactPlugin,
    ChainDefinition,
    Session,
    SessionOptions,
} from '$lib'
import {ABIDef, Name, PermissionLevel, TimePointSec} from '@greymass/eosio'

import {mockFetch} from '$test/utils/mock-fetch'
import {MockTransactPlugin, MockTransactResourceProviderPlugin} from '$test/utils/mock-hook'
import {nodejsUsage} from './use-cases/general/nodejs'
import {makeMockAction} from '$test/utils/mock-transfer'
import {makeWallet} from '$test/utils/mock-wallet'
import {mockPermissionLevel} from '$test/utils/mock-config'
import {UserInterfaceHeadless} from 'src/plugins/userinterface/headless'
import {MockUserInterface} from '$test/utils/mock-userinterface'
import {makeClient} from '$test/utils/mock-client'

const wallet = makeWallet()
const action = makeMockAction()

const mockSessionOptions: SessionOptions = {
    broadcast: false, // Disable broadcasting by default for tests, enable when required.
    chain: ChainDefinition.from({
        id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        url: 'https://jungle4.greymass.com',
    }),
    fetch: mockFetch, // Required for unit tests
    permissionLevel: PermissionLevel.from(mockPermissionLevel),
    walletPlugin: wallet,
}

const mockTransactOptions = {
    transactPlugins: [new MockTransactResourceProviderPlugin()],
}

suite('session', function () {
    let session: Session
    setup(function () {
        // Establish new session before each test
        session = new Session(mockSessionOptions)
    })
    nodejsUsage()
    suite('construct', function () {
        test('instance', function () {
            assert.instanceOf(session, Session)
        })
        suite('options', function () {
            suite('abiProvider', function () {
                test('specify provider', function () {
                    const client = makeClient()
                    const abiProvider = {
                        foo: 'bar',
                        getAbi: async (account) =>
                            (await client.v1.chain.get_abi(account)).abi as ABIDef,
                    }
                    const testSession = new Session({
                        abiProvider,
                        chain: ChainDefinition.from({
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        }),
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: PermissionLevel.from(mockPermissionLevel),
                        walletPlugin: wallet,
                    })
                    assert.equal(testSession.abiProvider['foo'], 'bar')
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
                    const testSession = new Session({
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
                    const testSession = new Session({
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
                    const testSession = new Session({
                        chain: ChainDefinition.from({
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        }),
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: PermissionLevel.from(mockPermissionLevel),
                        walletPlugin: wallet,
                    })
                    const result = await testSession.transact({action})
                    assert.isDefined(result.response)
                })
                test('true', async function () {
                    const testSession = new Session({
                        ...mockSessionOptions,
                        broadcast: true,
                    })
                    const result = await testSession.transact({action}, {broadcast: true})
                    assert.isDefined(result.response)
                })
                test('false', async function () {
                    const testSession = new Session({
                        ...mockSessionOptions,
                        broadcast: false,
                    })
                    const result = await testSession.transact({action}, {broadcast: false})
                    assert.isUndefined(result.response)
                })
            })
            suite('expireSeconds', function () {
                test('default: 120', async function () {
                    const session = new Session({
                        chain: ChainDefinition.from({
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        }),
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: PermissionLevel.from(mockPermissionLevel),
                        walletPlugin: wallet,
                    })
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
                    const session = new Session({
                        chain: ChainDefinition.from({
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        }),
                        expireSeconds: 60,
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: PermissionLevel.from(mockPermissionLevel),
                        walletPlugin: wallet,
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
                        const testSession = new Session({
                            actor: Name.from('account'),
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            fetch: mockFetch, // Required for unit tests
                            permission: Name.from('permission'),
                            walletPlugin: wallet,
                        })
                        assert.instanceOf(testSession, Session)
                    })
                    test('untyped values', async function () {
                        const testSession = new Session({
                            actor: 'account',
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            fetch: mockFetch, // Required for unit tests
                            permission: 'permission',
                            walletPlugin: wallet,
                        })
                        assert.instanceOf(testSession, Session)
                    })
                })
                suite('permissionLevel', function () {
                    test('typed values', async function () {
                        const testSession = new Session({
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            fetch: mockFetch, // Required for unit tests
                            permissionLevel: PermissionLevel.from('account@permission'),
                            walletPlugin: wallet,
                        })
                        assert.instanceOf(testSession, Session)
                    })
                    test('untyped values', async function () {
                        const testSession = new Session({
                            actor: 'account',
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            fetch: mockFetch, // Required for unit tests
                            permissionLevel: 'account@permission',
                            walletPlugin: wallet,
                        })
                        assert.instanceOf(testSession, Session)
                    })
                })
                test('undefined', function () {
                    assert.throws(() => {
                        new Session({
                            actor: 'account',
                            chain: ChainDefinition.from({
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            }),
                            fetch: mockFetch, // Required for unit tests
                            walletPlugin: wallet,
                        })
                    })
                })
            })
            suite('passed as', function () {
                test('typed values', async function () {
                    const testSession = new Session({
                        chain: ChainDefinition.from({
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        }),
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: PermissionLevel.from('account@permission'),
                        walletPlugin: wallet,
                    })
                    assert.instanceOf(testSession, Session)
                })
                test('untyped values', async function () {
                    const testSession = new Session({
                        chain: {
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        },
                        fetch: mockFetch, // Required for unit tests
                        permissionLevel: 'account@permission',
                        walletPlugin: wallet,
                    })
                    assert.instanceOf(testSession, Session)
                })
            })
            suite('transactPlugins', function () {
                test('default', async function () {
                    const sessionKit = new SessionKit({
                        appName: 'demo.app',
                        chains: [
                            {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                        ],
                        fetch: mockFetch, // Required for unit tests
                        walletPlugins: [makeWallet()],
                    })
                    const {session} = await sessionKit.login({
                        permissionLevel: mockPermissionLevel,
                    })
                    assert.instanceOf(session, Session)
                    assert.lengthOf(session.transactPlugins, 1)
                    assert.instanceOf(session.transactPlugins[0], BaseTransactPlugin)
                })
                test('inherit', async function () {
                    const sessionKit = new SessionKit({
                        appName: 'demo.app',
                        chains: [
                            {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                        ],
                        fetch: mockFetch, // Required for unit tests
                        transactPlugins: [new MockTransactPlugin()],
                        walletPlugins: [makeWallet()],
                    })
                    const {session} = await sessionKit.login({permissionLevel: mockPermissionLevel})
                    assert.instanceOf(session, Session)
                    assert.lengthOf(session.transactPlugins, 1)
                    assert.instanceOf(session.transactPlugins[0], MockTransactPlugin)
                })
                test('override', async function () {
                    const sessionKit = new SessionKit({
                        appName: 'demo.app',
                        chains: [
                            {
                                id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                                url: 'https://jungle4.greymass.com',
                            },
                        ],
                        fetch: mockFetch, // Required for unit tests
                        walletPlugins: [makeWallet()],
                    })
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
        test('default', async function () {
            assert.instanceOf(session.ui, UserInterfaceHeadless)
        })
        test('override', async function () {
            const testSession = new Session({
                chain: ChainDefinition.from({
                    id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                    url: 'https://jungle4.greymass.com',
                }),
                fetch: mockFetch, // Required for unit tests
                permissionLevel: PermissionLevel.from(mockPermissionLevel),
                ui: new MockUserInterface(),
                walletPlugin: wallet,
            })
            assert.instanceOf(testSession.ui, MockUserInterface)
        })
    })
})
