import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index.js';
import { createMockD1 } from './d1-mock.js';
import type { D1Database } from '@cloudflare/workers-types';

describe('Casa de Stella Backend API Integration Tests', () => {
  let mockDb: D1Database;
  const env = {
    DB: undefined as any,
    JWT_SECRET: 'test-jwt-secret-key-1234567890',
    ENVIRONMENT: 'test',
    CORS_ORIGIN: '*',
    PUBLIC_R2_URL: 'https://media.test.com',
  };

  beforeEach(() => {
    mockDb = createMockD1();
    env.DB = mockDb;
  });

  it('GET /api/health should return healthy status', async () => {
    const res = await app.request('/api/health', {}, env);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.status).toBe('healthy');
    expect(body.environment).toBe('test');
  });

  it('GET /openapi.json should return valid OpenAPI 3.1 document', async () => {
    const res = await app.request('/openapi.json', {}, env);
    expect(res.status).toBe(200);

    const doc = (await res.json()) as any;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Casa de Stella Catering Services API');
    expect(doc.paths['/api/bookings']).toBeDefined();
    expect(doc.paths['/api/packages']).toBeDefined();
  });

  it('POST /api/auth/login should authenticate and return JWT token', async () => {
    const res = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      },
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.username).toBe('admin');
    expect(body.data.user.role).toBe('Owner');
  });

  it('GET /api/auth/me should return authenticated user profile with valid Bearer token', async () => {
    // 1. Login to obtain token
    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      },
      env
    );
    const { data: { token } } = (await loginRes.json()) as any;

    // 2. Fetch profile
    const meRes = await app.request(
      '/api/auth/me',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
      env
    );

    expect(meRes.status).toBe(200);
    const meBody = (await meRes.json()) as any;
    expect(meBody.success).toBe(true);
    expect(meBody.data.username).toBe('admin');
  });

  it('CRUD /api/packages should create, list, and fetch catering packages', async () => {
    // Login as admin
    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      },
      env
    );
    const { data: { token } } = (await loginRes.json()) as any;

    // Create package
    const createRes = await app.request(
      '/api/packages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageName: 'Grand Emerald Wedding Package',
          eventCategory: 'Wedding',
          basePrice: 55000,
          minPax: 50,
          isAvailable: true,
          inclusions: ['5-course buffet', 'Thematic backdrop', 'Uniformed staff'],
        }),
      },
      env
    );

    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as any;
    expect(createBody.success).toBe(true);
    expect(createBody.data.packageName).toBe('Grand Emerald Wedding Package');
    const packageId = createBody.data.packageId;

    // List packages (Public)
    const listRes = await app.request('/api/packages', {}, env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.success).toBe(true);
    expect(listBody.data.length).toBe(1);

    // Get package by ID (Public)
    const getRes = await app.request(`/api/packages/${packageId}`, {}, env);
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as any;
    expect(getBody.data.packageName).toBe('Grand Emerald Wedding Package');
  });

  it('POST /api/bookings should enforce 7-day lead time and min guest count rules', async () => {
    // 1. Create a catering package first
    const loginRes = await app.request(
      '/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      },
      env
    );
    const { data: { token } } = (await loginRes.json()) as any;

    const pkgRes = await app.request(
      '/api/packages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageName: 'Classic Debut Package',
          eventCategory: 'Debut',
          basePrice: 40000,
          minPax: 50,
          isAvailable: true,
        }),
      },
      env
    );
    const { data: { packageId } } = (await pkgRes.json()) as any;

    // Reject guest count < 30
    const failPaxRes = await app.request(
      '/api/bookings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Juan Dela Cruz',
          contactNumber: '09171234567',
          email: 'juan@example.com',
          packageId,
          eventDate: '2026-12-25',
          venueLocation: 'Bulacan Provincial Capitol Gym',
          guestCount: 20, // Less than MIN_PAX_COUNT 30
        }),
      },
      env
    );
    expect(failPaxRes.status).toBe(400);

    // Reject eventDate within 7 days
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const failDateRes = await app.request(
      '/api/bookings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Juan Dela Cruz',
          contactNumber: '09171234567',
          email: 'juan@example.com',
          packageId,
          eventDate: tomorrowStr,
          venueLocation: 'Bulacan Provincial Capitol Gym',
          guestCount: 60,
        }),
      },
      env
    );
    expect(failDateRes.status).toBe(400);

    // Success with valid payload (future date > 7 days, guestCount >= minPax)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const successRes = await app.request(
      '/api/bookings',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Juan Dela Cruz',
          contactNumber: '09171234567',
          email: 'juan@example.com',
          packageId,
          eventDate: futureDateStr,
          venueLocation: 'Bulacan Provincial Capitol Gym',
          guestCount: 60,
          designThemeNotes: 'Enchanted Forest with fairy lights',
        }),
      },
      env
    );

    expect(successRes.status).toBe(201);
    const successBody = (await successRes.json()) as any;
    expect(successBody.success).toBe(true);
    expect(successBody.data.bookingId).toBeDefined();
    expect(successBody.data.trackingToken).toBeDefined();
    expect(successBody.data.status).toBe('Pending');

    const trackingToken = successBody.data.trackingToken;
    const bookingId = successBody.data.bookingId;

    // Verify self-service tracking endpoint
    const trackRes = await app.request(`/api/track/${trackingToken}`, {}, env);
    expect(trackRes.status).toBe(200);
    const trackBody = (await trackRes.json()) as any;
    expect(trackBody.data.status).toBe('Pending');
    expect(trackBody.data.customerName).toBe('Juan Dela Cruz');
    expect(trackBody.data.packageName).toBe('Classic Debut Package');

    // Admin updates status to Confirmed
    const updateStatusRes = await app.request(
      `/api/bookings/${bookingId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'Confirmed' }),
      },
      env
    );

    expect(updateStatusRes.status).toBe(200);
    const updateBody = (await updateStatusRes.json()) as any;
    expect(updateBody.data.status).toBe('Confirmed');

    // Check tracked status reflects confirmed
    const trackAgainRes = await app.request(`/api/track/${trackingToken}`, {}, env);
    const trackAgainBody = (await trackAgainRes.json()) as any;
    expect(trackAgainBody.data.status).toBe('Confirmed');
  });
});
