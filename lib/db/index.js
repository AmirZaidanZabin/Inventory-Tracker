
import { FirebaseAdminAdapter } from './providers/FirebaseAdminAdapter.js';
import { SupabaseAdapter } from './providers/SupabaseAdapter.js';
import { RestAdapter } from './providers/RestAdapter.js';

const ACTIVE_PROVIDER = process.env.DB_PROVIDER || 'firebase';

class DatabaseManager {
    constructor(provider) {
        switch(provider) {
            case 'firebase':
                this.adapter = new FirebaseAdminAdapter();
                break;
            case 'supabase':
                this.adapter = new SupabaseAdapter();
                break;
            case 'rest':
                this.adapter = new RestAdapter();
                break;
            default:
                this.adapter = new FirebaseAdminAdapter();
        }
    }

    async findMany(table, options = {}) {
        return await this.adapter.findMany(table, options);
    }

    async findOne(table, id) {
        return await this.adapter.findOne(table, id);
    }

    async create(table, data, id = null) {
        return await this.adapter.create(table, data, id);
    }

    async update(table, id, data) {
        return await this.adapter.update(table, id, data);
    }

    async remove(table, id) {
        return await this.adapter.remove(table, id);
    }

    async updateOrCreate(table, id, data) {
        if (this.adapter.updateOrCreate) {
            return await this.adapter.updateOrCreate(table, id, data);
        }
        const existing = await this.findOne(table, id);
        if (existing) {
            return await this.update(table, id, data);
        } else {
            return await this.create(table, data, id);
        }
    }

    serverTimestamp() {
        return this.adapter.serverTimestamp();
    }
}

export const db = new DatabaseManager(ACTIVE_PROVIDER);
