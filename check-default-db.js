
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

admin.initializeApp({
  projectId: firebaseConfig.projectId
});

const defaultDb = getFirestore();

async function check() {
  try {
    const snap = await defaultDb.collection('users').limit(1).get();
    console.log("Default DB 'users' count:", snap.size);
  } catch (e) {
    console.error("Default DB Error:", e.message);
  }
  process.exit(0);
}
check();
