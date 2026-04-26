/**
 * Core Financial NBR Constants
 */
const SCALE = 10_000_000; // Multiplier for 7-decimal place safety against float errors.

const WEIGHT_MADA_FRAC = 0.778; 
const WEIGHT_CC_FRAC = 0.222;

const DEDUCT_MADA_FRAC = 0.004;
const DEDUCT_CC_FRAC = 0.005;

const FLAT_FEE_EQUIV_FRAC = 0.0045721;

// Convert to internal integer representations globally to freeze them.
const WEIGHT_MADA = Math.round(WEIGHT_MADA_FRAC * SCALE);
const WEIGHT_CC = Math.round(WEIGHT_CC_FRAC * SCALE);
const DEDUCT_MADA = Math.round(DEDUCT_MADA_FRAC * SCALE);
const DEDUCT_CC = Math.round(DEDUCT_CC_FRAC * SCALE);
const FLAT_FEE_EQUIV = Math.round(FLAT_FEE_EQUIV_FRAC * SCALE);

/**
 * Pure function to calculate the Net Blended Rate (NBR) using integer scaling
 * to bypass standard JS floating-point arithmetic errors.
 * 
 * Formula: NBR = (0.778 * (Mada Rate - 0.004)) + (0.222 * (CC Rate - 0.005)) + (if +1SAR -> 0.0045721)
 * 
 * @param {number} madaRate - Proposed rate for Mada (decimal format, e.g., 0.01 for 1%)
 * @param {number} ccRate - Proposed rate for CC (decimal format)
 * @param {boolean} hasPlusOneSar - Toggle for +1 SAR flat fee
 * @returns {number} The calculated NBR as a decimal.
 */
function calculateNBR(madaRate, ccRate, hasPlusOneSar) {
    // 1. Scale inputs
    const madaInt = Math.round(madaRate * SCALE);
    const ccInt = Math.round(ccRate * SCALE);
    
    // 2. Evaluate components with order of operations
    // Note: Division by SCALE to normalize the multiplication of two scaled factors.
    const madaComponent = (WEIGHT_MADA * (madaInt - DEDUCT_MADA)) / SCALE;
    const ccComponent = (WEIGHT_CC * (ccInt - DEDUCT_CC)) / SCALE;
    
    // 3. Evaluate optional flag
    const flatFeeComponent = hasPlusOneSar ? FLAT_FEE_EQUIV : 0;
    
    // 4. Sum components
    const nbrInt = madaComponent + ccComponent + flatFeeComponent;
    
    // 5. Unscale back to decimal
    return nbrInt / SCALE;
}

/**
 * Strategy Pattern Interface implementation for Approval Routing
 */
class ApprovalStrategy {
    execute(proposalId, nbr) {
        throw new Error("Must implement execute method.");
    }
}

class AutoApproveStrategy extends ApprovalStrategy {
    execute(proposalId, nbr) {
        console.log(`[AutoApprove] Proposal ${proposalId} bypassed bottlenecks. NBR: ${nbr}`);
        // Integration hook: db.approvals.update({ status: 'APPROVED' })
        return { status: 'APPROVED', reason: 'NBR met or exceeded threshold', nbr };
    }
}

class ManualReviewStrategy extends ApprovalStrategy {
    execute(proposalId, nbr) {
        console.log(`[ManualReview] Proposal ${proposalId} requires review. NBR: ${nbr}`);
        // Integration hook: db.approvals.update({ status: 'PENDING_TIER_2' })
        return { status: 'PENDING_REVIEW', reason: 'NBR below automatic threshold', nbr };
    }
}

/**
 * Context for Workflow Routing
 */
class NBRWorkflowRouter {
    constructor(threshold) {
        this.threshold = threshold;
    }

    /**
     * Executes the calculation and routes appropriately.
     */
    route(proposalId, madaRate, ccRate, hasPlusOneSar) {
        const nbr = calculateNBR(madaRate, ccRate, hasPlusOneSar);
        
        let strategy;
        if (nbr >= this.threshold) {
            strategy = new AutoApproveStrategy();
        } else {
            strategy = new ManualReviewStrategy();
        }
        
        return strategy.execute(proposalId, nbr);
    }
}

module.exports = {
    calculateNBR,
    NBRWorkflowRouter,
    AutoApproveStrategy,
    ManualReviewStrategy,
    SCALE,
    WEIGHT_MADA_FRAC,
    WEIGHT_CC_FRAC,
    DEDUCT_MADA_FRAC,
    DEDUCT_CC_FRAC,
    FLAT_FEE_EQUIV_FRAC
};
