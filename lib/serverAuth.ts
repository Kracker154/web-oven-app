// lib/serverAuth.ts
import { adminAuth, adminDb } from './firebaseAdmin';
import { NextRequest } from 'next/server'; // Import NextRequest
import { DecodedIdToken } from 'firebase-admin/auth';

// Define the shape of the object our functions will return
interface VerificationResult {
    success: boolean;
    status: number;
    message: string;
    user: DecodedIdToken | null;
}

// This function verifies the user token from the request object.
export async function verifyUser(request: NextRequest): Promise<VerificationResult> {
  const authorization = request.headers.get('Authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return { success: false, status: 401, message: "Missing or invalid Authorization header", user: null };
  }
  
  const idToken = authorization.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return { success: true, status: 200, message: "User verified", user: decodedToken };
  } catch (error) {
    return { success: false, status: 401, message: "Invalid auth token", user: null };
  }
}

// This function first verifies the user, then checks if they are an admin.
export async function verifyAdmin(request: NextRequest): Promise<VerificationResult> {
    const verification = await verifyUser(request); // Pass the request to verifyUser
    if (!verification.success || !verification.user) {
        return verification;
    }

    try {
        const userDoc = await adminDb.collection('users').doc(verification.user.uid).get();
        if (!userDoc.exists || !userDoc.data()?.isAdmin) {
            return { success: false, status: 403, message: "User is not an admin", user: verification.user };
        }
    } catch (error) {
        console.error("Admin check failed in Firestore:", error);
        return { success: false, status: 500, message: "Internal server error during admin check", user: verification.user };
    }

    return { success: true, status: 200, message: "Admin verified", user: verification.user };
}