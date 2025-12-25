import * as admin from 'firebase-admin';

const isFirebaseConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

if (isFirebaseConfigured && !admin.apps.length) {
    try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey,
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
        });
        console.log('[Firebase Admin] Initialization successful');
    } catch (error: any) {
        console.error('[Firebase Admin] Initialization failed:', error.message);
    }
} else if (!isFirebaseConfigured) {
    console.warn('[Firebase Admin] Configuration missing:', {
        projectId: !!process.env.FIREBASE_PROJECT_ID,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY
    });
}

export const bucket = isFirebaseConfigured ? admin.storage().bucket() : null;
