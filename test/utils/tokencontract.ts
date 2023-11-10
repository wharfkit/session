import {ABI, Action, Asset, AssetType, Blob, Name, NameType, Struct} from '@wharfkit/antelope'
import {ActionOptions, Contract as BaseContract, ContractArgs, PartialBy} from '@wharfkit/contract'
export namespace EosioToken {
    export const abiBlob = Blob.from(
        'DmVvc2lvOjphYmkvMS4yAAgHYWNjb3VudAABB2JhbGFuY2UFYXNzZXQFY2xvc2UAAgVvd25lcgRuYW1lBnN5bWJvbAZzeW1ib2wGY3JlYXRlAAIGaXNzdWVyBG5hbWUObWF4aW11bV9zdXBwbHkFYXNzZXQOY3VycmVuY3lfc3RhdHMAAwZzdXBwbHkFYXNzZXQKbWF4X3N1cHBseQVhc3NldAZpc3N1ZXIEbmFtZQVpc3N1ZQADAnRvBG5hbWUIcXVhbnRpdHkFYXNzZXQEbWVtbwZzdHJpbmcEb3BlbgADBW93bmVyBG5hbWUGc3ltYm9sBnN5bWJvbAlyYW1fcGF5ZXIEbmFtZQZyZXRpcmUAAghxdWFudGl0eQVhc3NldARtZW1vBnN0cmluZwh0cmFuc2ZlcgAEBGZyb20EbmFtZQJ0bwRuYW1lCHF1YW50aXR5BWFzc2V0BG1lbW8Gc3RyaW5nBgAAAAAAhWlEBWNsb3NlAAAAAACobNRFBmNyZWF0ZQAAAAAAAKUxdgVpc3N1ZQAAAAAAADBVpQRvcGVuAAAAAACo67K6BnJldGlyZQAAAABXLTzNzQh0cmFuc2ZlcgACAAAAOE9NETIDaTY0AAAHYWNjb3VudAAAAAAAkE3GA2k2NAAADmN1cnJlbmN5X3N0YXRzAAAAAA=='
    )
    export const abi = ABI.from(abiBlob)
    export class Contract extends BaseContract {
        constructor(args: PartialBy<ContractArgs, 'abi' | 'account'>) {
            super({
                client: args.client,
                abi: abi,
                account: Name.from('eosio.token'),
            })
        }
        action<T extends 'close' | 'create' | 'issue' | 'open' | 'retire' | 'transfer'>(
            name: T,
            data: ActionNameParams[T],
            options?: ActionOptions
        ): Action {
            return super.action(name, data, options)
        }
        table<T extends 'accounts' | 'stat'>(name: T, scope?: NameType) {
            return super.table(name, scope, TableMap[name])
        }
    }
    export interface ActionNameParams {
        close: ActionParams.Close
        create: ActionParams.Create
        issue: ActionParams.Issue
        open: ActionParams.Open
        retire: ActionParams.Retire
        transfer: ActionParams.Transfer
    }
    export namespace ActionParams {
        export interface Close {
            owner: NameType
            symbol: Asset.SymbolType
        }
        export interface Create {
            issuer: NameType
            maximum_supply: AssetType
        }
        export interface Issue {
            to: NameType
            quantity: AssetType
            memo: string
        }
        export interface Open {
            owner: NameType
            symbol: Asset.SymbolType
            ram_payer: NameType
        }
        export interface Retire {
            quantity: AssetType
            memo: string
        }
        export interface Transfer {
            from: NameType
            to: NameType
            quantity: AssetType
            memo: string
        }
    }
    export namespace Types {
        @Struct.type('account')
        export class Account extends Struct {
            @Struct.field(Asset)
            balance!: Asset
        }
        @Struct.type('close')
        export class Close extends Struct {
            @Struct.field(Name)
            owner!: Name
            @Struct.field(Asset.Symbol)
            symbol!: Asset.Symbol
        }
        @Struct.type('create')
        export class Create extends Struct {
            @Struct.field(Name)
            issuer!: Name
            @Struct.field(Asset)
            maximum_supply!: Asset
        }
        @Struct.type('currency_stats')
        export class CurrencyStats extends Struct {
            @Struct.field(Asset)
            supply!: Asset
            @Struct.field(Asset)
            max_supply!: Asset
            @Struct.field(Name)
            issuer!: Name
        }
        @Struct.type('issue')
        export class Issue extends Struct {
            @Struct.field(Name)
            to!: Name
            @Struct.field(Asset)
            quantity!: Asset
            @Struct.field('string')
            memo!: string
        }
        @Struct.type('open')
        export class Open extends Struct {
            @Struct.field(Name)
            owner!: Name
            @Struct.field(Asset.Symbol)
            symbol!: Asset.Symbol
            @Struct.field(Name)
            ram_payer!: Name
        }
        @Struct.type('retire')
        export class Retire extends Struct {
            @Struct.field(Asset)
            quantity!: Asset
            @Struct.field('string')
            memo!: string
        }
        @Struct.type('transfer')
        export class Transfer extends Struct {
            @Struct.field(Name)
            from!: Name
            @Struct.field(Name)
            to!: Name
            @Struct.field(Asset)
            quantity!: Asset
            @Struct.field('string')
            memo!: string
        }
    }
    const TableMap = {
        accounts: Types.Account,
        stat: Types.CurrencyStats,
    }
}
export default EosioToken
