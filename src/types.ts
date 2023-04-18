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

export type ChainLogoType = ChainLogo | {dark: string; light: string} | string

@Struct.type('chain_logo')
export class ChainLogo extends Struct {
    @Struct.field('string') declare dark: string
    @Struct.field('string') declare light: string

    static from(value: ChainLogoType): ChainLogo {
        if (typeof value === 'string') {
            return new ChainLogo({light: value, dark: value})
        }
        return new ChainLogo(value)
    }
}

/**
 * A list of known chain IDs and their logos.
 */
export const chainLogos: Map<Checksum256Type, ChainLogoType> = new Map([
    [
        'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
        'https://assets.wharfkit.com/chain/eos.png',
    ],
    [
        '21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c',
        'https://assets.wharfkit.com/chain/fio.png',
    ],
    [
        'b20901380af44ef59c5918439a1f9a41d83669020319a80574b804a5f95cbd7e',
        'https://assets.wharfkit.com/chain/fio.png',
    ],
    [
        '2a02a0053e5a8cf73a56ba0fda11e4d92e0238a4a2aa74fccf46d5a910746840',
        'https://assets.wharfkit.com/chain/jungle.png',
    ],
    [
        '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        'https://assets.wharfkit.com/chain/jungle.png',
    ],
    [
        '38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96465',
        'https://assets.wharfkit.com/chain/libre.png',
    ],
    [
        'b64646740308df2ee06c6b72f34c0f7fa066d940e831f752db2006fcc2b78dee',
        'https://assets.wharfkit.com/chain/libre.png',
    ],
    [
        '384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0',
        'https://assets.wharfkit.com/chain/proton.png',
    ],
    [
        '71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd',
        'https://assets.wharfkit.com/chain/proton.png',
    ],
    [
        '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
        'https://assets.wharfkit.com/chain/telos.png',
    ],
    [
        '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
        'https://assets.wharfkit.com/chain/telos.png',
    ],
    [
        '8fc6dce7942189f842170de953932b1f66693ad3788f766e777b6f9d22335c02',
        'https://assets.wharfkit.com/chain/ux.png',
    ],
    [
        '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
        'https://assets.wharfkit.com/chain/wax.png',
    ],
    [
        'f16b1833c747c43682f4386fca9cbb327929334a762755ebec17f6f23c9b8a12',
        'https://assets.wharfkit.com/chain/wax.png',
    ],
])

@Struct.type('explorer_definition')
export class ExplorerDefinition extends Struct {
    @Struct.field('string') declare prefix: string
    @Struct.field('string') declare suffix: string

    public url(id: string) {
        return `${this.prefix}${id}${this.suffix}`
    }
}

/**
 * The information required to interact with a given chain.
 */
@Struct.type('chain_definition')
export class ChainDefinition extends Struct {
    /**
     * The chain ID.
     */
    @Struct.field('checksum256') declare id: Checksum256
    /**
     * The base URL of the chain's API endpoint (e.g. https://jungle4.greymass.com).
     */
    @Struct.field('string') declare url: string
    /**
     * The absolute URL to the chain's logo.
     */
    @Struct.field(ChainLogo, {optional: true}) declare logo?: ChainLogoType
    /**
     * The explorer definition for the chain.
     */
    @Struct.field(ExplorerDefinition, {optional: true}) declare explorer?: ExplorerDefinition

    get name() {
        const id = String(this.id)
        return chainNames.has(id) ? chainNames.get(id) : 'Unknown blockchain'
    }
}

export type ChainDefinitionType =
    | ChainDefinition
    | {id: Checksum256Type; url: string; explorer?: ExplorerDefinition; logo?: string}

export type LocaleDefinitions = Record<string, any>

/**
 * Cancelable promises
 *
 * https://stackoverflow.com/questions/46461801/possible-to-add-a-cancel-method-to-promise-in-typescript/46464377#46464377
 */

export class Canceled extends Error {
    silent = false
    constructor(reason, silent = false) {
        super(reason)
        this.silent = silent
        Object.setPrototypeOf(this, Canceled.prototype)
    }
}

export interface Cancelable<T> extends Promise<T> {
    cancel(reason?: string, silent?: boolean): Cancelable<T>
}

export function cancelable<T>(
    promise: Promise<T>,
    onCancel?: (canceled: Canceled) => void
): Cancelable<T> {
    let cancel: ((reason: string, silent: boolean) => Cancelable<T>) | null = null
    const cancelable: Cancelable<T> = <Cancelable<T>>new Promise((resolve, reject) => {
        cancel = (reason = '', silent = false) => {
            try {
                if (onCancel) {
                    onCancel(new Canceled(reason, silent))
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
