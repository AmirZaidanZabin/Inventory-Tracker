import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
let connectionString = process.env.DATABASE_URL;
if (connectionString) {
    connectionString = connectionString.replace(/%0A/g, '').replace(/\n/g, '');
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const schema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS roles ( id VARCHAR(50) PRIMARY KEY, role_id VARCHAR(50), role_name VARCHAR(255), authorities JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS users ( id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50), role_id VARCHAR(50), user_name VARCHAR(255), email VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

-- Alter existing users table if badly defined
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS vans ( id VARCHAR(50) PRIMARY KEY, van_id VARCHAR(50), location_id VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS product_types ( id VARCHAR(50) PRIMARY KEY, type_id VARCHAR(50), name VARCHAR(255), catalog_id VARCHAR(50), duration_minutes INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS item_types ( id VARCHAR(50) PRIMARY KEY, type_id VARCHAR(50), name VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS item_catalog ( id VARCHAR(50) PRIMARY KEY, catalog_id VARCHAR(50), item_name VARCHAR(255), provider VARCHAR(255), item_type VARCHAR(50), duration_minutes INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS items ( id VARCHAR(50) PRIMARY KEY, item_id VARCHAR(50), catalog_id VARCHAR(50), current_location_type VARCHAR(50), current_location_id VARCHAR(50), is_available BOOLEAN, status VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS appointments ( id VARCHAR(50) PRIMARY KEY, appointment_id VARCHAR(50), tech_id VARCHAR(50), user_id VARCHAR(50), van_id VARCHAR(50), product_type_id VARCHAR(50), status VARCHAR(50), appointment_name VARCHAR(255), schedule_date DATE, appointment_time VARCHAR(10), location_name VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS stock_take_logs ( id VARCHAR(50) PRIMARY KEY, log_id VARCHAR(50), user_id VARCHAR(50), van_id VARCHAR(50), log_type VARCHAR(50), scanned_items JSONB, discrepancies JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS custom_forms ( id VARCHAR(50) PRIMARY KEY, form_name VARCHAR(255), schema_definition JSONB, fields JSONB, entities JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS forms ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), fields JSONB, entities JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS form_submissions ( id VARCHAR(50) PRIMARY KEY, form_id VARCHAR(50), appointment_id VARCHAR(50), submitted_by VARCHAR(50), data JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS saved_reports ( id VARCHAR(50) PRIMARY KEY, creator_id VARCHAR(50), name VARCHAR(255), query JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS triggers ( id VARCHAR(50) PRIMARY KEY, event_type VARCHAR(100), action_to_take VARCHAR(100), condition_logic JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS leads ( id VARCHAR(50) PRIMARY KEY, merchant_name VARCHAR(255), cr_number VARCHAR(100), status VARCHAR(50), owner_id VARCHAR(50), country VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, approved_at TIMESTAMP WITH TIME ZONE, rejected_at TIMESTAMP WITH TIME ZONE, current_approver_uid VARCHAR(50), breach_details JSONB, metadata JSONB );

CREATE TABLE IF NOT EXISTS merchants ( id VARCHAR(50) PRIMARY KEY, merchant_name VARCHAR(255), merchant_reference VARCHAR(100), cr_number VARCHAR(100), country VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS approvals ( id VARCHAR(50) PRIMARY KEY, lead_id VARCHAR(50), status VARCHAR(50), tier_id VARCHAR(50), approver_uid VARCHAR(50), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, resolved_by VARCHAR(50), resolved_at TIMESTAMP WITH TIME ZONE, notes TEXT, metadata JSONB );

CREATE TABLE IF NOT EXISTS app_settings ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), value JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS audit_logs ( id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50), user_email VARCHAR(255), action VARCHAR(255), collection VARCHAR(50), document_id VARCHAR(50), previous_data JSONB, new_data JSONB, context VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS pricing_tiers ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), level INTEGER, approver_email VARCHAR(255), min_monthly_gmv NUMERIC, thresholds JSONB, approval_strategy VARCHAR(50), nbr_threshold NUMERIC, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );

CREATE TABLE IF NOT EXISTS pricing_cards ( id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), min_pct NUMERIC, max_pct NUMERIC, min_flat NUMERIC, max_flat NUMERIC, default_pct NUMERIC, mandatory BOOLEAN, active_countries JSONB, sort_order INTEGER, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, metadata JSONB );
`;

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(schema);
        await client.query('COMMIT');
        console.log("Full Schema Initialized!");
    } catch(e) {
        await client.query('ROLLBACK');
        console.error(e);
    } finally {
        client.release();
        process.exit();
    }
}
migrate();
