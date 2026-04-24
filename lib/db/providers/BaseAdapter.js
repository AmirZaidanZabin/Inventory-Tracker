
/**
 * Base class for all server-side database adapters
 */
export class BaseAdapter {
    async findMany(table, options = {}) {
        throw new Error('Method findMany() must be implemented');
    }

    async findOne(table, id) {
        throw new Error('Method findOne() must be implemented');
    }

    async create(table, data, id = null) {
        throw new Error('Method create() must be implemented');
    }

    async update(table, id, data) {
        throw new Error('Method update() must be implemented');
    }

    async remove(table, id) {
        throw new Error('Method remove() must be implemented');
    }

    serverTimestamp() {
        return new Date().toISOString();
    }
}
