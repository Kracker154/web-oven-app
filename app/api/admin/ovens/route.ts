// api/admin/ovens/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { verifyAdmin } from '@/lib/serverAuth';

// GET handler remains public so anyone can see the list of ovens.
export async function GET() {
    try {
        const snapshot = await adminDb.collection('ovens').orderBy('name').get();
        const ovens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ success: true, data: ovens });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// POST to create a new oven. Must be an admin.
export async function POST(request: NextRequest) {
    const verification = await verifyAdmin(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }
    
    try {
        const { name } = await request.json();
        const ovenRef = await adminDb.collection('ovens').add({ name, status: 'active' });
        return NextResponse.json({ success: true, id: ovenRef.id });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

// PUT to update an oven's status. Must be an admin.
export async function PUT(request: NextRequest) {
    const verification = await verifyAdmin(request);
    if (!verification.success) {
        return NextResponse.json({ success: false, message: verification.message }, { status: verification.status });
    }

    try {
        const { id, status } = await request.json();
        await adminDb.collection('ovens').doc(id).update({ status });
        return NextResponse.json({ success: true, message: 'Oven updated' });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}