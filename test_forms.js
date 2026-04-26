import { db } from './src/lib/db/index.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(app);

async function test() {
    const snap = await getDocs(collection(firestoreDb, 'forms'));
    const forms = snap.docs.map(d => ({id: d.id, ...d.data()}));
    console.log(JSON.stringify(forms, null, 2));
    process.exit(0);
}
test();
