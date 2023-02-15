import {SessionStorage} from 'src/kit'

export class MockStorage implements SessionStorage {
    data: Record<string, string> = {}
    async write(key: string, data: string): Promise<void> {
        this.data[key] = data
    }
    async read(key: string): Promise<string | null> {
        return this.data[key]
    }
    async remove(key: string): Promise<void> {
        delete this.data[key]
    }
    storageKey(key: string) {
        return `mock-${key}`
    }
}
