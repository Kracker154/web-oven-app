// app/api/book/[bookingId]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

// This handler will update an existing booking
export async function PUT(request: NextRequest, { params }: { params: { bookingId: string } }) {
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
        
        // Use a transaction to safely check for conflicts and update the document
        await adminDb.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) {
                throw new Error("Booking not found.");
            }
            // Ensure the user owns this booking before allowing an update
            if (bookingDoc.data()?.userId !== uid) {
                throw new Error("You are not authorized to edit this booking.");
            }

            // --- Check for conflicts with OTHER bookings ---
            const bookingsRef = adminDb.collection('bookings');
            const potentialConflictsQuery = bookingsRef
                .where('ovenId', '==', ovenId)
                .where('endTime', '>', Timestamp.fromDate(start));
            
            const snapshot = await transaction.get(potentialConflictsQuery);

            const hasConflict = snapshot.docs.some(doc => {
                // Ignore the booking we are currently editing
                if (doc.id === bookingId) return false;

                const existingBooking = doc.data();
                const existingStart = existingBooking.startTime.toDate();
                return existingStart < end;
            });
            
            if (hasConflict) {
                throw new Error('This time slot conflicts with another booking.');
            }
            // --- End of conflict check ---

            // Get the user's name to update the title
            const userDoc = await transaction.get(adminDb.collection('users').doc(uid));
            const userName = userDoc.exists ? userDoc.data()?.name : 'Unknown User';

            // If all checks pass, update the booking
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