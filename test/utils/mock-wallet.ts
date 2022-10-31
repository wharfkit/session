import {PrivateKey, WalletPluginPrivateKey} from '$lib'

export const privateKey = PrivateKey.from('5JnUd2V5nYmRKgK9K2fRQcs3qKoi4mbcGV8Dg8EFqjjqEp9tYP5')

export function makeWallet() {
    return new WalletPluginPrivateKey({
        privateKey,
    })
}
