/* Typed client for the StudyPod API. */

export type StaffRole = 'facility_manager' | 'front_desk';
export type SessionUser =
  | { kind: 'student'; id: number; email: string; name: string }
  | { kind: 'staff'; id: number; email: string; name: string; role: StaffRole };

export type PodStatus = 'active' | 'maintenance' | 'retired';
export interface Pod {
  id: number;
  label: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  amenities: string[];
  status: PodStatus;
  notes: string | null;
}

export interface Policy {
  minDurationMinutes: number;
  maxDurationMinutes: number;
  gracePeriodMinutes: number;
  earlyCheckInMinutes: number;
  modifyCutoffMinutes: number;
  reminderLeadMinutes: number;
  maxAdvanceDays: number;
  retireConflictWindowHours: number;
}
export type OperatingHours = Record<string, { open: string; close: string } | null>;

export interface AppConfig {
  appName: string;
  timezone: string;
  now: number;
  today: string;
  nowTime: string;
  maxDate: string;
  bookableDates: string[];
  policy: Policy;
  operatingHours: OperatingHours;
  locations: { building: string; floors: number[] }[];
  authMode: 'dev' | 'oidc';
}

export type ReservationStatus = 'Confirmed' | 'CheckedIn' | 'Completed' | 'Cancelled' | 'NoShow';
export interface Reservation {
  code: string;
  checkInCode?: string;
  status: ReservationStatus;
  source: 'online' | 'walk_in';
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  startAt: number;
  endAt: number;
  checkInOpensAt: number;
  checkInDeadlineAt: number;
  checkedInAt: number | null;
  checkInMethod: string | null;
  endedEarlyAt: number | null;
  cancelledAt: number | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: number;
  pod: { id: number; label: string; name: string; building: string; floor: number; capacity: number };
  student: { id: number; name: string; email: string };
  actions: { canModify: boolean; canCancel: boolean; canCheckIn: boolean; canEndEarly: boolean };
}

export interface Availability {
  date: string;
  hours: { open: string; close: string } | null;
  pods: { pod: Pod; busy: string[]; available: boolean | null }[];
  available: Pod[];
  suggestions: {
    alternativeTimes: { startTime: string; availableCount: number }[];
    alternativeLocations: Pod[];
  } | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: {
      'X-StudyPod-Client': 'web',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'NETWORK',
      err?.message ?? 'We could not reach StudyPod. Check your connection and try again.',
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
