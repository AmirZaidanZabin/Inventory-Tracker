import { apiFetch } from './api.js';

class ApiClient {
    async get(endpoint, options = {}) {
        let path = `/api/${endpoint}`;
        const params = new URLSearchParams();
        if (options.limit) params.append("limit", options.limit);
        if (options.page) params.append("page", options.page);
        if (options.fields) {
            params.append("fields", Array.isArray(options.fields) ? options.fields.join(",") : options.fields);
        }
        if (Array.from(params.keys()).length > 0) {
            path += `?${params.toString()}`;
        }
        return await apiFetch(path);
    }

    async getById(endpoint, id) {
        return await apiFetch(`/api/${endpoint}/${id}`);
    }

    async post(endpoint, data, id = null) {
        const payload = id ? { ...data, id } : data;
        return await apiFetch(`/api/${endpoint}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async put(endpoint, id, data) {
        return await apiFetch(`/api/${endpoint}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(endpoint, id) {
        await apiFetch(`/api/${endpoint}/${id}`, { method: 'DELETE' });
        return id;
    }

    async remove(endpoint, id) {
        return await this.delete(endpoint, id);
    }

    async logAction(action, details) {
        return await apiFetch("/api/audit_logs", {
            method: "POST",
            body: JSON.stringify({
                action,
                details,
                timestamp: this.serverTimestamp(),
            }),
        });
    }

    async bulkStockTake(data) {
        return await apiFetch("/api/stock_takes/bulk", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    // Aliases to match old FirebaseAdapter / db API
    async findMany(endpoint, options = {}) {
        return await this.get(endpoint, options);
    }

    async getMany(endpoint, options = {}) {
        return await this.get(endpoint, options);
    }

    async findOne(endpoint, id) {
        return await this.getById(endpoint, id);
    }

    async create(endpoint, data, id = null) {
        return await this.post(endpoint, data, id);
    }

    async update(endpoint, id, data) {
        return await this.put(endpoint, id, data);
    }

    subscribe(endpoint, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        let isStopped = false;
        const poll = async () => {
            if (isStopped) return;
            try {
                if (options?.id) {
                    const data = await this.getById(endpoint, options.id);
                    callback(data);
                } else {
                    const data = await this.get(endpoint, options);
                    callback(data);
                }
            } catch (e) {
                console.error("API Subscription Error:", e);
            }
            setTimeout(poll, 15000);
        };
        poll();
        return () => { isStopped = true; }; 
    }

    serverTimestamp() {
        return '__server_timestamp__';
    }
}

export const apiDb = new ApiClient();
