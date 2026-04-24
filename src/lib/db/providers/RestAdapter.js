
import { apiFetch } from '../../api.js';

export class RestAdapter {
    async findMany(table, options = {}) {
        return await apiFetch(`/api/${table}`);
    }

    async findOne(table, id) {
        return await apiFetch(`/api/${table}/${id}`);
    }

    async create(table, data, id = null) {
        const payload = id ? { ...data, id } : data;
        return await apiFetch(`/api/${table}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async update(table, id, data) {
        return await apiFetch(`/api/${table}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async remove(table, id) {
        await apiFetch(`/api/${table}/${id}`, { method: 'DELETE' });
        return id;
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

    subscribe(table, options, callback) {
        // Implementation of simple polling for REST-based real-time compatibility
        let isStopped = false;
        const poll = async () => {
            if (isStopped) return;
            try {
                if (options?.id) {
                    const data = await this.findOne(table, options.id);
                    callback(data);
                } else {
                    const data = await this.findMany(table, options);
                    callback(data);
                }
            } catch (e) {
                console.error("Rest Subscription Error:", e);
            }
            setTimeout(poll, 1000);
        };
        poll();
        return () => { isStopped = true; }; 
    }

    serverTimestamp() {
        return '__server_timestamp__';
    }
}
