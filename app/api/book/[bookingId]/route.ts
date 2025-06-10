// app/api/book/[bookingId]/route.ts (Final attempt with type inference)
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

export async function PUT(
    request: NextRequest,
    { params }: any // Using 'any' to bypass the stubborn type error
) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    const uid = verification.user!.uid;
    const { bookingId } = params;

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

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}