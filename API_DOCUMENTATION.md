# API Documentation

This document outlines the API endpoints generated from the entity schemas defined in `firebase-blueprint.json`.

## Base URL

`https://<YOUR_APP_URL>/api`

## Authentication

All endpoints require a Bearer token in the Authorization header.
`Authorization: Bearer <ID_TOKEN>`

## Common HTTP Status Codes

* **200 OK**: Request successful.
* **401 Unauthorized**: Missing or invalid authentication token.
* **403 Forbidden**: Authenticated, but lacking sufficient permissions (`required: <permission>`).
* **404 Not Found**: Entity or endpoint not found.
* **500 Internal Server Error**: Database write failure or server error.

---

## 🗂️ Van

Inventory storage location

**Schema Attributes:**
* `id` (string, optional): 
* `van_id` (string, required): 
* `location_id` (string, required): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `is_deleted` (boolean, optional): 
* `metadata` (object, optional): 

### 1. Create Van

`POST /api/vans`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "van_id": "string_value",
  "location_id": "string_value",
  "is_deleted": true,
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "vans:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Van

`GET /api/vans/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "van_id": "string_value",
  "location_id": "string_value",
  "is_deleted": true,
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Van

`PUT /api/vans/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "van_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Van

`DELETE /api/vans/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Van

`GET /api/vans`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Inventory - Hardware Type

Inventory hardware definitions (formerly Item Catalog)

**Schema Attributes:**
* `id` (string, optional): 
* `catalog_id` (string, required): 
* `item_type` (string, required): 
* `item_name` (string, optional): 
* `provider` (string, optional): 
* `duration_minutes` (number, optional): Estimated installation duration in minutes
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Inventory - Hardware Type

`POST /api/item_catalog`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "catalog_id": "string_value",
  "item_type": "string_value",
  "item_name": "string_value",
  "provider": "string_value",
  "duration_minutes": 123,
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "item_catalog:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Inventory - Hardware Type

`GET /api/item_catalog/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "catalog_id": "string_value",
  "item_type": "string_value",
  "item_name": "string_value",
  "provider": "string_value",
  "duration_minutes": 123,
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Inventory - Hardware Type

`PUT /api/item_catalog/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "catalog_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Inventory - Hardware Type

`DELETE /api/item_catalog/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Inventory - Hardware Type

`GET /api/item_catalog`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Item Instance

Serialized inventory unit

**Schema Attributes:**
* `id` (string, optional): 
* `item_id` (string, required): 
* `catalog_id` (string, required): 
* `current_location_type` (string, required): 
* `current_location_id` (string, optional): 
* `is_available` (boolean, optional): 
* `status` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Item Instance

`POST /api/items`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "item_id": "string_value",
  "catalog_id": "string_value",
  "current_location_type": "string_value",
  "current_location_id": "string_value",
  "is_available": true,
  "status": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "items:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Item Instance

`GET /api/items/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "item_id": "string_value",
  "catalog_id": "string_value",
  "current_location_type": "string_value",
  "current_location_id": "string_value",
  "is_available": true,
  "status": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Item Instance

`PUT /api/items/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "item_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Item Instance

`DELETE /api/items/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Item Instance

`GET /api/items`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Role

User role and authorities

**Schema Attributes:**
* `id` (string, optional): 
* `role_id` (string, required): 
* `role_name` (string, required): 
* `authorities` (array, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Role

`POST /api/roles`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "role_id": "string_value",
  "role_name": "string_value",
  "authorities": [],
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "roles:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Role

`GET /api/roles/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "role_id": "string_value",
  "role_name": "string_value",
  "authorities": [],
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Role

`PUT /api/roles/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "role_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Role

`DELETE /api/roles/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Role

`GET /api/roles`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ User

System user

**Schema Attributes:**
* `id` (string, optional): 
* `user_id` (string, required): 
* `role_id` (string, required): 
* `user_name` (string, optional): 
* `email` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create User

`POST /api/users`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "user_id": "string_value",
  "role_id": "string_value",
  "user_name": "string_value",
  "email": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "users:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get User

`GET /api/users/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "user_id": "string_value",
  "role_id": "string_value",
  "user_name": "string_value",
  "email": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update User

`PUT /api/users/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "user_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete User

`DELETE /api/users/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List User

`GET /api/users`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Appointment

Technician appointment

**Schema Attributes:**
* `id` (string, optional): 
* `appointment_id` (string, required): 
* `tech_id` (string, required): 
* `user_id` (string, optional): 
* `van_id` (string, optional): 
* `product_type_id` (string, optional): 
* `status` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Appointment

`POST /api/appointments`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "appointment_id": "string_value",
  "tech_id": "string_value",
  "user_id": "string_value",
  "van_id": "string_value",
  "product_type_id": "string_value",
  "status": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "appointments:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Appointment

`GET /api/appointments/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "appointment_id": "string_value",
  "tech_id": "string_value",
  "user_id": "string_value",
  "van_id": "string_value",
  "product_type_id": "string_value",
  "status": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Appointment

`PUT /api/appointments/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "appointment_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Appointment

`DELETE /api/appointments/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Appointment

`GET /api/appointments`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Stock Take Log

Inventory audit trails

**Schema Attributes:**
* `id` (string, optional): 
* `log_id` (string, required): 
* `user_id` (string, required): 
* `van_id` (string, required): 
* `log_type` (string, required): 
* `scanned_items` (array, optional): 
* `discrepancies` (object, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Stock Take Log

`POST /api/stock_take_logs`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "log_id": "string_value",
  "user_id": "string_value",
  "van_id": "string_value",
  "log_type": "string_value",
  "scanned_items": [],
  "discrepancies": {},
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "stock_take_logs:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Stock Take Log

`GET /api/stock_take_logs/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "log_id": "string_value",
  "user_id": "string_value",
  "van_id": "string_value",
  "log_type": "string_value",
  "scanned_items": [],
  "discrepancies": {},
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Stock Take Log

`PUT /api/stock_take_logs/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "log_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Stock Take Log

`DELETE /api/stock_take_logs/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Stock Take Log

`GET /api/stock_take_logs`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Saved Report

Saved SQL report

**Schema Attributes:**
* `id` (string, required): 
* `creator_id` (string, optional): 
* `name` (string, required): 
* `query` (string, required): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Saved Report

`POST /api/saved_reports`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "creator_id": "string_value",
  "name": "string_value",
  "query": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "saved_reports:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Saved Report

`GET /api/saved_reports/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "creator_id": "string_value",
  "name": "string_value",
  "query": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Saved Report

`PUT /api/saved_reports/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "creator_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Saved Report

`DELETE /api/saved_reports/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Saved Report

`GET /api/saved_reports`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Form

Custom form definition

**Schema Attributes:**
* `id` (string, required): 
* `name` (string, required): 
* `fields` (array, optional): 
* `entities` (array, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Form

`POST /api/forms`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "name": "string_value",
  "fields": [],
  "entities": [],
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "forms:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Form

`GET /api/forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "name": "string_value",
  "fields": [],
  "entities": [],
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Form

`PUT /api/forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "name": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Form

`DELETE /api/forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Form

`GET /api/forms`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Custom Form

Legacy custom form definition

**Schema Attributes:**
* `id` (string, required): 
* `form_name` (string, required): 
* `schema_definition` (object, optional): 
* `fields` (array, optional): 
* `entities` (array, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Custom Form

`POST /api/custom_forms`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "form_name": "string_value",
  "schema_definition": {},
  "fields": [],
  "entities": [],
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "custom_forms:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Custom Form

`GET /api/custom_forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "form_name": "string_value",
  "schema_definition": {},
  "fields": [],
  "entities": [],
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Custom Form

`PUT /api/custom_forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "form_name": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Custom Form

`DELETE /api/custom_forms/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Custom Form

`GET /api/custom_forms`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Form Submission

Submission of a custom form

**Schema Attributes:**
* `id` (string, required): 
* `form_id` (string, required): 
* `appointment_id` (string, optional): 
* `submitted_by` (string, optional): 
* `data` (object, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Form Submission

`POST /api/form_submissions`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "form_id": "string_value",
  "appointment_id": "string_value",
  "submitted_by": "string_value",
  "data": {},
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "form_submissions:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Form Submission

`GET /api/form_submissions/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "form_id": "string_value",
  "appointment_id": "string_value",
  "submitted_by": "string_value",
  "data": {},
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Form Submission

`PUT /api/form_submissions/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "form_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Form Submission

`DELETE /api/form_submissions/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Form Submission

`GET /api/form_submissions`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Trigger

Automation trigger

**Schema Attributes:**
* `id` (string, required): 
* `event_type` (string, required): 
* `action_to_take` (string, optional): 
* `condition_logic` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Trigger

`POST /api/triggers`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "event_type": "string_value",
  "action_to_take": "string_value",
  "condition_logic": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "triggers:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Trigger

`GET /api/triggers/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "event_type": "string_value",
  "action_to_take": "string_value",
  "condition_logic": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Trigger

`PUT /api/triggers/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "event_type": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Trigger

`DELETE /api/triggers/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Trigger

`GET /api/triggers`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Inventory - Product Type

Definition of installable products linked to hardware

**Schema Attributes:**
* `id` (string, optional): 
* `type_id` (string, required): 
* `name` (string, required): 
* `catalog_id` (string, required): Reference to InventoryHardwareType
* `duration_minutes` (number, optional): Override or inherited duration from hardware
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Inventory - Product Type

`POST /api/product_types`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "type_id": "string_value",
  "name": "string_value",
  "catalog_id": "string_value",
  "duration_minutes": 123,
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "product_types:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Inventory - Product Type

`GET /api/product_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "type_id": "string_value",
  "name": "string_value",
  "catalog_id": "string_value",
  "duration_minutes": 123,
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Inventory - Product Type

`PUT /api/product_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "type_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Inventory - Product Type

`DELETE /api/product_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Inventory - Product Type

`GET /api/product_types`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Item Type

Inventory item types

**Schema Attributes:**
* `id` (string, optional): 
* `type_id` (string, required): 
* `name` (string, required): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Item Type

`POST /api/item_types`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "type_id": "string_value",
  "name": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "item_types:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Item Type

`GET /api/item_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "type_id": "string_value",
  "name": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Item Type

`PUT /api/item_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "type_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Item Type

`DELETE /api/item_types/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Item Type

`GET /api/item_types`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Lead

Sales lead

**Schema Attributes:**
* `id` (string, required): 
* `merchant_name` (string, required): 
* `cr_number` (string, optional): 
* `status` (string, required): 
* `owner_id` (string, optional): 
* `country` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `approved_at` (string, optional): 
* `rejected_at` (string, optional): 
* `current_approver_uid` (string, optional): 
* `breach_details` (object, optional): 

### 1. Create Lead

`POST /api/leads`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "merchant_name": "string_value",
  "cr_number": "string_value",
  "status": "string_value",
  "owner_id": "string_value",
  "country": "string_value",
  "approved_at": "string_value",
  "rejected_at": "string_value",
  "current_approver_uid": "string_value",
  "breach_details": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "leads:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Lead

`GET /api/leads/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "merchant_name": "string_value",
  "cr_number": "string_value",
  "status": "string_value",
  "owner_id": "string_value",
  "country": "string_value",
  "approved_at": "string_value",
  "rejected_at": "string_value",
  "current_approver_uid": "string_value",
  "breach_details": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Lead

`PUT /api/leads/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "merchant_name": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Lead

`DELETE /api/leads/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Lead

`GET /api/leads`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Merchant

Approved merchant

**Schema Attributes:**
* `id` (string, required): 
* `merchant_name` (string, required): 
* `merchant_reference` (string, optional): 
* `cr_number` (string, optional): 
* `country` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `metadata` (object, optional): 

### 1. Create Merchant

`POST /api/merchants`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "merchant_name": "string_value",
  "merchant_reference": "string_value",
  "cr_number": "string_value",
  "country": "string_value",
  "metadata": {}
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "merchants:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Merchant

`GET /api/merchants/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "merchant_name": "string_value",
  "merchant_reference": "string_value",
  "cr_number": "string_value",
  "country": "string_value",
  "metadata": {},
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Merchant

`PUT /api/merchants/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "merchant_name": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Merchant

`DELETE /api/merchants/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Merchant

`GET /api/merchants`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

## 🗂️ Approval

Approval record for leads

**Schema Attributes:**
* `id` (string, required): 
* `lead_id` (string, required): 
* `status` (string, required): 
* `tier_id` (string, optional): 
* `approver_uid` (string, optional): 
* `created_at` (string, optional): 
* `updated_at` (string, optional): 
* `resolved_by` (string, optional): 
* `resolved_at` (string, optional): 
* `notes` (string, optional): 

### 1. Create Approval

`POST /api/approvals`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "id": "string_value",
  "lead_id": "string_value",
  "status": "string_value",
  "tier_id": "string_value",
  "approver_uid": "string_value",
  "resolved_by": "string_value",
  "resolved_at": "string_value",
  "notes": "string_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "generated_or_provided_id"
}
```

**Failure Response - Missing Token (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Failure Response - No Permission (403 Forbidden):**
```json
{
  "error": "Insufficient permissions",
  "required": "approvals:create"
}
```

**Failure Response - Validation Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "details": "Missing required field"
}
```

### 2. Get Approval

`GET /api/approvals/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "id": "string_value",
  "lead_id": "string_value",
  "status": "string_value",
  "tier_id": "string_value",
  "approver_uid": "string_value",
  "resolved_by": "string_value",
  "resolved_at": "string_value",
  "notes": "string_value",
  "created_at": "2026-04-26T12:00:00Z",
  "updated_at": "2026-04-26T12:00:00Z"
}
```

**Failure Response - Not Found (404 Not Found):**
```json
{
  "error": "Not Found"
}
```

### 3. Update Approval

`PUT /api/approvals/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
Content-Type: application/json
```

**Request Body Example:**
```json
{
  "lead_id": "updated_value"
}
```

**Success Response (200 OK):**
```json
{
  "id": "item_id",
  "updated_fields": "..."
}
```

### 4. Delete Approval

`DELETE /api/approvals/:id`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
{
  "message": "Deleted successfully"
}
```

### 5. List Approval

`GET /api/approvals`

**Request Headers:**
```http
Authorization: Bearer <ID_TOKEN>
```

**Success Response (200 OK):**
```json
[
  {
    "id": "item_id",
    "..." : "..."
  }
]
```

---

