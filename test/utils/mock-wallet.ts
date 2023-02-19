import {Checksum256, PermissionLevel, PrivateKey, Transaction} from '@greymass/eosio'
import {WalletPluginPrivateKey} from '@wharfkit/wallet-plugin-privatekey'

import {
    AbstractWalletPlugin,
    ChainDefinition,
    LoginContext,
    ResolvedSigningRequest,
    SigningRequest,
    TransactContext,
    WalletPluginConfig,
    WalletPluginSignResponse,
} from '$lib'
import {mockChainDefinition, mockPermissionLevel, mockPrivateKey} from './mock-config'
import {makeMockAction} from './mock-transfer'

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
    testModify = false
    config: WalletPluginConfig
    options: Record<string, any>
    constructor(config?: WalletPluginConfig, options: Record<string, any> = {}) {
        super()
        if (config) {
            this.config = config
        } else {
            this.config = {
                requiresChainSelect: true,
                requiresPermissionSelect: false,
            }
        }
        this.options = options
        this.privateKey = PrivateKey.from(mockPrivateKey)
    }
    get id() {
        return 'MockWalletPluginConfigs'
    }
    get data() {
        return {
            config: this.config,
            options: this.options,
        }
    }
    async login(context: LoginContext) {
        return {
            chain: context.chain ? context.chain.id : ChainDefinition.from(mockChainDefinition).id,
            permissionLevel: context.permissionLevel || PermissionLevel.from(mockPermissionLevel),
        }
    }
    async sign(
        resolved: ResolvedSigningRequest,
        context: TransactContext
    ): Promise<WalletPluginSignResponse> {
        // If the `testModify` flag is enabled, modify the transaction for testing purposes
        if (this.options.testModify) {
            const request = await SigningRequest.create(
                {action: makeMockAction('modified transaction')},
                context.esrOptions
            )
            const modifiedResolved = await context.resolve(request)
            const transaction = Transaction.from(modifiedResolved.transaction)
            const digest = transaction.signingDigest(Checksum256.from(context.chain.id))
            const signature = this.privateKey.signDigest(digest)
            return {
                request: request,
                signatures: [signature],
            }
        }
        // Otherwise sign what was returned
        const transaction = Transaction.from(resolved.transaction)
        const digest = transaction.signingDigest(Checksum256.from(context.chain.id))
        const signature = this.privateKey.signDigest(digest)
        return {
            signatures: [signature],
        }
    }
}
