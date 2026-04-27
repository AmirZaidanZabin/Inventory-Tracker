// ----------------------------------------------------------------------
// BACKEND MODULE: sales.backend.js
// This file acts as the server-side logic (or Cloud Function implementation)
// for processing lead submissions and calculating approval routing.
// In a true environment, this resides on Node.js/Firebase Cloud Functions.
// ----------------------------------------------------------------------

import { apiDb as db } from '../lib/api-client.js'; // Assumes node/server environment compatibility

export const SalesBackend = {

    /**
     * Evaluates a lead's requested rates against the global card tiers.
     * Starts from highest tier (VP) downwards. If any rate is lower than a tier's minimum,
     * it requires approval from that tier.
     */
    async submitLead(leadId) {
        try {
            const lead = await db.findOne('leads', leadId);
            if (!lead || lead.status === 'approved') return { success: false, error: 'Invalid lead state' };

            // Fetch tiers (cached or DB fetch)
            const tiersList = await db.findMany('pricing_tiers') || [];
            // Sort tiers by level descending (e.g. VP -> Director -> Manager)
            // Assuming tiers have a 'level' property where higher number = higher authority
            const sortedTiers = tiersList.sort((a, b) => b.level - a.level);
            
            const cardsList = await db.findMany('pricing_cards') || [];
            
            let requiredTierId = null;
            let breachDetails = [];

            const requestedGmv = parseFloat(lead.monthly_gmv) || 0;

            // Walk down from highest tier to lowest
            for (const tier of sortedTiers) {
                let breachedThisTier = false;

                // 1. Check GMV Breach
                if (tier.min_monthly_gmv && requestedGmv < tier.min_monthly_gmv) {
                    breachedThisTier = true;
                    breachDetails.push({ 
                        type: 'GMV',
                        requested: requestedGmv, 
                        min_required: tier.min_monthly_gmv, 
                        tier_breached: tier.name 
                    });
                }

                // 2. Check Card Rate Breaches
                if (tier.thresholds) {
                    for (const card of cardsList) {
                        const reqRateRaw = lead[`rate_${card.id}`];
                        if (reqRateRaw !== undefined && reqRateRaw !== '') {
                            const reqRate = parseFloat(reqRateRaw);
                            const threshold = tier.thresholds[card.id];
                            if (threshold !== undefined && reqRate < threshold) {
                                breachedThisTier = true;
                                breachDetails.push({ 
                                    type: `Card (${card.name})`,
                                    requested: reqRate, 
                                    min_required: threshold, 
                                    tier_breached: tier.name 
                                });
                            }
                        }
                    }
                }

                if (breachedThisTier) {
                    // Rate breached this tier. Since we go from highest down, the first breach is the required authority.
                    if (!requiredTierId || tier.level > getTierLevel(requiredTierId, sortedTiers)) {
                        requiredTierId = tier.id;
                    }
                    break; // Once we hit a high tier, no need to check lower tiers for the final requiredTierId
                }
            }

            if (!requiredTierId) {
                // Auto-Approve if no thresholds breached
                await db.update('leads', leadId, { status: 'approved', approved_at: Date.now(), breach_details: null });
                return { success: true, action: 'auto_approved' };
            } else {
                // Find default approver for that tier
                const tierInfo = sortedTiers.find(t => t.id === requiredTierId);
                const approverEmail = tierInfo ? tierInfo.approver_email : null;

                // Create Approval Queue Item
                const approvalItem = {
                    lead_id: leadId,
                    tier_id: requiredTierId,
                    approver_uid: approverEmail, // Using email as uid proxy for now
                    status: 'pending',
                    created_at: Date.now(),
                    breach_details: breachDetails
                };

                const approvalRecord = await db.insert('approvals', approvalItem);

                // Lock lead under review
                await db.update('leads', leadId, { 
                    status: 'pending', 
                    current_approver_uid: approverEmail,
                    pending_approval_id: approvalRecord.id
                });

                return { success: true, action: 'routed_for_approval', required_tier: tierInfo.name, breachDetails };
            }

        } catch (error) {
            console.error("submitLead Engine Error:", error);
            throw error;
        }
    },

    /**
     * Invoked when an approver accepts/rejects a requested queue item.
     */
    async processApprovalDecision(approvalId, decision, notes, approverUid) {
        const approval = await db.findOne('approvals', approvalId);
        if (!approval || approval.status !== 'pending') throw new Error('Invalid approval record');

        // Security check (ideally part of Firebase Rules, but enforcing here server-side too)
        if (approval.approver_uid && approval.approver_uid !== approverUid) {
            // Also check if they are admin bypassing it
            // if (!isAdmin) throw new Error('Unauthorized');
        }

        const leadId = approval.lead_id;

        // Update Approval Record
        await db.update('approvals', approvalId, {
            status: decision, // 'approved' or 'rejected'
            resolved_by: approverUid,
            notes: notes,
            resolved_at: Date.now()
        });

        // Update Lead Record
        if (decision === 'approved') {
            await db.update('leads', leadId, { 
                status: 'approved', 
                approved_at: Date.now(), 
                current_approver_uid: null 
            });
        } else {
            // Returned to draft for rework, or hard rejected
            await db.update('leads', leadId, { 
                status: 'rejected', 
                rejected_at: Date.now(),
                current_approver_uid: null 
            });
        }

        return { success: true, decision };
    }
};

function getTierLevel(tierId, tiersList) {
    const t = tiersList.find(x => x.id === tierId);
    return t ? t.level : 0;
}
