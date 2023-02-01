import {assert} from 'chai'

import SessionKit, {
    AbstractWalletPlugin,
    ChainDefinition,
    LoginContext,
    Name,
    SessionKitOptions,
    WalletPluginPrivateKey,
} from '$lib'
import {mockPrivateKey} from '$test/utils/mock-config'
import {MockUserInterface} from '$test/utils/mock-userinterface'
import {makeWallet, MockWalletPluginConfigs} from '$test/utils/mock-wallet'
import {mockFetch} from '$test/utils/mock-fetch'

const chains = [
    ChainDefinition.from({
        id: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        url: 'https://jungle4.greymass.com',
    }),
    ChainDefinition.from({
        id: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        url: 'https://eos.greymass.com',
    }),
    ChainDefinition.from({
        id: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
        url: 'https://telos.greymass.com',
    }),
    ChainDefinition.from({
        id: '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590',
        url: 'https://mockuserinterface.greymass.com',
    }),
]

const context = new LoginContext({
    chains,
    ui: new MockUserInterface(),
})

const defaultSessionKitOptions: SessionKitOptions = {
    appName: 'demo.app',
    chains,
    fetch: mockFetch, // Required for unit tests
    ui: new MockUserInterface(),
    walletPlugins: [makeWallet()],
}

suite('walletPlugin', function () {
    suite('config', function () {
        test('defaults', function () {
            const walletPlugin = new MockWalletPluginConfigs()
            assert.equal(walletPlugin.config.requiresChainSelect, true)
            assert.equal(walletPlugin.config.requiresPermissionSelect, false)
        })
        test('mock wallet override', function () {
            const walletPlugin = new MockWalletPluginConfigs({
                requiresChainSelect: false,
                requiresPermissionSelect: true,
            })
            assert.equal(walletPlugin.config.requiresChainSelect, false)
            assert.equal(walletPlugin.config.requiresPermissionSelect, true)
        })
    })
    suite('requiresChainSelect', function () {
        test('true, triggers ui for user selection', async function () {
            const walletPlugin = new MockWalletPluginConfigs({
                requiresChainSelect: true,
                requiresPermissionSelect: false,
            })
            assert.isTrue(walletPlugin.config.requiresChainSelect)
            const kit = new SessionKit({
                ...defaultSessionKitOptions,
                walletPlugins: [walletPlugin],
            })
            const result = await kit.login({
                permissionLevel: 'mock@interface',
            })
            assert.isTrue(result.response.chain.equals(chains[3].id))
            assert.isTrue(result.response.permissionLevel.actor.equals('mock'))
            assert.isTrue(result.response.permissionLevel.permission.equals('interface'))
        })
        test('false, wallet returns chain', async function () {
            const walletPlugin = new MockWalletPluginConfigs({
                requiresChainSelect: false,
                requiresPermissionSelect: false,
            })
            assert.isFalse(walletPlugin.config.requiresChainSelect)
            const kit = new SessionKit({
                ...defaultSessionKitOptions,
                walletPlugins: [walletPlugin],
            })
            const result = await kit.login({
                permissionLevel: 'mock@interface',
            })
            assert.isTrue(result.response.chain.equals(chains[0].id))
            assert.isTrue(result.response.permissionLevel.actor.equals('mock'))
            assert.isTrue(result.response.permissionLevel.permission.equals('interface'))
        })
    })
    suite('requiresPermissionSelect', function () {
        test('true, triggers ui for user selection', async function () {
            const walletPlugin = new MockWalletPluginConfigs({
                requiresChainSelect: false,
                requiresPermissionSelect: true,
            })
            assert.isTrue(walletPlugin.config.requiresPermissionSelect)
            const kit = new SessionKit({
                ...defaultSessionKitOptions,
                walletPlugins: [walletPlugin],
            })
            const result = await kit.login({
                chain: chains[0].id,
            })
            assert.isTrue(result.response.chain.equals(chains[0].id))
            assert.isTrue(result.response.permissionLevel.actor.equals('mock'))
            assert.isTrue(result.response.permissionLevel.permission.equals('interface'))
        })
        test('false, walletPlugin returns it', async function () {
            const walletPlugin = new MockWalletPluginConfigs({
                requiresChainSelect: false,
                requiresPermissionSelect: false,
            })
            assert.isFalse(walletPlugin.config.requiresPermissionSelect)
            const kit = new SessionKit({
                ...defaultSessionKitOptions,
                walletPlugins: [walletPlugin],
            })
            const result = await kit.login({
                chain: chains[0].id,
            })
            assert.isTrue(result.response.chain.equals(chains[0].id))
            assert.isTrue(result.response.permissionLevel.actor.equals('wharfkit1111'))
            assert.isTrue(result.response.permissionLevel.permission.equals('test'))
        })
    })
})
