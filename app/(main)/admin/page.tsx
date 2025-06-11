// app/(main)/admin/page.tsx
"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import toast from "react-hot-toast";
import AuthCheck from "@/components/AuthCheck";
import { auth } from "@/lib/firebaseClient";
import { PlusCircle, Settings, Trash2, Edit, ShieldCheck, ShieldAlert } from 'lucide-react';
import moment from 'moment';
import { useRouter } from 'next/navigation';

// Define types for our data
type Oven = { id: string; name: string; status: 'active' | 'maintenance'; };
type FullBooking = {
    id: string; title: string; start: string; end: string;
    userName: string; userEmail: string; ovenName: string;
};

// This is the main component for the admin dashboard UI
function AdminDashboard() {
    const router = useRouter();
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [allBookings, setAllBookings] = useState<FullBooking[]>([]);
    const [loadingOvens, setLoadingOvens] = useState(true);
    const [loadingBookings, setLoadingBookings] = useState(true);
    const [newOvenName, setNewOvenName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchOvens = useCallback(async () => {
        setLoadingOvens(true);
        try {
            const res = await fetch('/api/admin/ovens');
            if (!res.ok) throw new Error("Failed to fetch ovens");
            const data = await res.json();
            setOvens(data.data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoadingOvens(false);
        }
    }, []);

    const fetchAllBookings = useCallback(async () => {
        setLoadingBookings(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/bookings?scope=admin', {
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!res.ok) throw new Error("Failed to fetch all bookings");
            const data = await res.json();
            setAllBookings(data.data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoadingBookings(false);
        }
    }, []);

    useEffect(() => {
        fetchOvens();
        fetchAllBookings();
    }, [fetchOvens, fetchAllBookings]);

    const handleAddOven = async (e: FormEvent) => {
        e.preventDefault();
        if (!newOvenName.trim()) return;
        setIsSubmitting(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/ovens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ name: newOvenName }),
            });
            if (!res.ok) throw new Error((await res.json()).message || "Failed to add oven");
            toast.success("Oven added!");
            setNewOvenName("");
            fetchOvens();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleToggleOvenStatus = async (ovenId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'maintenance' : 'active';
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/ovens', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ id: ovenId, status: newStatus }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            toast.success(`Oven status updated to ${newStatus}`);
            fetchOvens();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const handleAdminCancelBooking = async (bookingId: string) => {
        if (!confirm("Are you sure you want to delete this user's booking? This cannot be undone.")) return;
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ bookingId }),
            });
            if (!res.ok) throw new Error((await res.json()).message || "Failed to cancel booking");
            toast.success("Booking deleted.");
            fetchAllBookings(); // Refresh the list
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Settings className="h-8 w-8 text-gray-700" />
                <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
            </div>
            
            {/* Manage Ovens Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold mb-5 border-b pb-3">Manage Equipment</h2>
                <form onSubmit={handleAddOven} className="flex flex-col sm:flex-row gap-4 mb-8">
                    <input value={newOvenName} onChange={(e) => setNewOvenName(e.target.value)} placeholder="New Oven Name" className="flex-grow px-4 py-2 border rounded-lg" />
                    <button type="submit" disabled={isSubmitting || !newOvenName.trim()} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg">
                        <PlusCircle className="h-5 w-5" /> Add Oven
                    </button>
                </form>
                <h3 className="text-xl font-semibold mb-4">Existing Ovens</h3>
                <div className="space-y-3">
                    {loadingOvens ? <p>Loading ovens...</p> : ovens.map(oven => (
                        <div key={oven.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <p className="font-medium text-lg">{oven.name}</p>
                                <div className={`flex items-center gap-2 text-sm font-semibold ${oven.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                                    {oven.status === 'active' ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                    <span>{oven.status.charAt(0).toUpperCase() + oven.status.slice(1)}</span>
                                </div>
                            </div>
                            <button onClick={() => handleToggleOvenStatus(oven.id, oven.status)} className="px-3 py-1 text-sm bg-gray-200 rounded-md">
                                {oven.status === 'active' ? 'Set to Maintenance' : 'Set to Active'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* All Upcoming Bookings Card */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold mb-5 border-b pb-3">All Upcoming Bookings</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oven</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loadingBookings ? (
                                <tr><td colSpan={5} className="text-center py-4">Loading bookings...</td></tr>
                            ) : allBookings.length > 0 ? allBookings.map(b => (
                                <tr key={b.id}>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        <div className="font-medium text-gray-900">{b.userName}</div>
                                        <div className="text-gray-500">{b.userEmail}</div>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{b.ovenName}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{b.title.split(' (by')[0]}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {moment(b.start).format('MMM D, h:mm a')} - {moment(b.end).format('h:mm a')}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => handleAdminCancelBooking(b.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="h-5 w-5"/>
                                        </button>
                                        {/* Editing from admin panel is complex, redirecting to dashboard is a good start */}
                                        {/* <button className="text-blue-600 hover:text-blue-900 ml-4"><Edit className="h-5 w-5"/></button> */}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={5} className="text-center py-4 text-gray-500">No upcoming bookings.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function AdminPage() {
    return (
        <AuthCheck adminOnly={true}>
            <AdminDashboard />
        </AuthCheck>
    );
}