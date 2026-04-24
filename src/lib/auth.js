
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const _auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/calendar.events");

export const auth = {
    get currentUser() {
        return _auth.currentUser;
    },

    signIn: async () => {
        try {
            const result = await signInWithPopup(_auth, googleProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem("google_oauth_access_token", credential.accessToken);
            }
            return result;
        } catch (error) {
            if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
                return null;
            }
            throw error;
        }
    },

    signInAnonymously: () => signInAnonymously(_auth),
    
    signInEmail: (email, pass) => signInWithEmailAndPassword(_auth, email, pass),
    
    resetPassword: (email) => sendPasswordResetEmail(_auth, email),
    
    signOut: () => signOut(_auth),
    
    onAuth: (cb) => onAuthStateChanged(_auth, cb),

    changeUserPassword: async (uid, newPassword) => {
        const { apiFetch } = await import('./api.js');
        return apiFetch(`/api/admin/users/${uid}/password`, {
            method: "POST",
            body: JSON.stringify({ password: newPassword }),
        });
    },

    // Helper to get token for API calls
    getToken: async () => {
        const user = _auth.currentUser;
        if (!user && window._isTesting) return 'TEST_BYPASS_TOKEN';
        return user ? await user.getIdToken() : null;
    }
};
