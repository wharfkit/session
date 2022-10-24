import {
    Action,
    API,
    Asset,
    Name,
    PrivateKey,
    SignedTransaction,
    Struct,
    Transaction,
} from '@greymass/eosio'

@Struct.type('transfer')
class Transfer extends Struct {
    @Struct.field('name') from!: Name
    @Struct.field('name') to!: Name
    @Struct.field('asset') quantity!: Asset
    @Struct.field('string') memo!: string
}

export async function makeMockTransaction(
    info: API.v1.GetInfoResponse,
    memo?: string
): Promise<Transaction> {
    // Assemble transaction header
    const header = info.getTransactionHeader(90)
    // Generate typed data for action data
    const transfer = Transfer.from({
        from: 'wharfkit',
        to: 'teamgreymass',
        quantity: '0.1337 EOS',
        memo: memo || 'wharfkit is the best <3',
    })
    // Assemble action with action data and metadata
    const action = Action.from({
        authorization: [
            {
                actor: 'wharfkit',
                permission: 'active',
            },
        ],
        account: 'eosio.token',
        name: 'transfer',
        data: transfer,
    })
    // Form and return transaction object
    const transaction = Transaction.from({
        ...header,
        actions: [action],
    })
    return transaction
}
