import * as admin from 'firebase-admin';

// Vercel Redeploy Trigger: Adding verbose logging for production debugging.

const isFirebaseConfigured = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

let storageApp: admin.app.App | null = null;

if (isFirebaseConfigured) {
    const appName = 'storage-admin';
    const existingApp = admin.apps.find(app => app?.name === appName);

    if (existingApp) {
        storageApp = existingApp;
    } else {
        try {
            const rawKey = process.env.FIREBASE_PRIVATE_KEY || '';
            const privateKey = rawKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');

            console.log(`[Firebase Admin] Initializing named app: ${appName} for project: ${process.env.FIREBASE_PROJECT_ID}`);
            console.log(`[Firebase Admin] Key Length detected: ${privateKey.length}`);

            if (privateKey.length < 100) {
                throw new Error('Firebase private key seems too short or malformed.');
            }

            storageApp = admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey,
                }),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
            }, appName);
            console.log('[Firebase Admin] Named app initialization successful');
        } catch (error: any) {
            console.error('[Firebase Admin] Named app initialization failed:', error.message);
        }
    }
} else {
    console.warn('[Firebase Admin] Configuration missing. Check .env.local');
}

export const bucket = storageApp ? storageApp.storage().bucket() : null;
