import {Checksum256, Checksum256Type, Struct} from '@greymass/eosio'

export type Fetch = (input: any, init?: any) => Promise<any>

/**
 * A list of chain IDs and their names for display purposes.
 */
export const chainNames: Map<Checksum256Type, string> = new Map([
    ['aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906', 'EOS'],
    ['21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c', 'FIO'],
    ['b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e', 'FIO (Testnet)'],
    ['2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840', 'Jungle 3 (Testnet)'],
    ['73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d', 'Jungle 4 (Testnet)'],
    ['5fff1dae8dc8e2fc4d5b23b2c7665c97f9e9d8edf2b6485a86ba311c25639191', 'Kylin (Testnet)'],
    ['38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96465', 'Libre'],
    ['b64646740308df2ee06c6b72f34c0f7fa066d940e831f752db2006fcc2b78dee', 'Libre (Testnet)'],
    ['384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0', 'Proton'],
    ['71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd', 'Proton (Testnet)'],
    ['4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11', 'Telos'],
    ['1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f', 'Telos (Testnet)'],
    ['8fc6dce7942189f842170de953932b1f66693ad3788f766e777b6f9d22335c02', 'UX'],
    ['1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4', 'WAX'],
    ['f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12', 'WAX (Testnet)'],
])

/**
 * The information required to interact with a given chain.
 */
@Struct.type('chain_definition')
export class ChainDefinition extends Struct {
    @Struct.field('checksum256') declare id: Checksum256
    @Struct.field('string') declare url: string

    get name() {
        const id = String(this.id)
        return chainNames.has(id) ? chainNames.get(id) : 'Unknown blockchain'
    }
}

export type ChainDefinitionType = ChainDefinition | {id: Checksum256Type; url: string}

/**
 * Cancelable promises
 *
 * https://stackoverflow.com/questions/46461801/possible-to-add-a-cancel-method-to-promise-in-typescript/46464377#46464377
 */

export class Canceled extends Error {
    constructor(reason) {
        super(reason)
        Object.setPrototypeOf(this, Canceled.prototype)
    }
}

export interface Cancelable<T> extends Promise<T> {
    cancel(reason?: string): Cancelable<T>
}

export function cancelable<T>(
    promise: Promise<T>,
    onCancel?: (canceled: Canceled) => void
): Cancelable<T> {
    let cancel: ((reason: string) => Cancelable<T>) | null = null
    const cancelable: Cancelable<T> = <Cancelable<T>>new Promise((resolve, reject) => {
        cancel = (reason = '') => {
            try {
                if (onCancel) {
                    onCancel(new Canceled(reason))
                }
            } catch (e) {
                reject(e)
            }
            return cancelable
        }
        promise.then(resolve, reject)
    })
    if (cancel) {
        cancelable.cancel = cancel
    }
    return cancelable
}
