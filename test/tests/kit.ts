import {assert} from 'chai'

import {
    BaseTransactPlugin,
    Session,
    SessionKit,
    SessionKitOptions,
    WalletPluginPrivateKey,
} from '$lib'
import {Checksum256, PermissionLevel, PrivateKey, TimePointSec} from '@greymass/eosio'

import {makeWallet} from '$test/utils/mock-wallet'
import {MockTransactPlugin} from '$test/utils/mock-hook'
import {makeMockAction} from '$test/utils/mock-transfer'
import {mockFetch} from '$test/utils/mock-fetch'
import {mockChainId, mockPermissionLevel, mockPrivateKey} from '$test/utils/mock-config'
import {UserInterfaceHeadless} from 'src/plugins/userinterface/headless'
import {MockUserInterface} from '$test/utils/mock-userinterface'

const action = makeMockAction()

const defaultSessionKitOptions: SessionKitOptions = {
    appName: 'demo.app',
    chains: [
        {
            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
            url: 'https://jungle4.greymass.com',
        },
        {
            id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
            url: 'https://eos.greymass.com',
        },
        {
            id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
            url: 'https://telos.greymass.com',
        },
        {
            id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
            url: 'https://wax.greymass.com',
        },
        {
            id: '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
            url: 'https://mockuserinterface.greymass.com',
        },
    ],
    fetch: mockFetch, // Required for unit tests
    ui: new MockUserInterface(),
    walletPlugins: [makeWallet()],
}

const defaultLoginOptions = {
    chain: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
    permissionLevel: mockPermissionLevel,
}

function assertSessionMatchesMockSession(session: Session) {
    assert.instanceOf(session, Session)
    assert.isTrue(session.appName?.equals(defaultSessionKitOptions.appName))
    assert.equal(session.allowModify, true)
    assert.equal(session.broadcast, true)
    assert.equal(session.expireSeconds, 120)
    assert.isTrue(session.chain.equals(defaultSessionKitOptions.chains[4]))
    assert.instanceOf(session.wallet, WalletPluginPrivateKey)
}

suite('kit', function () {
    suite('construct', function () {
        test('instance', function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            assert.instanceOf(sessionKit, SessionKit)
        })
        suite('options', function () {
            suite('expireSeconds', function () {
                test('default: 120', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const {session} = await sessionKit.login(defaultLoginOptions)
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
                    const sessionKit = new SessionKit({
                        ...defaultSessionKitOptions,
                        expireSeconds: 60,
                    })
                    const {session} = await sessionKit.login(defaultLoginOptions)
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
            suite('transactPlugins', function () {
                test('default', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    assert.lengthOf(sessionKit.transactPlugins, 1)
                    assert.instanceOf(sessionKit.transactPlugins[0], BaseTransactPlugin)
                })
                test('override', async function () {
                    const sessionKit = new SessionKit({
                        ...defaultSessionKitOptions,
                        transactPlugins: [new MockTransactPlugin()],
                    })
                    assert.lengthOf(sessionKit.transactPlugins, 1)
                    assert.instanceOf(sessionKit.transactPlugins[0], MockTransactPlugin)
                })
            })
        })
    })
    suite('login', function () {
        test('default', async function () {
            const sessionKit = new SessionKit({...defaultSessionKitOptions})
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
        })
        suite('options', function () {
            suite('chain', function () {
                test('override', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const chain = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        chain,
                    })
                    assert.isTrue(session.chain.id.equals(chain))
                })
                test('throws on unknown', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    assert.throws(() =>
                        sessionKit.getChainDefinition(
                            'c054efbc59625be7ce0d69ef26124fd349420b98fef2ed23fead4c558b9826b1'
                        )
                    )
                })
            })
            suite('chains', function () {
                test('specify subset', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        chain: undefined,
                        chains: [
                            '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
                            '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                            '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
                        ],
                    })
                    assert.isTrue(
                        session.chain.id.equals(
                            '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590'
                        )
                    )
                })
                test('specify subset, wallet returns invalid ID choice', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    let error
                    try {
                        await sessionKit.login({
                            ...defaultLoginOptions,
                            chain: undefined,
                            chains: [
                                '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
                                '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                            ],
                        })
                    } catch (err: unknown) {
                        error = err
                    }
                    assert.instanceOf(
                        error,
                        Error,
                        'Login should throw with an unknown chain ID returned'
                    )
                })
                test('specify subset, specify selection', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        chain: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                        chains: [
                            '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
                            '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                        ],
                    })
                    assert.isTrue(
                        session.chain.id.equals(
                            '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11'
                        )
                    )
                })
            })
            suite('permissionLevel', function () {
                test('typed', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        permissionLevel: PermissionLevel.from('mock@interface'),
                    })
                    assert.instanceOf(session, Session)
                    assert.isTrue(
                        PermissionLevel.from('mock@interface').equals(session.permissionLevel)
                    )
                })
                test('untyped', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const result = await sessionKit.login({
                        ...defaultLoginOptions,
                        permissionLevel: 'mock@interface',
                    })
                    assert.instanceOf(result.session, Session)
                    assert.isTrue(
                        PermissionLevel.from('mock@interface').equals(
                            result.response.permissionLevel
                        )
                    )
                })
            })
        })
    })
    suite('ui', function () {
        test('default', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        test('override', async function () {
            const sessionKit = new SessionKit({
                ...defaultSessionKitOptions,
                ui: new MockUserInterface(),
            })
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        suite('onSelectWallet', function () {
            test('if 1 walletPlugin, use it without UI selection', async function () {
                const sessionKit = new SessionKit({
                    ...defaultSessionKitOptions,
                    ui: new UserInterfaceHeadless(),
                    walletPlugins: [makeWallet()],
                })
                const {session} = await sessionKit.login({
                    chain: '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('if >1 walletPlugin, force selection', async function () {
                const sessionKit = new SessionKit({
                    ...defaultSessionKitOptions,
                    walletPlugins: [makeWallet(), makeWallet()],
                })
                const {session} = await sessionKit.login({
                    chain: '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('walletPlugin returning invalid index throws', async function () {
                class FailingUI extends MockUserInterface {
                    async onSelectWallet(): Promise<number> {
                        return 999999
                    }
                }
                const sessionKit = new SessionKit({
                    ...defaultSessionKitOptions,
                    ui: new FailingUI(),
                    walletPlugins: [makeWallet(), makeWallet()],
                })
                let error
                try {
                    await sessionKit.login()
                } catch (err) {
                    error = err
                }
                assert.instanceOf(error, Error)
            })
        })
    })
})
