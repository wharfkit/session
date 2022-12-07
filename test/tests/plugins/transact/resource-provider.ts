import {assert} from 'chai'
import zlib from 'pako'

import {
    ABIDef,
    Action,
    APIResponse,
    Name,
    Serializer,
    Signature,
    Transaction,
} from '@greymass/eosio'

import {
    AbiProvider,
    AbstractTransactPlugin,
    Session,
    SessionOptions,
    SigningRequest,
    TransactContext,
    TransactHookResponse,
    TransactHookTypes,
} from '$lib'

import {makeMockAction} from '$test/utils/mock-transfer'
import {makeClient, MockFetchProvider} from '$test/utils/mock-provider'
import {makeWallet} from '$test/utils/mock-wallet'
import {mockChainId, mockUrl} from '$test/utils/mock-config'

const client = makeClient()
const wallet = makeWallet()

interface MockTransactResourceProviderOptions {
    allowFees?: boolean
    url?: string
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
        // Validate that this request is valid for the resource provider
        this.validateRequest(request, context)
        // return {request}

        // Perform the request to the resource provider.
        const response: APIResponse = await client.provider.call(
            // TODO: Make this use the URL from the constructor once @greymass/eosio provides support for other URLs.
            '/v1/resource_provider/request_transaction',
            {
                ref: 'unittest',
                request,
                signer: context.session,
            }
        )

        // If the resource provider refused to process this request, return the original request without modification.
        if (response.status === 400) {
            return {
                request,
            }
        }

        // Validate that the response is valid for the session.
        this.validateResponse(response)

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
        const modified = await this.createRequest(response, context)

        // Return the modified transaction and additional signatures
        return {
            request: modified,
            signatures: response.json.data.signatures,
        }
    }
    async createRequest(response: APIResponse, context: TransactContext): Promise<SigningRequest> {
        // Establish an AbiProvider based on the session context.
        const abiProvider: AbiProvider = {
            getAbi: async (account: Name): Promise<ABIDef> => {
                const response = await context.client.v1.chain.get_abi(account)
                if (!response.abi) {
                    /* istanbul ignore next */
                    throw new Error('could not load abi') // TODO: Better coverage for this
                }
                return response.abi
            },
        }

        // Create a new signing request based on the response to return to the session's transact flow.
        const request = await SigningRequest.create(
            {transaction: response.json.data.request[1]},
            {
                abiProvider,
                zlib,
            }
        )

        // Set the required fee onto the request itself for wallets to process.
        if (response.json.code === 402) {
            request.setInfoKey('txfee', response.json.data.fee)
        }

        // If the fee costs exist, set them on the request for the signature provider to consume
        if (response.json.data.costs) {
            request.setInfoKey('txfeecpu', response.json.data.costs.cpu)
            request.setInfoKey('txfeenet', response.json.data.costs.net)
            request.setInfoKey('txfeeram', response.json.data.costs.ram)
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
        if (!firstAuthorizer.actor.equals(context.session.actor)) {
            throw new Error('The first authorizer of the transaction does not match this session.')
        }
    }
    /**
     * Perform validation against the response to ensure it is valid for the session.
     */
    validateResponse(response: APIResponse): void {
        // If the data wasn't provided in the response, throw an error.
        if (!response || !response.json.data) {
            throw new Error('Resource provider did not respond to the request.')
        }

        // If a malformed response with a fee was provided, throw an error.
        if (response.status === 402 && !response.json.data.fee) {
            throw new Error(
                'Resource provider returned a response indicating required payment, but provided no fee amount.'
            )
        }

        // If no signatures were provided, throw an error.
        if (!response.json.data.signatures || !response.json.data.signatures[0]) {
            throw new Error('Resource provider did not return a signature.')
        }
    }
}

const mockResourceProviderPlugin = new MockTransactResourceProviderPlugin({
    url: 'https://jungle4.greymass.com',
})

const mockSessionOptions: SessionOptions = {
    chain: {
        id: mockChainId,
        url: mockUrl,
    },
    /**
     * NOT required for normal usage of wharfkit/session
     * This is only required to execute sucessfully in a unit test environment.
     */
    fetchProvider: new MockFetchProvider(mockUrl),
    permissionLevel: 'corecorecore@test',
    transactPlugins: [mockResourceProviderPlugin],
    walletPlugin: wallet,
}

export const resourceProviderPlugin = () => {
    suite('resource provider', function () {
        test('provides free transaction', async function () {
            this.slow(10000)
            const session = new Session(mockSessionOptions)
            const action = makeMockAction('testing fee transaction model')
            const response = await session.transact({action})
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
                assert.isTrue(action.data.equals(response.resolved?.transaction.actions[1].data))
            } else {
                assert.fail('No transaction was returned from transact call.')
            }
        })
        test('requires a fee to cover resources', async function () {
            this.slow(10000)
            const session = new Session(mockSessionOptions)
            let response
            const action = makeMockAction('testing fee-based model')
            try {
                console.log(action)
                response = await session.transact({action})
            } catch (e) {
                console.log(e)
                assert.fail('transact exception')
            }
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
                assert.isTrue(action.data.equals(response.resolved?.transaction.actions[1].data))
            } else {
                assert.fail('No transaction was returned from transact call.')
            }
        })
    })
}
