
import admin from "firebase-admin";
import { BaseAdapter } from "./BaseAdapter.js";

export class FirebaseAdminAdapter extends BaseAdapter {
  constructor(config = {}) {
    super();
    this._rtdb = null;
    
    // Schemas from original server.js logic
    this.SCHEMAS = {
      test_collection: { essentials: ['name', 'timestamp', 'created_at', 'updated_at'] },
      roles: { essentials: ['role_id', 'id', 'role_name', 'authorities', 'created_at', 'updated_at', 'metadata'] },
      users: { essentials: ['user_id', 'id', 'role_id', 'user_name', 'email', 'created_at', 'updated_at', 'metadata'] },
      vans: { essentials: ['van_id', 'id', 'location_id', 'created_at', 'updated_at', 'metadata'] },
      product_types: { essentials: ['type_id', 'id', 'name', 'catalog_id', 'duration_minutes', 'created_at', 'updated_at', 'metadata'] },
      item_types: { essentials: ['type_id', 'id', 'name', 'created_at', 'updated_at', 'metadata'] },
      item_catalog: { essentials: ['catalog_id', 'id', 'item_name', 'provider', 'item_type', 'duration_minutes', 'created_at', 'updated_at', 'metadata'] },
      items: { essentials: ['item_id', 'id', 'catalog_id', 'current_location_type', 'current_location_id', 'is_available', 'status', 'created_at', 'updated_at', 'metadata'] },
      appointments: { essentials: ['appointment_id', 'id', 'tech_id', 'user_id', 'van_id', 'product_type_id', 'status', 'appointment_name', 'schedule_date', 'appointment_time', 'location_name', 'created_at', 'updated_at', 'metadata'] },
      stock_take_logs: { essentials: ['log_id', 'id', 'user_id', 'van_id', 'log_type', 'scanned_items', 'discrepancies', 'created_at', 'updated_at', 'metadata'] },
      custom_forms: { essentials: ['id', 'form_name', 'schema_definition', 'fields', 'entities', 'created_at', 'updated_at', 'metadata'] },
      forms: { essentials: ['id', 'name', 'fields', 'entities', 'created_at', 'updated_at', 'metadata'] },
      form_submissions: { essentials: ['id', 'form_id', 'appointment_id', 'submitted_by', 'data', 'created_at', 'updated_at', 'metadata'] },
      saved_reports: { essentials: ['id', 'creator_id', 'name', 'query', 'created_at', 'updated_at', 'metadata'] },
      triggers: { essentials: ['id', 'event_type', 'action_to_take', 'condition_logic', 'created_at', 'updated_at', 'metadata'] },
      leads: { essentials: ['id', 'merchant_name', 'cr_number', 'status', 'owner_id', 'country', 'created_at', 'updated_at', 'approved_at', 'rejected_at', 'current_approver_uid', 'breach_details'] },
      merchants: { essentials: ['id', 'merchant_name', 'merchant_reference', 'cr_number', 'country', 'created_at', 'updated_at', 'metadata'] },
      approvals: { essentials: ['id', 'lead_id', 'status', 'tier_id', 'approver_uid', 'created_at', 'updated_at', 'resolved_by', 'resolved_at', 'notes'] },
      pricing_tiers: { essentials: ['id', 'name', 'level', 'approver_email', 'min_monthly_gmv', 'thresholds', 'approval_strategy', 'nbr_threshold', 'created_at', 'updated_at'] },
      pricing_cards: { essentials: ['id', 'name', 'min_pct', 'max_pct', 'min_flat', 'max_flat', 'default_pct', 'mandatory', 'active_countries', 'sort_order', 'created_at', 'updated_at'] }
    };
  }

  get rtdb() {
    if (!this._rtdb) {
      try {
        this._rtdb = admin.database();
      } catch (e) {
        if (e.code === 'app/no-app') {
          throw new Error('Firebase Admin not initialized. Ensure initializeApp() is called before database access.');
        }
        throw e;
      }
    }
    return this._rtdb;
  }

  async findMany(table, options = {}) {
    const snap = await this.rtdb.ref(table).once('value');
    const val = snap.val() || {};
    
    // Quick list: just return essentials (no history join) for list performance
    const results = Object.keys(val).map((id) => {
        const essentialData = val[id];
        if (!essentialData) return null;
        
        const out = { ...essentialData, id };
        // Convert RTDB numeric timestamps to ISO strings
        ['created_at', 'updated_at', 'timestamp', '__entry_timestamp__'].forEach(k => {
          if (typeof out[k] === 'number' && !isNaN(out[k]) && isFinite(out[k])) out[k] = new Date(out[k]).toISOString();
        });
        return out;
    });
    return results.filter(d => d !== null);
  }

  async findOne(table, id) {
    const essentialSnap = await this.rtdb.ref(`${table}/${id}`).once('value');
    const essentialData = essentialSnap.val();
    if (!essentialData) return null;

    // Join with latest history
    const historySnap = await this.rtdb.ref(`${table}_history/${id}`).orderByKey().limitToLast(1).once('value');
    const historyData = historySnap.val();
    let transactional = {};
    if (historyData) {
      const latestKey = Object.keys(historyData)[0];
      transactional = historyData[latestKey];
    }
    const out = { ...essentialData, ...transactional, id };
    
    // Convert RTDB numeric timestamps to ISO strings
    ['created_at', 'updated_at', 'timestamp', '__entry_timestamp__'].forEach(k => {
      if (typeof out[k] === 'number' && !isNaN(out[k]) && isFinite(out[k])) out[k] = new Date(out[k]).toISOString();
    });
    return out;
  }

  async create(table, data, id = null) {
    return await this._save(table, id, data);
  }

  async update(table, id, data) {
    return await this._save(table, id, data);
  }

  async updateOrCreate(table, id, data) {
    return await this._save(table, id, data);
  }

  async _save(table, id, data) {
    const schema = this.SCHEMAS[table];
    const idToUse = id || data.id || data[`${table.slice(0, -1)}_id`] || Math.random().toString(36).substr(2, 9);
    
    const processData = (d) => {
       const out = { ...d };
       const sensitiveFields = ['password', 'secret', 'token'];
       Object.keys(out).forEach(k => {
         if (out[k] === '__server_timestamp__') out[k] = admin.database.ServerValue.TIMESTAMP;
         if (sensitiveFields.includes(k.toLowerCase())) delete out[k];
       });
       return out;
    };

    const unflatten = (obj) => {
      const result = {};
      for (const key in obj) {
        if (key.includes('.')) {
          const parts = key.split('.');
          let current = result;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current)) current[part] = {};
            current = current[part];
          }
          current[parts[parts.length - 1]] = obj[key];
        } else {
          result[key] = obj[key];
        }
      }
      return result;
    };

    const cleanData = processData(data);
    console.log(`[DB_WRITE] ${table}/${idToUse}:`, cleanData);

    if (!schema) {
      await this.rtdb.ref(`${table}/${idToUse}`).set(unflatten(cleanData));
      return { id: idToUse };
    }

    const essentials = { id: idToUse };
    const transactional = { ...cleanData };

    schema.essentials.forEach(f => {
      if (cleanData[f] !== undefined) {
        essentials[f] = cleanData[f];
        delete transactional[f];
      }
    });

    Object.keys(cleanData).forEach(k => {
      if (k.endsWith('_id') || k === 'id') essentials[k] = cleanData[k];
    });

    await this.rtdb.ref(`${table}/${idToUse}`).update(unflatten(essentials));
    await this.rtdb.ref(`${table}_history/${idToUse}`).push({
        ...unflatten(transactional),
        __entry_timestamp__: admin.database.ServerValue.TIMESTAMP
    });

    return { id: idToUse };
  }

  async remove(table, id) {
    await this.rtdb.ref(`${table}/${id}`).remove();
    return id;
  }

  serverTimestamp() {
    return '__server_timestamp__';
  }
}
