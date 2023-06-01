import {AssetType, Checksum256Type, PermissionLevelType} from '@greymass/eosio'

import {LoginOptions} from './kit'
import {LoginContext} from './login'
import {Cancelable, LocaleDefinitions} from './types'

/**
 * The arguments for a [[UserInterface.prompt]] call.
 */
export interface PromptArgs {
    title: string
    body?: string
    elements: PromptElement[]
}

export type PromptElementTypes =
    | 'accept'
    | 'asset'
    | 'button'
    | 'close'
    | 'countdown'
    | 'link'
    | 'qr'
    | 'textarea'

export interface PromptElement {
    type: PromptElementTypes
    data?: PromptElementData
}

export interface PromptElementDataTypes {
    accept: PromptElementDataAccept
    asset: PromptElementDataAsset
    button: PromptElementDataButton
    close: PromptElementDataClose
    countdown: PromptElementDataCountdown
    link: PromptElementDataLink
    qr: PromptElementDataQR
    textarea: PromptElementDataTextarea
}

export interface PromptElementData {}
export interface PromptElementDataAccept extends PromptElementData {}
export interface PromptElementDataAsset extends PromptElementData {
    label: string
    value: AssetType
}
export interface PromptElementDataButton extends PromptElementData {
    label: string
    icon?: string
    onClick: () => void
    variant: 'primary' | 'secondary' | 'outlined'
    autofocus?: boolean
}
export interface PromptElementDataClose extends PromptElementData {}
export interface PromptElementDataCountdown extends PromptElementData {
    label?: string
    end?: string
    logo?: string
    loading?: boolean
}
export interface PromptElementDataLink extends PromptElementData {
    button?: boolean
    href: string
    label: string
    icon?: string
    variant?: 'primary' | 'secondary' | 'outlined'
    target?: string
}
export interface PromptElementDataQR extends PromptElementData {}
export interface PromptElementDataTextarea extends PromptElementData {
    content?: string
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
