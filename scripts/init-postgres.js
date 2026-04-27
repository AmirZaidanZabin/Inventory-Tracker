import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS vans (
    id VARCHAR(50) PRIMARY KEY,
    van_id VARCHAR(50),
    primary_tech_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(50) PRIMARY KEY,
    location_id VARCHAR(50),
    name VARCHAR(255),
    type VARCHAR(50),
    lat NUMERIC,
    lng NUMERIC,
    radius NUMERIC,
    assigned_van_id VARCHAR(50) REFERENCES vans(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS item_types (
    id VARCHAR(50) PRIMARY KEY,
    type_id VARCHAR(50),
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS item_catalog (
    id VARCHAR(50) PRIMARY KEY,
    catalog_id VARCHAR(50),
    item_name VARCHAR(255),
    provider VARCHAR(255),
    item_type VARCHAR(50),
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS items (
    id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(50),
    catalog_id VARCHAR(50) REFERENCES item_catalog(id) ON DELETE CASCADE,
    current_location_type VARCHAR(50),
    current_location_id VARCHAR(50),
    is_available BOOLEAN DEFAULT true,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(50) PRIMARY KEY,
    appointment_id VARCHAR(50),
    appointment_name VARCHAR(255),
    tech_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    user_id VARCHAR(50),
    van_id VARCHAR(50) REFERENCES vans(id) ON DELETE SET NULL,
    product_type_id VARCHAR(50),
    schedule_date DATE,
    appointment_time VARCHAR(10),
    location_name VARCHAR(255),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS stock_take_logs (
    id VARCHAR(50) PRIMARY KEY,
    log_id VARCHAR(50),
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    van_id VARCHAR(50) REFERENCES vans(id) ON DELETE SET NULL,
    log_type VARCHAR(50),
    scanned_items JSONB,
    discrepancies JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS forms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    fields JSONB,
    entities JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS custom_forms (
    id VARCHAR(50) PRIMARY KEY,
    form_name VARCHAR(255),
    schema_definition JSONB,
    fields JSONB,
    entities JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS completed_forms (
    id VARCHAR(50) PRIMARY KEY,
    form_id VARCHAR(50),
    appointment_id VARCHAR(50) REFERENCES appointments(id) ON DELETE CASCADE,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_appointments_tech ON appointments(tech_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(schedule_date);
CREATE INDEX IF NOT EXISTS idx_items_catalog ON items(catalog_id);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(current_location_id);
CREATE INDEX IF NOT EXISTS idx_stock_take_logs_date ON stock_take_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_completed_forms_apt ON completed_forms(appointment_id);
`;

async function migrate() {
    console.log("Starting PostgreSQL schema initialization...");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(schema);
        await client.query('COMMIT');
        console.log("PostgreSQL schema initialized successfully.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
