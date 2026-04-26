
/**
 * Generic Database Interface
 * Decouples views from specific provider implementations (Firebase, etc.)
 */
import { FirebaseAdapter } from './providers/FirebaseAdapter.js';
import { RestAdapter } from './providers/RestAdapter.js';
import { SupabaseAdapter } from './providers/SupabaseAdapter.js';

// Retrieve the provider from Vite env vars, a global runtime config, or default to firebase
const PROVIDER = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DB_PROVIDER) 
                 || (typeof window !== 'undefined' && window.APP_CONFIG?.DB_PROVIDER) 
                 || 'rest';

class DatabaseManager {
    constructor(provider) {
        switch(provider.toLowerCase()) {
            case 'firebase':
                this.adapter = new FirebaseAdapter();
                break;
            case 'rest':
                this.adapter = new RestAdapter();
                break;
            case 'supabase':
                this.adapter = new SupabaseAdapter();
                break;
            default:
                this.adapter = new RestAdapter();
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

    async insert(table, data, id = null) {
        return await this.create(table, data, id);
    }

    async update(table, id, data) {
        return await this.adapter.update(table, id, data);
    }

    async updateOrCreate(table, id, data) {
        const existing = await this.findOne(table, id);
        if (existing) {
            return await this.update(table, id, data);
        } else {
            return await this.create(table, data, id);
        }
    }

    async remove(table, id) {
        return await this.adapter.remove(table, id);
    }

    subscribe(table, options, callback) {
        return this.adapter.subscribe(table, options, callback);
    }

    serverTimestamp() {
        return this.adapter.serverTimestamp();
    }

    async logAction(action, details) {
        if (this.adapter.logAction) {
            return await this.adapter.logAction(action, details);
        }
        // Fallback: standard create in audit_logs
        return await this.create('audit_logs', {
            action,
            details,
            timestamp: this.serverTimestamp()
        });
    }

    async bulkStockTake(data) {
        if (this.adapter.bulkStockTake) {
            return await this.adapter.bulkStockTake(data);
        }
        throw new Error("bulkStockTake not implemented for this adapter");
    }
}

export const db = new DatabaseManager(PROVIDER);
