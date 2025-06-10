// app/api/book/[bookingId]/route.ts (Final, Verified, and Correct Version)
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

// This is the correct way to type the second argument for dynamic routes
interface RouteContext {
    params: {
        bookingId: string;
    }
}

// This handler will update an existing booking
export async function PUT(request: NextRequest, context: RouteContext) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    const uid = verification.user!.uid;
    const { bookingId } = context.params;

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
            if (bookingDoc.data()?.userId !== uid) {
                throw new Error("You are not authorized to edit this booking.");
            }

            const bookingsRef = adminDb.collection('bookings');
            const potentialConflictsQuery = bookingsRef
                .where('ovenId', '==', ovenId)
                .where('endTime', '>', Timestamp.fromDate(start));
            
            const snapshot = await transaction.get(potentialConflictsQuery);

            const hasConflict = snapshot.docs.some(doc => {
                if (doc.id === bookingId) return false;
                const existingBooking = doc.data();
                const existingStart = existingBooking.startTime.toDate();
                return existingStart < end;
            });
            
            if (hasConflict) {
                throw new Error('This time slot conflicts with another booking.');
            }

            const userDoc = await transaction.get(adminDb.collection('users').doc(uid));
            const userName = userDoc.exists ? userDoc.data()?.name : 'Unknown User';

            transaction.update(bookingRef, {
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                title: `${title} (by ${userName})`,
            });
        });

        return NextResponse.json({ success: true, message: 'Booking updated successfully' });

    } catch (error: any) { // Explicitly type 'error' to fix linting warning
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}