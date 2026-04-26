import { test, expect, beforeAll } from 'vitest';

beforeAll(() => {
    // Set up environment 
    window.APP_CONFIG = { DB_PROVIDER: 'rest' };
});

test('Insights Configuration feature setup', async () => {
    const { db } = await import('../lib/db/index.js');
    
    // Mock the adapter
    const memoryDb = { insights_configs: [], app_settings: [] };
    db.adapter = {
        findMany: async (table) => memoryDb[table] || [],
        findOne: async (table, id) => (memoryDb[table] || []).find(x => x.id === id),
        create: async (table, data, id) => {
            if (!memoryDb[table]) memoryDb[table] = [];
            const newDoc = { ...data, id: id || `mock_${Date.now()}` };
            memoryDb[table].push(newDoc);
            return newDoc;
        },
        update: async (table, id, data) => {
            const arr = memoryDb[table];
            const idx = arr.findIndex(x => x.id === id);
            if (idx >= 0) {
                arr[idx] = { ...arr[idx], ...data };
                return arr[idx];
            }
            return null;
        },
        remove: async (table, id) => {
            const arr = memoryDb[table];
            const idx = arr.findIndex(x => x.id === id);
            if (idx >= 0) arr.splice(idx, 1);
        }
    };
    
    // Test that the Insights module allows CRU operations
    await db.updateOrCreate('insights_configs', 'test-insight-1', {
        title: 'Sales Last 30 Days',
        target_module: 'dashboard',
        sql_template: 'SELECT SUM(gmv) FROM analytics.sales_last_30',
        active: true,
        updated_at: Date.now()
    });

    const configs = await db.findMany('insights_configs');
    const myConfig = configs.find(c => c.id === 'test-insight-1');
    expect(myConfig).toBeDefined();
    expect(myConfig.title).toBe('Sales Last 30 Days');
    expect(myConfig.sql_template).toContain('SELECT SUM(gmv)');

    await db.remove('insights_configs', 'test-insight-1');
    
    const configsAfter = await db.findMany('insights_configs');
    expect(configsAfter.find(c => c.id === 'test-insight-1')).toBeUndefined();
});

test('Settings feature system validation options', async () => {
    const { db } = await import('../lib/db/index.js');
    
    // Save system settings via DB
    await db.updateOrCreate('app_settings', 'global', {
        require_registry_verification: true,
        enforce_kyc: true,
        cr_api_url: 'https://api.test.run/cr',
        gemini_api_key: 'AIZA-MOCK-GEMINI-KEY',
        sf_account: 'test.sf.org',
        updated_at: Date.now()
    });

    // Retrieve system settings
    const settings = await db.findOne('app_settings', 'global');
    
    expect(settings).toBeDefined();
    expect(settings.require_registry_verification).toBe(true);
    expect(settings.enforce_kyc).toBe(true);
    expect(settings.cr_api_url).toBe('https://api.test.run/cr');
    expect(settings.gemini_api_key).toBe('AIZA-MOCK-GEMINI-KEY');
    expect(settings.sf_account).toBe('test.sf.org');
});
