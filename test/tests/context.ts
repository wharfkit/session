import {assert} from 'chai'

import {ABI, Name} from '@greymass/eosio'
import zlib from 'pako'

import {makeContext} from '$test/utils/mock-context'

const context = makeContext()

suite('context', function () {
    suite('abiProvider', function () {
        test('has default', function () {
            assert.isDefined(context.abiProvider)
        })
        test('fetches ABIs', async function () {
            const result = await context.abiProvider.getAbi(Name.from('eosio.token'))
            const abi = ABI.from(result)
            assert.instanceOf(result, ABI)
            assert.equal(abi.version, 'eosio::abi/1.2')
        })
    })
    suite('esrOptions', function () {
        test('has abiProvider', function () {
            assert.isDefined(context.esrOptions.abiProvider)
            assert.hasAllKeys(context.esrOptions.abiProvider, ['getAbi'])
        })
        test('has zlib', function () {
            assert.isDefined(context.esrOptions.zlib)
            assert.instanceOf(context.esrOptions.zlib, Object)
        })
    })
})
