import {LoginHook, SessionOptions, SigningRequest, TransactContext, TransactHook} from '$lib'

export class MockLoginHook implements LoginHook {
    async process(context: SessionOptions) {
        // Mock hook that does nothing
    }
}

export class MockTransactHook implements TransactHook {
    async process(request: SigningRequest, context: TransactContext): Promise<SigningRequest> {
        // Mock hook that does nothing
        return request
    }
}
