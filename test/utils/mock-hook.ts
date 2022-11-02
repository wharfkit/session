import {
    Action,
    LoginHook,
    SessionOptions,
    SigningRequest,
    TransactContext,
    TransactHook,
    TransactHookResponse,
    Transaction,
} from '$lib'
import {makeClient} from '$test/utils/mock-provider'

const client = makeClient()

export class MockLoginHook implements LoginHook {
    async process(context: SessionOptions) {
        // Mock hook that does nothing
    }
}

export class MockTransactHook implements TransactHook {
    async process(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        // Mock hook that does nothing
        return {
            request,
        }
    }
}

export class MockModifyingTransactHook implements TransactHook {
    async process(request: SigningRequest): Promise<TransactHookResponse> {
        // Clone the request for modification
        const cloned = request.clone()
        // Couldn't work with normal objects here
        // Needed to load the ABI and work with an `Action` object
        const abi = (await client.v1.chain.get_abi('greymassnoop')).abi
        const newAction = Action.from(
            {
                account: 'greymassnoop',
                name: 'noop',
                authorization: [
                    {
                        actor: 'greymassfuel',
                        permission: 'cosign',
                    },
                ],
                data: {},
            },
            abi
        )
        // Needs to do a bunch of conditional logic - shoulnd't be required for a hook
        if (cloned.data.req.value instanceof Action) {
            // Overwrite the data
            cloned.data.req.value = [newAction, cloned.data.req.value]
            // This needs to be done to indicate it's an `Action[]`
            cloned.data.req.variantIdx = 1
        } else if (cloned.data.req.value instanceof Array) {
            // Prepend the action to the existing array
            cloned.data.req.value.unshift(newAction)
        } else if (cloned.data.req.value instanceof Transaction) {
            // Prepend the action to the existing array of the transaction
            cloned.data.req.value.actions.unshift(newAction)
        } else {
            throw new Error('Unrecognized data type in request.')
        }
        // Return the request
        return {
            request: cloned,
            signatures: [],
        }
    }
}
