import {Checksum256, PermissionLevel} from '@greymass/eosio'
import {LoginOptions} from './kit'
import {LoginContext} from './login'
import {TransactContext, TransactResult} from './transact'

export interface PromptArgs {
    title: string
    body?: string
    elements: PromptElement[]
}

export interface PromptElement {
    type: 'button' | 'countdown' | 'qr'
    label?: string
    data?: unknown
}

/**
 * Interface which a [[UserInteface]] plugins must implement.
 */
export interface UserInterface {
    /** Inform the UI that an error has occurred */
    onError: (error: Error) => Promise<void>
    /** Inform the UI that a login call has started **/
    onLogin: (options?: LoginOptions) => Promise<void>
    /** Inform the UI that a login call has completed **/
    onLoginResult: () => Promise<void>
    /** Ask the user to select a blockchain, and return the chain id **/
    onSelectChain: (context: LoginContext) => Promise<Checksum256>
    /** Ask the user to select an account, and return the PermissionLevel **/
    onSelectPermissionLevel: (context: LoginContext) => Promise<PermissionLevel>
    /** Ask the user to select a wallet, and return the index based on the metadata **/
    onSelectWallet: (context: LoginContext) => Promise<number>
    /** Inform the UI that a transact call has started **/
    onTransact: (context: TransactContext) => Promise<void>
    /** Inform the UI that a transact call has completed **/
    onTransactResult: (context: TransactResult) => Promise<void>
    /** Prompt the user with a custom UI element **/
    prompt: (args: PromptArgs) => void
    /** Update the displayed modal status from a TransactPlugin **/
    status: (message: string) => void
}

export abstract class AbstractUserInterface implements UserInterface {
    abstract onError(error: Error): Promise<void>
    abstract onLogin(options?: LoginOptions): Promise<void>
    abstract onLoginResult(): Promise<void>
    abstract onSelectChain(context: LoginContext): Promise<Checksum256>
    abstract onSelectPermissionLevel(context: LoginContext): Promise<PermissionLevel>
    abstract onSelectWallet(context: LoginContext): Promise<number>
    abstract onTransact(context: TransactContext): Promise<void>
    abstract onTransactResult(context: TransactResult): Promise<void>
    abstract prompt(args: PromptArgs): void
    abstract status(message: string): void
}
