import {
    Checksum256,
    LoginContext,
    LoginOptions,
    PermissionLevel,
    TransactContext,
    TransactResult,
    UserInterface,
} from '$lib'

export class MockUserInterface implements UserInterface {
    readonly logging = false
    messages: string[] = []
    log(message: string) {
        this.messages.push(message)
        if (this.logging) {
            // eslint-disable-next-line no-console
            console.info('MockUserInterface', message)
        }
    }
    async onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }
    async onLoginResult() {
        this.log('onLoginResult')
    }
    async onSelectPermissionLevel(): Promise<PermissionLevel> {
        const permissionLevel = PermissionLevel.from('mock@interface')
        this.log(`onSelectPermissionLevel: ${JSON.stringify(permissionLevel)}`)
        return permissionLevel
    }
    async onSelectChain(): Promise<Checksum256> {
        const checksum = Checksum256.from(
            '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590'
        )
        this.log(`onSelectChain: ${String(checksum)}`)
        return checksum
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onSelectWallet(context: LoginContext): Promise<number> {
        this.log('onSelectWallet')
        return 0
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onTransact(context: TransactContext) {
        this.log('onTransactResult')
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onTransactResult(context: TransactResult) {
        this.log('onTransactResult')
    }
    prompt(args) {
        this.log('prompt' + JSON.stringify(args))
    }
    status(message: string) {
        this.log(`status:('${message}')`)
    }
}
