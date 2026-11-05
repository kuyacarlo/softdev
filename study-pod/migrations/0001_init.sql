-- StudyPod initial schema (SRS 3.8 / 4.2 / 4.3).
-- Timestamps are UTC epoch milliseconds; `date` / `start_time` hold the campus-local
-- calendar values (SRS 2.4: recorded in the campus's local timezone).

CREATE TABLE student (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sso_subject      TEXT UNIQUE,
  full_name        TEXT NOT NULL,
  university_email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at       INTEGER NOT NULL,
  last_login_at    INTEGER
);

CREATE TABLE admin_staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sso_subject   TEXT UNIQUE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('facility_manager', 'front_desk')),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at    INTEGER NOT NULL,
  last_login_at INTEGER
);

CREATE TABLE study_pod (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  label               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  building            TEXT NOT NULL,
  floor               INTEGER NOT NULL,
  capacity            INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  amenities           TEXT NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  notes               TEXT,
  managed_by_staff_id INTEGER REFERENCES admin_staff(id),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX ix_study_pod_location ON study_pod(building, floor);

CREATE TABLE reservation (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  code                 TEXT NOT NULL UNIQUE,
  check_in_code        TEXT NOT NULL,
  student_id           INTEGER NOT NULL REFERENCES student(id),
  pod_id               INTEGER NOT NULL REFERENCES study_pod(id),
  date                 TEXT NOT NULL,
  start_time           TEXT NOT NULL,
  duration_minutes     INTEGER NOT NULL CHECK (duration_minutes > 0),
  start_at             INTEGER NOT NULL,
  end_at               INTEGER NOT NULL,
  check_in_deadline_at INTEGER NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('Confirmed', 'CheckedIn', 'Completed', 'Cancelled', 'NoShow')),
  source               TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online', 'walk_in')),
  checked_in_at        INTEGER,
  check_in_method      TEXT CHECK (check_in_method IN ('qr', 'kiosk', 'staff', 'walk_in')),
  ended_early_at       INTEGER,
  cancelled_at         INTEGER,
  cancelled_by         TEXT CHECK (cancelled_by IN ('student', 'staff', 'system')),
  cancel_reason        TEXT,
  reminder_sent_at     INTEGER,
  created_by_staff_id  INTEGER REFERENCES admin_staff(id),
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);
-- SRS 3.6: at most one active (Confirmed or CheckedIn) reservation per student, enforced by the DB.
CREATE UNIQUE INDEX ux_reservation_one_active_per_student
  ON reservation(student_id) WHERE status IN ('Confirmed', 'CheckedIn');
CREATE INDEX ix_reservation_pod_time ON reservation(pod_id, start_at);
CREATE INDEX ix_reservation_status_deadline ON reservation(status, check_in_deadline_at);
CREATE INDEX ix_reservation_date ON reservation(date);
CREATE INDEX ix_reservation_student ON reservation(student_id, start_at);

-- SRS 3.8: overlapping reservations for the same pod are impossible at the DB level.
-- Every live reservation owns one row per 15-minute slot it covers; the primary key
-- (pod_id, slot_start_at) rejects any second claim on the same slot. Rows are removed
-- when a reservation is cancelled, released as a no-show, or ended early.
CREATE TABLE pod_slot (
  pod_id         INTEGER NOT NULL REFERENCES study_pod(id),
  slot_start_at  INTEGER NOT NULL,
  reservation_id INTEGER NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  PRIMARY KEY (pod_id, slot_start_at)
);
CREATE INDEX ix_pod_slot_reservation ON pod_slot(reservation_id);

-- SRS 3.5.5: policy constants and operating hours are editable data, not code.
CREATE TABLE setting (
  key                 TEXT PRIMARY KEY,
  value               TEXT NOT NULL,
  updated_at          INTEGER NOT NULL,
  updated_by_staff_id INTEGER REFERENCES admin_staff(id)
);

-- SRS 3.1.4 / 3.9: outbound email log (confirmation, reminder, cancellation, no-show).
CREATE TABLE notification (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER REFERENCES reservation(id),
  recipient      TEXT NOT NULL,
  kind           TEXT NOT NULL,
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'logged', 'failed')),
  error          TEXT,
  created_at     INTEGER NOT NULL,
  sent_at        INTEGER
);
CREATE INDEX ix_notification_created ON notification(created_at);

-- Accountability trail for staff actions (inventory changes, overrides, settings).
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id   INTEGER,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  TEXT,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX ix_audit_log_created ON audit_log(created_at);
