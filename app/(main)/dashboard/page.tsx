// app/(main)/dashboard/page.tsx
"use client";
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar';
import moment from 'moment';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebaseClient';

type Oven = { id: string; name: string; status: 'active' | 'maintenance' };
type Booking = { id: string; start: Date; end: Date; title: string; userId: string; isPreview?: boolean };
type FormData = { startDate: string; startTime: string; endDate: string; endTime: string; purpose: string; };

const localizer = momentLocalizer(moment);

export default function DashboardPage() {
    const { user } = useAuth();
    const [ovens, setOvens] = useState<Oven[]>([]);
    const [selectedOven, setSelectedOven] = useState<Oven | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [myUpcomingBookings, setMyUpcomingBookings] = useState<Booking[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false); // Changed from isLoading
    const [formData, setFormData] = useState<FormData>({ startDate: '', startTime: '', endDate: '', endTime: '', purpose: '' });
    const [previewEvent, setPreviewEvent] = useState<Booking | null>(null);
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState<View>(Views.WEEK);

    useEffect(() => {
        const fetchOvens = async () => {
            try {
                const res = await fetch('/api/admin/ovens');
                if (!res.ok) throw new Error('Failed to fetch ovens');
                const data = await res.json();
                setOvens(data.data);
            } catch (error: any) { // FIX
                toast.error(error.message);
            }
        };
        fetchOvens();
    }, []);

    const fetchBookingsForOven = useCallback(async (ovenId: string) => {
        if (!auth.currentUser) return;
        try {
            const idToken = await auth.currentUser.getIdToken();
            const res = await fetch(`/api/bookings?ovenId=${ovenId}`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            if (!res.ok) {
                 const errorData = await res.json();
                 throw new Error(errorData.message || 'Failed to fetch bookings');
            }
            const data = await res.json();
            const formattedBookings = data.data.map((b: any) => ({
                ...b,
                start: new Date(b.start),
                end: new Date(b.end),
            }));
            setBookings(formattedBookings);
        } catch (error: any) { // FIX
            toast.error(error.message);
        }
    }, []);
    
    useEffect(() => {
        if (selectedOven?.id) {
            fetchBookingsForOven(selectedOven.id);
        } else {
            setBookings([]);
        }
    }, [selectedOven, fetchBookingsForOven]);

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

    useEffect(() => {
        if (formData.startDate && formData.startTime && formData.endDate && formData.endTime && user) {
            const start = moment(`${formData.startDate} ${formData.startTime}`, 'YYYY-MM-DD HH:mm').toDate();
            const end = moment(`${formData.endDate} ${formData.endTime}`, 'YYYY-MM-DD HH:mm').toDate();
            if (start < end) {
                setPreviewEvent({
                    id: 'preview', start, end,
                    title: `${formData.purpose || "New Booking"} (by ${user.name})`,
                    userId: user.uid, isPreview: true,
                });
            } else {
                setPreviewEvent(null);
            }
        } else {
            setPreviewEvent(null);
        }
    }, [formData, user]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSelectSlot = useCallback((slotInfo: { start: Date; end: Date; }) => {
        if (!selectedOven) {
            toast.error("Please select an oven first.");
            return;
        }
        setFormData({
            startDate: moment(slotInfo.start).format('YYYY-MM-DD'),
            startTime: moment(slotInfo.start).format('HH:mm'),
            endDate: moment(slotInfo.start).add(1, 'hour').format('YYYY-MM-DD'),
            endTime: moment(slotInfo.start).add(1, 'hour').format('HH:mm'),
            purpose: '',
        });
    }, [selectedOven]);

    const handleSubmitBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOven || !previewEvent || !formData.purpose.trim() || !auth.currentUser) return;
        setIsSubmitting(true);
        const { start, end } = previewEvent;
        try {
            const idToken = await auth.currentUser.getIdToken(true);
            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ ovenId: selectedOven.id, startTime: start.toISOString(), endTime: end.toISOString(), title: formData.purpose }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success("Booking confirmed!");
            fetchBookingsForOven(selectedOven.id);
            setPreviewEvent(null);
            setFormData({ startDate: '', startTime: '', endDate: '', endTime: '', purpose: '' });
        } catch (error: any) { // FIX
            toast.error(`Booking failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancelBooking = async (bookingId: string) => {
        if (!confirm("Are you sure?") || !auth.currentUser || !selectedOven) return;
        setIsSubmitting(true); // Re-use isSubmitting
        try {
            const idToken = await auth.currentUser.getIdToken(true);
            const res = await fetch('/api/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
                body: JSON.stringify({ bookingId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            toast.success("Booking cancelled.");
            fetchBookingsForOven(selectedOven.id);
        } catch (error: any) { // FIX
            toast.error(`Cancellation failed: ${error.message}`);
        } finally {
            setIsSubmitting(false); // Re-use isSubmitting
        }
    };

    const calendarEvents = useMemo(() => {
        const allEvents = [...bookings];
        if (previewEvent) allEvents.push(previewEvent);
        return allEvents;
    }, [bookings, previewEvent]);

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
            <div className="md:col-span-4 lg:col-span-3 space-y-6">
                 <div className="p-4 bg-white rounded-lg shadow-md">
                    <form onSubmit={handleSubmitBooking} className="space-y-4">
                        <h2 className="text-xl font-semibold border-b pb-2">Create Booking</h2>
                        <div>
                            <label htmlFor="oven-select" className="block text-sm font-medium text-gray-700">1. Select Oven</label>
                            <select id="oven-select" className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md" value={selectedOven?.id || ''} onChange={(e) => setSelectedOven(ovens.find(o => o.id === e.target.value) || null)} >
                                <option value="" disabled>-- Select an Oven --</option>
                                {ovens.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            <p className="text-xs text-gray-500 mt-2">Then, click a time slot on the calendar to start.</p>
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
                        <button type="submit" disabled={!previewEvent || !formData.purpose || isSubmitting} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                           {isSubmitting ? "Processing..." : "Check & Book"}
                        </button>
                    </form>
                </div>
                 <div className="p-4 bg-white rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold border-b pb-2 mb-4">Your Upcoming Bookings</h2>
                    {myUpcomingBookings.length > 0 ? (
                        <ul className="space-y-3 max-h-60 overflow-y-auto">
                            {myUpcomingBookings.map(b => (
                                <li key={b.id} className="text-sm p-2 bg-blue-50 rounded-md">
                                    <p className="font-bold">{b.title.split(' (by')[0]}</p>
                                    <p className="text-gray-600">{moment(b.start).format('ddd, MMM D, h:mm a')} - {moment(b.end).format('h:mm a')}</p>
                                    <button onClick={() => handleCancelBooking(b.id)} className="text-red-600 hover:text-red-800 text-xs mt-1">Cancel</button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-gray-500">You have no upcoming bookings.</p>}
                </div>
            </div>
            <div className="md:col-span-8 lg:col-span-9 bg-white rounded-lg shadow-lg p-4">
                <Calendar localizer={localizer} events={calendarEvents} startAccessor="start" endAccessor="end" style={{ height: '85vh' }} date={date} onNavigate={handleNavigate} view={view} onView={handleView} views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]} selectable onSelectSlot={handleSelectSlot} eventPropGetter={eventPropGetter} dayLayoutAlgorithm="no-overlap" />
            </div>
        </div>
    );
}