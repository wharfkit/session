import {assert} from 'chai'
import fetch from 'node-fetch'

import {WalletPluginPrivateKey, WalletPluginPrivateKeyOptions} from '$lib'

import {privateKey} from '../../../utils/mock-wallet'

const defaultWalletOptions: WalletPluginPrivateKeyOptions = {
    privateKey,
}

suite('plugin - wallet - privatekey', function () {
    test('construct', function () {
        const wallet = new WalletPluginPrivateKey(defaultWalletOptions)
        assert.instanceOf(wallet, WalletPluginPrivateKey)
    })
    test('throws error with invalid privatekey', function () {
        assert.throws(() => {
            new WalletPluginPrivateKey({privateKey: 'foo'})
        }, Error)
    })
})
