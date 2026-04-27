import pg from 'pg';
import { BaseAdapter } from './BaseAdapter.js';

const { Pool } = pg;

export class PostgresAdapter extends BaseAdapter {
  constructor() {
    super();
    let connectionString = process.env.DATABASE_URL;
    if (connectionString) {
        connectionString = connectionString.replace(/%0A/g, '').replace(/\n/g, '');
    }
    this.pool = new Pool({
      connectionString,
      onConnect: () => console.log('Connected to PostgreSQL'),
      ssl: {
        rejectUnauthorized: false,
      },
    });
    this._tableColumns = {};
  }

  async _getValidColumns(table, client) {
    if (this._tableColumns[table]) return this._tableColumns[table];
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table]
    );
    const cols = res.rows.map(r => r.column_name);
    this._tableColumns[table] = cols;
    return cols;
  }

  async _preparePayload(table, data, client) {
    const cols = await this._getValidColumns(table, client);
    if (!cols || cols.length === 0) return data;

    const cleanPayload = {};
    const metadata = { ...(data.metadata || {}) };

    for (const [k, v] of Object.entries(data)) {
        if (k === 'metadata') continue;

        let sanitizedValue = v;
        if (v === '__server_timestamp__') {
            sanitizedValue = new Date().toISOString();
        }

        if (cols.includes(k)) {
            // Stringify objects/arrays explicitly so pg inserts them safely into jsonb
            if (sanitizedValue !== null && typeof sanitizedValue === 'object' && !(sanitizedValue instanceof Date)) {
                cleanPayload[k] = JSON.stringify(sanitizedValue);
            } else {
                cleanPayload[k] = sanitizedValue;
            }
        } else if (table === 'users' && k === 'user_name' && cols.includes('name')) {
            cleanPayload['name'] = sanitizedValue;
        } else if (table === 'users' && k === 'role_id' && cols.includes('role')) {
            cleanPayload['role'] = sanitizedValue;
        } else {
            // Keep as raw object/type for metadata JSON tree
            metadata[k] = sanitizedValue;
        }
    }
    
    if (cols.includes('metadata') && Object.keys(metadata).length > 0) {
        cleanPayload.metadata = JSON.stringify(metadata);
    }
    return cleanPayload;
  }

  _mapOut(table, row) {
    if (!row) return row;
    if (row.metadata) {
      const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
      Object.assign(row, meta);
    }
    if (table === 'users') {
      if (row.name && !row.user_name) row.user_name = row.name;
      if (row.role && !row.role_id) row.role_id = row.role;
    }
    return row;
  }

  async findMany(table, options = {}) {
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM ${table}`;
      const res = await client.query(query);
      return res.rows.map(r => this._mapOut(table, r));
    } finally {
      client.release();
    }
  }

  async findOne(table, id) {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
      return this._mapOut(table, res.rows[0]);
    } finally {
      client.release();
    }
  }

  async create(table, data, id = null) {
    const client = await this.pool.connect();
    try {
      const dbId = id || 'PG-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const initialPayload = { ...data, id: dbId, created_at: new Date().toISOString() };
      
      const payload = await this._preparePayload(table, initialPayload, client);

      const keys = Object.keys(payload);
      const values = Object.values(payload);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const res = await client.query(query, values);
      return this._mapOut(table, res.rows[0]);
    } finally {
      client.release();
    }
  }

  async update(table, id, data) {
    const client = await this.pool.connect();
    try {
      const initialPayload = { ...data, updated_at: new Date().toISOString() };
      const payload = await this._preparePayload(table, initialPayload, client);
      
      const keys = Object.keys(payload);
      if (keys.length === 0) return this.findOne(table, id);

      const values = Object.values(payload);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      values.push(id); 

      const query = `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
      const res = await client.query(query, values);
      return this._mapOut(table, res.rows[0]);
    } finally {
      client.release();
    }
  }

  async remove(table, id) {
    const client = await this.pool.connect();
    try {
      await client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
      return { success: true };
    } finally {
      client.release();
    }
  }
}

