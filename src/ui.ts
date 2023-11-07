import {Checksum256Type, PermissionLevelType} from '@wharfkit/antelope'
import type {Cancelable, ChainDefinition, LocaleDefinitions} from '@wharfkit/common'

import {LoginOptions} from './kit'
import {LoginContext} from './login'
import {CreateAccountContext} from './index-module'

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
    type: 'accept' | 'asset' | 'button' | 'close' | 'countdown' | 'link' | 'qr' | 'textarea'
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
 * The response for an account creation call of a [[UserInterface]].
 */
export type UserInterfaceAccountCreationResponse = {
    chain?: Checksum256Type // If account creation can only be done on one chain.
    pluginId?: string // The id of the plugin that was selected (if more than one plugin was available).
}

/**
 * The options to pass to [[UserInterface.translate]].
 */
export interface UserInterfaceTranslateOptions {
    default: string
    [key: string]: unknown
}

/**
 * The translate function the UserInterface expects and uses.
 */
export type UserInterfaceTranslateFunction = (
    key: string,
    options?: UserInterfaceTranslateOptions,
    namespace?: string
) => string

/**
 * Interface which all 3rd party user interface plugins must implement.
 */
export interface UserInterface {
    /** Interact with the user to collect the data needed for a [[UserInterfaceLoginResponse]]. */
    login(context: LoginContext): Promise<UserInterfaceLoginResponse>
    /** Inform the UI that an error has occurred */
    onError: (error: Error) => Promise<void>
    /** Inform the UI that an account creation process has started */
    onAccountCreate: (
        context: CreateAccountContext
    ) => Promise<UserInterfaceAccountCreationResponse>
    /** Inform the UI that a account creation call has completed **/
    onAccountCreateComplete: () => Promise<void>
    /** Inform the UI that a login call has started **/
    onLogin: () => Promise<void>
    /** Inform the UI that a login call has completed **/
    onLoginComplete: () => Promise<void>
    /** Inform the UI that a transact call has started **/
    onTransact: () => Promise<void>
    /** Inform the UI that a transact call has completed **/
    onTransactComplete: () => Promise<void>
    /** Inform the UI that a transact call has started signing the transaction **/
    onSign: () => Promise<void>
    /** Inform the UI that a transact call has completed signing the transaction **/
    onSignComplete: () => Promise<void>
    /** Inform the UI that a transact call has started broadcasting the transaction **/
    onBroadcast: () => Promise<void>
    /** Inform the UI that a transact call has completed broadcasting the transaction **/
    onBroadcastComplete: () => Promise<void>
    /** Prompt the user with a custom UI element **/
    prompt: (args: PromptArgs) => Cancelable<PromptResponse>
    /** Update the displayed modal status from a TransactPlugin **/
    status: (message: string) => void
    /** Translate a string using the UI's language **/
    translate: UserInterfaceTranslateFunction
    /** Returns a translator for a specific namespace */
    getTranslate: (namespace?: string) => UserInterfaceTranslateFunction
    /** Programmatically add new localization strings to the  user interface */
    addTranslations: (translations: LocaleDefinitions) => void
}

/**
 * Abstract class which all 3rd party [[UserInterface]] implementations may extend.
 */
export abstract class AbstractUserInterface implements UserInterface {
    abstract login(context: LoginContext): Promise<UserInterfaceLoginResponse>
    abstract onError(error: Error): Promise<void>
    abstract onAccountCreate(
        context: CreateAccountContext
    ): Promise<UserInterfaceAccountCreationResponse>
    abstract onAccountCreateComplete(): Promise<void>
    abstract onLogin(options?: LoginOptions): Promise<void>
    abstract onLoginComplete(): Promise<void>
    abstract onTransact(): Promise<void>
    abstract onTransactComplete(): Promise<void>
    abstract onSign(): Promise<void>
    abstract onSignComplete(): Promise<void>
    abstract onBroadcast(): Promise<void>
    abstract onBroadcastComplete(): Promise<void>
    abstract prompt(args: PromptArgs): Cancelable<PromptResponse>
    abstract status(message: string): void
    translate(key: string, options?: UserInterfaceTranslateOptions, namespace?: string): string {
        throw new Error(
            'The `translate` method must be implemented in this UserInterface. Called with: ' +
                JSON.stringify({
                    key,
                    options,
                    namespace,
                })
        )
    }
    getTranslate(namespace?: string | undefined): UserInterfaceTranslateFunction {
        return (key, options) => this.translate(key, options, namespace)
    }
    addTranslations(translations: LocaleDefinitions) {
        throw new Error(
            'The `addTranslations` method must be implemented in this UserInterface. Called with: ' +
                JSON.stringify(translations)
        )
    }
}
