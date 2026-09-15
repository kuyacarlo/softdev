import React, { useState, useEffect } from 'react';
import type { BookingRecord, BookingStatus } from '@stella/schema';
import { BOOKING_STATUSES } from '@stella/schema';
import { getAdminBookings, updateBookingStatus } from '../lib/api-client';

export function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [token, setToken] = useState<string>('');

  const loadData = (authToken: string, filter: string) => {
    setLoading(true);
    getAdminBookings(authToken, { status: filter || undefined })
      .then(setBookings)
      .catch(() => {
        localStorage.removeItem('stella_admin_token');
        window.location.href = '/admin/login';
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('stella_admin_token');
    if (!savedToken) {
      window.location.href = '/admin/login';
      return;
    }
    setToken(savedToken);
    loadData(savedToken, statusFilter);
  }, [statusFilter]);

  const handleStatusChange = async (bookingId: number, newStatus: BookingStatus) => {
    if (!token) return;
    try {
      setUpdatingId(bookingId);
      const updated = await updateBookingStatus(bookingId, newStatus, token);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === bookingId ? { ...b, status: updated.status } : b))
      );
      if (selectedBooking && selectedBooking.bookingId === bookingId) {
        setSelectedBooking((prev) => (prev ? { ...prev, status: updated.status } : null));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('stella_admin_token');
    localStorage.removeItem('stella_admin_user');
    window.location.href = '/admin/login';
  };

  // Status counters
  const totalCount = bookings.length;
  const pendingCount = bookings.filter((b) => b.status === 'Pending').length;
  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length;
  const completedCount = bookings.filter((b) => b.status === 'Completed').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Declined':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'Completed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Cancelled':
        return 'bg-stone-200 text-stone-700 border-stone-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Navbar Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
            Booking Reservations Manager
          </h1>
          <p className="text-xs text-stone-500">Live operational reservations & approvals</p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/admin/packages"
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
          >
            Manage Packages
          </a>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <span className="text-xs text-stone-500 font-medium block">Total Inquiries</span>
          <span className="text-2xl font-bold font-mono text-stone-900">{totalCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/40">
          <span className="text-xs text-amber-700 font-medium block">Pending Review</span>
          <span className="text-2xl font-bold font-mono text-amber-800">{pendingCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-emerald-50/40">
          <span className="text-xs text-emerald-700 font-medium block">Confirmed</span>
          <span className="text-2xl font-bold font-mono text-emerald-800">{confirmedCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/40">
          <span className="text-xs text-blue-700 font-medium block">Completed</span>
          <span className="text-2xl font-bold font-mono text-blue-800">{completedCount}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-3">
        <label className="text-xs font-semibold text-stone-600 uppercase">Filter Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
        >
          <option value="">All Statuses</option>
          {BOOKING_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-500 animate-pulse">
            Loading reservations...
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No booking requests found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Client</th>
                  <th className="py-3.5 px-4">Package</th>
                  <th className="py-3.5 px-4">Event Date</th>
                  <th className="py-3.5 px-4">Pax</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {bookings.map((b) => (
                  <tr key={b.bookingId} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-stone-500">
                      #{b.bookingId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-stone-900">
                        {b.customer?.fullName || 'Guest'}
                      </div>
                      <div className="text-[11px] text-stone-500 font-mono">
                        {b.customer?.contactNumber} • {b.customer?.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-stone-900">{b.package?.packageName}</span>
                      <span className="block text-[11px] text-stone-500 font-mono">
                        ₱{b.package?.basePrice.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-stone-900">
                      {b.eventDate}
                    </td>
                    <td className="py-3.5 px-4 font-mono">{b.guestCount}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[11px] border ${getStatusBadge(
                          b.status
                        )}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {b.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(b.bookingId, 'Confirmed')}
                              disabled={updatingId === b.bookingId}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.bookingId, 'Declined')}
                              disabled={updatingId === b.bookingId}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold transition-colors"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {b.status === 'Confirmed' && (
                          <button
                            onClick={() => handleStatusChange(b.bookingId, 'Completed')}
                            disabled={updatingId === b.bookingId}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold transition-colors"
                          >
                            Mark Complete
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-[11px] font-semibold transition-colors"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif font-bold text-stone-900">
                Booking #{selectedBooking.bookingId} Details
              </h3>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-stone-400 hover:text-stone-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-50 rounded-lg space-y-1">
                <span className="text-stone-500 font-medium">Customer:</span>
                <p className="font-semibold text-stone-900">
                  {selectedBooking.customer?.fullName} ({selectedBooking.customer?.contactNumber})
                </p>
                <p className="text-stone-600">{selectedBooking.customer?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-stone-50 rounded-lg">
                  <span className="text-stone-500 font-medium">Event Date:</span>
                  <p className="font-mono font-bold text-stone-900 mt-0.5">
                    {selectedBooking.eventDate}
                  </p>
                </div>
                <div className="p-3 bg-stone-50 rounded-lg">
                  <span className="text-stone-500 font-medium">Headcount:</span>
                  <p className="font-mono font-bold text-stone-900 mt-0.5">
                    {selectedBooking.guestCount} Guests
                  </p>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-lg">
                <span className="text-stone-500 font-medium">Venue Address:</span>
                <p className="font-semibold text-stone-900 mt-0.5">
                  {selectedBooking.venueLocation}
                </p>
              </div>

              {selectedBooking.designThemeNotes && (
                <div className="p-3 bg-stone-50 rounded-lg">
                  <span className="text-stone-500 font-medium">Theme & Notes:</span>
                  <p className="text-stone-800 mt-0.5">{selectedBooking.designThemeNotes}</p>
                </div>
              )}

              <div className="p-3 bg-stone-50 rounded-lg">
                <span className="text-stone-500 font-medium">Tracking Token:</span>
                <code className="block mt-1 font-mono text-[11px] text-stone-800 break-all select-all bg-white p-1.5 rounded border border-stone-200">
                  {selectedBooking.trackingToken}
                </code>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
