import {Checksum256, PrivateKey, PrivateKeyType, Signature, Transaction} from '@greymass/eosio'
import {ResolvedSigningRequest} from 'eosio-signing-request'
import {
    WalletPlugin,
    WalletPluginConfig,
    WalletPluginLoginOptions,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
    WalletPluginOptions,
} from '../../session'

import {ChainDefinition} from '../../types'

export interface WalletPluginPrivateKeyOptions extends WalletPluginOptions {
    privateKey: PrivateKeyType
}

export class WalletPluginPrivateKey implements WalletPlugin {
    readonly config: WalletPluginConfig = {
        requiresChainSelect: true,
        requiresPermissionSelect: true,
    }
    readonly metadata: WalletPluginMetadata = {
        name: 'Private Key Signer',
        description: '',
    }
    public privateKey: PrivateKey
    constructor(options: WalletPluginPrivateKeyOptions) {
        this.privateKey = PrivateKey.from(options.privateKey)
        this.metadata.description = `An unsecured wallet that can sign for authorities using the ${String(
            this.privateKey.toPublic()
        )} public key.`
    }
    login(options: WalletPluginLoginOptions): WalletPluginLoginResponse {
        let chain: Checksum256
        if (options.chain) {
            chain = options.chain.id
        } else {
            chain = options.chains[0].id
        }
        if (!options.permissionLevel) {
            throw new Error(
                'Calling login() without a permissionLevel is not supported by the WalletPluginPrivateKey plugin.'
            )
        }
        return {
            chain,
            permissionLevel: options.permissionLevel,
        }
    }
    sign(chain: ChainDefinition, resolved: ResolvedSigningRequest): Signature {
        const transaction = Transaction.from(resolved.transaction)
        const digest = transaction.signingDigest(Checksum256.from(chain.id))
        return this.privateKey.signDigest(digest)
    }
}
