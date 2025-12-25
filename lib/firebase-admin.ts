import * as admin from 'firebase-admin';

const isFirebaseConfigured = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

if (isFirebaseConfigured && !admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
    });
}

export const bucket = isFirebaseConfigured ? admin.storage().bucket() : null as any;
