import { SalesBackend } from '../modules/sales.backend.js';
import { apiDb as db } from '../lib/api-client.js';

export async function runApprovalsTests(t) {
    t.test('Approvals: Auto-Approval for high GMV and standard rates', async () => {
        // Setup mock data
        const leadId = `test_lead_auto_${Date.now()}`;
        await db.create('leads', {
            monthly_gmv: "1000000",
            rate_mada: "0.8",
            rate_visa: "1.5",
            status: 'pending'
        }, leadId);

        try {
            const result = await SalesBackend.submitLead(leadId);
            t.assert(result.action === 'auto_approved', 'Should be auto-approved');
            
            const lead = await db.findOne('leads', leadId);
            t.assert(lead.status === 'approved', 'Lead status should be approved');
        } finally {
            await db.remove('leads', leadId);
        }
    });

    t.test('Approvals: Routing to VP for low GMV', async () => {
        const leadId = `test_lead_vp_${Date.now()}`;
        // VP Tier usually has high GMV requirement
        await db.create('leads', {
            monthly_gmv: "5000", 
            rate_mada: "0.8",
            status: 'pending'
        }, leadId);

        try {
            const result = await SalesBackend.submitLead(leadId);
            t.assert(result.action === 'routed_for_approval', 'Should be routed for approval');
            t.assert(result.required_tier === 'VP' || result.required_tier === 'Director', 'Should require high level approval');
            
            const lead = await db.findOne('leads', leadId);
            t.assert(lead.status === 'pending', 'Lead should be pending');
            t.assert(lead.pending_approval_id, 'Should have a pending approval record');
            
            // Cleanup approval record too
            if (lead.pending_approval_id) {
                await db.remove('approvals', lead.pending_approval_id);
            }
        } finally {
            await db.remove('leads', leadId);
        }
    });
}
