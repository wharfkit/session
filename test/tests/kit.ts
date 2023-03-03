import {assert} from 'chai'
import {PermissionLevel, TimePointSec} from '@greymass/eosio'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {
    BaseTransactPlugin,
    LoginContext,
    Session,
    SessionKit,
    UserInterfaceLoginResponse,
} from '$lib'

import {makeWallet, MockWalletPluginConfigs} from '$test/utils/mock-wallet'
import {MockTransactPlugin} from '$test/utils/mock-hook'
import {makeMockAction} from '$test/utils/mock-transfer'
import {mockChainDefinitions, mockChainId, mockPermissionLevel} from '$test/utils/mock-config'
import {MockUserInterface} from '$test/utils/mock-userinterface'
import {mockSessionKit, mockSessionKitOptions} from '$test/utils/mock-session'

const action = makeMockAction()

const defaultLoginOptions = {
    chain: mockChainId,
    permissionLevel: mockPermissionLevel,
}

function assertSessionMatchesMockSession(session: Session) {
    assert.instanceOf(session, Session)
    assert.isTrue(session.appName?.equals(mockSessionKitOptions.appName))
    assert.equal(session.allowModify, true)
    assert.equal(session.broadcast, true)
    assert.equal(session.expireSeconds, 120)
    assert.isTrue(session.chain.equals(mockChainDefinitions[0]))
    assert.instanceOf(session.walletPlugin, WalletPluginPrivateKey)
}

suite('kit', function () {
    suite('construct', function () {
        test('instance', function () {
            const sessionKit = new SessionKit(mockSessionKitOptions)
            assert.instanceOf(sessionKit, SessionKit)
        })
        suite('options', function () {
            suite('expireSeconds', function () {
                test('default: 120', async function () {
                    const sessionKit = new SessionKit(mockSessionKitOptions)
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
                        ...mockSessionKitOptions,
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
                    const sessionKit = new SessionKit(mockSessionKitOptions)
                    assert.lengthOf(sessionKit.transactPlugins, 1)
                    assert.instanceOf(sessionKit.transactPlugins[0], BaseTransactPlugin)
                })
                test('override', async function () {
                    const sessionKit = new SessionKit({
                        ...mockSessionKitOptions,
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
            const sessionKit = new SessionKit({...mockSessionKitOptions})
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
        })
        suite('options', function () {
            suite('chain', function () {
                test('override', async function () {
                    const sessionKit = new SessionKit(mockSessionKitOptions)
                    const chain = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        chain,
                    })
                    assert.isTrue(session.chain.id.equals(chain))
                })
                test('throws on unknown', async function () {
                    const sessionKit = new SessionKit(mockSessionKitOptions)
                    assert.throws(() =>
                        sessionKit.getChainDefinition(
                            'c054efbc59625be7ce0d69ef26124fd349420b98fef2ed23fead4c558b9826b1'
                        )
                    )
                })
            })
            suite('chains', function () {
                test('specify subset', async function () {
                    const sessionKit = new SessionKit(mockSessionKitOptions)
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
                            '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4'
                        )
                    )
                })
                test('specify subset, wallet returns invalid ID choice', async function () {
                    const sessionKit = new SessionKit(mockSessionKitOptions)
                    let error
                    try {
                        await sessionKit.login({
                            ...defaultLoginOptions,
                            chain: '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
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
                    const sessionKit = new SessionKit(mockSessionKitOptions)
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
                    const sessionKit = new SessionKit(mockSessionKitOptions)
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
                    const sessionKit = new SessionKit(mockSessionKitOptions)
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
    suite('restore', function () {
        test('session', async function () {
            const sessionKit = new SessionKit({...mockSessionKitOptions})
            const {session} = await sessionKit.login()
            const mockSerializedSession = session.serialize()
            const restored = await mockSessionKit.restore(mockSerializedSession)
            assertSessionMatchesMockSession(restored)
        })
        test('throws if wallet not found', async function () {
            const sessionKit = new SessionKit({
                ...mockSessionKitOptions,
                walletPlugins: [new MockWalletPluginConfigs()],
            })
            const {session} = await sessionKit.login()
            const mockSerializedSession = session.serialize()
            let error
            try {
                await mockSessionKit.restore(mockSerializedSession)
            } catch (err) {
                error = err
            }
            assert.instanceOf(error, Error)
        })
    })
    suite('ui', function () {
        test('default', async function () {
            const sessionKit = new SessionKit(mockSessionKitOptions)
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        test('override', async function () {
            const sessionKit = new SessionKit({
                ...mockSessionKitOptions,
                ui: new MockUserInterface(),
            })
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        suite('onSelectWallet', function () {
            test('if 1 walletPlugin, use it without UI selection', async function () {
                const sessionKit = new SessionKit({
                    ...mockSessionKitOptions,
                    walletPlugins: [makeWallet()],
                })
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('if >1 walletPlugin, force selection', async function () {
                const sessionKit = new SessionKit({
                    ...mockSessionKitOptions,
                    walletPlugins: [makeWallet(), makeWallet()],
                })
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('walletPlugin returning invalid index throws', async function () {
                class FailingUI extends MockUserInterface {
                    async login(context: LoginContext): Promise<UserInterfaceLoginResponse> {
                        return {
                            chainId: mockChainId,
                            permissionLevel: PermissionLevel.from(mockPermissionLevel),
                            walletPluginIndex: 999999,
                        }
                    }
                }
                const sessionKit = new SessionKit({
                    ...mockSessionKitOptions,
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
