import {
    Action,
    SigningRequest,
    TransactContext,
    TransactFlow,
    TransactHookResponse,
    Transaction,
} from '$lib'

export class MockTransactFlow implements TransactFlow {
    async beforeSign(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
            signatures: [],
        }
    }

    async afterSign(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
            signatures: [],
        }
    }

    async beforeBroadcast(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
            signatures: [],
        }
    }

    async afterBroadcast(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        return {
            request,
            signatures: [],
        }
    }
}

export class MockModifyingTransactFlow extends MockTransactFlow {
    async beforeSign(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        // Clone the request for modification
        const cloned = request.clone()
        // Couldn't work with normal objects here
        // Needed to load the ABI and work with an `Action` object
        const abi = (await context.client.v1.chain.get_abi('greymassnoop')).abi
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
