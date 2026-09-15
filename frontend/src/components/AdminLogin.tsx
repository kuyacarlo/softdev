import React, { useState, useEffect } from 'react';
import { adminLogin } from '../lib/api-client';

export function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existingToken = localStorage.getItem('stella_admin_token');
    if (existingToken) {
      window.location.href = '/admin';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await adminLogin({ username, password });
      localStorage.setItem('stella_admin_token', res.token);
      localStorage.setItem('stella_admin_user', JSON.stringify(res.user));
      window.location.href = '/admin';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-8 sm:p-10 rounded-2xl border border-stone-200 shadow-sm max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-stone-900 text-amber-300 font-serif font-bold text-2xl flex items-center justify-center mx-auto mb-3">
          S
        </div>
        <h2 className="text-2xl font-serif font-bold text-stone-900">Staff Portal Login</h2>
        <p className="text-xs text-stone-500 mt-1">Casa de Stella Event Operations</p>
      </div>

      {error && (
        <div className="p-3 mb-6 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            required
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition-all shadow-sm mt-2"
        >
          {submitting ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
