# Requirements Traceability — StudyPod

Maps each requirement in [`srs-study-pod.md`](../../docs/03-srs/srs-study-pod.md) to its
implementation and the automated tests that verify it.

| SRS | Requirement | Implementation | Verified by |
| --- | --- | --- | --- |
| 3.2.1 | Browse availability by building / floor / date / time / capacity; exclude maintenance | `services/availability.ts` `searchAvailability`; `pages/FindPod.tsx` | `booking.test.ts` › 3.2.1 |
| 3.2.1.5 | Suggest nearest alternative time or location | `searchAvailability` › `suggestions` | `booking.test.ts` › suggests nearest alternative… |
| 3.2.2 | Create reservation; 30 min – 3 h; slot still free; no overlapping reservation | `services/reservations.ts` `createReservation`, `availability.ts` `resolveSlot` | `booking.test.ts` › 3.2.2 |
| 3.2.2.3 | Optimistic lock against double booking | `pod_slot` PK + transactional batch | `booking.test.ts` › only one of two simultaneous requests… |
| 3.2.2.4 | Reservation code, QR check-in code, confirmation email | `newUniqueCode`, `checkInPin`; `MyReservation.tsx` QR; `notifications.ts` | `booking.test.ts` › confirms a booking… |
| 3.2.2.5 | "No longer available" and re-offer current availability | `slotTakenError` | `booking.test.ts` › rejects a double booking… |
| 3.2.3 | Cancel any time before check-in; modify at least 15 min before start if the new slot is free | `modifyReservation`, `cancelReservation` | `booking.test.ts` › 3.2.3 |
| 3.2.3.5 | Reject late modification and direct the student to cancel and rebook | `MODIFY_CUTOFF_PASSED` | `booking.test.ts` › rejects modification within 15 minutes |
| 3.2.4 | Check in by QR or kiosk PIN within grace; auto-release no-shows | `studentCheckIn`, `kioskCheckIn`, `jobs.ts` `sweep` | `checkin.test.ts` › 3.2.4 |
| 3.2.4.5 | Late check-in: explain expiry and offer rebooking | `expiredError` (`details.rebook`); `CheckIn.tsx` "Book again" | `checkin.test.ts` › late check-in after release… |
| 3.2.5 | Add / edit / maintenance / retire pods; existing reservations kept | `services/pods.ts`; `admin/Pods.tsx` | `admin.test.ts` › 3.2.5 |
| 3.2.5.5 | Retiring with reservations in next 24 h needs confirmed forced cancellation | `changePodStatus` (`RETIRE_CONFLICT`) | `admin.test.ts` › retiring a pod… |
| 3.2.6 | View all reservations, force-cancel, walk-in override | `listAdminReservations`, `staffCancelReservation`, `createWalkIn` | `admin.test.ts` › 3.2.6 |
| 3.2.6 | Occupancy rate, no-show rate, peak-hour demand by range / building / floor | `services/reports.ts`; `admin/Reports.tsx` | `admin.test.ts` › computes occupancy… |
| 3.1.1 | Responsive UI; plain-language errors | `styles.css` (mobile-first); `AppError` messages | screenshots / all tests assert messages |
| 3.1.2 | Phone camera QR; optional shared kiosk using the same check-in flow | `/checkin?pod=`, printable labels (`PodLabel.tsx`), `/kiosk` | `checkin.test.ts` › kiosk PIN… |
| 3.1.3 / 3.7 | Campus SSO (OAuth2) and SQL / D1 database | `routes/auth.ts` (PKCE), `migrations/` | `admin.test.ts` › redirects to the campus IdP… |
| 3.1.4 | HTTPS; email confirmations / reminders / cancellations | Workers TLS, Secure cookies; `notifications.ts` | `checkin.test.ts`, `admin.test.ts` › outbox |
| 3.3.1–3.3.4 | Use cases | Find → Confirm → My reservation; Check-in; Admin Pods; Admin Reports | covered by the rows above |
| 3.5.1 | Search under 2 s; 200 concurrent sessions | Two indexed queries per search on edge compute; stateless Workers scale horizontally | — (architecture) |
| 3.5.2 | No-show release within 1 min | Cron `* * * * *` plus lazy sweep on every request | `checkin.test.ts` › releases no-shows within one minute |
| 3.5.3 | 99 % availability | Cloudflare Workers / D1 managed platform | — (platform) |
| 3.5.4 | SSO only; RBAC for admin actions | `lib/guards.ts` `requireStaff` (re-checked against the DB) | `admin.test.ts` › Security / RBAC |
| 3.5.5 | Policy configurable without a code change | `setting` table, `services/settings.ts`, `admin/Settings.tsx` | `admin.test.ts` › Configurable policy |
| 3.5.6 | Chrome / Edge / Firefox / Safari, desktop and mobile | Standard React + CSS, no browser-specific APIs | manual check at 390 px and 1200 px |
| 3.6 | At most one active reservation per student | Partial unique index + service check | `booking.test.ts` › 3.6 (both) |
| 3.6 | No booking more than 7 days ahead | `resolveSlot` `TOO_FAR_IN_ADVANCE` | `booking.test.ts` › rejects bookings more than 7 days |
| 3.8 | Relational DB; history kept for at least 1 year; DB-level overlap prevention | `migrations/0001_init.sql` (reservations are never deleted) | `booking.test.ts` › DB enforces… |
| 3.9 | Reminder 15 min before start | `jobs.ts` `sendReminders` | `checkin.test.ts` › sends exactly one reminder |
| 2.4 | Campus-local timezone | `lib/time.ts` | `time.test.ts` |
| AC-01 | End-to-end find, reserve, receive check-in code without staff | — | `booking.test.ts` › confirms a booking… (AC-01) |
| AC-02 | Unchecked reservation released and reappears in availability | — | `checkin.test.ts` › AC-02 |
| AC-03 | Pod add / edit / retire reflected immediately | — | `admin.test.ts` › AC-03, retiring… |
