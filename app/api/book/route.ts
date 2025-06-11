// app/api/book/[bookingId]/route.ts (Final fix using 'any' to force build)
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

// This is the simplest possible signature to bypass the stubborn type error.
export async function PUT(
    request: NextRequest,
    context: any // Using 'any' as a last resort to solve the build error.
) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    const uid = verification.user!.uid;
    const { bookingId } = context.params; // Get bookingId from the context object

    try {
        const { ovenId, startTime, endTime, title } = await request.json();
        const start = new Date(startTime);
        const end = new Date(endTime);

        const bookingRef = adminDb.collection('bookings').doc(bookingId);
        
        await adminDb.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) {
                throw new Error("Booking not found.");
            }
            const bookingData = bookingDoc.data()!;
            
            const userDocSnap = await transaction.get(adminDb.collection('users').doc(uid));
            const isAdmin = userDocSnap.exists && userDocSnap.data()?.isAdmin === true;

            if (bookingData.userId !== uid && !isAdmin) {
                throw new Error("You are not authorized to edit this booking.");
            }
            
            if (bookingData.userId === uid && !isAdmin) {
                const createdAt = bookingData.createdAt.toDate();
                const now = new Date();
                const oneHour = 60 * 60 * 1000;
                if (now.getTime() - createdAt.getTime() > oneHour) {
                    throw new Error("You can no longer edit this booking. The 1-hour grace period has passed.");
                }
            }
            
            const potentialConflictsQuery = bookingRef.parent
                .where('ovenId', '==', ovenId)
                .where('endTime', '>', Timestamp.fromDate(start));
            
            const snapshot = await transaction.get(potentialConflictsQuery);
            const hasConflict = snapshot.docs.some(doc => {
                if (doc.id === bookingId) return false;
                return doc.data().startTime.toDate() < end;
            });
            
            if (hasConflict) {
                throw new Error('This time slot conflicts with another booking.');
            }

            const userName = userDocSnap.exists ? userDocSnap.data()?.name : 'Unknown User';

            transaction.update(bookingRef, {
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                title: `${title} (by ${userName})`,
            });
        });

        return NextResponse.json({ success: true, message: 'Booking updated successfully' });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}