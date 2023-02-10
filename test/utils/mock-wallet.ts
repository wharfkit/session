import {Checksum256, PermissionLevel, PrivateKey, Transaction} from '@greymass/eosio'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {
    AbstractWalletPlugin,
    ChainDefinition,
    LoginContext,
    ResolvedSigningRequest,
    TransactContext,
    WalletPluginConfig,
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
    async login(context: LoginContext, options) {
        return {
            chain: options.chain ? options.chain.id : ChainDefinition.from(mockChainDefinition).id,
            permissionLevel: options.permissionLevel || PermissionLevel.from(mockPermissionLevel),
        }
    }
    async sign(resolved: ResolvedSigningRequest, context: TransactContext) {
        const transaction = Transaction.from(resolved.transaction)
        const digest = transaction.signingDigest(Checksum256.from(context.chain.id))
        return this.privateKey.signDigest(digest)
    }
}
