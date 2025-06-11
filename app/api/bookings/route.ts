// api/bookings/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser, verifyAdmin } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const ovenId = searchParams.get('ovenId');
    const scope = searchParams.get('scope');

    // --- ADMIN SCOPE: Fetch all upcoming bookings ---
    if (scope === 'admin') {
        const adminVerification = await verifyAdmin(request);
        if (!adminVerification.success) {
            return NextResponse.json({ success: false, message: adminVerification.message }, { status: adminVerification.status });
        }
        
        try {
            const snapshot = await adminDb.collection('bookings')
                .where('startTime', '>=', Timestamp.now())
                .orderBy('startTime', 'asc')
                .get();

            // For admins, we need to fetch user and oven names for each booking
            const allBookings = await Promise.all(snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const [userDoc, ovenDoc] = await Promise.all([
                    adminDb.collection('users').doc(data.userId).get(),
                    adminDb.collection('ovens').doc(data.ovenId).get()
                ]);

                return {
                    id: doc.id,
                    title: data.title,
                    start: data.startTime.toDate().toISOString(),
                    end: data.endTime.toDate().toISOString(),
                    userId: data.userId,
                    userName: userDoc.exists ? userDoc.data()?.name : 'Unknown User',
                    userEmail: userDoc.exists ? userDoc.data()?.email : 'N/A',
                    ovenName: ovenDoc.exists ? ovenDoc.data()?.name : 'Unknown Oven',
                };
            }));
            return NextResponse.json({ success: true, data: allBookings });

        } catch (error: any) {
            return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }
    }
    
    // --- USER SCOPE: Fetch bookings for a specific oven (for the dashboard calendar) ---
    const userVerification = await verifyUser(request);
    if (!userVerification.success) {
        return NextResponse.json({ success: false, message: userVerification.message }, { status: userVerification.status });
    }

    if (!ovenId) {
        return NextResponse.json({ success: false, message: 'Oven ID is required' }, { status: 400 });
    }

    try {
        const snapshot = await adminDb.collection('bookings').where('ovenId', '==', ovenId).get();
        const bookings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                start: data.startTime.toDate().toISOString(),
                end: data.endTime.toDate().toISOString(),
                userId: data.userId,
                createdAt: data.createdAt.toDate().toISOString(),
            };
        });
        return NextResponse.json({ success: true, data: bookings });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}