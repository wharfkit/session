import {assert} from 'chai'

import {ABI, Checksum256, Name, PermissionLevel, Transaction} from '@greymass/eosio'
import zlib from 'pako'

import {SigningRequest, TransactContext} from '$lib'
import {makeMockAction} from '$test/utils/mock-transfer'

import {makeContext, mockTransactContextOptions} from '$test/utils/mock-context'
import {MockUserInterface} from '$test/utils/mock-userinterface'

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
        test('caches ABIs', async function () {
            const result = await context.abiProvider.getAbi(Name.from('eosio.token'))
            const abi = ABI.from(result)
            assert.instanceOf(result, ABI)
            assert.equal(abi.version, 'eosio::abi/1.2')
        })
    })
    suite('getters', function () {
        test('accountName', function () {
            assert.isTrue(
                context.accountName.equals('wharfkit1125'),
                `Expected 'wharfkit1125', got '${context.accountName}'`
            )
        })
        test('permissionName', function () {
            assert.isTrue(
                context.permissionName.equals('test'),
                `Expected 'test', got '${context.permissionName}'`
            )
        })
        suite('esrOptions', function () {
            test('has abiProvider', function () {
                assert.isDefined(context.esrOptions.abiProvider)
                assert.isFunction(context.esrOptions.abiProvider?.getAbi)
            })
            test('has zlib', function () {
                assert.isDefined(context.esrOptions.zlib)
                assert.instanceOf(context.esrOptions.zlib, Object)
            })
        })
    })
    suite('resolve', function () {
        test('request', async function () {
            const request = await SigningRequest.create(
                {
                    action: makeMockAction(),
                    chainId: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
                },
                {zlib}
            )
            const resolved = await context.resolve(request)
            assert.isTrue(
                resolved.chainId.equals(
                    Checksum256.from(
                        '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d'
                    )
                )
            )
            assert.instanceOf(resolved.request, SigningRequest)
            assert.instanceOf(resolved.signer, PermissionLevel)
            assert.instanceOf(resolved.transaction, Transaction)
        })
    })
})
