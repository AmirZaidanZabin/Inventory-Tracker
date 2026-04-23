import { tester } from '../lib/tester.js';
import { firebase } from '../lib/firebase.js';
import { runViewTests } from './views.test.js';
import { runSystemTests } from './system.test.js';
import { runAuthTests } from './auth.test.js';
import { runScannerTests } from './scanner.test.js';

export async function runTests() {
    const t = tester();
    console.log("Starting Pico Inventory Pro Test Suite...");

    // View Tests
    await runViewTests(t);

    // Hardware/Scanner Tests
    await runScannerTests(t);

    // System Integration & Audit Tests
    await runSystemTests(t);

    // Auth & Logic Tests
    await runAuthTests(t);

    // CRUD Tests (using a test collection)
    await t.test('Firestore: Create and Delete Test Doc', async () => {
        const testId = `test_${Date.now()}`;
        const testRef = firebase.db.doc(firebase.db.db, 'test_collection', testId);
        
        await firebase.db.setDoc(testRef, { name: 'Test User', timestamp: firebase.db.serverTimestamp() });
        const snap = await firebase.db.getDoc(testRef);
        t.assert(snap.exists(), 'Document should exist after creation');
        t.assert(snap.data().name === 'Test User', 'Document data should match');

        await firebase.db.deleteDoc(testRef);
        const snapAfter = await firebase.db.getDoc(testRef);
        t.assert(!snapAfter.exists(), 'Document should not exist after deletion');
    });

    // Role Logic Tests
    await t.test('Role Authorities should be an array', async () => {
        const rolesSnap = await firebase.db.getDocs(firebase.db.collection(firebase.db.db, 'roles'));
        if (!rolesSnap.empty) {
            const role = rolesSnap.docs[0].data();
            t.assert(role.authorities === undefined || Array.isArray(role.authorities), 'authorities should be an array or undefined');
        }
    });

    t.summary();
}
