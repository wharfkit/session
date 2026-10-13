import {
    AnyAction,
    Checksum256,
    Name,
    NameType,
    PrivateKey,
    PublicKey,
    Transaction,
} from '@wharfkit/antelope'

import {LogoutContext} from '../kit'
import {LoginContext} from '../login'
import {Session} from '../session'
import {TransactContext} from '../transact'
import {
    AbstractWalletPlugin,
    SerializedWalletPlugin,
    WalletPlugin,
    WalletPluginConfig,
    WalletPluginData,
    WalletPluginLoginResponse,
    WalletPluginMetadata,
    WalletPluginSignResponse,
} from '../wallet'
import {Contract as SystemContract} from './systemcontract'
import {SessionKeyWalletInterface, SessionKeyWhitelistEntry} from './types'

/**
 * Options for creating a new [[SessionKeyWalletPlugin]] instance.
 */
export interface SessionKeyWalletPluginOptions {
    /** The user's primary wallet that will be used for non-whitelisted actions. */
    primaryWallet: WalletPlugin
    /** The private key for the session key. */
    privateKey: PrivateKey
    /** The permission name the session key operates under. */
    permission: NameType
    /** The whitelist of contracts and actions this session key can sign. */
    whitelist: SessionKeyWhitelistEntry[]
}

/**
 * Options for restoring a [[SessionKeyWalletPlugin]] from serialized data.
 */
export interface SessionKeyWalletPluginRestoreOptions {
    /** Available wallet plugins for restoring the primary wallet. */
    walletPlugins: WalletPlugin[]
}

/**
 * Serialized form of a whitelist entry.
 */
export interface SerializedSessionKeyWalletEntry {
    /** Contract account name. */
    contract: string
    /** Optional array of action names. If omitted, all actions on the contract are allowed. */
    actions?: string[]
}

/**
 * The serialized form of a [[SessionKeyWalletPlugin]].
 */
export interface SerializedSessionKeyWallet {
    /** Serialized primary wallet plugin. */
    primaryWallet: SerializedWalletPlugin
    /** Private key as a string. */
    privateKey: string
    /** Permission name as a string. */
    permission: string
    /** Serialized whitelist entries. */
    whitelist: SerializedSessionKeyWalletEntry[]
}

let sessionKeyLogoutInProgress = false

/**
 * Wallet plugin that wraps a primary wallet and routes transactions based on whitelist.
 * Whitelisted actions are signed with the session key, others fall back to primary wallet.
 */
export class SessionKeyWalletPlugin
    extends AbstractWalletPlugin
    implements SessionKeyWalletInterface
{
    public readonly id = 'session-key-wallet'
    readonly config: WalletPluginConfig = {
        requiresChainSelect: false,
        requiresPermissionSelect: false,
    }
    readonly metadata: WalletPluginMetadata = WalletPluginMetadata.from({
        name: 'Session Key Wallet',
        description: 'A wrapper wallet that routes transactions based on whitelist',
    })

    private primaryWallet!: WalletPlugin
    private privateKey!: PrivateKey
    private permission!: Name
    private whitelist!: SessionKeyWhitelistEntry[]
    private walletPlugins: WalletPlugin[] = []

    constructor(options?: SessionKeyWalletPluginOptions | SessionKeyWalletPluginRestoreOptions) {
        super()

        if (options && 'primaryWallet' in options) {
            this.primaryWallet = options.primaryWallet
            this.privateKey = PrivateKey.from(options.privateKey)
            this.permission = Name.from(options.permission)
            this.whitelist = options.whitelist
            this.metadata.publicKey = String(this.privateKey.toPublic())
        } else if (options && 'walletPlugins' in options) {
            this.walletPlugins = options.walletPlugins
        }
    }

    get data(): WalletPluginData {
        return {
            primaryWallet: this.primaryWallet.serialize(),
            privateKey: String(this.privateKey),
            permission: String(this.permission),
            whitelist: this.whitelist.map((entry) => ({
                contract: String(entry.contract),
                actions: entry.actions?.map((a) => String(a)),
            })),
        }
    }

    set data(data: WalletPluginData) {
        const serialized = data as SerializedSessionKeyWallet
        this.privateKey = PrivateKey.from(serialized.privateKey)
        this.permission = Name.from(serialized.permission)
        this.whitelist = serialized.whitelist.map((entry) => ({
            contract: Name.from(entry.contract),
            actions: entry.actions?.map((a) => Name.from(a)),
        }))
        this.metadata.publicKey = String(this.privateKey.toPublic())

        if (serialized.primaryWallet) {
            const primaryPlugin = this.walletPlugins.find(
                (p) => p.id === serialized.primaryWallet.id
            )
            if (primaryPlugin) {
                if (serialized.primaryWallet.data) {
                    primaryPlugin.data = serialized.primaryWallet.data
                }
                this.primaryWallet = primaryPlugin
            } else {
                throw new Error(
                    `Cannot restore session key: primary wallet plugin '${serialized.primaryWallet.id}' not found`
                )
            }
        }
    }

    /**
     * Get the primary wallet that this session key wallet wraps.
     *
     * @returns The primary wallet plugin
     */
    getPrimaryWallet(): WalletPlugin {
        return this.primaryWallet
    }

    /**
     * Get the permission name the session key operates under.
     *
     * @returns The permission name
     */
    getPermission(): Name {
        return this.permission
    }

    /**
     * Get the public key of the session key.
     *
     * @returns The public key as a string
     */
    getPublicKey(): string {
        return String(this.privateKey.toPublic())
    }

    /**
     * Get the whitelist of contracts and actions this session key can sign.
     *
     * @returns Array of whitelist entries
     */
    getWhitelist(): SessionKeyWhitelistEntry[] {
        return this.whitelist
    }

    /**
     * Check if an action is whitelisted for signing with the session key.
     *
     * @param action The action to check
     * @returns True if the action is whitelisted
     */
    isWhitelisted(action: AnyAction): boolean {
        const actionContract = Name.from(action.account)
        const actionName = Name.from(action.name)

        for (const entry of this.whitelist) {
            if (Name.from(entry.contract).equals(actionContract)) {
                if (!entry.actions || entry.actions.length === 0) {
                    return true
                }
                for (const allowedAction of entry.actions) {
                    if (actionName.equals(allowedAction)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    /**
     * Check if all actions in a transaction are whitelisted.
     *
     * @param actions Array of actions to check
     * @returns True if all actions are whitelisted
     */
    allActionsWhitelisted(actions: AnyAction[]): boolean {
        return actions.every((action) => this.isWhitelisted(action))
    }

    login(context: LoginContext): Promise<WalletPluginLoginResponse> {
        return this.primaryWallet.login(context)
    }

    async logout(context: LogoutContext): Promise<void> {
        if (!this.privateKey || !context.ui?.onSessionKeyRemove || sessionKeyLogoutInProgress) {
            return
        }

        sessionKeyLogoutInProgress = true
        try {
            const shouldRemove = await context.ui.onSessionKeyRemove({appName: context.appName})
            if (!shouldRemove) {
                return
            }

            const session = context.session
            const actor = session.actor
            const client = session.client
            const publicKey = this.privateKey.toPublic()

            const accountData = await client.v1.chain.get_account(actor)
            const permData = accountData.permissions.find((p) =>
                this.permission.equals(p.perm_name)
            )

            if (!permData) {
                return
            }

            const ourKeyIndex = permData.required_auth.keys.findIndex((k) =>
                PublicKey.from(k.key).equals(publicKey)
            )

            if (ourKeyIndex === -1) {
                return
            }

            const remainingKeys = permData.required_auth.keys.filter((_, i) => i !== ourKeyIndex)
            const systemContract = new SystemContract({client})
            const actions: AnyAction[] = []

            const primarySession = new Session(
                {
                    chain: session.chain,
                    permissionLevel: session.permissionLevel,
                    walletPlugin: this.primaryWallet,
                },
                {
                    fetch: session.fetch,
                    ui: context.ui,
                }
            )

            if (remainingKeys.length > 0) {
                actions.push(
                    systemContract.action(
                        'updateauth',
                        {
                            account: actor,
                            permission: this.permission,
                            parent: 'active',
                            auth: {
                                ...permData.required_auth,
                                keys: remainingKeys,
                            },
                        },
                        {authorization: [session.permissionLevel]}
                    )
                )
            } else {
                const linkedActions = permData.linked_actions || []
                for (const link of linkedActions) {
                    actions.push(
                        systemContract.action(
                            'unlinkauth',
                            {
                                account: actor,
                                code: link.account,
                                type: link.action || '',
                            },
                            {authorization: [session.permissionLevel]}
                        )
                    )
                }

                actions.push(
                    systemContract.action(
                        'deleteauth',
                        {
                            account: actor,
                            permission: this.permission,
                        },
                        {authorization: [session.permissionLevel]}
                    )
                )
            }

            await primarySession.transact({actions})

            if (this.primaryWallet?.logout) {
                await this.primaryWallet.logout(context)
            }
        } catch (error) {
            sessionKeyLogoutInProgress = false
            throw error
        } finally {
            sessionKeyLogoutInProgress = false
        }
    }

    async sign(resolved: any, context: TransactContext): Promise<WalletPluginSignResponse> {
        const transaction = resolved.transaction
        const actions = transaction.actions || []

        const hasSessionKeyAuth = actions.some((action: any) =>
            action.authorization.some((auth: any) =>
                this.permission.equals(auth.permission || auth.permission_name)
            )
        )

        if (hasSessionKeyAuth) {
            const txn = Transaction.from(transaction)
            const digest = txn.signingDigest(Checksum256.from(context.chain.id))
            const signature = this.privateKey.signDigest(digest)
            return {
                signatures: [signature],
            }
        }

        return this.primaryWallet.sign(resolved, context)
    }

    serialize(): SerializedWalletPlugin {
        return {
            id: this.id,
            data: this.data,
        }
    }
}
