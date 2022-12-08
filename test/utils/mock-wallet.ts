import {PrivateKey} from '@greymass/eosio'
import {WalletPluginPrivateKey} from '$lib'

import {mockPrivateKey} from './mock-config'

export const privateKey = PrivateKey.from(mockPrivateKey)

export function makeWallet() {
    return new WalletPluginPrivateKey({
        privateKey,
    })
}
