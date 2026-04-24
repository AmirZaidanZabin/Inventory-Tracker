
import { createClient } from '@supabase/supabase-js';
import { BaseAdapter } from './BaseAdapter.js';

export class SupabaseAdapter extends BaseAdapter {
    constructor(config = {}) {
        super();
        const url = config.url || process.env.SUPABASE_URL;
        const key = config.key || process.env.SUPABASE_KEY;
        
        if (url && key) {
            this.client = createClient(url, key);
        } else {
            console.warn('SupabaseAdapter: Missing URL or KEY. Adapter will be limited.');
        }
    }

    async findMany(table, options = {}) {
        if (!this.client) throw new Error('Supabase not initialized');
        const { data, error } = await this.client.from(table).select('*');
        if (error) throw error;
        return data;
    }

    async findOne(table, id) {
        if (!this.client) throw new Error('Supabase not initialized');
        const { data, error } = await this.client.from(table).select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    }

    async create(table, data, id = null) {
        if (!this.client) throw new Error('Supabase not initialized');
        const payload = id ? { ...data, id } : data;
        const { data: result, error } = await this.client.from(table).insert([payload]).select().single();
        if (error) throw error;
        return result;
    }

    async update(table, id, data) {
        if (!this.client) throw new Error('Supabase not initialized');
        const { data: result, error } = await this.client.from(table).update(data).eq('id', id).select().single();
        if (error) throw error;
        return result;
    }

    async remove(table, id) {
        if (!this.client) throw new Error('Supabase not initialized');
        const { error } = await this.client.from(table).delete().eq('id', id);
        if (error) throw error;
        return id;
    }
}
