import {assert} from 'chai'
import fetch from 'node-fetch'

import {BaseTransactPlugin, Session, SessionKit, SessionKitOptions} from '$lib'
import {PermissionLevel} from '@greymass/eosio'

import {makeWallet} from '$test/utils/mock-wallet'
import {MockTransactPlugin} from '$test/utils/mock-hook'

const defaultSessionKitOptions: SessionKitOptions = {
    appName: 'demo.app',
    chains: [
        {
            id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
            url: 'https://jungle3.greymass.com',
        },
    ],
    fetch,
    walletPlugins: [makeWallet()],
}

suite('kit', function () {
    suite('construct', function () {
        test('instance', function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            assert.instanceOf(sessionKit, SessionKit)
        })
        suite('options', function () {
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
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login()
            assert.instanceOf(session, Session)
        })
        test('specify chain id', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                chain: defaultSessionKitOptions.chains[0].id,
            })
            assert.instanceOf(session, Session)
        })
        test('specify permission (typed)', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                permissionLevel: PermissionLevel.from('wharfkit@session'),
            })
            assert.instanceOf(session, Session)
        })
        test('specify permission (untyped)', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                permissionLevel: 'wharfkit@session',
            })
            assert.instanceOf(session, Session)
        })
        test('specify wallet plugin', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                walletPlugin: makeWallet(),
            })
            assert.instanceOf(session, Session)
        })
    })
    suite('getClient', function () {
        test('throws on getClient with invalid chain', function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            assert.throws(() =>
                sessionKit.getClient(
                    'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906'
                )
            )
        })
    })
})
