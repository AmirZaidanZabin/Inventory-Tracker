
import fetch from 'node-fetch';
import { BaseAdapter } from './BaseAdapter.js';

export class RestAdapter extends BaseAdapter {
    constructor(config = {}) {
        super();
        this.baseUrl = config.baseUrl || process.env.EXTERNAL_API_URL;
        this.apiKey = config.apiKey || process.env.EXTERNAL_API_KEY;
    }

    async findMany(table, options = {}) {
        if (!this.baseUrl) throw new Error('RestAdapter: baseUrl not configured');
        const res = await fetch(`${this.baseUrl}/${table}`, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
        return await res.json();
    }

    async findOne(table, id) {
        if (!this.baseUrl) throw new Error('RestAdapter: baseUrl not configured');
        const res = await fetch(`${this.baseUrl}/${table}/${id}`, {
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
        return await res.json();
    }

    async create(table, data, id = null) {
        const url = id ? `${this.baseUrl}/${table}/${id}` : `${this.baseUrl}/${table}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
        return await res.json();
    }

    async update(table, id, data) {
        const res = await fetch(`${this.baseUrl}/${table}/${id}`, {
            method: 'PUT',
            headers: { 
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
        return await res.json();
    }

    async remove(table, id) {
        const res = await fetch(`${this.baseUrl}/${table}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${this.apiKey}` }
        });
        if (!res.ok) throw new Error(`REST Error: ${res.statusText}`);
        return id;
    }
}
