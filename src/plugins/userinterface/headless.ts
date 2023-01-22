import {UserInterface} from '../../kit'

export class UserInterfaceHeadless implements UserInterface {
    public consoleLog = false
    public messages: string[] = []
    public log(message: string) {
        if (this.consoleLog) {
            // eslint-disable-next-line no-console
            console.info('UserInterfaceHeadless', message)
        }
    }
    public status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
