// api/book/[bookingId]/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

interface RouteContext {
    params: {
        bookingId: string;
    }
}

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
            const bookingData = bookingDoc.data()!;
            
            // --- NEW LOGIC: Admin Check and Time Limit ---
            const userDocSnap = await transaction.get(adminDb.collection('users').doc(uid));
            const isAdmin = userDocSnap.exists && userDocSnap.data()?.isAdmin === true;

            // Condition 1: User is not the owner and not an admin. REJECT.
            if (bookingData.userId !== uid && !isAdmin) {
                throw new Error("You are not authorized to edit this booking.");
            }
            
            // Condition 2: User is the owner BUT NOT an admin. Check the time limit.
            if (bookingData.userId === uid && !isAdmin) {
                const createdAt = bookingData.createdAt.toDate();
                const now = new Date();
                const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
                if (now.getTime() - createdAt.getTime() > oneHour) {
                    throw new Error("You can no longer edit this booking. The 1-hour grace period has passed.");
                }
            }
            // If the user IS an admin, they bypass the time check.
            // --- END OF NEW LOGIC ---

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