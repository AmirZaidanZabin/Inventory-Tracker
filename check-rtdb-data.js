
import admin from "firebase-admin";
import { getDatabase } from "firebase-admin/database";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

admin.initializeApp({
  projectId: firebaseConfig.projectId,
  databaseURL: `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com/`
});

const rtdb = getDatabase();

async function check() {
  const snap = await rtdb.ref('/').once('value');
  console.log("RTDB Root Keys:", Object.keys(snap.val() || {}));
  process.exit(0);
}
check();
