import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

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
    const [decodedToken, error] = await _tc(async () => await auth.verifyIdToken(idToken));
    
    if (error) {
      console.error("Auth Token Verification Error:", error.message || error);
      return res.status(401).json({ error: "Unauthorized", details: error.message || error.toString() });
    }
    
    req.user = decodedToken;
    next();
  };

    // API Routes
  app.get("/api/health", async (req, res) => {
    // Quick RTDB connection check (lightweight)
    let rtdbAccessible = false;
    const [_, rtdbErr] = await _tc(async () => await rtdb.ref('.info/connected').once('value'));
    if (!rtdbErr) rtdbAccessible = true;

    res.json({ 
      status: "ok", 
      engine: "vanilla-js-controller", 
      backend: "firebase-admin", 
      rtdbAccessible,
      projectId: admin.app().options.projectId,
      credentialParsed: !!credential,
      rtdbUrl: admin.app().options.databaseURL
    });
  });

  // Example Protected Route
  app.get("/api/me", authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  // RTDB Normalization Schemas
  const SCHEMAS = {
    users: { essentials: ['user_id', 'id', 'user_name', 'name', 'email', 'role_id', 'created_at'] },
    vans: { essentials: ['van_id', 'location_id', 'created_at', 'default_lat', 'default_lng'] },
    items: { essentials: ['item_id', 'item_type', 'provider', 'created_at'] },
    appointments: { essentials: ['appointment_id', 'id', 'appointment_name', 'schedule_date', 'lat', 'lng', 'created_at'] },
    product_types: { essentials: ['id', 'name', 'duration_minutes', 'created_at'] },
    roles: { essentials: ['role_id', 'role_name', 'created_at'] },
    forms: { essentials: ['id', 'name', 'created_at'] }
  };

  const getNormalized = async (col, id) => {
    const essentialSnap = await rtdb.ref(`${col}/${id}`).once('value');
    const essentialData = essentialSnap.val();
    if (!essentialData) return null;

    // Join with latest history
    const historySnap = await rtdb.ref(`${col}_history/${id}`).orderByKey().limitToLast(1).once('value');
    const historyData = historySnap.val();
    let transactional = {};
    if (historyData) {
      const latestKey = Object.keys(historyData)[0];
      transactional = historyData[latestKey];
    }
    const out = { ...essentialData, ...transactional, id };
    // Convert RTDB numeric timestamps to ISO strings
    ['created_at', 'updated_at', 'timestamp', '__entry_timestamp__'].forEach(k => {
      if (typeof out[k] === 'number') out[k] = new Date(out[k]).toISOString();
    });
    return out;
  };

  const saveNormalized = async (col, id, data) => {
    const schema = SCHEMAS[col];
    const idToUse = id || data.id || data[`${col.slice(0, -1)}_id`] || Math.random().toString(36).substr(2, 9);
    
    const processData = (d) => {
       const out = { ...d };
       Object.keys(out).forEach(k => {
         if (out[k] === '__server_timestamp__') out[k] = admin.database.ServerValue.TIMESTAMP;
       });
       return out;
    };

    const cleanData = processData(data);

    if (!schema) {
      await rtdb.ref(`${col}/${idToUse}`).set(cleanData);
      return { id: idToUse };
    }

    const essentials = { id: idToUse };
    const transactional = { ...cleanData };

    schema.essentials.forEach(f => {
      if (cleanData[f] !== undefined) {
        essentials[f] = cleanData[f];
        delete transactional[f];
      }
    });

    Object.keys(cleanData).forEach(k => {
      if (k.endsWith('_id') || k === 'id') essentials[k] = cleanData[k];
    });

    await rtdb.ref(`${col}/${idToUse}`).update(essentials);
    await rtdb.ref(`${col}_history/${idToUse}`).push({
        ...transactional,
        __entry_timestamp__: admin.database.ServerValue.TIMESTAMP
    });

    return { id: idToUse };
  };

  // Helper for Firestore (DEPRECATED: transition to RTDB)
  const snapToData = (snap) => {
    const data = snap.data();
    if (!data) return null;
    return {
      ...data,
      id: snap.id,
      // Convert timestamps to ISO strings
      created_at: data.created_at?.toDate?.()?.toISOString() || data.created_at,
      updated_at: data.updated_at?.toDate?.()?.toISOString() || data.updated_at,
      timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
    };
  };

  async function runTriggers(col, prevDoc, newDoc) {
    try {
      if (col === 'audit_logs' || col === 'triggers') return; // avoid loops
      const snap = await rtdb.ref('triggers').once('value');
      const val = snap.val() || {};
      const triggers = Object.keys(val).map(id => ({ ...val[id], id }));
      
      for (const t of triggers) {
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
  const collections = ["vans", "items", "appointments", "roles", "users", "audit_logs", "stock_takes", "test_collection", "triggers", "forms", "saved_reports", "product_types"];

  // Admin: Change User Password
  app.post("/api/admin/users/:uid/password", authenticate, async (req, res) => {
    const adminData = await getNormalized("users", req.user.uid);
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

    const [_, error] = await _tc(async () => await admin.auth().updateUser(uid, { password }));
    
    if (error) {
        console.error(`Admin Error: Failed to change password for ${uid}:`, error);
        return res.status(500).json({ error: `Admin Auth Error: ${error.message}` });
    }

    res.json({ success: true, message: "Password updated successfully" });
  });

  collections.forEach(colName => {
    // List
    app.get(`/api/${colName}`, authenticate, async (req, res) => {
      console.log(`Backend: Fetching ${colName} (RTDB)...`);
      const [snap, error] = await _tc(async () => await rtdb.ref(colName).once('value'));
      
      if (error) {
        console.error(`Backend Error: Error fetching ${colName}:`, error);
        return res.status(500).json({ error: `RTDB Error (${colName}): ${error.message}` });
      }
      
      const val = snap.val() || {};
      const data = await Promise.all(Object.keys(val).map(async (id) => {
          return await getNormalized(colName, id);
      }));
      res.json(data.filter(d => d !== null));
    });

    // Get One
    app.get(`/api/${colName}/:id`, authenticate, async (req, res) => {
      console.log(`Backend: Getting ${colName}/${req.params.id} (RTDB)...`);
      const data = await getNormalized(colName, req.params.id);
      
      if (!data) return res.status(404).json({ error: "Not Found" });
      res.json(data);
    });

    // Create / Update (Normalized)
    app.post(`/api/${colName}`, authenticate, async (req, res) => {
      const data = req.body;
      console.log(`Backend: Saving normalized ${colName} (RTDB)...`, data.id);
      
      const [result, error] = await _tc(async () => await saveNormalized(colName, data.id, data));

      if (error) {
        console.error(`Backend Error: Error saving ${colName}:`, error);
        return res.status(500).json({ error: `RTDB Error: ${error.message}` });
      }
      
      // Run triggers asynchronously
      (async () => {
        const newDoc = await getNormalized(colName, result.id);
        if (newDoc) {
          runTriggers(colName, null, newDoc);
        }
      })().catch(e => console.error(`Async trigger error for ${colName}:`, e));

      res.json(result);
    });

    // Update
    app.put(`/api/${colName}/:id`, authenticate, async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      console.log(`Backend: Updating normalized ${colName}/${id} (RTDB)...`);

      // Fetch prev state for triggers
      const prevDoc = await getNormalized(colName, id);

      const [result, error] = await _tc(async () => await saveNormalized(colName, id, data));
      
      if (error) {
        console.error(`Backend Error: Error updating ${colName}/${id}:`, error);
        return res.status(500).json({ error: `RTDB Error: ${error.message}` });
      }

      // Run triggers asynchronously
      (async () => {
        const newDoc = await getNormalized(colName, id);
        if (newDoc) {
          runTriggers(colName, prevDoc, newDoc);
        }
      })().catch(e => console.error(`Async trigger error for ${colName}:`, e));
      
      res.json({ success: true, id });
    });

    // Delete
    app.delete(`/api/${colName}/:id`, authenticate, async (req, res) => {
      console.log(`Backend: Deleting essentials for ${colName}/${req.params.id} (RTDB)...`);
      const [_, error] = await _tc(async () => await rtdb.ref(`${colName}/${req.params.id}`).remove());
      
      if (error) {
        console.error(`Backend Error: Error deleting ${colName}/${req.params.id}:`, error);
        return res.status(500).json({ error: `RTDB Error: ${error.message}` });
      }
      
      res.json({ success: true });
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
