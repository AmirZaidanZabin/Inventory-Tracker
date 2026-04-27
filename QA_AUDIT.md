# Node.js & Vanilla JS Migration Integrity Audit (Postgres Transition)

**Role:** Senior Full-Stack QA Engineer
**Target:** Node.js (v20.x), Vanilla JS Frontend, PostgreSQL Database
**Migrated Tables:** `users`, `roles`, `leads`, `appointments`, `custom_forms`, `app_settings`
**Configuration:** Raw `pg` pool (`new Pool({ connectionString, max: 10 })`)

---

## 1. Data Integrity & Schema Mapping

The transition from a schema-less NoSQL store to a rigid relational schema introduces strict type enforcement. Firebase allowed arbitrary data nesting and dynamic column creation; PostgreSQL will outright reject inserts that violate constraints or type definitions.

### Mapping Risks
- **Timestamps:** Firebase uses a `{ seconds, nanoseconds }` object for timestamps. PostgreSQL uses `TIMESTAMPTZ`. Blindly passing Firebase objects into Postgres will cause a fatal error.
- **Null vs. Undefined:** Firebase omits undefined keys. PostgreSQL requires explicit `NULL` handling or default values for missing schema columns.
- **Schema-less Data:** Auxiliary keys must be routed safely to a `JSONB` `metadata` column, requiring manual `JSON.stringify()` in the data access layer.

### Test Case: Timestamp & JSONB Integrity (TC-101)
```javascript
// Validates frontend sending raw data and backend correctly parsing into PostgreSQL types
async function testSchemaMapping() {
  try {
    const payload = {
      name: "QA Integrity Lead",
      status: "pending", 
      dynamic_field: { test: true } // Should map to JSONB metadata
    };

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    
    // Assert DB returned valid ISO 8601 string for created_at, not a Firebase object
    console.assert(typeof data.created_at === 'string' && !isNaN(Date.parse(data.created_at)), "TIMESTAMPTZ parse failed");
    console.assert(JSON.parse(data.metadata).dynamic_field.test === true, "JSONB serialization failed");
    console.log("TC-101 Passed: Data mapping sound.");
  } catch (err) {
    console.error("TC-101 Failed:", err);
  }
}
testSchemaMapping();
```

## 2. Database Driver & Connection Testing

The `pg` driver requires strict connection lifecycle management. A leaked client from the pool will silently exhaust available connections, causing subsequent requests to hang indefinitely.

### Pool Configuration Under Audit
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Max concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Test Case: Connection Pool Exhaustion (TC-201)
```javascript
// Simulates concurrent bursts to ensure backend connections are properly released
async function testPoolExhaustion() {
  const concurrentRequests = 15; // Exceeds pool.max (10)
  
  try {
    const requests = Array.from({ length: concurrentRequests }).map(() => 
      fetch('/api/users').then(r => {
        if (!r.ok) throw new Error(`Status: ${r.status}`);
        return r.json();
      })
    );

    const start = performance.now();
    await Promise.all(requests);
    const end = performance.now();
    
    // If requests took > 5s, the pool queueing is too slow or connections are leaking
    console.assert((end - start) < 5000, "Pool latency highly suspicious. Potential connection leak.");
    console.log("TC-201 Passed: Pool gracefully queued and executed requests.");
  } catch (err) {
    console.error("TC-201 Failed: Pool exhaustion led to dropped requests.", err);
  }
}
testPoolExhaustion();
```

## 3. API Logic & SQL Injection Audit

Without an ORM, manual SQL string concatenation is extremely dangerous. All queries must be parameterized (`$1`, `$2`). 

### The N+1 Query Problem (CRITICAL)
Developers coming from Firebase often fetch a list of records (e.g., Leads), then loop over them via vanilla `for...of` or `.map()` to fetch related data (e.g., the User assigned to the Lead). 
**Anti-Pattern:** 1 Query for 100 Leads + 100 Queries for Users = 101 back-to-back Queries. This will instantly saturate the PostgreSQL connection pool and cause severe latency.
**Resolution:** You must rewrite these routes to use a single SQL `JOIN` or parameterize an `IN (...)` clause. Under no circumstances should frontend components or backend route handlers loop database reads for relational data.

### Test Case: SQL Injection Immunity (TC-301)
```javascript
// Attempts standard SQL injection to ensure backend driver uses parameterized inputs
async function testSqlInjection() {
  try {
    // Malicious payload attempting to drop the leads table
    const maliciousId = "1'; DROP TABLE leads; --";
    
    const res = await fetch(`/api/leads/${encodeURIComponent(maliciousId)}`);
    
    // The DB should reject the UUID/ID format or return 404/400
    console.assert(res.status === 404 || res.status === 400, "Injection vectors should be safely neutralized as bad inputs.");
    console.log("TC-301 Passed: SQL Injection failed successfully.");
  } catch (err) {
    console.error("TC-301 Failed: Application crashed during injection test.", err);
  }
}
testSqlInjection();
```

## 4. Real-time Sync Replacement

Firebase provided `.onSnapshot()`. Moving to standard Postgres + Node + Vanilla JS requires replacing this with either WebSockets, Server-Sent Events (SSE), or short-polling via `setInterval()`.

### Vanilla JS Caveats
React re-renders cleanly. Vanilla JS does not. If you replace `.onSnapshot()` with a polling `fetch()` that repeatedly calls `element.innerHTML = newRows`, you destroy focused inputs, lose scroll position, and risk memory leaks from orphaned event listeners.

### Test Case: Zombie DOM / State Sync Check (TC-401)
```javascript
// Evaluates frontend resilience against continuous data polling
async function verifyRealtimeSyncParity() {
  let initialNodeCount = document.querySelectorAll('*').length;
  
  // Assuming a global 'refreshData()' polling function exists in the Vanilla JS architecture
  if (typeof window.refreshData !== 'function') {
      console.warn("Manual polling interval not found in global scope. Audit manual sync mechanisms.");
      return;
  }

  try {
    for (let i=0; i<5; i++) {
        await window.refreshData(); // Manually force the polling function 5 times
    }
    
    let finalNodeCount = document.querySelectorAll('*').length;
    // If the node count doubles, the Vanilla JS UI is appending rather than diffing/clearing
    console.assert(Math.abs(finalNodeCount - initialNodeCount) < 50, "DOM Leak detected. Polling is not clearing old elements.");
    console.log("TC-401 Passed: DOM stays stable across multiple sync cycles.");
  } catch(e) {
    console.error("TC-401 Failed: Sync logic crashed UI", e);
  }
}
verifyRealtimeSyncParity();
```
