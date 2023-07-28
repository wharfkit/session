import {assert} from 'chai'
import {Checksum256, PermissionLevel, TimePointSec} from '@wharfkit/antelope'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {
    BaseTransactPlugin,
    ChainDefinition,
    Chains,
    ExplorerDefinition,
    Logo,
    Session,
    SessionKit,
    UserInterfaceLoginResponse,
} from '$lib'

import {makeWallet, MockWalletPluginConfigs} from '@wharfkit/mock-data'
import {MockTransactPlugin} from '@wharfkit/mock-data'
import {makeMockAction} from '@wharfkit/mock-data'
import {
    mockChainDefinition,
    mockChainDefinitions,
    mockChainId,
    mockPermissionLevel,
} from '@wharfkit/mock-data'
import {MockUserInterface} from '@wharfkit/mock-data'
import {mockSessionKit, mockSessionKitArgs, mockSessionKitOptions} from '@wharfkit/mock-data'
import {MockStorage} from '@wharfkit/mock-data'

const action = makeMockAction()

const defaultLoginOptions = {
    chain: mockChainId,
    permissionLevel: mockPermissionLevel,
}

function assertSessionMatchesMockSession(session: Session) {
    assert.instanceOf(session, Session)
    assert.equal(session.appName, mockSessionKitArgs.appName)
    assert.equal(session.allowModify, true)
    assert.equal(session.broadcast, true)
    assert.equal(session.expireSeconds, 120)
    assert.isTrue(session.chain.equals(mockChainDefinitions[0]))
    assert.instanceOf(session.walletPlugin, WalletPluginPrivateKey)
}

suite('kit', function () {
    let sessionKit
    setup(async function () {
        sessionKit = new SessionKit(mockSessionKitArgs, mockSessionKitOptions)
        await sessionKit.logout()
    })
    suite('construct', function () {
        test('instance', function () {
            assert.instanceOf(sessionKit, SessionKit)
        })
        suite('args', function () {
            test('Chains definitions', async function () {
                const kit = new SessionKit(
                    {
                        ...mockSessionKitArgs,
                        chains: [Chains.Jungle4, Chains.EOS],
                    },
                    mockSessionKitOptions
                )
                const result = await kit.login({chain: Chains.EOS.id})
                assert.isTrue(result.response.chain.equals(Chains.EOS.id))
            })
        })
        suite('options', function () {
            suite('abis', function () {
                test('passing for all sessions', async function () {
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
                    const sessionKit = new SessionKit(mockSessionKitArgs, {
                        ...mockSessionKitOptions,
                        abis: [
                            {
                                account: 'eosio.token',
                                abi,
                            },
                        ],
                    })
                    assert.lengthOf(sessionKit.abis, 1)
                    const {session} = await sessionKit.login()
                    assert.lengthOf(session.abis, 1)
                })
            })
            suite('expireSeconds', function () {
                test('default: 120', async function () {
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
                    const sessionKit = new SessionKit(mockSessionKitArgs, {
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
                    assert.lengthOf(sessionKit.transactPlugins, 1)
                    assert.instanceOf(sessionKit.transactPlugins[0], BaseTransactPlugin)
                })
                test('override', async function () {
                    const sessionKit = new SessionKit(mockSessionKitArgs, {
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
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
        })
        suite('options', function () {
            suite('chain', function () {
                test('override', async function () {
                    const chain = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
                    const {session} = await sessionKit.login({
                        ...defaultLoginOptions,
                        chain,
                    })
                    assert.isTrue(session.chain.id.equals(chain))
                })
                test('throws on unknown', async function () {
                    assert.throws(() =>
                        sessionKit.getChainDefinition(
                            'c054efbc59625be7ce0d69ef26124fd349420b98fef2ed23fead4c558b9826b1'
                        )
                    )
                })
            })
            suite('chains', function () {
                test('specify subset', async function () {
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
                test('default logo', async function () {
                    const sessionKit = new SessionKit(
                        {
                            ...mockSessionKitArgs,
                            chains: [
                                {
                                    id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                                    url: 'https://telos.greymass.com',
                                    logo: 'https://assets.wharfkit.com/chain/telos.png',
                                },
                            ],
                        },
                        mockSessionKitOptions
                    )
                    assert.instanceOf(sessionKit.chains[0], ChainDefinition)
                    assert.instanceOf(sessionKit.chains[0].id, Checksum256)
                    assert.instanceOf(sessionKit.chains[0].logo, Logo)
                    assert.equal(
                        String(sessionKit.chains[0].logo),
                        'https://assets.wharfkit.com/chain/telos.png'
                    )
                    assert.isString(sessionKit.chains[0].name)
                })
                test('specify logo', async function () {
                    const sessionKit = new SessionKit(
                        {
                            ...mockSessionKitArgs,
                            chains: [
                                {
                                    id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
                                    url: 'https://telos.greymass.com',
                                    logo: 'https://assets.wharfkit.com/chain/eos.png',
                                    explorer: {
                                        prefix: 'https://explorer.telos.net/transaction/',
                                        suffix: '',
                                        url: (id) => this.prefix + id + this.suffix,
                                    },
                                },
                            ],
                        },
                        mockSessionKitOptions
                    )
                    assert.instanceOf(sessionKit.chains[0], ChainDefinition)
                    assert.instanceOf(sessionKit.chains[0].id, Checksum256)
                    assert.instanceOf(sessionKit.chains[0].logo, Logo)
                    assert.equal(
                        String(sessionKit.chains[0].logo),
                        'https://assets.wharfkit.com/chain/eos.png'
                    )
                    assert.instanceOf(sessionKit.chains[0].explorer, ExplorerDefinition)
                    assert.isString(sessionKit.chains[0].name)
                })
            })
            suite('permissionLevel', function () {
                test('typed', async function () {
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
    suite('logout', function () {
        test('no param', async function () {
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
            const sessionsBeforeLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsBeforeLogout, 1)
            await sessionKit.logout()
            const sessionsAfterLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsAfterLogout, 0)
        })
        test('session param', async function () {
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
            const sessionsBeforeLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsBeforeLogout, 1)
            await sessionKit.logout(session)
            const sessionsAfterLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsAfterLogout, 0)
        })
        test('serialized session param', async function () {
            const {session} = await sessionKit.login()
            assertSessionMatchesMockSession(session)
            const sessionsBeforeLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsBeforeLogout, 1)
            await sessionKit.logout(session.serialize())
            const sessionsAfterLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsAfterLogout, 0)
        })
    })
    suite('restore', function () {
        test('session', async function () {
            const {session} = await sessionKit.login()
            const mockSerializedSession = session.serialize()
            const restored = await mockSessionKit.restore(mockSerializedSession)
            if (!restored) {
                throw new Error('Failed to restore session')
            }
            assertSessionMatchesMockSession(restored)
        })
        test('no session returns undefined', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const restored = await sessionKit.restore()
            assert.isUndefined(restored)
        })
        test('can restore with just actor, permission, and chainId', async function () {
            const {session} = await sessionKit.login()
            const mockSerializedSession = session.serialize()
            const restored = await mockSessionKit.restore({
                actor: mockSerializedSession.actor,
                permission: mockSerializedSession.permission,
                chain: mockSerializedSession.chain,
            })
            if (!restored) {
                throw new Error('Failed to restore session')
            }
            assertSessionMatchesMockSession(restored)
        })
        test('throws if wallet not found', async function () {
            const sessionKit = new SessionKit(
                {
                    ...mockSessionKitArgs,
                    walletPlugins: [new MockWalletPluginConfigs()],
                },
                mockSessionKitOptions
            )
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
    suite('restoreAll', function () {
        test('restores no sessions', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const restored = await sessionKit.restore()
            assert.isUndefined(restored)
            const sessions = await sessionKit.getSessions()
            assert.isEmpty(sessions)
        })
        test('restores all sessions', async function () {
            // New kit w/ empty storage
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            // Login 3 times
            await sessionKit.login({
                chain: mockChainDefinition.id,
                permissionLevel: PermissionLevel.from('mock1@interface'),
            })
            await sessionKit.login({
                chain: mockChainDefinition.id,
                permissionLevel: PermissionLevel.from('mock2@interface'),
            })
            await sessionKit.login({
                chain: mockChainDefinition.id,
                permissionLevel: PermissionLevel.from('mock3@interface'),
            })
            // Restore all sessions
            const sessions = await sessionKit.restoreAll()
            // Assert 3 sessions restored
            assert.lengthOf(sessions, 3)
            assert.instanceOf(sessions[0], Session)
            assert.isTrue(sessions[0].actor.equals('mock1'))
            assert.instanceOf(sessions[1], Session)
            assert.isTrue(sessions[1].actor.equals('mock2'))
            assert.instanceOf(sessions[2], Session)
            assert.isTrue(sessions[2].actor.equals('mock3'))
        })
    })
    suite('ui', function () {
        test('default', async function () {
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        test('override', async function () {
            const sessionKit = new SessionKit(
                {...mockSessionKitArgs, ui: new MockUserInterface()},
                mockSessionKitOptions
            )
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const {session} = await sessionKit.login(defaultLoginOptions)
            assert.instanceOf(session.ui, MockUserInterface)
        })
        suite('onSelectWallet', function () {
            test('if 1 walletPlugin, use it without UI selection', async function () {
                const sessionKit = new SessionKit(
                    {
                        ...mockSessionKitArgs,
                        walletPlugins: [makeWallet()],
                    },
                    mockSessionKitOptions
                )
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('if >1 walletPlugin, force selection', async function () {
                const sessionKit = new SessionKit(
                    {
                        ...mockSessionKitArgs,
                        walletPlugins: [makeWallet(), makeWallet()],
                    },
                    mockSessionKitOptions
                )
                const {session} = await sessionKit.login({
                    permissionLevel: mockPermissionLevel,
                })
                assertSessionMatchesMockSession(session)
            })
            test('walletPlugin returning invalid index throws', async function () {
                class FailingUI extends MockUserInterface {
                    async login(): Promise<UserInterfaceLoginResponse> {
                        return {
                            chainId: mockChainId,
                            permissionLevel: PermissionLevel.from(mockPermissionLevel),
                            walletPluginIndex: 999999,
                        }
                    }
                }
                const sessionKit = new SessionKit(
                    {
                        ...mockSessionKitArgs,
                        ui: new FailingUI(),
                        walletPlugins: [makeWallet(), makeWallet()],
                    },
                    mockSessionKitOptions
                )
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
