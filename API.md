# Pico Inventory Tracker API Documentation

## Base URL
`http://localhost:3000/api`

## Authentication
Requests to `/api/*` require a Bearer token (Firebase ID Token). The `authenticate` middleware on the server verifies the token.

---

## Webhooks

### Zendesk Webhook
`POST /api/webhooks/zendesk`

Handles incoming events from Zendesk.

**Payload for `ticket_created`:**
```json
{
  "action": "ticket_created",
  "jobId": "ZD-12345",
  "customerName": "John Doe",
  "address": "123 Main St, London",
  "phone": "+44 7700 900077",
  "issue": "Needs new Pico device"
}
```

**Payload for `job_completed`:**
```json
{
  "action": "job_completed",
  "jobId": "ZD-12345",
  "psEmail": "installer@example.com",
  "serialNumber": "PICO-999",
  "simId": "SIM-888",
  "customerName": "John Doe",
  "address": "123 Main St, London"
}
```

---

## CRUD Endpoints
The application exposes generic CRUD endpoints for these collections:
`vans`, `items`, `appointments`, `roles`, `users`, `audit_logs`, `stock_takes`.

### Generic Operations (Example: `vans`)

#### GET `/api/vans`
**Response (200 OK):**
```json
[
  {
    "id": "VAN-001",
    "van_id": "VAN-001",
    "location_id": "Riyadh",
    "created_at": "2026-04-17T15:00:00.000Z"
  }
]
```

#### POST `/api/vans`
**Request Body:**
```json
{
  "van_id": "VAN-002",
  "location_id": "Jeddah",
  "created_at": "__server_timestamp__"
}
```
**Response (200 OK):**
```json
{ "id": "VAN-002" }
```

#### PUT `/api/vans/:id`
**Request Body:**
```json
{
  "location_id": "Dammam",
  "updated_at": "__server_timestamp__"
}
```

---

## Audit Logging
State-changing actions are logged via `POST /api/audit_logs`. This is usually triggered by the frontend controller.

**Endpoint:** `POST /api/audit_logs`
**Request Body:**
```json
{
  "action": "Item Registered",
  "details": "Pico Device PICO-777 added to VAN-001",
  "timestamp": "__server_timestamp__"
}
```

---

## Stock Takes Templates
Stock takes are processed via the Inventory view and logged to the `stock_takes` collection.

### Morning Load (Stock In)
**Payload Template:**
```json
{
  "log_id": "ST-MORNING-123",
  "type": "morning_load",
  "user_email": "admin@example.com",
  "count": 5,
  "scanned_items": ["PICO-1", "PICO-2", "SIM-1", "SIM-2", "VAN-KEY"],
  "timestamp": "__server_timestamp__"
}
```

### Evening Reconcile (Stock Check)
**Payload Template:**
```json
{
  "log_id": "ST-EVENING-456",
  "type": "evening_reconcile",
  "user_email": "admin@example.com",
  "count": 4,
  "scanned_items": ["PICO-1", "SIM-1"],
  "missing": ["PICO-2", "SIM-2"],
  "extra": ["STRANGER-PICO"],
  "timestamp": "__server_timestamp__"
}
```

---

## Reporting Proxy
The Reporting View simulates an SQL environment. In-memory data is loaded from the REST endpoints into SQLite via `sql.js` for advanced analytical queries.
