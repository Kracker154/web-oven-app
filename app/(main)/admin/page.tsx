// app/(main)/admin/page.tsx
"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import AuthCheck from "@/components/AuthCheck";
import { auth } from "@/lib/firebaseClient";

type Oven = { id: string; name: string; status: 'active' | 'maintenance' };

function AdminDashboard() {
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [loading, setLoading] = useState(true);
    const [newOvenName, setNewOvenName] = useState("");

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/ovens');
            if (!res.ok) throw new Error("Failed to fetch ovens");
            const data = await res.json();
            setOvens(data.data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddOven = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOvenName) return;
        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/ovens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ name: newOvenName }),
            });
            if (!res.ok) throw new Error("Failed to add oven");
            toast.success("Oven added!");
            setNewOvenName("");
            fetchData();
        } catch (error: any) {
            toast.error(error.message);
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
        } catch (error: any) {
            toast.error(error.message);
        }
    };
    
    if (loading) return <p className="text-center p-8">Loading admin data...</p>;

    return (
        <div className="container mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
            <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold mb-4">Manage Ovens</h2>
                <form onSubmit={handleAddOven} className="flex flex-col sm:flex-row gap-4 mb-6">
                    <input 
                        value={newOvenName}
                        onChange={(e) => setNewOvenName(e.target.value)}
                        placeholder="New Oven Name (e.g., High-Temp Furnace)"
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Oven</button>
                </form>

                <ul className="space-y-3">
                    {ovens.map(oven => (
                        <li key={oven.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-md border">
                            <div>
                                <p className="font-medium text-lg">{oven.name}</p>
                                <p className={`text-sm font-semibold ${oven.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                                    {oven.status.toUpperCase()}
                                </p>
                            </div>
                            <button onClick={() => handleToggleOvenStatus(oven.id, oven.status)} className="px-3 py-1 text-sm bg-gray-200 rounded-md hover:bg-gray-300">
                                {oven.status === 'active' ? 'Set to Maintenance' : 'Set to Active'}
                            </button>
                        </li>
                    ))}
                </ul>
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