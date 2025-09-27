import {assert} from 'chai'
import {Checksum256, Name, PermissionLevel, TimePointSec} from '@wharfkit/antelope'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {
    BaseTransactPlugin,
    ChainDefinition,
    Chains,
    ExplorerDefinition,
    Logo,
    Session,
    SessionKit,
    SessionType,
    UserInterfaceAccountCreationResponse,
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
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)

            const session2 = new Session({
                actor: 'session2',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2)

            const session3 = new Session({
                actor: 'session3',
                permission: 'test',
                chain: Chains.EOS,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session3)

            const sessionsBeforeLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsBeforeLogout, 3)
            assert.equal(sessionsBeforeLogout[0].actor, session1.actor)
            assert.equal(sessionsBeforeLogout[1].actor, session2.actor)
            assert.equal(sessionsBeforeLogout[2].actor, session3.actor)

            await sessionKit.logout(session2)
            const sessionsAfterLogout = await sessionKit.getSessions()
            assert.lengthOf(sessionsAfterLogout, 2)
            assert.equal(sessionsAfterLogout[0].actor, session1.actor)
            assert.equal(sessionsAfterLogout[1].actor, session3.actor)
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
        test('session data', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const {session} = await sessionKit.login()
            session.data.customField = 'data value'
            await sessionKit.persistSession(session)
            const restored = await sessionKit.restore()
            if (!restored) {
                throw new Error('Failed to restore session')
            }
            assert.equal(restored.data.customField, 'data value')
        })
        test('session by chain id (checksum256)', async function () {
            // New kit w/ empty storage
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            // Login 3 times
            await sessionKit.login({
                chain: Chains.WAX.id,
                permissionLevel: PermissionLevel.from('mock1@interface'),
            })
            await sessionKit.login({
                chain: Chains.Jungle4.id,
                permissionLevel: PermissionLevel.from('mock2@interface'),
            })
            await sessionKit.login({
                chain: Chains.EOS.id,
                permissionLevel: PermissionLevel.from('mock3@interface'),
            })
            // Restore all sessions
            const sessions = await sessionKit.restoreAll()
            // Assert 3 sessions restored
            assert.lengthOf(sessions, 3)
            assert.instanceOf(sessions[0], Session)
            assert.isTrue(sessions[0].actor.equals('mock1'))
            assert.isTrue(sessions[0].chain.id.equals(Chains.WAX.id))
            assert.instanceOf(sessions[1], Session)
            assert.isTrue(sessions[1].actor.equals('mock2'))
            assert.isTrue(sessions[1].chain.id.equals(Chains.Jungle4.id))
            assert.instanceOf(sessions[2], Session)
            assert.isTrue(sessions[2].actor.equals('mock3'))
            assert.isTrue(sessions[2].chain.id.equals(Chains.EOS.id))

            const restoredEOS = await sessionKit.restore({chain: Chains.EOS.id})
            assert.isDefined(restoredEOS)
            if (restoredEOS) {
                assert.instanceOf(restoredEOS, Session)
                assert.isTrue(restoredEOS.actor.equals('mock3'))
                assert.isTrue(restoredEOS.chain.id.equals(Chains.EOS.id))
            }

            const restoredJUNGLE = await sessionKit.restore({chain: Chains.Jungle4.id})
            assert.isDefined(restoredJUNGLE)
            if (restoredJUNGLE) {
                assert.instanceOf(restoredJUNGLE, Session)
                assert.isTrue(restoredJUNGLE.actor.equals('mock2'))
                assert.isTrue(restoredJUNGLE.chain.id.equals(Chains.Jungle4.id))
            }
        })
        test('session by chain id (ChainDefinition)', async function () {
            // New kit w/ empty storage
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            // Login 3 times
            await sessionKit.login({
                chain: Chains.WAX.id,
                permissionLevel: PermissionLevel.from('mock1@interface'),
            })
            await sessionKit.login({
                chain: Chains.Jungle4.id,
                permissionLevel: PermissionLevel.from('mock2@interface'),
            })
            await sessionKit.login({
                chain: Chains.EOS.id,
                permissionLevel: PermissionLevel.from('mock3@interface'),
            })
            // Restore all sessions
            const sessions = await sessionKit.restoreAll()
            // Assert 3 sessions restored
            assert.lengthOf(sessions, 3)
            assert.instanceOf(sessions[0], Session)
            assert.isTrue(sessions[0].actor.equals('mock1'))
            assert.isTrue(sessions[0].chain.id.equals(Chains.WAX.id))
            assert.instanceOf(sessions[1], Session)
            assert.isTrue(sessions[1].actor.equals('mock2'))
            assert.isTrue(sessions[1].chain.id.equals(Chains.Jungle4.id))
            assert.instanceOf(sessions[2], Session)
            assert.isTrue(sessions[2].actor.equals('mock3'))
            assert.isTrue(sessions[2].chain.id.equals(Chains.EOS.id))

            const restoredEOS = await sessionKit.restore({chain: Chains.EOS.id})
            assert.isDefined(restoredEOS)
            if (restoredEOS) {
                assert.instanceOf(restoredEOS, Session)
                assert.isTrue(restoredEOS.actor.equals('mock3'))
                assert.isTrue(restoredEOS.chain.id.equals(Chains.EOS.id))
            }

            const restoredJUNGLE = await sessionKit.restore({chain: Chains.Jungle4.id})
            assert.isDefined(restoredJUNGLE)
            if (restoredJUNGLE) {
                assert.instanceOf(restoredJUNGLE, Session)
                assert.isTrue(restoredJUNGLE.actor.equals('mock2'))
                assert.isTrue(restoredJUNGLE.chain.id.equals(Chains.Jungle4.id))
            }
        })
        test('session from URL', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                acceptUrlSession: true,
                storage: new MockStorage(),
            })

            // Mock window object for Node.js environment
            if (typeof globalThis.window === 'undefined') {
                ;(globalThis as any).window = {}
            }

            // Mock window.history for Node.js environment
            if (typeof (globalThis as any).window.history === 'undefined') {
                ;(globalThis as any).window.history = {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    replaceState: () => {},
                }
            }

            // Mock window.location with a writable href property
            if (typeof (globalThis as any).window.location === 'undefined') {
                ;(globalThis as any).window.location = {href: ''}
            } else {
                try {
                    ;(globalThis as any).window.location.href =
                        (globalThis as any).window.location.href || ''
                } catch {
                    ;(globalThis as any).window.location = {href: ''}
                }
            }

            // Ensure no sessions
            const sessions = await sessionKit.restoreAll()
            assert.lengthOf(sessions, 0)

            // Set the href to include an incomingWharfSession parameter
            window.location.href =
                'https://somewhere.com?incomingWharfSession=73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d104208d9c1754de3000000000090b1ca737b226964223a2277616c6c65742d706c7567696e2d707269766174656b6579222c2264617461223a7b22707269766174654b6579223a225056545f4b315f32355850314c7431527438376879796d6f755369654262676e554541657253317951486939777148433255656b326d677a48227d7d010f7b226669656c64223a22666f6f227d'

            // Attempt to restore the session from the URL
            const session = await sessionKit.restore()
            if (!session) {
                throw new Error('Failed to restore session from URL')
            }

            // Ensure session is correct
            assert.isDefined(session)
            assert.isTrue(session.chain.id.equals(mockChainDefinition.id), 'Incorrect chain')
            assert.isTrue(session.actor.equals('wharfkit1111'), 'Incorrect actor')
            assert.isTrue(session.permission.equals('test'), 'Incorrect permission')
            assert.isTrue(
                session.walletPlugin instanceof WalletPluginPrivateKey,
                'Incorrect walletPlugin type'
            )
            assert.equal(session.data.field, 'foo', 'Incorrect session data')
            assert.equal(session.walletPlugin.id, 'wallet-plugin-privatekey')
            assert.equal(
                session.walletPlugin.data.privateKey,
                'PVT_K1_25XP1Lt1Rt87hyymouSieBbgnUEAerS1yQHi9wqHC2Uek2mgzH'
            )

            // Ensure session was persisted to storage
            const sessionsAfter = await sessionKit.restoreAll()
            assert.lengthOf(sessionsAfter, 1)
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
    suite('persistSession', function () {
        test('persists session data', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const {session} = await sessionKit.login()
            const restored = await sessionKit.restore()
            if (!restored) {
                throw new Error('Failed to restore session')
            }
            assert.deepEqual(restored.serialize(), session.serialize())
        })
        test('prevent duplicates', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const {session} = await sessionKit.login()
            await sessionKit.persistSession(session)
            await sessionKit.persistSession(session)
            const sessions = await sessionKit.getSessions()
            assert.lengthOf(sessions, 1)
        })
        test('sets default on new session', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)
            const session2 = new Session({
                actor: 'session2',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2)
            const sessions = await sessionKit.getSessions()
            assert.lengthOf(sessions, 2)
            assert.equal(sessions[0].default, false)
            assert.equal(sessions[1].default, true)
        })
        test('prevent default on new session', async function () {
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)
            const session2 = new Session({
                actor: 'session2',
                permission: 'test',
                chain: mockChainDefinition,
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2, {setAsDefault: false})
            const sessions = await sessionKit.getSessions()
            assert.lengthOf(sessions, 2)
            assert.equal(sessions[0].default, true)
            assert.equal(sessions[1].default, false)
        })
    })
    suite('equalityFn', function () {
        test('base equality check', async function () {
            // The base equality uses a combination of chain, actor, and permission
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                storage: new MockStorage(),
            })
            // Create two sessions for the same chain, actor, and permission but different appIds
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app1',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)
            const session2 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app2',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2)
            const sessions = await sessionKit.getSessions()
            // The base rules prevent duplicate sessions based on chain, actor, and permission only
            // it ignores additional data like appId
            assert.lengthOf(sessions, 1)
            // The second session should have overwritten the first
            assert.equal(sessions[0].data?.appId, 'app2')
        })
        test('custom equalityFn', async function () {
            // This custom rule enforces custom uniqueness based on persisted appId
            const equalityFn = (a: SessionType, b: SessionType) => {
                const first = a instanceof Session ? a.serialize() : a
                const second = b instanceof Session ? b.serialize() : b
                const idsEqual = first.data?.appId === second.data?.appId
                return (
                    Checksum256.from(first.chain).equals(second.chain) &&
                    Name.from(first.actor).equals(second.actor) &&
                    Name.from(first.permission).equals(second.permission) &&
                    idsEqual
                )
            }
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                equalityFn, // Initialize with custom equality function
                storage: new MockStorage(),
            })
            // Create two sessions for the same user with different appIds
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app1',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)
            const session2 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app2',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2)
            const sessions = await sessionKit.getSessions()
            // Ensure the uniqueness rule was applied and both sessions exist
            assert.lengthOf(sessions, 2)
            assert.equal(sessions[0].data?.appId, 'app1')
            assert.equal(sessions[1].data?.appId, 'app2')
        })
        test('disable equality', async function () {
            // This custom rule disables uniqueness entirely
            const equalityFn = () => false
            const sessionKit = new SessionKit(mockSessionKitArgs, {
                ...mockSessionKitOptions,
                equalityFn, // Initialize with custom equality function
                storage: new MockStorage(),
            })
            // Create two sessions for the same user with different appIds
            const session1 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app1',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session1)
            const session2 = new Session({
                actor: 'session1',
                permission: 'test',
                chain: mockChainDefinition,
                data: {
                    appId: 'app2',
                },
                walletPlugin: makeWallet(),
            })
            await sessionKit.persistSession(session2)
            const sessions = await sessionKit.getSessions()
            // Ensure the uniqueness rule was applied and both sessions exist
            assert.lengthOf(sessions, 2)
            assert.equal(sessions[0].data?.appId, 'app1')
            assert.equal(sessions[1].data?.appId, 'app2')
        })
    })
    suite('setEndpoint', function () {
        test('able to change api endpoint', async function () {
            // Start with a Session
            const testSessionKit = new SessionKit(
                {
                    ...mockSessionKitArgs,
                    chains: [
                        {
                            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                            url: 'https://jungle4.greymass.com',
                        },
                    ],
                },
                mockSessionKitOptions
            )

            // Check for the default API endpoint
            assert.equal(testSessionKit.chains[0].url, 'https://jungle4.greymass.com')

            // Change the API endpoint
            testSessionKit.setEndpoint(
                '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                'https://wax.greymass.com'
            )

            // Check for that the API endpoint has changed
            assert.equal(testSessionKit.chains[0].url, 'https://wax.greymass.com')

            // Change the API endpoint
            testSessionKit.setEndpoint(
                '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                'https://telos.greymass.com'
            )

            // Check for that the API endpoint has changed
            assert.equal(testSessionKit.chains[0].url, 'https://telos.greymass.com')
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
                    onAccountCreate(): Promise<UserInterfaceAccountCreationResponse> {
                        throw new Error('Not implemented in mock UI')
                    }
                    onAccountCreateComplete(): Promise<void> {
                        throw new Error('Not implemented in mock UI')
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
