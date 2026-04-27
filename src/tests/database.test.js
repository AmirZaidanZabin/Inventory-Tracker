import { apiDb as db } from '../lib/api-client.js';

export async function runDatabaseTests(t) {
    t.test('DB: Lead to Merchant Transition', async () => {
        const leadId = `test_lead_conv_${Date.now()}`;
        const merchantId = `test_merch_conv_${Date.now()}`;
        
        try {
            // 1. Create Lead
            await db.create('leads', {
                merchant_name: 'Test Conversion Merchant',
                cr_number: 'CONV-123',
                status: 'approved'
            }, leadId);

            // 2. Simulate Conversion (This usually happens in a Lead Detail view action)
            const lead = await db.findOne('leads', leadId);
            t.assert(lead, 'Lead should exist');

            await db.create('merchants', {
                ...lead,
                id: merchantId,
                status: 'active',
                converted_from: leadId,
                converted_at: Date.now()
            }, merchantId);

            // 3. Verify
            const merchant = await db.findOne('merchants', merchantId);
            t.assert(merchant, 'Merchant should be created');
            t.assert(merchant.cr_number === 'CONV-123', 'Data should persist');

        } finally {
            // Cleanup
            await db.remove('leads', leadId);
            try {
                await db.remove('merchants', merchantId);
            } catch(e) {
                console.log("Merchant cleanup failed (expected if rules block it)");
            }
        }
    });

    t.test('DB: Firestore Rule Check (Expect failure if rules missing)', async () => {
        // This test intentionally tries to write to a potentially unprotected collection
        const testId = `rule_test_${Date.now()}`;
        try {
            await db.create('merchants', { name: 'Unauthorized test' }, testId);
            t.assert(true, 'Write succeeded');
        } catch (e) {
            if (e.message.includes('permission-denied')) {
                throw new Error('Security Regression: Merchants collection is read-only or not configured');
            }
            throw e;
        } finally {
            try { await db.remove('merchants', testId); } catch(e) {}
        }
    });
}
