import {TransactContext} from '../contexts'

export interface TransactPlugin {
    register: (context: TransactContext) => void
}

export abstract class AbstractTransactPlugin implements TransactPlugin {
    public abstract register(context: TransactContext): void
}
