import {Hook, SigningRequest} from '$lib'

export class MockHook implements Hook {
    async process(request: SigningRequest): Promise<SigningRequest> {
        // Mock hook that does nothing
        return request
    }
}
