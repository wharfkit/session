import {assert} from 'chai'

import {ChainDefinition, Session, SessionOptions} from '$lib'
import {PermissionLevel} from '@greymass/eosio'

import {makeClient} from '$test/utils/mock-provider'
import {makeWallet} from '$test/utils/mock-wallet'

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
