
import admin from "firebase-admin";
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

const rtdb = getDatabase();

async function seed() {
  console.log("Seeding basic roles to RTDB...");
  await rtdb.ref('roles/admin').set({ role_id: 'admin', role_name: 'Administrator', created_at: Date.now() });
  await rtdb.ref('roles/technician').set({ role_id: 'technician', role_name: 'Technician', created_at: Date.now() });
  await rtdb.ref('roles/viewer').set({ role_id: 'viewer', role_name: 'Viewer', created_at: Date.now() });
  
  // Note: We don't seed users here because we don't know their UIDs easily.
  // The first user with the admin email will be recognized by server logic.
  
  console.log("Seed complete.");
  process.exit(0);
}

seed();
