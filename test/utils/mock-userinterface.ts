import {
    cancelable,
    Cancelable,
    Checksum256,
    LoginContext,
    LoginOptions,
    PermissionLevel,
    PromptArgs,
    PromptResponse,
    UserInterface,
    UserInterfaceLoginResponse,
} from '$lib'

export class MockUserInterface implements UserInterface {
    readonly logging = false
    public messages: string[] = []

    log(message: string) {
        this.messages.push(message)
        if (this.logging) {
            // eslint-disable-next-line no-console
            console.info('MockUserInterface', message)
        }
    }

    async login(context: LoginContext): Promise<UserInterfaceLoginResponse> {
        let chainId = context.chain?.id
        if (!chainId) {
            chainId = Checksum256.from(context.chains[0].id)
        }
        let permissionLevel = context.permissionLevel
        if (!permissionLevel) {
            permissionLevel = PermissionLevel.from('mock@interface')
        }
        return {
            chainId,
            permissionLevel,
            walletPluginIndex: 0,
        }
    }

    async onError(error: Error) {
        this.log('onError: ' + JSON.stringify(error))
    }

    async onLogin(options?: LoginOptions) {
        this.log('onLogin: ' + JSON.stringify(options))
    }

    async onLoginResult() {
        this.log('onLoginResult')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onTransact() {
        this.log('onTransactResult')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onTransactResult() {
        this.log('onTransactResult')
    }

    prompt(args: PromptArgs): Cancelable<PromptResponse> {
        this.log('prompt' + JSON.stringify(args))
        return cancelable(new Promise(() => {}), (canceled) => {
            // do things to cancel promise
            throw canceled
        })
    }

    status(message: string) {
        this.log(`status:('${message}')`)
    }
}
