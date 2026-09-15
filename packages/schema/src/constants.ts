export const MIN_PAX_COUNT = 30;
export const MIN_LEAD_TIME_DAYS = 7;

export const EVENT_CATEGORIES = [
  'Wedding',
  'Debut',
  'Birthday',
  'Corporate',
  'Special Event',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const BOOKING_STATUSES = [
  'Pending',
  'Confirmed',
  'Declined',
  'Completed',
  'Cancelled',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const ADMIN_ROLES = [
  'Owner',
  'Events_Manager',
  'Site_Admin',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const APPOINTMENT_STATUSES = [
  'Pending',
  'Confirmed',
  'Declined',
  'Rescheduled',
  'Completed',
  'Cancelled',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
