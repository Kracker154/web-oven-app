// api/book/route.ts (Corrected with Maintenance Status Check)
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import moment from 'moment';
import { verifyUser } from '@/lib/serverAuth';

const MAX_BOOKING_DURATION_HOURS = 7 * 24;
const MAX_ACTIVE_BOOKINGS = 2;

export async function POST(request: NextRequest) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    const uid = verification.user!.uid;

    try {
        const { ovenId, startTime, endTime, title } = await request.json();
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (moment(end).diff(moment(start), 'hours') > MAX_BOOKING_DURATION_HOURS) {
            return NextResponse.json({ success: false, message: `Booking cannot exceed 7 days.` }, { status: 400 });
        }
        
        const userBookingsSnapshot = await adminDb.collection('bookings')
            .where('userId', '==', uid)
            .where('endTime', '>=', Timestamp.now())
            .get();
            
        if (userBookingsSnapshot.size >= MAX_ACTIVE_BOOKINGS) {
            return NextResponse.json({ success: false, message: `You have reached your limit of ${MAX_ACTIVE_BOOKINGS} active bookings.` }, { status: 403 });
        }

        await adminDb.runTransaction(async (transaction) => {
            const bookingsRef = adminDb.collection('bookings');
            const ovenRef = adminDb.collection('ovens').doc(ovenId); // Get a reference to the oven

            // --- THE BUG FIX IS HERE ---
            // First, get the oven's current data within the transaction
            const ovenDoc = await transaction.get(ovenRef);
            if (!ovenDoc.exists) {
                throw new Error("The selected oven does not exist.");
            }
            // Second, check the oven's status
            if (ovenDoc.data()?.status !== 'active') {
                throw new Error("This oven is currently under maintenance and cannot be booked.");
            }
            // --- END OF BUG FIX ---
            
            // Proceed with conflict checks only if the oven is active
            const potentialConflictsQuery = bookingsRef
                .where('ovenId', '==', ovenId)
                .where('endTime', '>', Timestamp.fromDate(start));
            
            const snapshot = await transaction.get(potentialConflictsQuery);
            const hasConflict = snapshot.docs.some(doc => {
                const existingBooking = doc.data();
                return existingBooking.startTime.toDate() < end;
            });
            
            if (hasConflict) {
                throw new Error('This time slot conflicts with an existing booking.');
            }

            const userDoc = await transaction.get(adminDb.collection('users').doc(uid));
            const userName = userDoc.exists ? userDoc.data()?.name : 'Unknown User';
            
            const newBookingRef = bookingsRef.doc();
            transaction.set(newBookingRef, {
                userId: uid,
                ovenId,
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                title: `${title} (by ${userName})`,
                createdAt: Timestamp.now(),
            });
        });

        return NextResponse.json({ success: true, message: 'Booking successful' });

    } catch (error: any) {
        // This catch block will now handle the "maintenance" error and send it to the frontend
        console.error("Booking failed:", error.message);
        return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred.' }, { status: 400 });
    }
}