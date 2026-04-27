# Firebase to PostgreSQL Architecture Refactoring Guide

## Overview

This guide outlines the transition of the application’s data persistence layer from a NoSQL paradigm (Firebase Realtime Database) to a structured relational paradigm (Google Cloud SQL for PostgreSQL). It also implements a Hybrid Compatibility Data Layer (Repository Pattern) enabling the application to swap dynamically between Firebase and Postgres by simply altering an environment variable.

---

## 1. Schema Mapping & Normalization

### Current Firebase Schema (Heuristic Example)
Firebase Realtime Database represents objects as heavily denormalized JSON trees:
```json
{
  "users": {
    "user123": { "name": "Alice", "role": "admin" }
  },
  "appointments": {
    "apt1": {
      "user_id": "user123",
      "schedule_date": "2026-05-01",
      "location_name": "Site A"
    }
  }
}
```

### New PostgreSQL Normalized Schema
To capitalize on Postgres’ ACID compliance and relational structure, the schema must be fully normalized using table schemas.

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    schedule_date DATE NOT NULL,
    location_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for frequent query patterns
CREATE INDEX idx_appointments_schedule ON appointments(schedule_date);
```

---

## 2. Infrastructure & Environment Configuration

Connections to Google Cloud SQL utilize the `pg` driver using Connection Strings or Google Cloud SQL Auth Proxy for IAM authentication. Do not hardcode credentials in source control.

**`.env` Configuration Variables:**
```env
# Define the Active Database Provider ('firebase', 'supabase', 'postgres', or 'rest')
DB_PROVIDER=postgres

# PostgreSQL Connection String (Use Google Cloud SQL Auth Proxy for Production)
DATABASE_URL=postgres://myuser:mypassword@localhost:5432/mytrafficapp

# Firebase Details (if falling back)
FIREBASE_SERVICE_ACCOUNT={"project_id": "..."}
```

---

## 3. Hybrid Data Layer (Repository/Factory Pattern)

The codebase has been refactored to support Dynamic Injection. A standard Interface (`BaseAdapter.js`) dictates the standard operations.

### Core Interface Methods
* `findMany(table, options)`
* `findOne(table, id)`
* `create(table, data, id)`
* `update(table, id, data)`
* `remove(table, id)`

### The Factory (`/src/lib/db/index.js`)
It reads `process.env.DB_PROVIDER` at initialization and delegates calls to the appropriate repository implementation (`FirebaseAdminAdapter.js` or `PostgresAdapter.js`). No controller or router knows the underlying persistence mechanism. No business logic leaks.

---

## 4. PostgreSQL Data Access Layer (DAL) Refactoring

The `PostgresAdapter.js` implements the base adapter utilizing standard parameterized `pg` queries to defeat SQL Injection.

* **Firebase `.push()` / `.set()` -> Postgres `INSERT`**: Use parameterized binding (`$1, $2`).
* **Firebase `.update()` -> Postgres `UPDATE`**: Dynamically map JSON keys to SQL `SET` assignments.
* **Firebase `.remove()` -> Postgres `DELETE`**: Soft deletes (`is_deleted = true`) or hard cascades depending on requirements.

### Atomic Transactions
To handle multi-table synchronized updates that Firebase relies on atomic multi-path sets for, `pg` implements standard SQL blocks:
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO table1 (...) VALUES (...)');
  await client.query('UPDATE table2 SET (...)');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

This ensures "Zero Downtime" flip capabilities by aligning with identical inputs and outputs across all persistence layers.
