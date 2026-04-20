
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

// Set up credentials
let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT");
  }
}

admin.initializeApp({
  ...(credential ? { credential } : {}),
  projectId: firebaseConfig.projectId,
  databaseURL: `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com/`
});

const db = getFirestore(firebaseConfig.firestoreDatabaseId);
const rtdb = getDatabase();

const collections = ["vans", "items", "appointments", "roles", "users", "audit_logs", "stock_takes", "triggers", "forms", "saved_reports", "product_types"];

const SCHEMAS = {
    users: { essentials: ['user_id', 'id', 'user_name', 'name', 'email', 'role_id', 'created_at'] },
    vans: { essentials: ['van_id', 'location_id', 'created_at', 'default_lat', 'default_lng'] },
    items: { essentials: ['item_id', 'item_type', 'provider', 'created_at'] },
    appointments: { essentials: ['appointment_id', 'id', 'appointment_name', 'schedule_date', 'lat', 'lng', 'created_at'] },
    product_types: { essentials: ['id', 'name', 'duration_minutes', 'created_at'] },
    roles: { essentials: ['role_id', 'role_name', 'created_at'] },
    forms: { essentials: ['id', 'name', 'created_at'] }
};

const saveNormalizedMigration = async (col, id, data) => {
    const schema = SCHEMAS[col];
    const idToUse = id || data.id || data[`${col.slice(0, -1)}_id`] || Math.random().toString(36).substr(2, 9);
    
    // Convert Firestore Timestamps to Numbers/ServerValue
    const cleanData = {};
    Object.keys(data).forEach(k => {
        let v = data[k];
        if (v && v.toDate) v = v.toDate().getTime(); // Firestore Timestamp
        cleanData[k] = v;
    });

    if (!schema) {
      await rtdb.ref(`${col}/${idToUse}`).set(cleanData);
      return;
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
        __entry_timestamp__: Date.now(),
        __migration__: true
    });
};

async function migrate() {
    console.log("Starting Migration from Firestore to RTDB...");
    for (const col of collections) {
        console.log(`Migrating ${col}...`);
        try {
            const snap = await db.collection(col).get();
            console.log(`Found ${snap.size} docs in ${col}`);
            for (const doc of snap.docs) {
                await saveNormalizedMigration(col, doc.id, doc.data());
            }
        } catch (e) {
            console.error(`Error migrating ${col}:`, e.message);
        }
    }
    console.log("Migration Complete!");
    process.exit(0);
}

migrate();
