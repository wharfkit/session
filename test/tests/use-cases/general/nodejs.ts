/**
 * When replicating this use case in your own scripts, the only import required
 * will be the Session abd WalletPluginPrivateKey class, e.g.
 *
 * import {Session, WalletPluginPrivateKey} from 'wharfkit/session'
 *
 * The rest of the imports are only required for this unit test.
 */

import {assert} from 'chai'

import {Session, Signature, WalletPluginPrivateKey} from '$lib'

import {
    mockAccountName,
    mockChainId,
    mockPermissionLevel,
    mockPermissionName,
    mockPrivateKey,
    mockUrl,
} from '$test/utils/mock-config'
import {mockFetch} from '$test/utils/mock-fetch'

/**
 * Required configuration for manually establishing a session.
 *
 * This session utilizes the WalletPluginPrivateKey plugin to sign transactions without
 * the need for an external wallet.
 */
const sessionOptions = {
    chain: {
        id: mockChainId,
        url: mockUrl,
    },
    permissionLevel: mockPermissionLevel,
    walletPlugin: new WalletPluginPrivateKey({
        privateKey: mockPrivateKey,
    }),
    /**
     * NOT required for normal usage of wharfkit/session
     * This is only required to execute sucessfully in a unit test environment.
     */
    fetch: mockFetch,
}

export const nodejsUsage = () => {
    suite('nodejs', function () {
        test('session', async function () {
            // Ensure the test runs regardless of how slow the requests are
            this.slow(10000)
            // Establish a new session
            const session = new Session(sessionOptions)
            // Perform a transaction
            const response = await session.transact({
                action: {
                    authorization: [
                        {
                            actor: mockAccountName,
                            permission: mockPermissionName,
                        },
                    ],
                    account: 'eosio.token',
                    name: 'transfer',
                    data: {
                        from: mockAccountName,
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
