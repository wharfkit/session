import {UserInterface} from '$lib'

export class MockUserInterface implements UserInterface {
    public messages: string[] = []
    public log(message: string) {
        console.info('MockUserInterface', message)
    }
    public status(message: string) {
        this.messages.push(message)
        this.log(message)
    }
}
