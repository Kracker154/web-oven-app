// app/(main)/admin/page.tsx
"use client";
import { useState, useEffect, FormEvent } from "react";
import toast from "react-hot-toast";
import AuthCheck from "@/components/AuthCheck";
import { auth } from "@/lib/firebaseClient";
import { PlusCircle, Settings, ShieldCheck, ShieldAlert } from 'lucide-react';

type Oven = { id: string; name: string; status: 'active' | 'maintenance'; };

function AdminDashboard() {
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOvenName, setNewOvenName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/ovens', {
                headers: { 'Authorization': `Bearer ${idToken}` },
            });
            if (!res.ok) throw new Error("Failed to fetch ovens");
            const data = await res.json();
            setOvens(data.data);
        } catch (error: any) { // <-- FIX
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

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
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to add oven");
            }
            toast.success("Oven added successfully!");
            setNewOvenName("");
            fetchData();
        } catch (error: any) { // <-- FIX
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
            fetchData();
        } catch (error: any) { // <-- FIX
            toast.error(error.message);
        }
    };
    
    if (loading) return <p className="text-center p-8 text-gray-500">Loading oven data...</p>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-4 mb-6">
                <Settings className="h-8 w-8 text-gray-700" />
                <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-semibold mb-5 border-b pb-3">Manage Equipment</h2>
                <form onSubmit={handleAddOven} className="flex flex-col sm:flex-row gap-4 mb-8">
                    <input value={newOvenName} onChange={(e) => setNewOvenName(e.target.value)} placeholder="New Oven Name" className="flex-grow px-4 py-2 border rounded-lg" />
                    <button type="submit" disabled={isSubmitting || !newOvenName.trim()} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        <PlusCircle className="h-5 w-5" />
                        Add Oven
                    </button>
                </form>
                <h3 className="text-xl font-semibold mb-4">Existing Ovens</h3>
                <div className="space-y-3">
                    {ovens.length > 0 ? ovens.map(oven => (
                        <div key={oven.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border">
                            <div>
                                <p className="font-medium text-lg">{oven.name}</p>
                                <div className={`flex items-center gap-2 text-sm font-semibold ${oven.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                                    {oven.status === 'active' ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                                    <span>{oven.status.charAt(0).toUpperCase() + oven.status.slice(1)}</span>
                                </div>
                            </div>
                            <button onClick={() => handleToggleOvenStatus(oven.id, oven.status)} className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300">
                                {oven.status === 'active' ? 'Set to Maintenance' : 'Set to Active'}
                            </button>
                        </div>
                    )) : (<p className="text-center text-gray-500 py-4">No ovens have been added yet.</p>)}
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