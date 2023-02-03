import {Checksum256, PermissionLevel} from '@greymass/eosio'

import {LoginOptions, UserInterface} from '../../kit'
import {TransactContext, TransactResult} from '../../transact'

export class UserInterfaceHeadless implements UserInterface {
    consoleLog = false
    messages: string[] = []
    log(message: string) {
        if (this.consoleLog) {
            // eslint-disable-next-line no-console
            console.info('UserInterfaceHeadless', message)
        }
    }
    async onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }
    async onLoginResult() {
        this.log('onLoginResult')
    }
    async onSelectPermissionLevel(): Promise<PermissionLevel> {
        throw new Error('The headless user interface does not support permission selection')
    }
    async onSelectChain(): Promise<Checksum256> {
        throw new Error('The headless user interface does not support chain selection')
    }
    async onSelectWallet(): Promise<number> {
        throw new Error('The headless user interface does not support wallet selection')
    }
    async onTransact(context: TransactContext) {
        this.log('onTransact' + String(context.accountName))
    }
    async onTransactResult(context: TransactResult) {
        this.log('onTransactResult' + String(context.transaction))
    }
    status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
