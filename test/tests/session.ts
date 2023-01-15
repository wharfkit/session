import {assert} from 'chai'

import SessionKit, {BaseTransactPlugin, ChainDefinition, Session, SessionOptions} from '$lib'
import {PermissionLevel, TimePointSec} from '@greymass/eosio'

import {mockFetch} from '$test/utils/mock-fetch'
import {MockTransactPlugin, MockTransactResourceProviderPlugin} from '$test/utils/mock-hook'
import {nodejsUsage} from './use-cases/general/nodejs'
import {makeMockAction} from '$test/utils/mock-transfer'
import {makeWallet} from '$test/utils/mock-wallet'
import {mockPermissionLevel} from '$test/utils/mock-config'

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
                    const session = await sessionKit.login()
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
                    const session = await sessionKit.login()
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
                    const session = await sessionKit.login({
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
        assert.equal(
            session.accountName,
            PermissionLevel.from(mockSessionOptions.permissionLevel).actor
        )
        assert.equal(
            session.permissionName,
            PermissionLevel.from(mockSessionOptions.permissionLevel).permission
        )
    })
})
