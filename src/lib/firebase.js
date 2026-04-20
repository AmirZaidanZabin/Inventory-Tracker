import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged, 
    signInAnonymously,
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

async function apiFetch(url, options = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not authenticated");
    const idToken = await user.getIdToken();
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 404) return null;

    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
    }
    return response.json();
}

export const firebase = {
    signIn: async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_oauth_access_token', credential.accessToken);
            }
            return result;
        } catch (error) {
            if (error.code === 'auth/popup-closed-by-user') {
                console.log('User closed popup.');
                return null;
            }
            throw error;
        }
    },
    signInAnonymously: () => signInAnonymously(auth),
    signInEmail: (email, pass) => signInWithEmailAndPassword(auth, email, pass),
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
    onAuth: (cb) => onAuthStateChanged(auth, cb),
    auth,

    changeUserPassword: async (uid, newPassword) => {
        return apiFetch(`/api/admin/users/${uid}/password`, {
            method: 'POST',
            body: JSON.stringify({ password: newPassword })
        });
    },

    logAction: async (action, details) => {
        try {
            await apiFetch('/api/audit_logs', {
                method: 'POST',
                body: JSON.stringify({
                    action,
                    details,
                    user_id: auth.currentUser?.uid,
                    user_name: auth.currentUser?.displayName,
                    timestamp: '__server_timestamp__'
                })
            });
        } catch (e) { console.error('Log error:', e); }
    },
    db: {
        collection: (db, name) => ({ type: 'collection', path: name }),
        doc: (db, col, id) => ({ type: 'doc', path: `${col}/${id}`, col, id }),
        query: (ref) => ref,
        
        subscribe: (ref, cb, errCb) => {
            let interval;
            const parseData = (d) => ({ 
                ...d, 
                created_at: d.created_at ? { toDate: () => new Date(d.created_at) } : null, 
                updated_at: d.updated_at ? { toDate: () => new Date(d.updated_at) } : null,
                timestamp: d.timestamp ? { toDate: () => new Date(d.timestamp) } : null 
            });

            const poll = async () => {
                const user = auth.currentUser;
                if (!user) return; // Silently skip if auth not ready
                
                try {
                    const data = await (ref.type === 'collection' 
                        ? apiFetch(`/api/${ref.path}`) 
                        : apiFetch(`/api/${ref.col}/${ref.id}`));
                    
                    // Mock Snapshot
                    const snap = ref.type === 'collection' 
                        ? { 
                            docs: (data || []).map(d => ({ 
                                id: d.id, 
                                data: () => parseData(d) 
                            })),
                            size: (data || []).length,
                            empty: !(data && data.length > 0),
                            forEach: (f) => (data || []).forEach(d => f({ id: d.id, data: () => parseData(d) }))
                        }
                        : {
                            exists: () => !!data,
                            data: () => data ? parseData(data) : null,
                            id: data?.id || ref.id
                        };
                    cb(snap);
                } catch (e) {
                    console.error('Poll error:', e);
                    if (errCb) errCb(e);
                }
            };
            
            poll();
            interval = setInterval(poll, 2000); // Poll every 2s
            return () => clearInterval(interval);
        },

        getDoc: async (ref) => {
            const data = await apiFetch(`/api/${ref.col}/${ref.id}`);
            const parseData = (d) => ({ 
                ...d, 
                created_at: d.created_at ? { toDate: () => new Date(d.created_at) } : null, 
                updated_at: d.updated_at ? { toDate: () => new Date(d.updated_at) } : null,
                timestamp: d.timestamp ? { toDate: () => new Date(d.timestamp) } : null 
            });
            return {
                exists: () => !!data,
                data: () => data ? parseData(data) : null,
                id: data?.id || ref.id
            };
        },

        getDocs: async (ref) => {
            const data = await apiFetch(`/api/${ref.path}`);
            const parseData = (d) => ({ 
                ...d, 
                created_at: d.created_at ? { toDate: () => new Date(d.created_at) } : null, 
                updated_at: d.updated_at ? { toDate: () => new Date(d.updated_at) } : null,
                timestamp: d.timestamp ? { toDate: () => new Date(d.timestamp) } : null 
            });
            const docs = (data || []).map(d => ({ 
                id: d.id, 
                data: () => parseData(d)
            }));
            return {
                docs: docs,
                size: docs.length,
                empty: docs.length === 0,
                forEach: (f) => docs.forEach(f)
            };
        },

        setDoc: async (ref, data) => {
            return apiFetch(`/api/${ref.col}`, {
                method: 'POST',
                body: JSON.stringify({ ...data, id: ref.id, created_at: '__server_timestamp__', updated_at: '__server_timestamp__' })
            });
        },

        addDoc: async (ref, data) => {
            return apiFetch(`/api/${ref.path}`, {
                method: 'POST',
                body: JSON.stringify({ ...data, created_at: '__server_timestamp__', updated_at: '__server_timestamp__' })
            });
        },

        updateDoc: async (ref, data) => {
            return apiFetch(`/api/${ref.col}/${ref.id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...data, updated_at: '__server_timestamp__' })
            });
        },

        deleteDoc: async (ref) => {
            return apiFetch(`/api/${ref.col}/${ref.id}`, {
                method: 'DELETE'
            });
        },
        
        serverTimestamp: () => '__server_timestamp__',
        db: {}
    }
};
