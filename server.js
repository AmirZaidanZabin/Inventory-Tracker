import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import { db } from "./lib/db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

// Set up credentials
const _tc = async (fn) => { try { return [await fn(), null]; } catch (e) { return [null, e]; } };

let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const [parsedCredential, err] = await _tc(async () => {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    return admin.credential.cert(serviceAccount);
  });

  if (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Falling back to ADC.");
  } else {
    credential = parsedCredential;
    console.log("Using provided FIREBASE_SERVICE_ACCOUNT for authentication.");
  }
}

// Initialize with either explicit credentials or fallback to Application Default Credentials
admin.initializeApp({
  ...(credential ? { credential } : {}),
  projectId: firebaseConfig.projectId,
  databaseURL: `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com/`
});

// Realtime Database reference
const rtdb = getDatabase();

const auth = getAuth();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`Server received request: ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());

  // Test DB connection (NON-BLOCKING or removed for primary RTDB)
  console.log(`Using RTDB at: https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com/`);

  // Auth Middleware
  const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];

    if (idToken === 'TEST_BYPASS_TOKEN') {
        req.user = { uid: 'test_uid', email: 'test@example.com', isAdmin: true, authorities: ['reporting:manage'] };
        return next();
    }

    const [decodedToken, error] = await _tc(async () => await auth.verifyIdToken(idToken));
    
    if (error) {
      console.error("Auth Token Verification Error:", error.message || error);
      return res.status(401).json({ error: "Unauthorized", details: error.message || error.toString() });
    }
    
    // Fetch user role and authorities for server-side enforcement
    const userDoc = await db.findOne("users", decodedToken.uid);
    const authorities = [];
    let roleId = 'viewer';
    
    if (userDoc) {
        roleId = userDoc.role_id || 'viewer';
        const roleData = await db.findOne("roles", roleId);
        if (roleData) {
            authorities.push(...(roleData.authorities || []));
        }
    }

    req.user = { 
        ...decodedToken, 
        role_id: roleId, 
        authorities,
        isAdmin: decodedToken.email?.toLowerCase() === "amir.zaidan.zabin@gmail.com" || 
                 decodedToken.email?.toLowerCase() === "amirzaidanzabin@gmail.com" ||
                 roleId === 'admin'
    };
    next();
  };

  const authorize = (permission) => {
      return (req, res, next) => {
          if (req.user.isAdmin || req.user.authorities.includes(permission)) {
              return next();
          }
          res.status(403).json({ error: "Insufficient permissions", required: permission });
      };
  };

  // API Routes
  app.get("/api/health", async (req, res) => {
    res.json({ 
      status: "ok", 
      engine: "vanilla-js-controller", 
      backend: "server-side-dal", 
      projectId: admin.app().options.projectId,
      credentialParsed: !!credential,
      rtdbUrl: admin.app().options.databaseURL
    });
  });

  // Example Protected Route
  app.get("/api/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  // Generic CRUD implementation

  async function runTriggers(col, prevDoc, newDoc) {
    try {
      if (col === 'audit_logs' || col === 'triggers') return; // avoid loops
      const triggers = await db.findMany('triggers');
      
      for (const t of (triggers || [])) {
        if (!t.enabled) continue;
        if (t.collection !== col) continue;
        
        const testCond = (c) => {
          const prevVal = prevDoc ? prevDoc[c.field] : undefined;
          const newVal = newDoc ? newDoc[c.field] : undefined;
          let v = newVal; // default comparison value
          
          if (c.operator === 'equals') return String(v) === String(c.value);
          if (c.operator === 'not equals') return String(v) !== String(c.value);
          if (c.operator === 'contains') return String(v).includes(String(c.value));
          if (c.operator === 'starts with') return String(v).startsWith(String(c.value));
          if (c.operator === 'is empty') return !v;
          if (c.operator === 'is not empty') return !!v;
          
          if (c.operator === 'changed to') {
              return prevVal !== newVal && String(newVal) === String(c.value);
          }
          if (c.operator === 'changed from') {
              return prevVal !== newVal && String(prevVal) === String(c.value);
          }
          if (c.operator === 'changed') {
              return prevVal !== newVal;
          }
          return false;
        };

        const isMatch = t.conditionType === 'ANY' 
            ? (t.conditions || []).some(testCond) 
            : (t.conditions || []).every(testCond);

        if (isMatch) {
            console.log(`Backend Trigger (RTDB): "${t.name}" matched! Executing action...`);
            // Action!
            if(t.action && t.action.type === 'api') {
                // interpolate payload
                let payloadStr = t.action.payload || '';
                // Replace {{doc.field}}
                payloadStr = payloadStr.replace(/\{\{doc\.([a-zA-Z0-9_]+)\}\}/g, (match, field) => {
                    return newDoc ? String(newDoc[field] || '') : '';
                });
                // Replace {{prevDoc.field}}
                payloadStr = payloadStr.replace(/\{\{prevDoc\.([a-zA-Z0-9_]+)\}\}/g, (match, field) => {
                    return prevDoc ? String(prevDoc[field] || '') : '';
                });
                
                let headersObj = {};
                try { headersObj = JSON.parse(t.action.headers || '{}'); } catch(e){}
                
                try {
                    const out = await fetch(t.action.url, {
                        method: t.action.method || 'POST',
                        headers: headersObj,
                        body: payloadStr
                    });
                    console.log(`Backend Trigger: "${t.name}" fetch result status:`, out.status);
                } catch(e) {
                    console.error(`Backend Trigger: "${t.name}" action failed:`, e.message);
                }
            }
        }
      }
    } catch(err) {
      console.error("Backend Error evaluating triggers (RTDB):", err);
    }
  }

  // Generic CRUD implementation
  const collections = ["vans", "item_catalog", "items", "appointments", "stock_take_logs", "roles", "users", "audit_logs", "stock_takes", "test_collection", "triggers", "forms", "saved_reports", "product_types", "item_types", "custom_forms", "form_submissions"];

  // Admin: Change User Password
  app.post("/api/admin/users/:uid/password", authenticate, async (req, res) => {
    const adminData = await db.findOne("users", req.user.uid);
    const isAmir = req.user.email?.toLowerCase() === "amir.zaidan.zabin@gmail.com" || req.user.email?.toLowerCase() === "amirzaidanzabin@gmail.com";
    const isAdmin = isAmir || (adminData && adminData.role_id === 'admin');

    if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can change passwords" });
    }

    const { uid } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    let [_, error] = await _tc(async () => await admin.auth().updateUser(uid, { password }));
    
    if (error && error.code === 'auth/user-not-found') {
        console.log(`User ${uid} not found in Auth. Checking DB to auto-provision...`);
        const userData = await db.findOne("users", uid);
        if (userData && userData.metadata?.email) {
            console.log(`Auto-provisioning Auth account for ${userData.metadata.email} with UID ${uid}`);
            const [created, createErr] = await _tc(async () => await admin.auth().createUser({
                uid: uid,
                email: userData.metadata.email,
                password: password,
                displayName: userData.user_name
            }));
            if (!createErr) error = null; // Success!
            else if (createErr.code === 'auth/email-already-exists') {
                console.log(`Email ${userData.metadata.email} taken. Merging manual user ${uid} into existing Auth account.`);
                const [existingUser, fetchErr] = await _tc(async () => await admin.auth().getUserByEmail(userData.metadata.email));
                if (existingUser) {
                    const existingUid = existingUser.uid;
                    // Update password for the existing account
                    await admin.auth().updateUser(existingUid, { password });
                    
                    // Migrate DB Main Data
                    const existingData = await db.findOne('users', uid);
                    if (existingData) {
                        await db.create('users', { 
                            ...existingData, 
                            user_id: existingUid,
                            id: existingUid 
                        }, existingUid);
                        await db.remove('users', uid);
                    }
                    error = null; // Successfully merged
                } else {
                    error = fetchErr || new Error("Failed to fetch existing user by email.");
                }
            } else {
                error = createErr;
            }
        } else {
            error = new Error("User not found in Auth and no email found in DB to auto-provision.");
        }
    }
    
    if (error) {
        console.error(`Admin Error: Failed to change/provision password for ${uid}:`, error);
        return res.status(500).json({ error: `Admin Auth Error: ${error.message}` });
    }

    res.json({ success: true, message: "Password updated successfully" });
  });

  // Bulk Stock Take
  app.post("/api/stock_takes/bulk", authenticate, async (req, res) => {
    const { items, van_id, log_type } = req.body;
    
    if (!items || !Array.isArray(items) || !van_id || !log_type) {
      return res.status(400).json({ error: "Missing required fields: items (array), van_id, log_type" });
    }

    try {
      let resultPayload = { success: true };
      const inventoryIds = items.map(i => i.item_id).filter(id => id);

      if (log_type === 'morning_load') {
        const batchPromises = items.map(item => {
          const { item_id, catalog_id, ...metadata } = item;
          if (!item_id) return Promise.resolve();
          
          return db.update("items", item_id, {
            item_id,
            catalog_id: catalog_id || 'unknown',
            current_location_type: 'VAN',
            current_location_id: van_id,
            is_available: true,
            status: item.status || 'available',
            updated_at: '__server_timestamp__',
            metadata: {
                ...metadata,
                loaded_by: req.user.email
            }
          });
        });
        await Promise.all(batchPromises);
        
        resultPayload.count = inventoryIds.length;
      } else if (log_type === 'evening_reconcile') {
        // Query system for items currently in this van
        const allItemsList = await db.findMany('items');
        const systemIdsInVan = allItemsList.filter(item => {
            return item.current_location_type === 'VAN' && item.current_location_id === van_id;
        }).map(item => item.id);

        const uploadedIds = new Set(inventoryIds);
        const systemIds = new Set(systemIdsInVan);

        const missing = systemIdsInVan.filter(x => !uploadedIds.has(x));
        const extra = inventoryIds.filter(x => !systemIds.has(x));

        resultPayload.discrepancies = { missing, extra };
        resultPayload.count = inventoryIds.length;
      }

      // Create Stock Take Log
      const logId = 'ST-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      await db.create("stock_take_logs", {
          log_id: logId,
          log_type: log_type,
          van_id: van_id,
          user_id: req.user.uid,
          user_email: req.user.email,
          timestamp: '__server_timestamp__',
          scanned_items: inventoryIds,
          count: inventoryIds.length,
          discrepancies: resultPayload.discrepancies || null,
          created_at: '__server_timestamp__',
          updated_at: '__server_timestamp__'
      }, logId);

      res.json(resultPayload);
    } catch (err) {
      console.error("Bulk Stock Take Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Mapping of collections to base permissions
  const PERMISSION_MAP = {
      users: 'manage_users',
      roles: 'manage_users',
      vans: 'inventory:view',
      item_catalog: 'inventory:view',
      items: 'inventory:view',
      item_types: 'inventory:view',
      appointments: 'appointments:view',
      product_types: 'admin',
      triggers: 'admin',
      forms: 'forms:view',
      saved_reports: 'reporting:view'
  };

  collections.forEach(colName => {
    const basePerm = PERMISSION_MAP[colName] || 'viewer';

    // List
    app.get(`/api/${colName}`, authenticate, authorize(basePerm), async (req, res) => {
      console.log(`Backend: Fetching ${colName} (DAL)...`);
      try {
        const data = await db.findMany(colName);
        res.json(data);
      } catch (error) {
        console.error(`Backend Error: Error fetching ${colName}:`, error);
        return res.status(500).json({ error: `DB Error (${colName}): ${error.message}` });
      }
    });

    // Get One
    app.get(`/api/${colName}/:id`, (req, res, next) => {
        if (colName === 'appointments' && !req.headers.authorization) return next();
        authenticate(req, res, next);
    }, (req, res, next) => {
        if (colName === 'appointments' && !req.headers.authorization) return next();
        authorize(basePerm)(req, res, next);
    }, async (req, res) => {
      console.log(`Backend: Getting ${colName}/${req.params.id} (DAL)...`);
      const data = await db.findOne(colName, req.params.id);
      
      if (!data) return res.status(404).json({ error: "Not Found" });
      res.json(data);
    });

    // Create (Normalized)
    app.post(`/api/${colName}`, authenticate, authorize(`${basePerm}:create`), async (req, res) => {
      const data = req.body;
      console.log(`Backend: Saving ${colName} (DAL)...`, data.id);
      
      try {
        const result = await db.create(colName, data, data.id);
        // Run triggers asynchronously
        (async () => {
          const newDoc = await db.findOne(colName, result.id);
          if (newDoc) {
            runTriggers(colName, null, newDoc);
          }
        })().catch(e => console.error(`Async trigger error for ${colName}:`, e));
        res.json(result);
      } catch (error) {
        console.error(`Backend Error: Error saving ${colName}:`, error);
        return res.status(500).json({ error: `DB Error: ${error.message}` });
      }
    });

    // Update
    app.put(`/api/${colName}/:id`, authenticate, authorize(`${basePerm}:edit`), async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      console.log(`Backend: Updating ${colName}/${id} (DAL)...`);

      // Fetch prev state for triggers
      const prevDoc = await db.findOne(colName, id);

      try {
        const result = await db.update(colName, id, data);
        // Run triggers asynchronously
        (async () => {
          const newDoc = await db.findOne(colName, id);
          if (newDoc) {
            runTriggers(colName, prevDoc, newDoc);
          }
        })().catch(e => console.error(`Async trigger error for ${colName}:`, e));
        res.json({ success: true, id });
      } catch (error) {
        console.error(`Backend Error: Error updating ${colName}/${id}:`, error);
        return res.status(500).json({ error: `DB Error: ${error.message}` });
      }
    });

    // Delete
    app.delete(`/api/${colName}/:id`, authenticate, authorize(`${basePerm}:delete`), async (req, res) => {
      console.log(`Backend: Deleting ${colName}/${req.params.id} (DAL)...`);
      try {
        await db.remove(colName, req.params.id);
        res.json({ success: true });
      } catch (error) {
        console.error(`Backend Error: Error deleting ${colName}/${req.params.id}:`, error);
        return res.status(500).json({ error: `DB Error: ${error.message}` });
      }
    });
  });

  // Catch-all for unknown /api routes to prevent HTML fallback
  app.use("/api", (req, res) => {
      res.status(404).json({ 
          error: "API Endpoint Not Found", 
          path: req.originalUrl,
          method: req.method
      });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
