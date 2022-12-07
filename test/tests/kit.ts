import {assert} from 'chai'

import {BaseTransactPlugin, Session, SessionKit, SessionKitOptions} from '$lib'
import {PermissionLevel} from '@greymass/eosio'

import {makeWallet} from '$test/utils/mock-wallet'
import {MockTransactPlugin} from '$test/utils/mock-hook'
import {mockFetch} from '$test/utils/mock-fetch'

const defaultSessionKitOptions: SessionKitOptions = {
    appName: 'demo.app',
    chains: [
        {
            id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
            url: 'https://jungle4.greymass.com',
        },
    ],
    fetch: mockFetch, // Required for unit tests
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
                chain: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
            })
            assert.instanceOf(session, Session)
        })
        test('specify permission (typed)', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                permissionLevel: PermissionLevel.from('corecorecore@test'),
            })
            assert.instanceOf(session, Session)
        })
        test('specify permission (untyped)', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                permissionLevel: 'corecorecore@test',
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
})
