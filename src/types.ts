import {Checksum256, Checksum256Type, Struct} from '@greymass/eosio'

export type Fetch = (input: any, init?: any) => Promise<any>

@Struct.type('chain_definition')
export class ChainDefinition extends Struct {
    @Struct.field('checksum256') declare id: Checksum256
    @Struct.field('string') declare url: string
}

export type ChainDefinitionType = ChainDefinition | {id: Checksum256Type; url: string}

export * from './types/index'
