import {assert} from 'chai'

import {Action, Asset, AssetType, Name, Signature, Struct} from '@greymass/eosio'

import {
    AbstractTransactPlugin,
    Session,
    SessionArgs,
    SessionOptions,
    SigningRequest,
    TransactContext,
    TransactHookResponse,
    TransactHookTypes,
} from '$lib'

import {mockChainId, mockUrl} from '$test/utils/mock-config'
import {mockFetch} from '$test/utils/mock-fetch'
import {makeWallet} from '$test/utils/mock-wallet'

const wallet = makeWallet()

interface MockTransactResourceProviderOptions {
    allowFees?: boolean
    url?: string
}

interface ResourceProviderResponseData {
    request: [string, object]
    signatures: string[]
    version: unknown
    fee?: AssetType
    costs?: {
        cpu: AssetType
        net: AssetType
        ram: AssetType
    }
}

interface ResourceProviderResponse {
    code: number
    data: ResourceProviderResponseData
}

export class MockTransactResourceProviderPlugin extends AbstractTransactPlugin {
    readonly allowFees: boolean = false
    readonly url?: string

    constructor(options: MockTransactResourceProviderOptions) {
        super()
        if (typeof options.allowFees !== 'undefined') {
            this.allowFees = options.allowFees
        }
        if (options.url) {
            this.url = options.url
        }
    }

    register(context: TransactContext): void {
        context.addHook(TransactHookTypes.beforeSign, (request, context) =>
            this.request(request, context)
        )
    }

    async request(
        request: SigningRequest,
        context: TransactContext
    ): Promise<TransactHookResponse> {
        if (context.ui) {
            context.ui.status('Requesting resources from resource provider...')
        }
        // Validate that this request is valid for the resource provider
        this.validateRequest(request, context)

        // Perform the request to the resource provider.
        const response = await context.fetch(this.url, {
            method: 'POST',
            body: JSON.stringify({
                ref: 'unittest',
                request,
                signer: context.permissionLevel,
            }),
        })

        const json: ResourceProviderResponse = await response.json()

        // If the resource provider refused to process this request, return the original request without modification.
        if (response.status === 400) {
            if (context.ui) {
                context.ui.status('Resource provider refused to sign this request.')
            }
            return {
                request,
            }
        }

        // Validate that the response is valid for the session.
        await this.validateResponseData(json)

        // TODO: Interact with interface for fee based prompting

        /* Psuedo-code for fee based prompting

        if (response.status === 402) {

            // Prompt for the fee acceptance
            const promptResponse = context.userPrompt({
                title: 'Transaction Fee Required',
                message: `This transaction requires a fee of ${response.json.data.fee} EOS. Do you wish to accept this fee?`,
            })

            // If the user did not accept the fee, return the original request without modification.
            if (!promptResponse) {
                return {
                    request,
                }
            }
        } */

        // Create a new signing request based on the response to return to the session's transact flow.
        const modified = await this.createRequest(json, context)

        // Return the modified transaction and additional signatures
        return {
            request: modified,
            signatures: json.data.signatures.map((sig) => Signature.from(sig)),
        }
    }
    async createRequest(
        response: ResourceProviderResponse,
        context: TransactContext
    ): Promise<SigningRequest> {
        // Create a new signing request based on the response to return to the session's transact flow.
        const request = await SigningRequest.create(
            {transaction: response.data.request[1]},
            context.esrOptions
        )

        // Set the required fee onto the request itself for wallets to process.
        if (response.code === 402 && response.data.fee) {
            request.setInfoKey('txfee', Asset.from(response.data.fee))
        }

        // If the fee costs exist, set them on the request for the signature provider to consume
        if (response.data.costs) {
            request.setInfoKey('txfeecpu', response.data.costs.cpu)
            request.setInfoKey('txfeenet', response.data.costs.net)
            request.setInfoKey('txfeeram', response.data.costs.ram)
        }

        return request
    }
    /**
     * Perform validation against the request to ensure it is valid for the resource provider.
     */
    validateRequest(request: SigningRequest, context: TransactContext): void {
        // Retrieve first authorizer and ensure it matches session context.
        const firstAction = request.getRawActions()[0]
        const firstAuthorizer = firstAction.authorization[0]
        if (!firstAuthorizer.actor.equals(context.permissionLevel.actor)) {
            throw new Error('The first authorizer of the transaction does not match this session.')
        }
    }
    /**
     * Perform validation against the response to ensure it is valid for the session.
     */
    async validateResponseData(response: Record<string, any>): Promise<void> {
        // If the data wasn't provided in the response, throw an error.
        if (!response) {
            throw new Error('Resource provider did not respond to the request.')
        }

        // If a malformed response with a fee was provided, throw an error.
        if (response.code === 402 && !response.data.fee) {
            throw new Error(
                'Resource provider returned a response indicating required payment, but provided no fee amount.'
            )
        }

        // If no signatures were provided, throw an error.
        if (!response.data.signatures || !response.data.signatures[0]) {
            throw new Error('Resource provider did not return a signature.')
        }
    }
}

const mockResourceProviderPlugin = new MockTransactResourceProviderPlugin({
    url: 'https://jungle4.greymass.com/v1/resource_provider/request_transaction',
})

const mockSessionArgs: SessionArgs = {
    chain: {
        id: mockChainId,
        url: mockUrl,
    },
    permissionLevel: 'wharfkit1131@test',
    walletPlugin: wallet,
}

const mockSessionOptions: SessionOptions = {
    /**
     * NOT required for normal usage of wharfkit/session
     * This is only required to execute sucessfully in a unit test environment.
     */
    fetch: mockFetch,
    transactPlugins: [mockResourceProviderPlugin],
}

@Struct.type('transfer')
export class Transfer extends Struct {
    @Struct.field(Name) from!: Name
    @Struct.field(Name) to!: Name
    @Struct.field(Asset) quantity!: Asset
    @Struct.field('string') memo!: string
}

export const resourceProviderPlugin = () => {
    suite('resource provider', function () {
        test('provides free transaction', async function () {
            this.slow(10000)
            const session = new Session(mockSessionArgs, mockSessionOptions)
            const action = {
                authorization: [
                    {
                        actor: 'wharfkit1131',
                        permission: 'test',
                    },
                ],
                account: 'eosio.token',
                name: 'transfer',
                data: {
                    from: 'wharfkit1131',
                    to: 'wharfkittest',
                    quantity: '0.0001 EOS',
                    memo: 'wharfkit is the best <3',
                },
            }
            const response = await session.transact({
                action,
            })
            if (response.resolved && response.transaction) {
                assert.lengthOf(response.transaction?.actions, 2)
                // Ensure the noop action was properly prepended
                assert.equal(String(response.transaction?.actions[0].account), 'greymassnoop')
                assert.equal(
                    String(response.transaction?.actions[0].authorization[0].actor),
                    'greymassfuel'
                )
                assert.equal(
                    String(response.transaction?.actions[0].authorization[0].permission),
                    'cosign'
                )
                // Ensure the original transaction is still identical to the original
                assert.isTrue(
                    Action.from({...action, data: Transfer.from(action.data)}).data.equals(
                        response.resolved?.transaction.actions[1].data
                    )
                )
            } else {
                assert.fail('No transaction was returned from transact call.')
            }
        })
        // test('requires a fee to cover resources', async function () {
        //     this.slow(10000)
        //     const session = new Session(mockSessionOptions)
        //     let response
        //     const action = makeMockAction('testing fee-based model')
        //     try {
        //         console.log(action)
        //         response = await session.transact({action})
        //     } catch (e) {
        //         console.log(e)
        //         assert.fail('transact exception')
        //     }
        //     if (response.resolved && response.transaction) {
        //         assert.lengthOf(response.transaction?.actions, 2)
        //         // Ensure the noop action was properly prepended
        //         assert.equal(String(response.transaction?.actions[0].account), 'greymassnoop')
        //         assert.equal(
        //             String(response.transaction?.actions[0].authorization[0].actor),
        //             'greymassfuel'
        //         )
        //         assert.equal(
        //             String(response.transaction?.actions[0].authorization[0].permission),
        //             'cosign'
        //         )
        //         // Ensure the original transaction is still identical to the original
        //         assert.isTrue(action.data.equals(response.resolved?.transaction.actions[1].data))
        //     } else {
        //         assert.fail('No transaction was returned from transact call.')
        //     }
        // })
    })
}
