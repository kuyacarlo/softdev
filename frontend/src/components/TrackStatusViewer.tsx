import React, { useState, useEffect } from 'react';
import type { TrackBookingData } from '@stella/schema';
import { getTrackBooking } from '../lib/api-client';

interface Props {
  token: string;
}

export function TrackStatusViewer({ token }: Props) {
  const [data, setData] = useState<TrackBookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let effectiveToken = token;
    if ((!effectiveToken || effectiveToken === 'lookup') && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('token');
      if (queryToken) {
        effectiveToken = queryToken;
      } else {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last && last !== 'track' && last !== 'lookup') {
          effectiveToken = last;
        }
      }
    }

    if (!effectiveToken || effectiveToken === 'lookup') {
      setError('Please provide a valid tracking token.');
      setLoading(false);
      return;
    }

    getTrackBooking(effectiveToken)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center max-w-2xl mx-auto shadow-sm">
        <p className="text-sm text-stone-500 animate-pulse">Querying reservation details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center max-w-xl mx-auto shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
          ✕
        </div>
        <h2 className="text-xl font-serif font-bold text-stone-900">Reservation Not Found</h2>
        <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
          {error || 'No booking matched this tracking token. Please verify the link or token.'}
        </p>
        <a
          href="/track"
          className="inline-block mt-4 px-5 py-2.5 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800"
        >
          Try Another Token
        </a>
      </div>
    );
  }

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

  const getStatusDescription = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return 'Your reservation has been approved by our event management team. Our coordinator will contact you for tasting and site visit scheduling.';
      case 'Declined':
        return 'This reservation request could not be accepted due to slot availability or capacity constraints. Please reach out to us directly.';
      case 'Completed':
        return 'This event catering has been completed successfully. Thank you for celebrating with Casa de Stella!';
      case 'Cancelled':
        return 'This reservation has been cancelled.';
      default:
        return 'Our management team is reviewing your date and requirements. Confirmations are typically processed within 24-48 business hours.';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm max-w-3xl mx-auto overflow-hidden">
      {/* Header Banner */}
      <div className="bg-stone-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold block mb-1">
            Reservation Status
          </span>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-white">
            Booking #{data.bookingId}
          </h1>
          <p className="text-xs text-stone-400 mt-1">Client: {data.customerName}</p>
        </div>

        <div className={`px-3.5 py-1.5 rounded-full text-xs font-bold border ${getStatusBadge(data.status)}`}>
          {data.status.toUpperCase()}
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        {/* Status Callout */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed font-medium">
            {getStatusDescription(data.status)}
          </p>
        </div>

        {/* Logistics Grid */}
        <div>
          <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">
            Event Information & Logistics
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-100">
              <dt className="text-stone-500 font-medium">Event Date</dt>
              <dd className="text-stone-900 font-bold font-mono text-base mt-1">{data.eventDate}</dd>
            </div>
            <div className="p-3.5 rounded-lg bg-stone-50 border border-stone-100">
              <dt className="text-stone-500 font-medium">Headcount</dt>
              <dd className="text-stone-900 font-bold font-mono text-base mt-1">{data.guestCount} Pax</dd>
            </div>
            <div className="sm:col-span-2 p-3.5 rounded-lg bg-stone-50 border border-stone-100">
              <dt className="text-stone-500 font-medium">Venue Address</dt>
              <dd className="text-stone-900 font-semibold mt-1">{data.venueLocation}</dd>
            </div>
          </dl>
        </div>

        {/* Selected Package Summary */}
        <div>
          <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">
            Selected Catering Tier
          </h3>
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-base font-serif font-bold text-stone-900">{data.packageName}</span>
              <span className="font-mono font-bold text-stone-900 text-sm">
                ₱{data.basePrice.toLocaleString()}
              </span>
            </div>
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 font-medium">
              Category: {data.eventCategory}
            </span>
            {data.inclusions && data.inclusions.length > 0 && (
              <div className="pt-2 border-t border-amber-200/40">
                <span className="text-xs font-semibold text-stone-700 block mb-1">Inclusions:</span>
                <ul className="text-xs text-stone-600 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {data.inclusions.map((inc, i) => (
                    <li key={i} className="flex items-center space-x-1.5">
                      <span className="text-amber-600">✓</span>
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {data.designThemeNotes && (
          <div>
            <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider mb-2">
              Theme Notes
            </h3>
            <p className="text-xs text-stone-600 bg-stone-50 p-3 rounded-lg border border-stone-100 leading-relaxed">
              {data.designThemeNotes}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-stone-100 flex justify-between items-center text-xs text-stone-400 font-mono">
          <span>Submitted on {data.createdAt}</span>
          <a href="/track" className="text-amber-700 hover:underline">
            Track another booking →
          </a>
        </div>
      </div>
    </div>
  );
}
