import {
    Checksum256,
    PermissionLevel,
    PrivateKey,
    PrivateKeyType,
    Signature,
    Transaction,
} from '@greymass/eosio'
import {ResolvedSigningRequest} from 'eosio-signing-request'
import {
    WalletPlugin,
    WalletPluginLoginOptions,
    WalletPluginLoginResponse,
    WalletPluginOptions,
} from '../../session'

import {ChainDefinition} from '../../types'

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
        }
    }
    sign(chain: ChainDefinition, resolved: ResolvedSigningRequest): Signature {
        const transaction = Transaction.from(resolved.transaction)
        const digest = transaction.signingDigest(Checksum256.from(chain.id))
        return this.privateKey.signDigest(digest)
    }
}
