import {Checksum256, PermissionLevel, PrivateKey, Transaction} from '@greymass/eosio'
import {
    AbstractWalletPlugin,
    ChainDefinition,
    WalletPluginConfig,
    WalletPluginPrivateKey,
} from '$lib'

import {mockChainDefinition, mockPermissionLevel, mockPrivateKey} from './mock-config'

export const privateKey = PrivateKey.from(mockPrivateKey)

export function makeWallet() {
    return new WalletPluginPrivateKey({
        privateKey,
    })
}

export class MockWalletPluginConfigs extends AbstractWalletPlugin {
    readonly metadata = {
        name: 'Mock Wallet Plugin',
        description: 'A mock wallet plugin for testing chain selection',
    }
    privateKey: PrivateKey
    constructor(config?: WalletPluginConfig) {
        super()
        if (config) {
            this.config = config
        }
        this.privateKey = PrivateKey.from(mockPrivateKey)
    }
    async login(options) {
        return {
            chain: options.chain ? options.chain.id : ChainDefinition.from(mockChainDefinition).id,
            permissionLevel: options.permissionLevel || PermissionLevel.from(mockPermissionLevel),
        }
    }
    async sign(chain, resolved) {
        const transaction = Transaction.from(resolved.transaction)
        const digest = transaction.signingDigest(Checksum256.from(chain.id))
        return this.privateKey.signDigest(digest)
    }
}
