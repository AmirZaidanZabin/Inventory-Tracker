
import { firebase } from '../../firebase.js';

export class FirebaseAdapter {
    /**
     * Translates generic queries to Firebase SDK syntax.
     * Strips provider-specific wrappers to return plain JS objects.
     */
    async findMany(table, options = {}) {
        const colRef = firebase.db.collection(firebase.db.db, table);
        // Basic implementation (extension of filtering logic requested)
        const snap = await firebase.db.getDocs(colRef);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async findOne(table, id) {
        const docRef = firebase.db.doc(firebase.db.db, table, id);
        const snap = await firebase.db.getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
    }

    async create(table, data, id = null) {
        const colRef = firebase.db.collection(firebase.db.db, table);
        const docRef = id ? firebase.db.doc(colRef, id) : firebase.db.doc(colRef);
        await firebase.db.setDoc(docRef, data);
        return { id: docRef.id, ...data };
    }

    async update(table, id, data) {
        const docRef = firebase.db.doc(firebase.db.db, table, id);
        await firebase.db.updateDoc(docRef, data);
        return { id, ...data };
    }

    async remove(table, id) {
        const docRef = firebase.db.doc(firebase.db.db, table, id);
        await firebase.db.deleteDoc(docRef);
        return id;
    }

    subscribe(table, options, callback) {
        if (options && options.id) {
            const docRef = firebase.db.doc(firebase.db.db, table, options.id);
            return firebase.db.subscribe(docRef, (snap) => {
                if (!snap.exists()) {
                    callback(null);
                } else {
                    callback({ id: snap.id, ...snap.data() });
                }
            });
        }
        const colRef = firebase.db.collection(firebase.db.db, table);
        return firebase.db.subscribe(colRef, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(data);
        });
    }

    serverTimestamp() {
        return firebase.db.serverTimestamp();
    }
}
