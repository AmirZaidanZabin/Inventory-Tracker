import { firebase } from '../lib/firebase.js';

export async function runAuthTests(t) {
    // --- Test 1: Verify Password Failure Logic ---
    await t.test('Auth: Should fail with incorrect password', async () => {
        try {
            // Attempting to sign in with a known email but wrong password
            await firebase.signInEmail('test@example.com', 'wrong_password_123');
            t.assert(false, 'Login should have thrown an error for incorrect password');
        } catch (e) {
            // Firebase returns specific error codes for password mismatches
            const isAuthError = e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential';
            t.assert(isAuthError, 'Should return an authentication error code (auth/wrong-password or auth/invalid-credential)');
        }
    });

    // --- Test 2: Verify Logout Clears State ---
    await t.test('Auth: Logout should clear current user', async () => {
        await firebase.signOut();
        const user = firebase.auth.currentUser;
        t.assert(user === null, 'Current user should be null after sign out');
    });

    // --- Test 3: Password Reset Email Flow ---
    await t.test('Auth: Password reset should not throw errors for valid email', async () => {
        try {
            await firebase.resetPassword('test@example.com');
            t.assert(true, 'Reset password call successful');
        } catch (e) {
            t.assert(false, 'Reset password failed: ' + e.message);
        }
    });
}
