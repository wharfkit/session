import {TransactContext, TransactResult, UserInterface} from '$lib'

export class MockUserInterface implements UserInterface {
    public messages: string[] = []
    public log(message: string) {
        console.info('MockUserInterface', message)
    }
    public onTransact(context: TransactContext) {}
    public onTransactResult(context: TransactResult) {}
    public status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
