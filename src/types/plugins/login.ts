import {LoginContext} from '../contexts'

export interface LoginPlugin {
    register: (context: LoginContext) => void
}

export abstract class AbstractLoginPlugin implements LoginPlugin {
    public abstract register(context: LoginContext): void
}
