// app/(main)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot } from "firebase/firestore";

// --- Helper Types (with createdAt) ---
type Oven = { id: string; name: string; status: 'active' | 'maintenance' };
type Booking = { id: string; start: Date; end: Date; title: string; userId: string; createdAt: Date; isPreview?: boolean };
type FormData = { startDate: string; startTime: string; endDate: string; endTime: string; purpose: string; };

const localizer = momentLocalizer(moment);

// --- Main Dashboard Component ---
export default function DashboardPage() {
    const { user } = useAuth();
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [selectedOven, setSelectedOven] = useState<Oven | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [myUpcomingBookings, setMyUpcomingBookings] = useState<Booking[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<FormData>({ startDate: '', startTime: '', endDate: '', endTime: '', purpose: '' });
    const [previewEvent, setPreviewEvent] = useState<Booking | null>(null);
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

    const [date, setDate] = useState(new Date()); 
    const [view, setView] = useState<View>(Views.WEEK);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchOvens = async () => {
            try {
                const res = await fetch('/api/admin/ovens');
                if (!res.ok) throw new Error('Failed to fetch ovens');
                const data = await res.json();
                setOvens(data.data);
            } catch (error: any) {
                toast.error(error.message);
            }
        };
        fetchOvens();
    }, []);

    useEffect(() => {
        if (!selectedOven?.id) {
            setBookings([]);
            return;
        }

        const q = query(collection(db, "bookings"), where("ovenId", "==", selectedOven.id));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const bookingsFromDb: Booking[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                bookingsFromDb.push({
                    id: doc.id,
                    title: data.title,
                    start: data.startTime.toDate(),
                    end: data.endTime.toDate(),
                    userId: data.userId,
                    createdAt: data.createdAt.toDate(), // <-- Make sure to get createdAt
                });
            });
            setBookings(bookingsFromDb);
        }, (error) => {
            console.error("Error with real-time listener:", error);
            toast.error("Could not get real-time booking updates.");
        });

        return () => unsubscribe();
    }, [selectedOven]);

    useEffect(() => {
        if (user && bookings) {
            const now = new Date();
            const userBookings = bookings
                .filter((b: Booking) => b.userId === user.uid && b.end > now)
                .sort((a: Booking, b: Booking) => a.start.getTime() - b.start.getTime());
            setMyUpcomingBookings(userBookings);
        } else {
            setMyUpcomingBookings([]);
        }
    }, [bookings, user]);

    // --- Form and Preview Logic ---
    useEffect(() => {
        if (formData.startDate && formData.startTime && formData.endDate && formData.endTime && user) {
            const start = moment(`${formData.startDate} ${formData.startTime}`, 'YYYY-MM-DD HH:mm').toDate();
            const end = moment(`${formData.endDate} ${formData.endTime}`, 'YYYY-MM-DD HH:mm').toDate();
            if (start < end) {
                setPreviewEvent({
                    id: editingBooking ? editingBooking.id : 'preview', 
                    start, end,
                    title: `${formData.purpose || "New Booking"} (by ${user.name})`,
                    userId: user.uid, 
                    createdAt: editingBooking ? editingBooking.createdAt : new Date(),
                    isPreview: true,
                });
            } else {
                setPreviewEvent(null);
            }
        } else {
            setPreviewEvent(null);
        }
    }, [formData, user, editingBooking]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const resetForm = () => {
        setEditingBooking(null);
        setPreviewEvent(null);
        setFormData({ startDate: '', startTime: '', endDate: '', endTime: '', purpose: '' });
    };

    const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; }) => {
        if (!selectedOven) { toast.error("Please select an oven first."); return; }
        resetForm();
        setFormData({
            startDate: moment(slotInfo.start).format('YYYY-MM-DD'),
            startTime: moment(slotInfo.start).format('HH:mm'),
            endDate: moment(slotInfo.start).add(1, 'hour').format('YYYY-MM-DD'),
            endTime: moment(slotInfo.start).add(1, 'hour').format('HH:mm'),
            purpose: '',
        });
    }, [selectedOven]);
    
    const handleSelectEvent = useCallback((booking: Booking) => {
        // Anyone can click an event to see the details, but only some can edit
        const now = new Date();
        const oneHour = 60 * 60 * 1000;
        const isWithinGracePeriod = now.getTime() - booking.createdAt.getTime() < oneHour;
        const canEdit = user?.isAdmin || (user?.uid === booking.userId && isWithinGracePeriod);
        
        if (canEdit) {
            setEditingBooking(booking);
            setFormData({
                startDate: moment(booking.start).format('YYYY-MM-DD'),
                startTime: moment(booking.start).format('HH:mm'),
                endDate: moment(booking.end).format('YYYY-MM-DD'),
                endTime: moment(booking.end).format('HH:mm'),
                purpose: booking.title.split(' (by')[0],
            });
        } else {
            toast(`This booking was made by another user or the 1-hour edit period has passed.`);
        }
    }, [user]);

    // --- Booking Submission & Cancellation ---
    const handleSubmitBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOven || !previewEvent || !formData.purpose.trim() || !auth.currentUser) return;
        
        setIsSubmitting(true);
        const { start, end } = previewEvent;
        const isUpdating = !!editingBooking;
        const apiUrl = isUpdating ? `/api/book/${editingBooking.id}` : '/api/book';
        const httpMethod = isUpdating ? 'PUT' : 'POST';

        try {
            const idToken = await auth.currentUser.getIdToken(true);
            const res = await fetch(apiUrl, {
                method: httpMethod,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ 
                    ovenId: selectedOven.id, 
                    startTime: start.toISOString(), 
                    endTime: end.toISOString(), 
                    title: formData.purpose 
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success(isUpdating ? "Booking updated!" : "Booking confirmed!");
            resetForm();
        } catch (error: any) {
            toast.error(`Operation failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm("Are you sure you want to delete this booking?") || !auth.currentUser) return;
        setIsSubmitting(true);
        try {
            const idToken = await auth.currentUser.getIdToken(true);
            const res = await fetch('/api/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ bookingId }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message);
            }
            toast.success("Booking cancelled.");
        } catch (error: any) {
            toast.error(`Cancellation failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Calendar Rendering ---
    const calendarEvents = useMemo(() => {
        const filteredBookings = editingBooking ? bookings.filter(b => b.id !== editingBooking.id) : bookings;
        return previewEvent ? [...filteredBookings, previewEvent] : filteredBookings;
    }, [bookings, previewEvent, editingBooking]);

    const eventPropGetter = useCallback((event: Booking) => ({
        className: event.isPreview ? 'preview-event' : '',
        style: {
            backgroundColor: event.isPreview ? undefined : (event.userId === user?.uid ? '#3174ad' : '#7a7a7a'),
        },
    }), [user?.uid]);
    
    const handleNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate]);
    const handleView = useCallback((newView: View) => setView(newView), [setView]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-4">
            {/* Left Column */}
            <div className="md:col-span-4 lg:col-span-3 space-y-6">
                 <div className="p-4 bg-white rounded-lg shadow-md">
                    <form onSubmit={handleSubmitBooking} className="space-y-4">
                        <h2 className="text-xl font-semibold border-b pb-2">{editingBooking ? 'Edit Booking' : 'Create Booking'}</h2>
                        <div>
                            <label htmlFor="oven-select" className="block text-sm font-medium text-gray-700">1. Select Oven</label>
                            <select id="oven-select" className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md" value={selectedOven?.id || ''} onChange={(e) => setSelectedOven(ovens.find(o => o.id === e.target.value) || null)}>
                                <option value="" disabled>-- Select an Oven --</option>
                                {ovens.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            {!editingBooking && <p className="text-xs text-gray-500 mt-2">Then, click a time slot on the calendar to start.</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm">Start Date</label><input type="date" name="startDate" value={formData.startDate} onChange={handleFormChange} required className="mt-1 w-full rounded-md border-gray-300 shadow-sm" /></div>
                            <div><label className="block text-sm">Start Time</label><input type="time" name="startTime" value={formData.startTime} onChange={handleFormChange} required className="mt-1 w-full rounded-md border-gray-300 shadow-sm" /></div>
                            <div><label className="block text-sm">End Date</label><input type="date" name="endDate" value={formData.endDate} onChange={handleFormChange} required className="mt-1 w-full rounded-md border-gray-300 shadow-sm" /></div>
                            <div><label className="block text-sm">End Time</label><input type="time" name="endTime" value={formData.endTime} onChange={handleFormChange} required className="mt-1 w-full rounded-md border-gray-300 shadow-sm" /></div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Purpose of Use</label>
                            <input type="text" name="purpose" placeholder="e.g., Curing Epoxy Samples" value={formData.purpose} onChange={handleFormChange} required className="mt-1 w-full rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div className="flex gap-2">
                             {editingBooking && <button type="button" onClick={resetForm} className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600">Cancel Edit</button>}
                            <button type="submit" disabled={!previewEvent || !formData.purpose || isSubmitting} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                               {isSubmitting ? "Processing..." : (editingBooking ? 'Update Booking' : 'Check & Book')}
                            </button>
                        </div>
                    </form>
                </div>
                 <div className="p-4 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Your Upcoming Bookings</h2>
                    {myUpcomingBookings.length > 0 ? (
                        <ul className="space-y-3 max-h-60 overflow-y-auto">
                            {myUpcomingBookings.map(b => {
                                const now = new Date();
                                const oneHour = 60 * 60 * 1000;
                                const isWithinGracePeriod = now.getTime() - b.createdAt.getTime() < oneHour;
                                const canModify = user?.isAdmin || (user?.uid === b.userId && isWithinGracePeriod);
                                
                                return (
                                <li key={b.id} className="text-sm p-2 bg-blue-50 rounded-md">
                                    <p className="font-bold">{b.title.split(' (by')[0]}</p>
                                    <p className="text-gray-600">{moment(b.start).format('ddd, MMM D, h:mm a')} - {moment(b.end).format('h:mm a')}</p>
                                    {canModify && (
                                        <div className="flex gap-4 mt-1">
                                            <button onClick={() => handleSelectEvent(b)} className="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                                            <button onClick={() => handleCancelBooking(b.id)} className="text-red-600 hover:text-red-800 text-xs">Delete</button>
                                        </div>
                                    )}
                                </li>
                            )})}
                        </ul>
                    ) : <p className="text-sm text-gray-500">You have no upcoming bookings.</p>}
                </div>
            </div>

            {/* Right Column */}
            <div className="md:col-span-8 lg:col-span-9 bg-white rounded-lg shadow-lg p-4">
                <Calendar localizer={localizer} events={calendarEvents} startAccessor="start" endAccessor="end" style={{ height: '85vh' }} date={date} onNavigate={handleNavigate} view={view} onView={handleView} views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]} selectable onSelectSlot={handleSelectSlot} onSelectEvent={handleSelectEvent} eventPropGetter={eventPropGetter} dayLayoutAlgorithm="no-overlap" />
            </div>
        </div>
    );
}