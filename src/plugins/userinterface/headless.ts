import {Checksum256, PermissionLevel} from '@greymass/eosio'
import {LoginOptions, UserInterface} from '../../kit'
import {TransactContext, TransactResult} from '../../transact'

export class UserInterfaceHeadless implements UserInterface {
    public consoleLog = false
    public messages: string[] = []
    public log(message: string) {
        if (this.consoleLog) {
            // eslint-disable-next-line no-console
            console.info('UserInterfaceHeadless', message)
        }
    }
    onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }
    onLoginResult() {
        this.log('onLoginResult')
    }
    public async onSelectPermissionLevel(): Promise<PermissionLevel> {
        throw new Error('The headless user interface does not support permission selection')
    }
    public async onSelectChain(): Promise<Checksum256> {
        throw new Error('The headless user interface does not support chain selection')
    }
    public async onSelectWallet(): Promise<number> {
        throw new Error('The headless user interface does not support wallet selection')
    }
    public async onTransact(context: TransactContext) {
        this.log('onTransact' + String(context.accountName))
    }
    public async onTransactResult(context: TransactResult) {
        this.log('onTransactResult' + String(context.transaction))
    }
    public status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
