import {Checksum256Type, PermissionLevelType} from '@greymass/eosio'

import {LoginOptions} from './kit'
import {LoginContext} from './login'
import {Cancelable} from './types'

/**
 * The arguments for a [[UserInterface.prompt]] call.
 */
export interface PromptArgs {
    title: string
    body?: string
    elements: PromptElement[]
}

/**
 * The different types of elements that can be used in a [[PromptArgs]].
 */
export interface PromptElement {
    type: 'accept' | 'asset' | 'button' | 'countdown' | 'qr'
    label?: string
    data?: unknown
}

/**
 * The response for a [[UserInterface.prompt]] call.
 */
export interface PromptResponse {}

/**
 * The response for a login call of a [[UserInterface]].
 */
export interface UserInterfaceLoginResponse {
    chainId?: Checksum256Type
    permissionLevel?: PermissionLevelType
    walletPluginIndex: number
}

/**
 * Interface which all 3rd party user interface plugins must implement.
 */
export interface UserInterface {
    /** Interact with the user to collect the data needed for a [[UserInterfaceLoginResponse]]. */
    login(context: LoginContext): Promise<UserInterfaceLoginResponse>
    /** Inform the UI that an error has occurred */
    onError: (error: Error) => Promise<void>
    /** Inform the UI that a login call has started **/
    onLogin: () => Promise<void>
    /** Inform the UI that a login call has completed **/
    onLoginResult: () => Promise<void>
    /** Inform the UI that a transact call has started **/
    onTransact: () => Promise<void>
    /** Inform the UI that a transact call has completed **/
    onTransactResult: () => Promise<void>
    /** Prompt the user with a custom UI element **/
    prompt: (args: PromptArgs) => Cancelable<PromptResponse>
    /** Update the displayed modal status from a TransactPlugin **/
    status: (message: string) => void
}

/**
 * Abstract class which all 3rd party [[UserInterface]] implementations may extend.
 */
export abstract class AbstractUserInterface implements UserInterface {
    abstract login(context: LoginContext): Promise<UserInterfaceLoginResponse>
    abstract onError(error: Error): Promise<void>
    abstract onLogin(options?: LoginOptions): Promise<void>
    abstract onLoginResult(): Promise<void>
    abstract onTransact(): Promise<void>
    abstract onTransactResult(): Promise<void>
    abstract prompt(args: PromptArgs): Cancelable<PromptResponse>
    abstract status(message: string): void
}
