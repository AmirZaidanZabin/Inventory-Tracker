# Product Requirement Document: Pico Inventory Pro

## 1. Executive Summary
**Pico Inventory Pro** is a comprehensive Field Service Management (FSM) and Inventory Orchestration platform. It streamlines the lifecycle of hardware deployment—from warehouse stock to technician vans, and ultimately to customer sites. Designed for high-velocity operations like payment terminal rollouts (Pico), it integrates scheduling, real-time tracking, barcode scanning, and automated reporting.

---

## 2. Target Audience
- **Operations Managers / Admin:** Oversights system health, manages roles, and analyzes fleet efficiency.
- **Dispatchers:** Schedules jobs, optimizes routes, and monitors technician progress in real-time.
- **Field Technicians:** Manages van stock, fulfills job requirements using mobile scanning, and performs on-site installations.
- **Customers:** Provides a "Uber-style" tracking experience to see technician arrival time and live location.

---

## 3. Key Feature Modules

### A. Operations Dashboard
- **Real-time Analytics:** Summary of scheduled vs. completed jobs, stock levels, and revenue metrics.
- **Activity Feed:** Live log of all system actions (Audit log).

### B. Intelligent Scheduling (Calendar & Gantt)
- **Drag-and-Drop Gantt:** Visualize technician workloads and overlapping jobs.
- **Geospatial Dispatch:** Auto-assign jobs based on proximity and travel time estimation.
- **Capacity Management:** Define working hours and vacation days for technicians.

### C. Advanced Inventory Management
- **Hardware Catalog:** Centralized registry of hardware types (Terminals, SIMs, POS accessories).
- **Multi-Level Tracking:** Track items in Main Warehouse, individual VANs, or assigned to specific Appointments.
- **Morning Load / Evening Reconcile:** Mobile-first workflow for technicians to scan and verify van stock daily.
- **Barcode Integration:** Native support for scanning serial numbers (BCS) to ensure 100% data accuracy.

### D. Technician Mobile Interface
- **Progressive Web App (PWA):** Optimized for low-bandwidth field environments.
- **Job Fulfillment:** Step-by-step checklist to scan hardware items required for a job.
- **Real-time Comms:** Notifies the system of arrival, completion, and delays.

### E. Customer Tracking ("Uber for Field Service")
- **Public Tracking Link:** Secure, tokenized URL for customers.
- **Live Tech Location:** Real-time map view of the technician approaching the site.
- **Duration Estimation:** Dynamic ETA based on current traffic and previous job status.

### F. Automation & Triggers
- **Offline Sync:** Graceful handling of intermittent connectivity with automatic queue flushing.
- **Webhooks:** Outbound notifications to Zendesk or other CRM tools upon job state changes.
- **System Constraints:** Prevents job completion if hardware requirements aren't fulfilled.

---

## 4. User Personas

### 1. Sarah (Operations Manager)
- **Goal:** Minimize hardware shrinkage and optimize fleet utilization.
- **Pain Point:** Inaccurate van stock leads to missed SLAs.

### 2. Mike (Field Technician)
- **Goal:** Get through the daily schedule efficiently with the right tools.
- **Pain Point:** Manual paperwork for hardware serial numbers is tedious and error-prone.

### 3. David (End Customer)
- **Goal:** Know exactly when the terminal will be installed so he can open his business.
- **Pain Point:** Waiting in a "4-hour window" without updates.

---

## 5. Technical Requirements

### Stack
- **Frontend:** Vanilla JavaScript (ES Module), Vite, Tailwind CSS.
- **Backend:** Node.js, Express.
- **Database:** Universal Data Access Layer (DAL) supporting Firebase RTDB (REST), Supabase, or PostgreSQL.
- **Infrastructure:** Docker containerization with Nginx for optimized SPA serving.

### Integrations
- **Maps API:** Google Maps for technician tracking and route visualization.
- **Zendesk API:** For ticket synchronization (planned/partially implemented).
- **SQLite (WASM):** For client-side complex reporting and data analysis.

---

## 6. Non-Functional Requirements
- **Security:** JWT/Firebase Auth with granular Role-Based Access Control (RBAC).
- **Scalability:** Stateless backend designed for horizontal scaling in Cloud Run.
- **Observability:** Centralized audit logs for every state transition.
- **Accessibility:** High-contrast UI following modern design standards.

---

## 7. Roadmap & Future Enhancements
- **AI-Powered Route Optimization:** Use Gemini to minimize fuel costs across 100+ daily jobs.
- **Offline Maps:** Map caching for remote field areas.
- **Customer Feedback Loop:** Post-appointment CSAT surveys via SMS.
- **External API Platform:** Public REST API for third-party logistics partners.
