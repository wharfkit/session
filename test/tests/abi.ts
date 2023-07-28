import {makeClient} from '@wharfkit/mock-data'
import {ABI, Name} from '@wharfkit/session'
import {ABICache} from '@wharfkit/abicache'
import {assert} from 'chai'

const client = makeClient()

suite('ABICache', function () {
    let abiCache = new ABICache(client)
    setup(function () {
        abiCache = new ABICache(client)
    })
    test('constructor', function () {
        assert.instanceOf(abiCache, ABICache)
    })
    test('fetches data', async function () {
        const result = await abiCache.getAbi(Name.from('eosio.token'))
        assert.instanceOf(result, ABI)
        assert.equal(result.version, 'eosio::abi/1.2')
    })
    test('caches data', async function () {
        await abiCache.getAbi(Name.from('eosio.evm'))
        assert.isTrue(abiCache.cache.has('eosio.evm'))
        await abiCache.getAbi(Name.from('eosio.token'))
        assert.isTrue(abiCache.cache.has('eosio.token'))
    })
    test('no duplicate data', async function () {
        await abiCache.getAbi(Name.from('eosio.token'))
        await abiCache.getAbi(Name.from('eosio.token'))
        assert.isTrue(abiCache.cache.has('eosio.token'))
        assert.equal(abiCache.cache.size, 1)
    })
    test('manually add abi', async function () {
        const abi = ABI.from({version: 'eosio::abi/1.2'})
        abiCache.setAbi('foo', abi)
        assert.equal(abiCache.cache.size, 1)
        assert.instanceOf(abiCache.cache.get('foo'), ABI)
        assert.equal(abi.version, 'eosio::abi/1.2')
        const result = await abiCache.getAbi(Name.from('foo'))
        assert.instanceOf(result, ABI)
        assert.equal(result.version, 'eosio::abi/1.2')
    })
    test('manually add struct', async function () {
        // @Struct.type('transfer')
        // class Transfer extends Struct {
        //     @Struct.field(Name) from!: Name
        //     @Struct.field(Name) to!: Name
        //     @Struct.field(Asset) quantity!: Asset
        //     @Struct.field('string') memo!: string
        // }
        // abiCache.addStruct(Transfer)
    })
})
