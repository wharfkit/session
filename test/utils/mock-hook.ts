import {
    AbstractTransactPlugin,
    Action,
    LoginHook,
    SessionOptions,
    SigningRequest,
    Struct,
    TransactContext,
    TransactHookResponse,
    TransactHookTypes,
    Transaction,
} from '$lib'

export async function mockLoginHook(context: SessionOptions) {
    // Mock hook that does nothing
}

export async function mockTransactHook(request: SigningRequest): Promise<TransactHookResponse> {
    // Mock hook that does nothing
    return {
        request,
        signatures: [],
    }
}

export class MockTransactPlugin extends AbstractTransactPlugin {
    register(context: TransactContext): void {
        context.addHook(TransactHookTypes.beforeSign, mockTransactHook)
        context.addHook(TransactHookTypes.afterSign, mockTransactHook)
        context.addHook(TransactHookTypes.afterBroadcast, mockTransactHook)
    }
}

// Needed to load the ABI and work with an `Action` object
class noop extends Struct {
    static abiName = 'noop'
    static abiFields = []
}

export async function mockTransactResourceProviderPresignHook(
    request: SigningRequest,
    context: TransactContext
): Promise<TransactHookResponse> {
    // Pull the plugin options from the context
    const options = context.transactPluginsOptions
    // If any options this plugin is interested in are set, react to them
    // In this example, we're just bypassing the plugin w/ a flag.
    if (options.disableExamplePlugin) {
        return {
            request,
            signatures: [],
        }
    }
    // Clone the request for modification
    const cloned = request.clone()
    const newAction = Action.from({
        account: 'greymassnoop',
        name: 'noop',
        authorization: [
            {
                actor: 'greymassfuel',
                permission: 'cosign',
            },
        ],
        data: noop.from({}),
    })
    // TODO: Couldn't work with normal objects here
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

export class MockTransactResourceProviderPlugin extends AbstractTransactPlugin {
    register(context: TransactContext): void {
        context.addHook(TransactHookTypes.beforeSign, mockTransactResourceProviderPresignHook)
    }
}

export const mockTransactActionPrependerPlugin = {
    register: (context) =>
        context.addHook(TransactHookTypes.beforeSign, async (request, context) => ({
            request: await SigningRequest.create(
                {
                    actions: [
                        {
                            account: 'greymassnoop',
                            name: 'noop',
                            authorization: [
                                {
                                    actor: [...Array(12)]
                                        .map(() => Math.random().toString(36)[2])
                                        .join(''),
                                    permission: 'test',
                                },
                            ],
                            data: {},
                        },
                        ...request.getRawActions(),
                    ],
                },
                context.esrOptions
            ),
        })),
}

export const mockMetadataFooWriterPlugin = {
    register: (context) =>
        context.addHook(TransactHookTypes.beforeSign, async (request) => {
            request.setInfoKey('foo', 'baz')
            return {
                request,
            }
        }),
}
