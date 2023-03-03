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
import {prependAction} from 'src/utils'

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
    id = 'mock-transact-plugin'
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
    const modified = prependAction(request, newAction)
    // Return the request
    return {
        request: modified,
        signatures: [],
    }
}

export class MockTransactResourceProviderPlugin extends AbstractTransactPlugin {
    id = 'mock-transact-resource-provider-plugin'
    register(context: TransactContext): void {
        context.addHook(TransactHookTypes.beforeSign, mockTransactResourceProviderPresignHook)
    }
}

export const mockTransactActionPrependerPlugin = {
    id: 'mock-transact-action-prepender-plugin',
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
    id: 'mock-metadata-foo-writer-plugin',
    register: (context) =>
        context.addHook(TransactHookTypes.beforeSign, async (request) => {
            request.setInfoKey('foo', 'baz')
            return {
                request,
            }
        }),
}
