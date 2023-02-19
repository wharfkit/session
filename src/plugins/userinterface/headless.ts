import {LoginOptions} from '../../kit'
import {LoginContext} from '../../login'
import {UserInterface, UserInterfaceLoginResponse} from '../../ui'

export class UserInterfaceHeadless implements UserInterface {
    consoleLog = false
    messages: string[] = []
    log(message: string) {
        if (this.consoleLog) {
            // eslint-disable-next-line no-console
            console.info('UserInterfaceHeadless', message)
        }
    }
    async login(context: LoginContext): Promise<UserInterfaceLoginResponse> {
        if (!context.chain) {
            throw new Error(
                'The headless user interface adapter requires a chain to be set during login().'
            )
        }
        if (!context.permissionLevel) {
            throw new Error(
                'The headless user interface adapter requires a permissionLevel to be set during login().'
            )
        }
        return {
            chainId: context.chain?.id,
            permissionLevel: context.permissionLevel,
            walletPluginIndex: 0,
        }
    }
    async onError(error: Error) {
        this.log('onError: ' + error.message)
    }
    async onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }
    async onLoginResult() {
        this.log('onLoginResult')
    }
    async onTransact() {
        this.log('onTransact')
    }
    async onTransactResult() {
        this.log('onTransactResult')
    }
    prompt() {
        throw new Error('The headless user interface does not support prompts')
    }
    status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
