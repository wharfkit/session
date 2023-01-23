import {UserInterface} from '../../kit'
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
    public async onTransact(context: TransactContext) {
        // this.log('onTransact' + JSON.stringify(context))
    }
    public async onTransactResult(context: TransactResult) {
        // this.log('onTransactResult' + JSON.stringify(context))
    }
    public status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
