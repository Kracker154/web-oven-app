// lib/firebaseAdmin.ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccountJson = Buffer.from(
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON_BASE64!,
      'base64'
    ).toString('ascii');
    
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error);
  }
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth };