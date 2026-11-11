-- =====================================================================
-- Smart Campus Logistics System (SCLS) — Physical Database Schema
-- CPE 304L Activity No. 2 — Data Modeling (Group 2-1)
-- Dialect: MySQL 8.0+ (InnoDB, CHECK constraints enforced)
-- Naming:  snake_case tables and columns, singular table names
-- Referential actions: none declared, so every FK uses the default
--   RESTRICT/NO ACTION — a parent row cannot be deleted while children
--   reference it, and a child cannot point at a missing parent.
-- =====================================================================

CREATE TABLE office (
    office_id      INT           PRIMARY KEY AUTO_INCREMENT,
    office_code    VARCHAR(10)   NOT NULL UNIQUE,
    name           VARCHAR(100)  NOT NULL UNIQUE,
    building       VARCHAR(60)   NOT NULL,
    room_number    VARCHAR(10),
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_account (
    user_id        INT           PRIMARY KEY AUTO_INCREMENT,
    sso_subject    VARCHAR(128)  NOT NULL UNIQUE,
    email          VARCHAR(120)  NOT NULL UNIQUE,
    full_name      VARCHAR(100)  NOT NULL,
    role           VARCHAR(15)   NOT NULL DEFAULT 'REQUESTER',
    office_id      INT,
    is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_user_role  CHECK (role IN ('REQUESTER','APPROVER','OFFICE_ADMIN','SYSTEM_ADMIN')),
    CONSTRAINT ck_user_email CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT fk_user_office FOREIGN KEY (office_id) REFERENCES office(office_id)
);

-- 1:1 specialization of user_account (shared primary key)
CREATE TABLE approver (
    user_id                  INT          PRIMARY KEY,
    position_title           VARCHAR(80)  NOT NULL,
    backup_user_id           INT          UNIQUE,
    availability_status      VARCHAR(15)  NOT NULL DEFAULT 'UNKNOWN',
    availability_since       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    availability_updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_approver_availability CHECK (availability_status IN
        ('ON_CAMPUS','OFF_CAMPUS','AWAY','BACKUP_ACTIVE','UNKNOWN')),
    CONSTRAINT ck_approver_not_own_backup CHECK (backup_user_id <> user_id),
    CONSTRAINT ck_approver_since CHECK (availability_updated_at >= availability_since),
    CONSTRAINT fk_approver_user   FOREIGN KEY (user_id)        REFERENCES user_account(user_id),
    CONSTRAINT fk_approver_backup FOREIGN KEY (backup_user_id) REFERENCES approver(user_id)
);

CREATE TABLE document_type (
    document_type_id  INT           PRIMARY KEY AUTO_INCREMENT,
    type_code         VARCHAR(10)   NOT NULL UNIQUE,
    name              VARCHAR(80)   NOT NULL UNIQUE,
    description       VARCHAR(255)
);

CREATE TABLE document (
    document_id                INT           PRIMARY KEY AUTO_INCREMENT,
    tracking_id                VARCHAR(20)   NOT NULL UNIQUE,
    document_type_id           INT           NOT NULL,
    requester_id               INT           NOT NULL,
    title                      VARCHAR(150)  NOT NULL,
    status                     VARCHAR(15)   NOT NULL DEFAULT 'SUBMITTED',
    origin_office_id           INT           NOT NULL,
    current_custody_office_id  INT           NOT NULL,
    current_step_no            INT           NOT NULL DEFAULT 1,
    submitted_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at                  DATETIME,
    CONSTRAINT ck_document_tracking CHECK (tracking_id LIKE 'SCLS-%'),
    CONSTRAINT ck_document_status   CHECK (status IN
        ('SUBMITTED','IN_TRANSIT','UNDER_REVIEW','APPROVED','REJECTED','BLOCKED')),
    CONSTRAINT ck_document_step     CHECK (current_step_no >= 1),
    CONSTRAINT ck_document_closed   CHECK (
        (status IN ('APPROVED','REJECTED') AND closed_at IS NOT NULL AND closed_at >= submitted_at)
        OR (status NOT IN ('APPROVED','REJECTED') AND closed_at IS NULL)),
    CONSTRAINT fk_document_type      FOREIGN KEY (document_type_id)          REFERENCES document_type(document_type_id),
    CONSTRAINT fk_document_requester FOREIGN KEY (requester_id)              REFERENCES user_account(user_id),
    CONSTRAINT fk_document_origin    FOREIGN KEY (origin_office_id)          REFERENCES office(office_id),
    CONSTRAINT fk_document_custody   FOREIGN KEY (current_custody_office_id) REFERENCES office(office_id)
);

-- 1:1 with document (UNIQUE NOT NULL foreign key)
CREATE TABLE qr_tag (
    qr_tag_id     INT           PRIMARY KEY AUTO_INCREMENT,
    document_id   INT           NOT NULL UNIQUE,
    qr_payload    VARCHAR(255)  NOT NULL UNIQUE,
    generated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    printed_at    DATETIME,
    CONSTRAINT ck_qr_printed CHECK (printed_at IS NULL OR printed_at >= generated_at),
    CONSTRAINT fk_qr_document FOREIGN KEY (document_id) REFERENCES document(document_id)
);

-- Associative entity: resolves Document M:N Approver into an ordered approval chain
CREATE TABLE approval_step (
    step_id               INT           PRIMARY KEY AUTO_INCREMENT,
    document_id           INT           NOT NULL,
    step_no               INT           NOT NULL,
    office_id             INT           NOT NULL,
    assigned_approver_id  INT           NOT NULL,
    acting_approver_id    INT,
    status                VARCHAR(10)   NOT NULL DEFAULT 'WAITING',
    decision_comment      VARCHAR(500),
    arrived_at            DATETIME,
    decided_at            DATETIME,
    CONSTRAINT uq_step_order UNIQUE (document_id, step_no),
    CONSTRAINT ck_step_no     CHECK (step_no >= 1),
    CONSTRAINT ck_step_status CHECK (status IN ('WAITING','PENDING','APPROVED','REJECTED','SKIPPED')),
    CONSTRAINT ck_step_decided CHECK (
        (status IN ('APPROVED','REJECTED') AND acting_approver_id IS NOT NULL
             AND decided_at IS NOT NULL AND arrived_at IS NOT NULL AND decided_at >= arrived_at)
        OR (status NOT IN ('APPROVED','REJECTED') AND decided_at IS NULL)),
    CONSTRAINT fk_step_document FOREIGN KEY (document_id)          REFERENCES document(document_id),
    CONSTRAINT fk_step_office   FOREIGN KEY (office_id)            REFERENCES office(office_id),
    CONSTRAINT fk_step_assigned FOREIGN KEY (assigned_approver_id) REFERENCES approver(user_id),
    CONSTRAINT fk_step_acting   FOREIGN KEY (acting_approver_id)   REFERENCES approver(user_id)
);

-- Append-only custody history (immutability enforced by triggers below)
CREATE TABLE custody_log_entry (
    log_id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
    document_id        INT          NOT NULL,
    from_office_id     INT,
    to_office_id       INT          NOT NULL,
    logged_by_user_id  INT          NOT NULL,
    remarks            VARCHAR(255),
    logged_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_custody_move CHECK (from_office_id IS NULL OR from_office_id <> to_office_id),
    CONSTRAINT fk_custody_document FOREIGN KEY (document_id)       REFERENCES document(document_id),
    CONSTRAINT fk_custody_from     FOREIGN KEY (from_office_id)    REFERENCES office(office_id),
    CONSTRAINT fk_custody_to       FOREIGN KEY (to_office_id)      REFERENCES office(office_id),
    CONSTRAINT fk_custody_logger   FOREIGN KEY (logged_by_user_id) REFERENCES user_account(user_id)
);

CREATE TABLE escalation (
    escalation_id     INT          PRIMARY KEY AUTO_INCREMENT,
    step_id           INT          NOT NULL,
    from_approver_id  INT          NOT NULL,
    to_approver_id    INT,
    outcome           VARCHAR(20)  NOT NULL,
    threshold_hours   INT          NOT NULL,
    escalated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_escalation_outcome CHECK (
        (outcome = 'REASSIGNED'        AND to_approver_id IS NOT NULL AND to_approver_id <> from_approver_id)
        OR (outcome = 'BLOCKED_NO_BACKUP' AND to_approver_id IS NULL)),
    CONSTRAINT ck_escalation_threshold CHECK (threshold_hours > 0),
    CONSTRAINT fk_escalation_step FOREIGN KEY (step_id)          REFERENCES approval_step(step_id),
    CONSTRAINT fk_escalation_from FOREIGN KEY (from_approver_id) REFERENCES approver(user_id),
    CONSTRAINT fk_escalation_to   FOREIGN KEY (to_approver_id)   REFERENCES approver(user_id)
);

CREATE TABLE notification (
    notification_id    BIGINT       PRIMARY KEY AUTO_INCREMENT,
    document_id        INT          NOT NULL,
    recipient_user_id  INT          NOT NULL,
    channel            VARCHAR(10)  NOT NULL,
    event_type         VARCHAR(20)  NOT NULL,
    message            VARCHAR(500) NOT NULL,
    sent_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at            DATETIME,
    CONSTRAINT ck_notification_channel CHECK (channel IN ('EMAIL','DASHBOARD')),
    CONSTRAINT ck_notification_event   CHECK (event_type IN
        ('SUBMITTED','HANDOFF','APPROVED','REJECTED','ESCALATED','BLOCKED')),
    CONSTRAINT ck_notification_read    CHECK (read_at IS NULL OR read_at >= sent_at),
    CONSTRAINT fk_notification_document  FOREIGN KEY (document_id)       REFERENCES document(document_id),
    CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_user_id) REFERENCES user_account(user_id)
);

-- Configurable business rules (SRS 3.5.5: escalation threshold not hard-coded)
CREATE TABLE system_setting (
    setting_key    VARCHAR(50)   PRIMARY KEY,
    setting_value  VARCHAR(100)  NOT NULL,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_setting (setting_key, setting_value)
VALUES ('escalation_threshold_hours', '24'),
       ('availability_refresh_time',  '06:00');

-- SRS 3.5.2: custody log is append-only — reject UPDATE and DELETE
DELIMITER //
CREATE TRIGGER trg_custody_log_no_update BEFORE UPDATE ON custody_log_entry
FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'custody_log_entry is append-only';
//
CREATE TRIGGER trg_custody_log_no_delete BEFORE DELETE ON custody_log_entry
FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'custody_log_entry is append-only';
//
DELIMITER ;

-- Lookup paths used by the dashboard and the escalation job
CREATE INDEX ix_document_custody   ON document (current_custody_office_id, status);
CREATE INDEX ix_step_queue         ON approval_step (assigned_approver_id, status);
CREATE INDEX ix_custody_document   ON custody_log_entry (document_id, logged_at);
CREATE INDEX ix_notification_inbox ON notification (recipient_user_id, read_at);
