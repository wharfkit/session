import {assert} from 'chai'
import zlib from 'pako'

import {
    Action,
    ChainDefinition,
    PermissionLevel,
    Serializer,
    Session,
    SessionOptions,
    Signature,
    SigningRequest,
    Transaction,
} from '$lib'

import {makeClient} from '$test/utils/mock-provider'
import {makeWallet} from '$test/utils/mock-wallet'
import {makeMockAction, makeMockActions, makeMockTransaction} from '$test/utils/mock-transfer'
import {MockTransactHook} from '$test/utils/mock-hook'

const client = makeClient()
const wallet = makeWallet()

const mockSessionOptions: SessionOptions = {
    chain: ChainDefinition.from({
        id: '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        url: 'https://jungle3.greymass.com',
    }),
    client,
    permissionLevel: PermissionLevel.from('wharfkit@session'),
    walletPlugin: wallet,
}

function assetValidTransactResponse(result) {
    assert.instanceOf(result.chain, ChainDefinition)
    assert.instanceOf(result.signatures, Array)
    assert.instanceOf(result.signatures[0], Signature)
    assert.instanceOf(result.signer, PermissionLevel)
    assert.instanceOf(result.transaction, Transaction)
}

suite('transact', function () {
    let action: Action
    let actions: Action[]
    let transaction: Transaction
    let session: Session
    setup(async function () {
        // Setup mock transaction data
        const info = await client.v1.chain.get_info()
        action = await makeMockAction()
        actions = await makeMockActions()
        transaction = await makeMockTransaction(info)
        // Establish new session before each test
        session = new Session(mockSessionOptions)
    })
    suite('hooks', function () {
        test('assign', async function () {
            const result = await session.transact(
                {action},
                {
                    hooks: {
                        afterBroadcast: [new MockTransactHook()],
                        afterSign: [new MockTransactHook()],
                        beforeBroadcast: [new MockTransactHook()],
                        beforeSign: [new MockTransactHook()],
                    },
                }
            )
            assetValidTransactResponse(result)
        })
        test('assign afterBroadcast', async function () {
            const result = await session.transact(
                {action},
                {
                    broadcast: true,
                    hooks: {
                        afterBroadcast: [new MockTransactHook()],
                    },
                }
            )
            assetValidTransactResponse(result)
        })
        test('assign afterSign', async function () {
            const result = await session.transact(
                {action},
                {
                    hooks: {
                        afterSign: [new MockTransactHook()],
                    },
                }
            )
            assetValidTransactResponse(result)
        })
        test('assign beforeBroadcast', async function () {
            const result = await session.transact(
                {action},
                {
                    broadcast: true,
                    hooks: {
                        beforeBroadcast: [new MockTransactHook()],
                    },
                }
            )
            assetValidTransactResponse(result)
        })
        test('assign beforeSign', async function () {
            const result = await session.transact(
                {action},
                {
                    hooks: {
                        beforeSign: [new MockTransactHook()],
                    },
                }
            )
            assetValidTransactResponse(result)
        })
    })
    suite('transact args', function () {
        suite('action', function () {
            test('typed', async function () {
                const result = await session.transact({action})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const result = await session.transact({action: Serializer.objectify(action)})
                assetValidTransactResponse(result)
            })
        })
        suite('actions', function () {
            test('typed', async function () {
                const result = await session.transact({actions})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const result = await session.transact({actions: Serializer.objectify(actions)})
                assetValidTransactResponse(result)
            })
        })
        suite('transaction', function () {
            test('typed', async function () {
                const result = await session.transact({transaction})
                assetValidTransactResponse(result)
            })
            test('untyped', async function () {
                const result = await session.transact({
                    transaction: Serializer.objectify(transaction),
                })
                assetValidTransactResponse(result)
            })
            test('as typed param', async function () {
                const result = await session.transact(transaction)
                assetValidTransactResponse(result)
            })
            test('retain headers', async function () {
                const result = await session.transact(transaction)
                assetValidTransactResponse(result)
                assert.equal(transaction.delay_sec, result.transaction.delay_sec)
                assert.equal(transaction.expiration, result.transaction.expiration)
                assert.equal(transaction.ref_block_num, result.transaction.ref_block_num)
                assert.equal(transaction.ref_block_prefix, result.transaction.ref_block_prefix)
                assert.equal(
                    transaction.max_net_usage_words,
                    result.transaction.max_net_usage_words
                )
                assert.equal(transaction.max_cpu_usage_ms, result.transaction.max_cpu_usage_ms)
            })
            test('as untyped param', async function () {
                const result = await session.transact(Serializer.objectify(transaction))
                assetValidTransactResponse(result)
            })
        })
        suite('signing request', function () {
            test('string', async function () {
                const result = await session.transact({
                    request:
                        'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                })
                assetValidTransactResponse(result)
            })
            test('object', async function () {
                const result = await session.transact({
                    request: SigningRequest.from(
                        'esr:gmNgZGBY1mTC_MoglIGBIVzX5uxZRqAQGDBBaSOYQMPGiXGxar2ntKB8Flf_YBAt6BocpBCQWJmTn5hSrOAWEq7IzMAAAA',
                        {zlib}
                    ),
                })
                assetValidTransactResponse(result)
            })
        })
    })
    suite('transact options', function () {
        suite('allowModify', function () {
            test('undefined', async function () {
                const result = await session.transact({action})
                assetValidTransactResponse(result)
            })
            test('true', async function () {
                const result = await session.transact({action}, {allowModify: true})
                assetValidTransactResponse(result)
            })
            test('false', async function () {
                const result = await session.transact({action}, {allowModify: false})
                assetValidTransactResponse(result)
            })
            test('ignores modification from beforeSign hooks', async function () {
                const result = await session.transact(
                    {action},
                    {
                        allowModify: false,
                        hooks: {
                            beforeSign: [new MockTransactHook()],
                        },
                    }
                )
                assetValidTransactResponse(result)
            })
        })
        suite('broadcast', function () {
            test('undefined', async function () {
                const result = await session.transact({action})
                assetValidTransactResponse(result)
            })
            test('true', async function () {
                const result = await session.transact({action}, {broadcast: true})
                assetValidTransactResponse(result)
            })
            test('false', async function () {
                const result = await session.transact({action}, {broadcast: false})
                assetValidTransactResponse(result)
            })
        })
    })
    suite('response', function () {
        test('type check', async function () {
            const result = await session.transact(transaction)
            assetValidTransactResponse(result)
        })
    })
})
