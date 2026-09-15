import React, { useState, useEffect } from 'react';
import type { CateringPackage, CreateBookingInput } from '@stella/schema';
import { MIN_PAX_COUNT, MIN_LEAD_TIME_DAYS } from '@stella/schema';
import { createBooking, getPackages } from '../lib/api-client';

interface Props {
  initialPackageId?: number;
}

export function BookingWizard({ initialPackageId }: Props) {
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    bookingId: number;
    trackingToken: string;
    status: string;
  } | null>(null);

  // Calculate minimum allowed date string (Today + 7 days)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + MIN_LEAD_TIME_DAYS);
  const minDateString = minDate.toISOString().split('T')[0];

  const [formData, setFormData] = useState<CreateBookingInput>({
    packageId: initialPackageId || 0,
    fullName: '',
    contactNumber: '',
    email: '',
    eventDate: minDateString,
    venueLocation: '',
    guestCount: 50,
    designThemeNotes: '',
    referenceImageUrl: '',
  });

  useEffect(() => {
    getPackages()
      .then((pkgs) => {
        setPackages(pkgs);
        if (!formData.packageId && pkgs.length > 0) {
          setFormData((prev) => ({ ...prev, packageId: initialPackageId || pkgs[0].packageId }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPackages(false));
  }, [initialPackageId]);

  const selectedPkg = packages.find((p) => p.packageId === Number(formData.packageId));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'packageId' || name === 'guestCount' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side guard checks
    if (!formData.fullName || formData.fullName.length < 2) {
      setError('Full name is required (at least 2 characters).');
      return;
    }

    if (!formData.contactNumber || !/^(09|\+639)\d{9}$/.test(formData.contactNumber)) {
      setError('Please provide a valid Philippine mobile number (e.g. 09171234567 or +639171234567).');
      return;
    }

    if (!formData.email || !formData.email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    if (formData.guestCount < MIN_PAX_COUNT) {
      setError(`Minimum guest count is ${MIN_PAX_COUNT} pax.`);
      return;
    }

    if (selectedPkg && formData.guestCount < selectedPkg.minPax) {
      setError(`The selected package "${selectedPkg.packageName}" requires a minimum of ${selectedPkg.minPax} pax.`);
      return;
    }

    const eventDateObj = new Date(formData.eventDate + 'T00:00:00');
    const minAllowed = new Date();
    minAllowed.setDate(minAllowed.getDate() + MIN_LEAD_TIME_DAYS);
    if (eventDateObj < minAllowed) {
      setError(`Event date must be scheduled at least ${MIN_LEAD_TIME_DAYS} days from today.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await createBooking(formData);
      setSuccessResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit booking request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 shadow-sm text-center max-w-2xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
          ✓
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
            Reservation Request Submitted!
          </h2>
          <p className="text-stone-600 text-sm leading-relaxed">
            Thank you for choosing Casa de Stella. Your reservation has been recorded and is currently{' '}
            <span className="font-semibold text-amber-700">Pending Review</span>.
          </p>
        </div>

        <div className="bg-stone-50 rounded-xl p-6 border border-stone-200 space-y-3 text-left">
          <div className="flex justify-between items-center text-xs text-stone-500">
            <span>Booking Reference ID:</span>
            <span className="font-mono font-bold text-stone-800">#{successResult.bookingId}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-stone-500">
            <span>Status:</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              {successResult.status}
            </span>
          </div>
          <div className="pt-2 border-t border-stone-200 text-xs">
            <span className="text-stone-500 block mb-1">Your Tracking Token:</span>
            <code className="block bg-white p-2.5 rounded border border-stone-200 font-mono text-xs text-stone-800 break-all select-all">
              {successResult.trackingToken}
            </code>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
          <a
            href={`/track/${successResult.trackingToken}`}
            className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
          >
            Track Status Live
          </a>
          <a
            href="/"
            className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-medium rounded-lg transition-all"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-10 shadow-sm max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-2">
            <span className="font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* 1. Package Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-2">
            1. Select Catering Package
          </h3>
          {loadingPackages ? (
            <p className="text-sm text-stone-500">Loading available packages...</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Catering Tier
              </label>
              <select
                name="packageId"
                value={formData.packageId}
                onChange={handleChange}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 bg-white"
                required
              >
                {packages.map((pkg) => (
                  <option key={pkg.packageId} value={pkg.packageId}>
                    {pkg.packageName} ({pkg.eventCategory}) — ₱{pkg.basePrice.toLocaleString()} (Min. {pkg.minPax} pax)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 2. Event Logistics */}
        <div className="space-y-4">
          <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-2">
            2. Event Logistics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Event Date (Min. 7 Days Lead Time)
              </label>
              <input
                type="date"
                name="eventDate"
                min={minDateString}
                value={formData.eventDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Estimated Guest Count (Min. 30 Pax)
              </label>
              <input
                type="number"
                name="guestCount"
                min={selectedPkg ? Math.max(30, selectedPkg.minPax) : 30}
                value={formData.guestCount}
                onChange={handleChange}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Venue Location / Complete Address
            </label>
            <input
              type="text"
              name="venueLocation"
              placeholder="e.g. Club Balai Isabel, Talisay, Batangas or Private Residence, Malolos"
              value={formData.venueLocation}
              onChange={handleChange}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
              required
            />
          </div>
        </div>

        {/* 3. Theme & Inspiration */}
        <div className="space-y-4">
          <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-2">
            3. Thematic Styling & Notes (Optional)
          </h3>
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Design & Aesthetic Preferences
            </label>
            <textarea
              name="designThemeNotes"
              rows={3}
              placeholder="Describe color palettes, backdrop ideas, floral motifs, or dietary restrictions..."
              value={formData.designThemeNotes || ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Reference Inspiration URL (Pinterest / Cloud Image)
            </label>
            <input
              type="url"
              name="referenceImageUrl"
              placeholder="https://..."
              value={formData.referenceImageUrl || ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>
        </div>

        {/* 4. Client Contact Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-serif font-bold text-stone-900 border-b border-stone-100 pb-2">
            4. Client Contact Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                placeholder="Maria Santos"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Philippine Mobile Number
              </label>
              <input
                type="tel"
                name="contactNumber"
                placeholder="09171234567"
                value={formData.contactNumber}
                onChange={handleChange}
                className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              placeholder="maria.santos@example.com"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
              required
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-lg text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-md flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <span>Submitting Request...</span>
            ) : (
              <span>Submit Reservation Request</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
