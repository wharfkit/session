import {assert} from 'chai'

import {ChainDefinition, PermissionLevel, Session, SessionOptions} from '$lib'

import {makeClient} from '$test/utils/mock-provider'
import {makeWallet} from '$test/utils/mock-wallet'
import {MockTransactHook} from '$test/utils/mock-hook'

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

suite('session', function () {
    let session: Session
    setup(function () {
        // Establish new session before each test
        session = new Session(mockSessionOptions)
    })
    suite('construct', function () {
        test('instance', function () {
            assert.instanceOf(session, Session)
        })
        suite('options', function () {
            test('typed', async function () {
                const testSession = new Session({
                    chain: ChainDefinition.from({
                        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                        url: 'https://jungle3.greymass.com',
                    }),
                    client,
                    permissionLevel: PermissionLevel.from('account@permission'),
                    walletPlugin: wallet,
                })
                assert.instanceOf(testSession, Session)
            })
            test('untyped', async function () {
                const testSession = new Session({
                    chain: {
                        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
                        url: 'https://jungle3.greymass.com',
                    },
                    client,
                    permissionLevel: 'account@permission',
                    walletPlugin: wallet,
                })
                assert.instanceOf(testSession, Session)
            })
        })
        suite('hooks', function () {
            test('assign', function () {
                const testSession = new Session({
                    ...mockSessionOptions,
                    hooks: {
                        afterBroadcast: [new MockTransactHook()],
                        afterSign: [new MockTransactHook()],
                        beforeBroadcast: [new MockTransactHook()],
                        beforeSign: [new MockTransactHook()],
                    },
                })
                assert.lengthOf(testSession.hooks.afterBroadcast, 1)
                assert.instanceOf(testSession.hooks.afterBroadcast[0], MockTransactHook)
                assert.lengthOf(testSession.hooks.afterSign, 1)
                assert.lengthOf(testSession.hooks.beforeBroadcast, 1)
                assert.lengthOf(testSession.hooks.beforeSign, 1)
            })
            test('assign afterBroadcast', function () {
                const testSession = new Session({
                    ...mockSessionOptions,
                    hooks: {
                        afterBroadcast: [new MockTransactHook()],
                    },
                })
                assert.lengthOf(testSession.hooks.afterBroadcast, 1)
                assert.lengthOf(testSession.hooks.afterSign, 0)
                assert.lengthOf(testSession.hooks.beforeBroadcast, 0)
                assert.lengthOf(testSession.hooks.beforeSign, 0)
            })
            test('assign afterSign', function () {
                const testSession = new Session({
                    ...mockSessionOptions,
                    hooks: {
                        afterSign: [new MockTransactHook()],
                    },
                })
                assert.lengthOf(testSession.hooks.afterBroadcast, 0)
                assert.lengthOf(testSession.hooks.afterSign, 1)
                assert.lengthOf(testSession.hooks.beforeBroadcast, 0)
                assert.lengthOf(testSession.hooks.beforeSign, 0)
            })
            test('assign beforeBroadcast', function () {
                const testSession = new Session({
                    ...mockSessionOptions,
                    hooks: {
                        beforeBroadcast: [new MockTransactHook()],
                    },
                })
                assert.lengthOf(testSession.hooks.afterBroadcast, 0)
                assert.lengthOf(testSession.hooks.afterSign, 0)
                assert.lengthOf(testSession.hooks.beforeBroadcast, 1)
                assert.lengthOf(testSession.hooks.beforeSign, 0)
            })
            test('assign beforeSign', function () {
                const testSession = new Session({
                    ...mockSessionOptions,
                    hooks: {
                        beforeSign: [new MockTransactHook()],
                    },
                })
                assert.lengthOf(testSession.hooks.afterBroadcast, 0)
                assert.lengthOf(testSession.hooks.afterSign, 0)
                assert.lengthOf(testSession.hooks.beforeBroadcast, 0)
                assert.lengthOf(testSession.hooks.beforeSign, 1)
            })
        })
    })
    test('getters', function () {
        assert.equal(
            session.account,
            PermissionLevel.from(mockSessionOptions.permissionLevel).actor
        )
        assert.equal(
            session.permission,
            PermissionLevel.from(mockSessionOptions.permissionLevel).permission
        )
    })
})
