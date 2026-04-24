
export class SupabaseAdapter {
    /**
     * Standard findMany for Supabase (SKELETON)
     */
    async findMany(table, options = {}) {
        console.log(`Supabase: selecting from ${table}`);
        // return await supabase.from(table).select('*');
        return [];
    }

    async findOne(table, id) {
        return null;
    }

    async create(table, data, id) {
        return null;
    }

    async update(table, id, data) {
        return null;
    }

    async remove(table, id) {
        return null;
    }

    subscribe(table, options, callback) {
        console.log(`Supabase: subscribing to ${table}`);
        return () => {}; // Unsubscribe
    }

    serverTimestamp() {
        return new Date().toISOString();
    }
}
