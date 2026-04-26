const { calculateNBR, NBRWorkflowRouter } = require('../../src/lib/financial/nbr');

describe('Net Blended Rate (NBR) Calculation', () => {
    
    it('should correctly calculate NBR without the +1 SAR flat fee', () => {
        // Mada: 0.01 (1%), CC: 0.015 (1.5%)
        // Expected Mada = 0.778 * (0.01 - 0.004) = 0.778 * 0.006 = 0.004668
        // Expected CC = 0.222 * (0.015 - 0.005) = 0.222 * 0.010 = 0.002220
        // Total Expected = 0.006888
        
        const nbr = calculateNBR(0.01, 0.015, false);
        expect(nbr).toBeCloseTo(0.006888, 6);
    });

    it('should correctly calculate NBR with the +1 SAR flat fee included', () => {
        // Expected Total = 0.006888 + 0.0045721 = 0.0114601
        
        const nbr = calculateNBR(0.01, 0.015, true);
        expect(nbr).toBeCloseTo(0.0114601, 6);
    });

    it('should handle zero rates correctly, producing negative NBR if no flat fee', () => {
        // Mada: 0, CC: 0
        // Mada = 0.778 * -0.004 = -0.003112
        // CC = 0.222 * -0.005 = -0.001110
        // Total Expected = -0.004222
        
        const nbr = calculateNBR(0.0, 0.0, false);
        expect(nbr).toBeCloseTo(-0.004222, 6);
    });

    it('should eliminate floating point artifacts through scaling integers', () => {
        // 0.1 and 0.2 floats are notoriously bad. We test logic resiliency here.
        // Mada: 0.1, CC: 0.2
        // Mada = 0.778 * 0.096 = 0.074688
        // CC = 0.222 * 0.195 = 0.043290
        // Total = 0.117978
        
        const nbr = calculateNBR(0.1, 0.2, false);
        expect(nbr).toBeCloseTo(0.117978, 6);
    });
});

describe('NBR Workflow Router', () => {
    
    it('should correctly route to auto-approve when threshold is met', () => {
        const threshold = 0.0100; // 1%
        const router = new NBRWorkflowRouter(threshold);
        
        // nbr with these inputs = 0.0114601
        const result = router.route('PROP_123', 0.01, 0.015, true);
        
        expect(result.status).toBe('APPROVED');
        expect(result.nbr).toBeGreaterThanOrEqual(threshold);
    });

    it('should correctly route to manual review when threshold is missed', () => {
        const threshold = 0.0100; // 1%
        const router = new NBRWorkflowRouter(threshold);
        
        // nbr with these inputs = 0.006888
        const result = router.route('PROP_124', 0.01, 0.015, false);
        
        expect(result.status).toBe('PENDING_REVIEW');
        expect(result.nbr).toBeLessThan(threshold);
    });
});
