import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// Customers table for guest inquiries and bookings
export const customers = sqliteTable('customer', {
  customerId: integer('customer_id').primaryKey({ autoIncrement: true }),
  fullName: text('full_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  email: text('email').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Catering packages catalog table
export const cateringPackages = sqliteTable('catering_package', {
  packageId: integer('package_id').primaryKey({ autoIncrement: true }),
  packageName: text('package_name').notNull().unique(),
  eventCategory: text('event_category').notNull(),
  basePrice: real('base_price').notNull(),
  minPax: integer('min_pax').notNull().default(30),
  isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
  inclusions: text('inclusions'), // JSON string array of inclusions
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Administrator staff accounts table
export const administrators = sqliteTable('administrator', {
  adminId: integer('admin_id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('Events_Manager'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Bookings transaction table linking customer and package
export const bookings = sqliteTable('booking', {
  bookingId: integer('booking_id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.customerId, { onDelete: 'restrict' }),
  packageId: integer('package_id').notNull().references(() => cateringPackages.packageId, { onDelete: 'restrict' }),
  approvedBy: integer('approved_by').references(() => administrators.adminId, { onDelete: 'set null' }),
  eventDate: text('event_date').notNull(), // ISO Date string: YYYY-MM-DD
  venueLocation: text('venue_location').notNull(),
  guestCount: integer('guest_count').notNull(),
  designThemeNotes: text('design_theme_notes'),
  referenceImageUrl: text('reference_image_url'),
  trackingToken: text('tracking_token').notNull().unique(),
  status: text('status').notNull().default('Pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Drizzle relational mappings
export const customersRelations = relations(customers, ({ many }) => ({
  bookings: many(bookings),
}));

export const cateringPackagesRelations = relations(cateringPackages, ({ many }) => ({
  bookings: many(bookings),
}));

export const administratorsRelations = relations(administrators, ({ many }) => ({
  approvedBookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  customer: one(customers, {
    fields: [bookings.customerId],
    references: [customers.customerId],
  }),
  package: one(cateringPackages, {
    fields: [bookings.packageId],
    references: [cateringPackages.packageId],
  }),
  reviewer: one(administrators, {
    fields: [bookings.approvedBy],
    references: [administrators.adminId],
  }),
}));

// Inferred table types
export type CustomerRecord = typeof customers.$inferSelect;
export type NewCustomerRecord = typeof customers.$inferInsert;
export type CateringPackageRecord = typeof cateringPackages.$inferSelect;
export type NewCateringPackageRecord = typeof cateringPackages.$inferInsert;
export type AdministratorRecord = typeof administrators.$inferSelect;
export type NewAdministratorRecord = typeof administrators.$inferInsert;
export type BookingRecord = typeof bookings.$inferSelect;
export type NewBookingRecord = typeof bookings.$inferInsert;
