import {assert} from 'chai'

// A fetch implementation is required for anything less than nodejs v18
import fetch from 'node-fetch'

// Required imports from wharfkit/session
import {SessionOptions, Signature} from '$lib'
import {Session, WalletPluginPrivateKey} from '$lib'
import {makeClient} from '$test/utils/mock-provider'

/**
 * Required configuration for manually establishing a session
 *
 * This session utilizes the WalletPluginPrivateKey plugin to sign transactions without
 * the need for an external wallet.
 */
const sessionOptions: SessionOptions = {
    chain: {
        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        url: 'https://jungle3.greymass.com',
    },
    permissionLevel: 'wharfkit@session',
    walletPlugin: new WalletPluginPrivateKey({
        privateKey: '5JnUd2V5nYmRKgK9K2fRQcs3qKoi4mbcGV8Dg8EFqjjqEp9tYP5',
    }),
}

/**
 * Detect the version of nodejs in use.
 */
const version = parseInt(process.versions.node.split('.')[0])
if (version < 18) {
    /**
     * If the version is less than 18, we need to pass in a Fetch instance
     */
    sessionOptions.fetch = fetch
}

const client = makeClient()

export const nodejsUsage = () => {
    suite('nodejs', function () {
        test('session', async function () {
            // Force a client for testing purposes, not required for actual usage
            sessionOptions.client = client
            // Establish a new session
            const session = new Session(sessionOptions)
            // Perform a transaction
            const response = await session.transact({
                action: {
                    authorization: [
                        {
                            actor: 'corecorecore',
                            permission: 'active',
                        },
                    ],
                    account: 'eosio.token',
                    name: 'transfer',
                    data: {
                        from: 'corecorecore',
                        to: 'teamgreymass',
                        quantity: '0.1337 EOS',
                        memo: 'wharfkit is the best <3',
                    },
                },
            })
            // Ensure a signature was returned
            assert.instanceOf(response.signatures[0], Signature)
        })
    })
}
