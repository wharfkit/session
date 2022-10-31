import {
    ChainDefinition,
    WalletPlugin,
    WalletPluginLoginOptions,
    WalletPluginLoginResponse,
    WalletPluginOptions,
} from '../../kit.types'

import {
    Checksum256,
    PermissionLevel,
    PrivateKey,
    PrivateKeyType,
    Signature,
    Transaction,
} from '@greymass/eosio'

export interface WalletPluginPrivateKeyOptions extends WalletPluginOptions {
    privateKey: PrivateKeyType
}

export class WalletPluginPrivateKey implements WalletPlugin {
    readonly privateKey: PrivateKey
    constructor(options: WalletPluginPrivateKeyOptions) {
        this.privateKey = PrivateKey.from(options.privateKey)
    }
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse {
        return {
            chain: ChainDefinition.from({
                id: Checksum256.from(options.context.chain.id),
                url: options.context.chain.url,
            }),
            permissionLevel: PermissionLevel.from(options.context.permissionLevel),
            walletPlugin: this,
        }
    }
    sign(chain: ChainDefinition, transaction: Transaction): Signature {
        const digest = transaction.signingDigest(Checksum256.from(chain.id))
        return this.privateKey.signDigest(digest)
    }
}
