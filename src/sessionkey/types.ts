import {AnyAction, API, APIClient, Name, NameType, PublicKey} from '@wharfkit/antelope'
import {WalletPlugin} from '../wallet'

/**
 * Internal whitelist entry with resolved Name types.
 */
export interface SessionKeyWhitelistEntry {
    contract: Name
    actions?: Name[]
}

/**
 * User-facing whitelist entry that accepts string or Name types.
 */
export interface SessionKeyWhitelistInput {
    contract: NameType
    actions?: NameType[]
}

/**
 * Configuration options for session key functionality.
 */
export interface SessionKeyConfig {
    /** Optional custom permission name. If not provided, will be auto-generated from app name. */
    permission?: NameType
    /** List of contracts and actions that the session key is authorized to sign. */
    whitelist: SessionKeyWhitelistInput[]
    /** Optional custom function to fetch permission data from the blockchain. Defaults to v1.chain.get_account. */
    fetchPermission?: (
        client: APIClient,
        account: Name,
        permission: Name
    ) => Promise<API.v1.AccountPermission | undefined>
    /** Skip showing consent UI to user during setup. Default is false. */
    skipConsent?: boolean
}

/**
 * The result returned after successfully setting up a session key.
 */
export interface SessionKeySetupResult {
    /** The public key of the created session key. */
    publicKey: PublicKey
    /** The permission name the session key was created under. */
    permission: Name
}

/**
 * User's choice when a session key permission already exists on-chain.
 */
export type SessionKeyConflictChoice = 'add' | 'replace' | 'cancel'

/**
 * User's choice when local whitelist differs from on-chain linked actions.
 */
export type SessionKeyMismatchChoice = 'update' | 'dismiss'

/**
 * Details about whitelist/linkauth mismatches between local config and on-chain state.
 */
export interface SessionKeyMismatch {
    /** Actions in local whitelist but not linked on-chain. */
    added: SessionKeyWhitelistEntry[]
    /** Actions linked on-chain but not in local whitelist. */
    removed: SessionKeyWhitelistEntry[]
}

/**
 * Current state of a session key.
 */
export type SessionKeyState = 'active' | 'inactive' | 'mismatch' | 'not-setup'

/**
 * Complete status information about a session key.
 */
export interface SessionKeyStatus {
    /** Whether the session key is currently active and ready to sign. */
    active: boolean
    /** Whether a session key permission exists on-chain. */
    exists: boolean
    /** Current state of the session key. */
    state: SessionKeyState
    /** The permission name if one exists. */
    permission?: Name
    /** The public key string if one exists. */
    publicKey?: string
    /** Mismatch details if whitelist differs from on-chain state. */
    mismatch?: SessionKeyMismatch
}

/**
 * Interface for wallet plugins that support session keys.
 * Implemented by SessionKeyWalletPlugin.
 */
export interface SessionKeyWalletInterface extends WalletPlugin {
    allActionsWhitelisted(actions: AnyAction[]): boolean
    getPermission(): Name
    getPublicKey(): string
    getPrimaryWallet(): WalletPlugin
}

/**
 * Type guard to check if a wallet plugin is a session key wallet.
 *
 * @param plugin The wallet plugin to check
 * @returns True if the plugin is a session key wallet
 */
export function isSessionKeyWallet(plugin: WalletPlugin): plugin is SessionKeyWalletInterface {
    return plugin.id === 'session-key-wallet'
}
