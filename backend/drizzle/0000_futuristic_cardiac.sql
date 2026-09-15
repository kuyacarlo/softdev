CREATE TABLE `administrator` (
	`admin_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'Events_Manager' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `administrator_username_unique` ON `administrator` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `administrator_email_unique` ON `administrator` (`email`);--> statement-breakpoint
CREATE TABLE `booking` (
	`booking_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`package_id` integer NOT NULL,
	`approved_by` integer,
	`event_date` text NOT NULL,
	`venue_location` text NOT NULL,
	`guest_count` integer NOT NULL,
	`design_theme_notes` text,
	`reference_image_url` text,
	`tracking_token` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`customer_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`package_id`) REFERENCES `catering_package`(`package_id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by`) REFERENCES `administrator`(`admin_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `booking_tracking_token_unique` ON `booking` (`tracking_token`);--> statement-breakpoint
CREATE TABLE `catering_package` (
	`package_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`package_name` text NOT NULL,
	`event_category` text NOT NULL,
	`base_price` real NOT NULL,
	`min_pax` integer DEFAULT 30 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`inclusions` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catering_package_package_name_unique` ON `catering_package` (`package_name`);--> statement-breakpoint
CREATE TABLE `customer` (
	`customer_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`contact_number` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
