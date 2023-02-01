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
    public messages: string[] = []
    public log(message: string) {
        this.messages.push(message)
        if (this.logging) {
            console.info('MockUserInterface', message)
        }
    }
    onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }
    onLoginResult() {
        this.log('onLoginResult')
    }
    public async onSelectPermissionLevel(): Promise<PermissionLevel> {
        const permissionLevel = PermissionLevel.from('mock@interface')
        this.log(`onSelectPermissionLevel: ${JSON.stringify(permissionLevel)}`)
        return permissionLevel
    }
    public async onSelectChain(): Promise<Checksum256> {
        const checksum = Checksum256.from(
            '34593b65376aee3c9b06ea8a8595122b39333aaab4c76ad52587831fcc096590'
        )
        this.log(`onSelectChain: ${String(checksum)}`)
        return checksum
    }
    public async onSelectWallet(context: LoginContext): Promise<number> {
        this.log('onSelectWallet')
        return 0
    }
    public onTransact(context: TransactContext) {
        this.log('onTransactResult')
    }
    public onTransactResult(context: TransactResult) {
        this.log('onTransactResult')
    }
    public status(message: string) {
        this.log(`status:('${message}')`)
    }
}
