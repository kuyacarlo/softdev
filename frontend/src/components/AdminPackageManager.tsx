import React, { useState, useEffect } from 'react';
import type { CateringPackage, CreatePackageInput, EventCategory } from '@stella/schema';
import { EVENT_CATEGORIES } from '@stella/schema';
import { getAllPackagesAdmin, createPackage, updatePackage, deletePackage } from '../lib/api-client';

export function AdminPackageManager() {
  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<CateringPackage | null>(null);

  const [form, setForm] = useState<CreatePackageInput>({
    packageName: '',
    eventCategory: 'Wedding',
    basePrice: 45000,
    minPax: 50,
    isAvailable: true,
    inclusions: [],
  });
  const [inclusionsText, setInclusionsText] = useState('');

  const loadData = (authToken: string) => {
    setLoading(true);
    getAllPackagesAdmin(authToken)
      .then(setPackages)
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
    loadData(savedToken);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const inclusionsArray = inclusionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: CreatePackageInput = {
      ...form,
      inclusions: inclusionsArray.length > 0 ? inclusionsArray : undefined,
    };

    try {
      if (editingPkg) {
        await updatePackage(editingPkg.packageId, payload, token);
      } else {
        await createPackage(payload, token);
      }
      setShowAddModal(false);
      setEditingPkg(null);
      loadData(token);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleToggleActive = async (pkg: CateringPackage) => {
    if (!token) return;
    try {
      await updatePackage(pkg.packageId, { isAvailable: !pkg.isAvailable }, token);
      loadData(token);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const handleDelete = async (packageId: number) => {
    if (!token || !confirm('Are you sure you want to delete/deactivate this package?')) return;
    try {
      await deletePackage(packageId, token);
      loadData(token);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openCreateModal = () => {
    setEditingPkg(null);
    setForm({
      packageName: '',
      eventCategory: 'Wedding',
      basePrice: 45000,
      minPax: 50,
      isAvailable: true,
      inclusions: [],
    });
    setInclusionsText('');
    setShowAddModal(true);
  };

  const openEditModal = (pkg: CateringPackage) => {
    setEditingPkg(pkg);
    setForm({
      packageName: pkg.packageName,
      eventCategory: pkg.eventCategory,
      basePrice: pkg.basePrice,
      minPax: pkg.minPax,
      isAvailable: pkg.isAvailable,
      inclusions: pkg.inclusions,
    });
    setInclusionsText(pkg.inclusions ? pkg.inclusions.join('\n') : '');
    setShowAddModal(true);
  };

  return (
    <div className="space-y-8">
      {/* Top Navbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
            Catering Package Catalog Manager
          </h1>
          <p className="text-xs text-stone-500">Configure menus, pricing tiers, and inclusions</p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/admin"
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg transition-colors"
          >
            ← Back to Bookings
          </a>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg transition-all shadow-sm"
          >
            + Create Package
          </button>
        </div>
      </div>

      {/* Packages Grid / Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-stone-500 animate-pulse">
            Loading catalog packages...
          </div>
        ) : packages.length === 0 ? (
          <div className="p-12 text-center text-xs text-stone-500">
            No catering packages configured. Click "+ Create Package" to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Package Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Base Price</th>
                  <th className="py-3.5 px-4">Min. Pax</th>
                  <th className="py-3.5 px-4">Availability</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800">
                {packages.map((pkg) => (
                  <tr key={pkg.packageId} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-stone-500">
                      #{pkg.packageId}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-stone-900">{pkg.packageName}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-stone-100 font-medium">
                        {pkg.eventCategory}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-900">
                      ₱{pkg.basePrice.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono">{pkg.minPax} Pax</td>
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        className={`px-2.5 py-0.5 rounded-full font-semibold text-[11px] border ${
                          pkg.isAvailable
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-stone-100 text-stone-500 border-stone-300'
                        }`}
                      >
                        {pkg.isAvailable ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => openEditModal(pkg)}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-[11px] font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pkg.packageId)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-semibold"
                        >
                          Delete
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

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif font-bold text-stone-900">
                {editingPkg ? `Edit Package #${editingPkg.packageId}` : 'Create New Package'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">Package Name</label>
                <input
                  type="text"
                  value={form.packageName}
                  onChange={(e) => setForm({ ...form, packageName: e.target.value })}
                  placeholder="e.g. Grand Emerald Wedding Package"
                  className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Category</label>
                  <select
                    value={form.eventCategory}
                    onChange={(e) =>
                      setForm({ ...form, eventCategory: e.target.value as EventCategory })
                    }
                    className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 bg-white"
                  >
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Base Price (PHP)
                  </label>
                  <input
                    type="number"
                    value={form.basePrice}
                    onChange={(e) => setForm({ ...form, totalPrice: undefined, basePrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Minimum Headcount
                  </label>
                  <input
                    type="number"
                    min={30}
                    value={form.minPax}
                    onChange={(e) => setForm({ ...form, minPax: Number(e.target.value) })}
                    className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">Status</label>
                  <select
                    value={form.isAvailable ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, isAvailable: e.target.value === 'true' })}
                    className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900 bg-white"
                  >
                    <option value="true">Active / Accepting Bookings</option>
                    <option value="false">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Menu & Inclusions (One per line)
                </label>
                <textarea
                  rows={4}
                  value={inclusionsText}
                  onChange={(e) => setInclusionsText(e.target.value)}
                  placeholder="5-course buffet menu&#10;Thematic couple backdrop&#10;Uniformed banquet waitstaff"
                  className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-semibold hover:bg-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800"
                >
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
