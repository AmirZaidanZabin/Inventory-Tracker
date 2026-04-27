import pg from 'pg';
import { BaseAdapter } from './BaseAdapter.js';

const { Pool } = pg;

export class PostgresAdapter extends BaseAdapter {
  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async findMany(table, options = {}) {
    // simplified implementation
    const client = await this.pool.connect();
    try {
      let query = `SELECT * FROM ${table}`;
      // In a real app we would parse 'options' for filters, sorting, ordering.
      const res = await client.query(query);
      return res.rows;
    } finally {
      client.release();
    }
  }

  async findOne(table, id) {
    const client = await this.pool.connect();
    try {
      const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
      return res.rows[0] || null;
    } finally {
      client.release();
    }
  }

  async create(table, data, id = null) {
    const client = await this.pool.connect();
    try {
      const dbId = id || 'PG-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      const payload = { ...data, id: dbId, created_at: new Date().toISOString() };
      
      const keys = Object.keys(payload);
      const values = Object.values(payload);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const res = await client.query(query, values);
      return res.rows[0];
    } finally {
      client.release();
    }
  }

  async update(table, id, data) {
    const client = await this.pool.connect();
    try {
      const payload = { ...data, updated_at: new Date().toISOString() };
      const keys = Object.keys(payload);
      if (keys.length === 0) return this.findOne(table, id);

      const values = Object.values(payload);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      values.push(id); // push id for the where clause

      const query = `UPDATE ${table} SET ${setClauses} WHERE id = $${values.length} RETURNING *`;
      const res = await client.query(query, values);
      return res.rows[0];
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
