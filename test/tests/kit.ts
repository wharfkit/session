import {assert} from 'chai'

import {BaseTransactPlugin, Session, SessionKit, SessionKitOptions} from '$lib'
import {PermissionLevel, TimePointSec} from '@greymass/eosio'

import {makeWallet} from '$test/utils/mock-wallet'
import {MockTransactPlugin} from '$test/utils/mock-hook'
import {makeMockAction} from '$test/utils/mock-transfer'
import {mockFetch} from '$test/utils/mock-fetch'
import {mockPermissionLevel} from '$test/utils/mock-config'
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
            suite('expireSeconds', function () {
                test('default: 120', async function () {
                    const sessionKit = new SessionKit(defaultSessionKitOptions)
                    const session = await sessionKit.login()
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
                    const session = await sessionKit.login()
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
                permissionLevel: PermissionLevel.from(mockPermissionLevel),
            })
            assert.instanceOf(session, Session)
            assert.isTrue(PermissionLevel.from(mockPermissionLevel).equals(session.permissionLevel))
        })
        test('specify permission (untyped)', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                permissionLevel: mockPermissionLevel,
            })
            assert.instanceOf(session, Session)
            assert.isTrue(PermissionLevel.from(mockPermissionLevel).equals(session.permissionLevel))
        })
        test('specify wallet plugin', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            const session = await sessionKit.login({
                walletPlugin: makeWallet(),
            })
            assert.instanceOf(session, Session)
        })
    })
    suite('ui', function () {
        test('default', async function () {
            const sessionKit = new SessionKit(defaultSessionKitOptions)
            assert.instanceOf(sessionKit.ui, UserInterfaceHeadless)
            const session = await sessionKit.login()
            assert.instanceOf(session.ui, UserInterfaceHeadless)
        })
        test('override', async function () {
            const sessionKit = new SessionKit({
                ...defaultSessionKitOptions,
                ui: new MockUserInterface(),
            })
            assert.instanceOf(sessionKit.ui, MockUserInterface)
            const session = await sessionKit.login()
            assert.instanceOf(session.ui, MockUserInterface)
        })
    })
})
