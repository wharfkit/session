import fetch from 'node-fetch'
import {join as joinPath} from 'path'
import {promisify} from 'util'
import {readFile as _readFile, writeFile as _writeFile} from 'fs'
import {APIClient, Bytes, Checksum160, FetchProvider} from '@greymass/eosio'
import {Fetch} from '$lib'

const readFile = promisify(_readFile)
const writeFile = promisify(_writeFile)

export class MockFetchProvider implements FetchProvider {
    readonly fetch: Fetch
    readonly fetchProvider: FetchProvider
    readonly url: string

    constructor(url = 'https://jungle4.greymass.com') {
        this.fetch = fetch
        this.url = url
        this.fetchProvider = new FetchProvider(this.url, {fetch})
    }

    getFilename(path: string, params?: unknown) {
        const digest = Checksum160.hash(
            Bytes.from(this.url + path + (params ? JSON.stringify(params) : ''), 'utf8')
        ).hexString
        return joinPath(__dirname, '../data', digest + '.json')
    }

    async getExisting(filename: string) {
        try {
            const data = await readFile(filename)
            return JSON.parse(data.toString('utf8'))
        } catch (error) {
            if ((<any>error).code !== 'ENOENT') {
                throw error
            }
        }
    }

    async call(path: string, params?: unknown) {
        const filename = this.getFilename(path, params)
        if (process.env['MOCK'] !== 'overwrite') {
            const existing = await this.getExisting(filename)
            if (existing) {
                return existing
            }
        }
        if (process.env['MOCK']) {
            const response = await this.fetchProvider.call(path, params)
            const json = JSON.stringify(response, undefined, 4)
            await writeFile(filename, json)
            return response
        } else {
            throw new Error(`No data for ${path}`)
        }
    }
}

export function makeClient(url?: string) {
    return new APIClient({
        provider: new MockFetchProvider(url),
    })
}
