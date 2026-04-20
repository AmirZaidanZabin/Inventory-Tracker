# Pico Inventory Tracker Architecture

## Overview
The Pico Inventory Tracker is a full-stack application designed to manage hardware inventory (Pico devices, SIM cards), field service vans, user roles (RBAC), and service appointments. It integrates with Zendesk via webhooks to automate job scheduling and completion.

## Architectural Pattern: MVC (Model-View-Controller)

The application strictly adheres to the MVC pattern to ensure separation of concerns, testability, and maintainability.

### 1. Model (Data Layer)
- **Database**: Firebase Firestore (NoSQL).
- **In-Memory SQL**: For complex reporting, data is fetched from Firestore and loaded into an in-memory SQLite database via `sql.js` in the client.
- **Frontend Models**: Views establish real-time listeners (`onSnapshot`) to Firestore collections via the `firebase.js` library.

### 2. View (Presentation Layer)
- **Framework**: Vanilla JavaScript.
- **UI Architecture**: Component-based views managed by a custom `controller` library (`src/lib/controller.js`).
- **Styling**: Tailwind CSS + Bootstrap (for layout and accordions).
- **Libraries**:
  - `Leaflet.js`: Geographical mapping of appointments.
  - `D3.js`: Dashboard visualizations.
  - `Prism.js`: SQL syntax highlighting in the reporting editor.
  - `Lucide Icons` & `Bootstrap Icons`: Visual indicators.

### 3. Controller (Logic Layer)
- **Frontend Controller (`src/lib/controller.js`)**: A lightweight framework that handles DOM binding, event orchestration, and view lifecycle (init, destroy).
- **App Logic (`src/main.js`)**: The main entry point that manages routing and sidebar state.
- **Backend (`server.js`)**: An Express server that proxies Firestore operations and provides REST endpoints for CRUD and webhooks.

## Key Features & Workflows

### Universal Audit Logging
Every state-changing action performed via the frontend triggers a `logAction` call, which records the event in the `audit_logs` collection. This ensures a complete history for compliance and analysis.

### Zendesk Integration Workflow
1. **Ticket Created**: Zendesk sends a `ticket_created` webhook. The backend creates a record.
2. **Scheduling**: Technicians or admins schedule jobs in the `Appointments` view.
3. **Completion**: Technicians complete jobs in the `Appointment Detail` view, assigning serial numbers and uploading photos/signatures.

## Security (RBAC)
User permissions are managed via a `roles` collection. Each role has a list of `authorities` (e.g., `appointments:delete`, `items:create`). The `index.html` uses an `apply-auth` event and `auth-*` CSS classes to conditionally hide/show UI elements based on the logged-in user's role.
