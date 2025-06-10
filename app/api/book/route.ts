// api/book/route.ts (Final, Simplified, and Working Version)
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
        
        // This query requires the index you already built: (userId, endTime)
        const userBookingsSnapshot = await adminDb.collection('bookings')
            .where('userId', '==', uid)
            .where('endTime', '>=', Timestamp.now())
            .get();
            
        if (userBookingsSnapshot.size >= MAX_ACTIVE_BOOKINGS) {
            return NextResponse.json({ success: false, message: `You have reached your limit of ${MAX_ACTIVE_BOOKINGS} active bookings.` }, { status: 403 });
        }

        await adminDb.runTransaction(async (transaction) => {
            const bookingsRef = adminDb.collection('bookings');

            // --- THIS IS THE NEW, SINGLE, SIMPLIFIED CONFLICT CHECK ---
            // We only need ONE query. This fetches all bookings for the oven that end after our new booking starts.
            // This is a broad query, but it's simple and only needs one index.
            const potentialConflictsQuery = bookingsRef
                .where('ovenId', '==', ovenId)
                .where('endTime', '>', Timestamp.fromDate(start));
            
            const snapshot = await transaction.get(potentialConflictsQuery);

            // Now, we do a precise check in our code.
            const hasConflict = snapshot.docs.some(doc => {
                const existingBooking = doc.data();
                const existingStart = existingBooking.startTime.toDate();
                // A conflict exists if the existing booking's start time is before our new booking ends.
                return existingStart < end;
            });
            
            if (hasConflict) {
                throw new Error('This time slot conflicts with an existing booking.');
            }
            // --- END OF THE NEW CONFLICT CHECK ---


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
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
}