## Financial NBR Workflow Implementation

### Overview
This document outlines the implementation of the Net Blended Rate (NBR) calculation, designed to holistically evaluate the profitability of a fee proposal. By weighting the market share differently (Mada vs. Credit Card) and resolving differences with optional flat fees, we bypass single-rate rigid blocking matrices in favor of dynamic threshold evaluations.

### Mathematical Constants
To ensure precision and eliminate floating-point arithmetic pollution (e.g., `0.1 + 0.2 = 0.30000000000000004`), the logic internally scales floats by `10,000,000` (7 precision places).

- **Mada Market Share Weight**: 77.8% (0.778)
- **Credit Card Market Share Weight**: 22.2% (0.222)
- **Mada Base Deduction**: 0.4% (0.004)
- **CC Base Deduction**: 0.5% (0.005)
- **+1 SAR Fee Equivalent**: 0.45721% (0.0045721)

### Execution Logic (TypeScript/JavaScript)

```typescript
const SCALE = 10_000_000;

export function calculateNBR(madaRate: number, ccRate: number, hasPlusOneSar: boolean): number {
    const madaInt = Math.round(madaRate * SCALE);
    const ccInt = Math.round(ccRate * SCALE);

    // Mada component = 0.778 * (Mada - 0.004)
    const madaComponent = (7_780_000 * (madaInt - 40_000)) / SCALE;
    
    // CC component = 0.222 * (CC - 0.005)
    const ccComponent = (2_220_000 * (ccInt - 50_000)) / SCALE;
    
    // Optional flag addition
    const flatFeeComponent = hasPlusOneSar ? 45_721 : 0;
    
    const nbrInt = madaComponent + ccComponent + flatFeeComponent;
    
    return nbrInt / SCALE;
}
```

### Architectural Integration

The implementation intercepts the proposal object utilizing the **Strategy Pattern**.

Rather than checking multiple conditional properties tightly coupled to the endpoint controller, we encapsulate the context into a `NBRWorkflowRouter`.

1. **Interception Phase**: During the `db.approvals.create` API call or workflow update, the controller passes the requested rates to `NBRWorkflowRouter.route(..., config.threshold)`.
2. **Strategy Resolution**:
   - If `NBR < <NBR_APPROVAL_THRESHOLD>`: Resolves to `ManualReviewStrategy`. The backend mutates the object state (e.g., `status = PENDING_TIER_2`) and dispatches notification payloads to the necessary approver queue.
   - If `NBR >= <NBR_APPROVAL_THRESHOLD>`: Resolves to `AutoApproveStrategy`. The traditional block checks are bypassed, and the entity state finalizes as `APPROVED` automatically.

This ensures the controller remains detached from raw math algorithms and guarantees compliance-safe decimal handling for all incoming quotes.
