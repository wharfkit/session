import {assert} from 'chai'

import {WalletPluginPrivateKey, WalletPluginPrivateKeyOptions} from '$lib'

import {privateKey} from '$test/utils/mock-wallet'

const defaultWalletOptions: WalletPluginPrivateKeyOptions = {
    privateKey,
}

export const privateKeyWallet = () => {
    suite('privatekey', function () {
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
}
