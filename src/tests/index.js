import { tester } from '../lib/tester.js';
import { apiDb as db } from '../lib/api-client.js';
import { runViewTests } from './views.test.js';
import { runSystemTests } from './system.test.js';
import { runAuthTests } from './auth.test.js';
import { runScannerTests } from './scanner.test.js';
import { runTrackingTests } from './tracking.test.js';
import { runApprovalsTests } from './approvals.test.js';
import { runLeadsUITests } from './leads-ui.test.js';
import { runDatabaseTests } from './database.test.js';

export async function runTests() {
    const t = tester();
    console.log("Starting Pico Inventory Pro Test Suite...");

    // Sales Module Tests
    await runApprovalsTests(t);
    await runLeadsUITests(t);
    await runDatabaseTests(t);

    // View Tests
    await runViewTests(t);

    // Live Tracking Tests
    await runTrackingTests(t);

    // Hardware/Scanner Tests
    await runScannerTests(t);

    // System Integration & Audit Tests
    await runSystemTests(t);

    // CRUD Tests (using a test collection)
    await t.test('DAL: Create and Delete Test Doc', async () => {
        const testId = `test_${Date.now()}`;
        
        await db.create('test_collection', { name: 'Test User' }, testId);
        const data = await db.findOne('test_collection', testId);
        t.assert(data, 'Document should exist after creation');
        t.assert(data.name === 'Test User', 'Document data should match');

        await db.remove('test_collection', testId);
        const dataAfter = await db.findOne('test_collection', testId);
        t.assert(!dataAfter, 'Document should not exist after deletion');
    });

    // Role Logic Tests
    await t.test('Role Authorities should be an array', async () => {
        const roles = await db.findMany('roles');
        if (roles.length > 0) {
            const role = roles[0];
            t.assert(role.authorities === undefined || Array.isArray(role.authorities), 'authorities should be an array or undefined');
        }
    });

    // Auth & Logic Tests (Run last as they mutate session via signOut)
    await runAuthTests(t);

    t.summary();
}
