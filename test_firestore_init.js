import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
admin.initializeApp({ projectId: 'test-project' });
const db = getFirestore('my-database-id');
console.log('DB project:', db.projectId);
console.log('DB databaseId:', db.databaseId);
