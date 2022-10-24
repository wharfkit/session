import {
    ChainDefinition,
    Checksum256,
    Checksum256Type,
    PrivateKey,
    Session,
    Signature,
    Transaction,
    WalletPlugin,
    WalletPluginLoginOptions,
    WalletPluginOptions,
} from '$lib'

interface Options extends WalletPluginOptions {
    privateKey: PrivateKey
}

export class WalletPluginPrivateKey implements WalletPlugin {
    readonly privateKey: PrivateKey
    constructor(options: Options) {
        if (options.privateKey) {
            this.privateKey = options.privateKey
        } else {
            throw new Error('The Private Key wallet plugin must be initialized with a private key.')
        }
    }
    login(options: WalletPluginLoginOptions) {
        return new Session({
            chain: ChainDefinition.from({
                id: Checksum256.from(options.context.chain.id),
                url: options.context.chain.url,
            }),
            permissionLevel: options.context.permissionLevel,
            walletPlugin: this,
        })
    }
    sign(chain: ChainDefinition, transaction: Transaction): Signature {
        const digest = transaction.signingDigest(Checksum256.from(chain.id))
        return this.privateKey.signDigest(digest)
    }
}
