# Deep Source Code & Migration Integrity Audit 

**Role:** Elite Full-Stack Security & Performance Auditor  
**Focus:** Node.js (v20), Vanilla JS, PostgreSQL (pg, Raw SQL)  

---

## 1. Code Ingestion & Mapping

The application's migration from Firebase SDK (`onSnapshot`, `getDocs`) to PostgreSQL relies on an abstraction layer (`PostgresAdapter.js` on the backend and `RestAdapter.js` on the frontend). While the initial structure routes database logic functionally to PostgreSQL, several implementation details inherently carry over NoSQL paradigms that break SQL systems.

### File Manifest Audited
| File Category | File Paths Analyzed |
|---|---|
| **DAL (Database Access Layer)** | `/lib/db/providers/PostgresAdapter.js` |
| **Backend REST & API Logic** | `/server.js` |
| **Frontend Sync Layer** | `/src/lib/db/providers/RestAdapter.js` |

---

## 2. Schema Consistency Check 

**Finding: The `__server_timestamp__` mapping has serialization issues.**
Firebase naturally stores Timestamps as an object (`{ nanoseconds, seconds }`). The `PostgresAdapter` converts the constant `'__server_timestamp__'` into `new Date().toISOString()`. However, other timestamp objects (like `updated_at` timestamps sent manually) may not be parsed properly if the client attempts to pass Firebase objects instead of standard ISO strings.

---

## 3. SQL Security & Logic Audit

### **A. N+1 & Memory Saturation (Full Table Scans) [High Severity]**
NoSQL systems promote fetching collections heavily. Translated to `server.js`, developers fetch the *entire un-filtered table* into Node.js memory just to find a single record or filter it iteratively in memory.

**File:** `server.js`
**Line:** 493-500
**Issue:** `app.get("/api/sales/check-cr/:cr")` fetches the entire table.

#### Suboptimal Code (Before):
```javascript
const allMerchants = await db.findMany('merchants');
const merchant = allMerchants.find(m => m.cr_number === cr);

const allLeads = await db.findMany('leads');
const activeLead = allLeads.find(l => l.cr_number === cr && ["draft", "pending", "approved"].includes(l.status));
```

#### Optimized Code (After):
The `PostgresAdapter` must be modified to allow `WHERE` clauses, or a direct query should be executed.
```javascript
// PostgresAdapter.js modification required to support WHERE options
// OR use direct parameterization in server.js:
const merchantResult = await db.pool.query('SELECT * FROM merchants WHERE cr_number = $1 LIMIT 1', [cr]);
const merchant = merchantResult.rows[0];

const leadResult = await db.pool.query('SELECT * FROM leads WHERE cr_number = $1 AND status = ANY($2) LIMIT 1', [cr, ["draft", "pending", "approved"]]);
const activeLead = leadResult.rows[0];
```

### **B. SQL Interpolation / Command Injection Vector [Medium Severity]**
In `PostgresAdapter.js`, table operations are injected via template literals rather than explicit parametrization. While backend Express routes (`server.js`) currently limit inputs via a strict `const collections = ["vans", ...]` array, if an endpoint ever allows dynamic user-input for `table`, this creates a zero-day exploit.

**File:** `lib/db/providers/PostgresAdapter.js`
**Line:** 88, 99, 118, 139, 150

#### Suboptimal Code (Before):
```javascript
async findOne(table, id) {
  const client = await this.pool.connect();
  try {
    const res = await client.query(`SELECT * FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
// ...
```

#### Secure Recommendation:
Whitelist table names explicitly inside the adapter prior to injection, or throw an error.
```javascript
// At the top of PostgresAdapter.js
const VALID_TABLES = new Set(['users', 'leads', 'merchants', 'vans', /* ... */]);

async findOne(table, id) {
  if (!VALID_TABLES.has(table)) throw new Error('Invalid table reference');
  const client = await this.pool.connect();
  // ... proceed safely
```

### **C. Connection Pool Check [Pass]**
All instances of `const client = await this.pool.connect();` are appropriately wrapped in `try/finally { client.release(); }`. This correctly mitigates pool exhaustion drops.

---

## 4. Real-time Logic Gap Analysis

### **A. "Denial of Wallet / Server" (1-Second Full Table Polling) [Critical Severity]**
The frontend attempts to maintain Firebase's `.onSnapshot` parity by initiating an infinite `setTimeout()` loop in `RestAdapter.js`. It fetches the **entire** un-filtered endpoint table every 1000ms. If 10 users open a dashboard, the server experiences (10 req/s * Table Size payload), instantly crashing the `pg.Pool` or freezing the Node.js event loop.

**File:** `src/lib/db/providers/RestAdapter.js`
**Line:** 53-70

#### Suboptimal Code (Before):
```javascript
subscribe(table, options, callback) {
    let isStopped = false;
    const poll = async () => {
        if (isStopped) return;
        // ...
            const data = await this.findMany(table, options);
            callback(data);
        // ...
        setTimeout(poll, 1000); // 🚨 DANGER 🚨
    };
    poll();
    return () => { isStopped = true; }; 
}
```

#### Optimized Code (After):
Replace generic 1-second short polling with **WebSockets** or **Server-Sent Events (SSE)**. If polling must be retained as a fallback, you must index by `updated_at` and implement long-polling parameterization.
```javascript
// Short-term mitigation fix using Cache Headers/ETags or simply backing off:
setTimeout(poll, 15000); // Back off to 15s immediately to prevent DDoSing yourself
```

---

## 5. Production Readiness Checklist

- [ ] **Critical:** Refactor `src/lib/db/providers/RestAdapter.js` to eliminate the 1s `setTimeout` full-table polling loop. Implement SSE or WebSockets via Node.js.
- [ ] **Critical:** Remove Javascript `Array.find()` memory-filtering patterns in `server.js`. Offload data joins and filtering to PostgreSQL `WHERE` clauses.
- [ ] **Security:** Implement a strict whitelisting function for all dynamically injected `${table}` variables in `PostgresAdapter.js`.
- [ ] **Parity:** Add logic to `.create()` array mapping to handle JS Dates, returning standard ISO-strings for timeline charts in the frontend Vanilla JS views over JSON payloads.
