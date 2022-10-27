import {assert} from 'chai'
import zlib from 'pako'

import {
    Action,
    Hook,
    Name,
    PermissionLevel,
    SessionContext,
    Signature,
    SigningRequest,
    TransactContext,
    Transaction,
} from '$lib'
import {makeMockAction, makeMockActions, makeMockTransaction} from './utils/mock-transfer'
import {makeClient} from './utils/mock-provider'
import {makeContext} from './utils/mock-context'

const client = makeClient()
const context = makeContext()

class MockHook implements Hook {
    assertEligible(request: SigningRequest, session: PermissionLevel) {
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
        if (!firstAuthorizer.actor.equals(session.actor)) {
            throw new Error('Not first authorizer.')
        }
    }
    async process(request: SigningRequest, context: TransactContext): Promise<SigningRequest> {
        this.assertEligible(request, context.session)
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
        return cloned
    }
}

suite('hook - resource provider example', function () {
    test('pre-sign: Resource Provider', async function () {
        const request = await SigningRequest.create(
            {
                action: makeMockAction(),
            },
            {zlib}
        )
        const hook = new MockHook()
        const modifiedRequest = await hook.process(request, context)
        assert.notDeepEqual(request.data.req.value, modifiedRequest.data.req.value)
        const {value} = modifiedRequest.data.req
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
            const signatures = modifiedRequest.getInfoKey('cosig', {
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
