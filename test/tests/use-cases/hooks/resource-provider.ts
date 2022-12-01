import {assert} from 'chai'
import zlib from 'pako'

import {Name, Signature, Transaction} from '@greymass/eosio'

import {SigningRequest, TransactContext, TransactHookResponse} from '$lib'

import {makeMockAction} from '$test/utils/mock-transfer'
import {makeClient} from '$test/utils/mock-provider'
import {makeContext} from '$test/utils/mock-context'

const client = makeClient()
const context = makeContext()

async function mockHook(
    request: SigningRequest,
    context: TransactContext
): Promise<TransactHookResponse> {
    if (request.getRawInfoKey('no_modify')) {
        throw new Error('Request cannot be modified.')
    }
    if (request.isIdentity()) {
        throw new Error('Identity requests cannot be co-signed.')
    }
    const firstAction = request.getRawActions()[0]
    if (!firstAction) {
        throw new Error('No actions in request.')
    }
    const firstAuthorizer = firstAction.authorization[0]
    if (!firstAction) {
        throw new Error('First authorization missing.')
    }
    if (!firstAuthorizer.actor.equals(context.session.actor)) {
        throw new Error('Not first authorizer.')
    }
    const result: Record<string, any> = await client.call({
        path: '/v1/resource_provider/request_transaction',
        params: {
            ref: 'unittest',
            request,
            signer: context.session,
        },
    })
    if (!result || !result.data) {
        throw new Error('Invalid response from resource provider.')
    }
    if (!result.data.signatures || !result.data.signatures[0]) {
        throw new Error('No signature returned from resource provider.')
    }
    if (result.code === 402 && !result.data.fee) {
        throw new Error(
            'Resource provider returned a response indicating required payment, but provided no fee amount.'
        )
    }
    // Clone the request for modification
    const cloned = request.clone()
    // Set the required fee onto the request for signature providers
    if (result.code === 402) {
        if (request.getInfoKey('no_fee')) {
            throw new Error('Fee required but sender opted out.')
        }
        cloned.setInfoKey('txfee', result.data.fee)
    }
    // If the fee costs exist, set them on the request for the signature provider to consume
    if (result.data.costs) {
        cloned.setInfoKey('txfeecpu', result.data.costs.cpu)
        cloned.setInfoKey('txfeenet', result.data.costs.net)
        cloned.setInfoKey('txfeeram', result.data.costs.ram)
    }
    // Set the cosigner signature onto the request for signature providers
    const signatures = result.data.signatures.map((s) => Signature.from(s))
    cloned.setInfoKey('cosig', signatures, {type: Signature, array: true})
    // Modify the request based on the response from the API
    cloned.data.req = (
        await SigningRequest.create(
            {transaction: {...result.data.request[1]}},
            {abiProvider: (request as any).abiProvider}
        )
    ).data.req
    return {
        request: cloned,
    }
}

export const resourceProviderHooks = () => {
    suite('resource provider', function () {
        test('pre-sign', async function () {
            const request = await SigningRequest.create(
                {
                    action: makeMockAction(),
                },
                {zlib}
            )
            const modifiedRequest = await mockHook(request, context)
            assert.notDeepEqual(request.data.req.value, modifiedRequest.request.data.req.value)
            const {value} = modifiedRequest.request.data.req
            if (value instanceof Transaction) {
                const {actions} = value
                const [noop, transfer] = actions
                assert.instanceOf(actions, Array)
                assert.equal(actions.length, 2)
                // Check action data
                assert.isTrue(Name.from('greymassnoop').equals(noop.account))
                assert.isTrue(Name.from('greymassfuel').equals(noop.authorization[0].actor))
                assert.isTrue(Name.from('eosio.token').equals(transfer.account))
                assert.isTrue(Name.from('corecorecore').equals(transfer.authorization[0].actor))
                // Check that a signature was appended to the request
                const signatures = modifiedRequest.request.getInfoKey('cosig', {
                    type: Signature,
                    array: true,
                })
                assert.instanceOf(signatures, Array)
                assert.instanceOf(signatures[0], Signature)
            } else {
                assert.fail('The request did not return a transaction.')
            }
        })
    })
}
