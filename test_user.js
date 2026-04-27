import { db } from './lib/db/index.js';

async function test() {
    try {
        await db.create('users', {
            user_name: 'testuser',
            email: 'test@example.com',
            role_id: 'admin',
            is_deleted: false,
            created_at: '__server_timestamp__',
            updated_at: '__server_timestamp__'
        }, 'test_user_id');
        console.log("Success");
        await db.remove('users', 'test_user_id');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
test();
