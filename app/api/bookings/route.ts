// api/bookings/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyUser } from '@/lib/serverAuth';

export async function GET(request: NextRequest) {
    const verification = await verifyUser(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }

    try {
        const { searchParams } = new URL(request.url);
        const ovenId = searchParams.get('ovenId');

        if (!ovenId) {
            return NextResponse.json({ success: false, message: 'Oven ID is required' }, { status: 400 });
        }

        const snapshot = await adminDb.collection('bookings')
            .where('ovenId', '==', ovenId)
            // Fetch all bookings, not just future ones, so the calendar can show past events too.
            // .where('endTime', '>=', Timestamp.now()) 
            .get();

        const bookings = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                start: data.startTime.toDate().toISOString(),
                end: data.endTime.toDate().toISOString(),
                userId: data.userId,
            };
        });
        
        return NextResponse.json({ success: true, data: bookings });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}