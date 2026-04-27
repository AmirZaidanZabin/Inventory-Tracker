
export const auth = {
    get currentUser() {
        try {
            const token = localStorage.getItem('applet_auth_token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                return { 
                    uid: payload.uid, 
                    email: payload.email, 
                    getIdToken: async () => token 
                };
            }
        } catch(e) { }
        return null;
    },

    signIn: async () => {
        alert('Google Sign-In is disabled for the local DB deployment. Please use Email/Password sign-in.');
        return null;
    },

    signInAnonymously: async () => {
        const res = await fetch("/api/auth/anonymous", { method: 'POST' });
        if (!res.ok) throw new Error('Anonymous auth failed');
        const data = await res.json();
        if (data.token) {
            localStorage.setItem('applet_auth_token', data.token);
            _triggerAuthChange();
        }
        return data.user;
    },
    
    signInEmail: async (email, pass) => {
        const res = await fetch("/api/auth/login", { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass }) 
        });
        if (!res.ok) {
            const err = await res.json();
            const error = new Error(err.error || 'Login failed');
            error.code = 'auth/invalid-credential'; // To match frontend logic
            throw error;
        }
        const data = await res.json();
        if (data.token) localStorage.setItem('applet_auth_token', data.token);
        _triggerAuthChange();
        return data.user;
    },
    
    resetPassword: (email) => {
        // Mocked or inform user
        return Promise.reject(new Error("Local Database does not support email reset tokens. Please ask an admin to reset it in Settings."));
    },
    
    signOut: () => {
        localStorage.removeItem('applet_auth_token');
        _triggerAuthChange();
    },
    
    onAuth: (cb) => {
        _listeners.push(cb);
        cb(auth.currentUser);
        return () => { _listeners = _listeners.filter(l => l !== cb); };
    },

    changeUserPassword: async (uid, newPassword) => {
        const { apiFetch } = await import('./api.js');
        return apiFetch(`/api/admin/users/${uid}/password`, {
            method: "POST",
            body: JSON.stringify({ password: newPassword }),
        });
    },

    getToken: async () => {
        const user = auth.currentUser;
        if (!user && window._isTesting) return 'TEST_BYPASS_TOKEN';
        return user ? await user.getIdToken() : null;
    }
};

let _listeners = [];
function _triggerAuthChange() {
    const user = auth.currentUser;
    for (const l of _listeners) l(user);
}

