import {ABI, API, APIClient, Name} from '@greymass/eosio'
import {AbiProvider} from 'eosio-signing-request'

/**
 * Given an APIClient instance, this class provides an AbiProvider interface for retrieving and caching ABIs.
 */
export class ABICache implements AbiProvider {
    public readonly cache: Map<string, ABI> = new Map()
    public readonly pending: Map<string, Promise<API.v1.GetAbiResponse>> = new Map()

    constructor(public readonly client: APIClient) {}

    public async getAbi(account: Name): Promise<ABI> {
        const key = String(account)
        let record = this.cache.get(key)
        if (!record) {
            let getAbi = this.pending.get(key)
            if (!getAbi) {
                getAbi = this.client.v1.chain.get_abi(account)
                this.pending.set(key, getAbi)
            }
            const response = await getAbi
            this.pending.delete(key)
            if (response.abi) {
                record = ABI.from(response.abi)
                this.cache.set(key, record)
            } else {
                throw new Error(`ABI for ${key} could not be loaded.`)
            }
        }
        return record
    }
}