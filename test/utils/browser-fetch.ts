import {Bytes, Checksum160} from '@greymass/eosio'

const data = global.MOCK_DATA

export function getFilename(path, params) {
    const digest = Checksum160.hash(
        Bytes.from(path + (params ? JSON.stringify(params) : ''), 'utf8')
    ).hexString
    return digest + '.json'
}

async function getExisting(filename) {
    return data[filename]
}

export async function mockFetch(path, params) {
    const filename = getFilename(path, params)
    const existing = await getExisting(filename)
    if (existing) {
        return new Response(existing.text, {
            status: existing.status,
            headers: existing.headers,
        })
    }
    throw new Error(`No data for ${path}`)
}
