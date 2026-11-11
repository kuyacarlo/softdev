# SCLS UML Diagram Set

**System:** Smart Campus Logistics System (SCLS) — Document Custody & Approval Tracker
**Course:** CPE 304L — Software Design | **Group:** Group 2-1

All diagrams are Mermaid and are consistent with the SRS (`docs/03-srs/srs-campus-logistics.md`) and the Activity 2 data model (`docs/06-data-modeling/`). Rendered PNGs of every diagram are in `diagrams/`.

| # | UML Diagram | Category | Mermaid Type |
| --- | --- | --- | --- |
| 1 | Use Case | Behavioral | `flowchart` (UML notation approximated) |
| 2 | Class | Structural | `classDiagram` |
| 3 | Object | Structural | `classDiagram` (instance snapshot) |
| 4 | Package | Structural | `flowchart` with subgraphs |
| 5 | Component | Structural | `flowchart` with subgraphs |
| 6 | Deployment | Structural | `flowchart` with subgraphs |
| 7 | Sequence (×5) | Interaction | `sequenceDiagram` |
| 8 | Activity (×2) | Behavioral | `flowchart` |
| 9 | State Machine (×3) | Behavioral | `stateDiagram-v2` |
| 10 | Entity-Relationship | Data | `erDiagram` |

Mermaid has no native notation for UML communication, timing or interaction-overview diagrams, so those are not included.

---

## 1. Use Case Diagram

```mermaid
flowchart LR
    subgraph Actors["Primary Actors"]
        direction TB
        Requester["«actor»<br/>Requester"]
        Approver["«actor»<br/>Approver"]
        Backup["«actor»<br/>Backup Signer"]
        OfficeAdmin["«actor»<br/>Office Administrator"]
        SysAdmin["«actor»<br/>System Administrator"]
        Scheduler["«actor»<br/>Escalation Scheduler<br/>(time trigger)"]
    end

    subgraph SCLS["Smart Campus Logistics System"]
        direction TB
        UC1([Submit Document])
        UC3([Track Document Status])
        UC7([View Approval Queue])
        UC8([Approve / Reject Document])
        UC9([Set Availability Status])
        UC5([Log Custody Handoff])
        UC13([Assign Backup Signer])
        UC14([Override Approval Chain])
        UC15([Manage Offices & Users])
        UC16([Configure Escalation Threshold])
        UC10([Auto-Escalate Stalled Approval])
        UC11([Flag Blocked Document])
        UC2([Generate & Print QR Tag])
        UC4([View Custody History])
        UC6([Scan QR Tag])
        UC12([Notify Stakeholders])
        UC17([Authenticate via SSO])
    end

    subgraph External["Secondary Actors"]
        direction TB
        SSO["«actor»<br/>University SSO"]
        Mail["«actor»<br/>Email Gateway"]
    end

    Backup -->|«generalization»| Approver

    Requester --- UC1
    Requester --- UC3
    Approver --- UC7
    Approver --- UC8
    Approver --- UC9
    OfficeAdmin --- UC5
    OfficeAdmin --- UC9
    OfficeAdmin --- UC13
    OfficeAdmin --- UC14
    SysAdmin --- UC15
    SysAdmin --- UC16
    Scheduler --- UC10

    UC1 -.->|«include»| UC2
    UC1 -.->|«include»| UC17
    UC3 -.->|«include»| UC4
    UC5 -.->|«include»| UC6
    UC5 -.->|«include»| UC12
    UC8 -.->|«include»| UC17
    UC8 -.->|«include»| UC12
    UC10 -.->|«include»| UC12
    UC11 -.->|«extend»| UC10

    UC17 --- SSO
    UC12 --- Mail
```

---

## 2. Class Diagram (upgraded domain model)

Upgraded from the Quiz 1 baseline (Document, CustodyLogEntry, Approver, Office). Each class maps 1:1 to a table in the Activity 2 schema.

```mermaid
classDiagram
    direction TB

    class UserAccount {
        -int userId
        -String ssoSubject
        -String email
        -String fullName
        -UserRole role
        -boolean isActive
        +authenticate(ssoToken) boolean
        +deactivate() void
    }
    class Approver {
        -String positionTitle
        -AvailabilityStatus availabilityStatus
        -DateTime availabilitySince
        -DateTime availabilityUpdatedAt
        +setAvailability(status) void
        +isAvailable() boolean
        +getBackup() Approver
        +actOnStep(step, decision, comment) void
    }
    class Office {
        -int officeId
        -String officeCode
        -String name
        -String building
        -String roomNumber
        -boolean isActive
        +logHandoff(document, fromOffice, admin) CustodyLogEntry
    }
    class DocumentType {
        -int documentTypeId
        -String typeCode
        -String name
    }
    class Document {
        -int documentId
        -String trackingId
        -String title
        -DocumentStatus status
        -int currentStepNo
        -DateTime submittedAt
        -DateTime closedAt
        +submit(chain) void
        +currentStep() ApprovalStep
        +advanceToNextOffice() void
        +approve() void
        +reject() void
        +block() void
        +history() List~CustodyLogEntry~
    }
    class QRTag {
        -int qrTagId
        -String qrPayload
        -DateTime generatedAt
        -DateTime printedAt
        +render() Image
        +markPrinted() void
    }
    class ApprovalStep {
        -int stepId
        -int stepNo
        -StepStatus status
        -String decisionComment
        -DateTime arrivedAt
        -DateTime decidedAt
        +open() void
        +decide(approver, decision, comment) void
        +isStalled(thresholdHours) boolean
        +canBeDecidedBy(approver) boolean
    }
    class CustodyLogEntry {
        <<immutable>>
        -long logId
        -String remarks
        -DateTime loggedAt
        +append() void
    }
    class Escalation {
        -int escalationId
        -EscalationOutcome outcome
        -int thresholdHours
        -DateTime escalatedAt
    }
    class Notification {
        -long notificationId
        -NotificationChannel channel
        -String eventType
        -String message
        -DateTime sentAt
        -DateTime readAt
        +send() void
        +markRead() void
    }
    class SystemSetting {
        -String settingKey
        -String settingValue
        +asInt() int
    }

    class UserRole {
        <<enumeration>>
        REQUESTER
        APPROVER
        OFFICE_ADMIN
        SYSTEM_ADMIN
    }
    class AvailabilityStatus {
        <<enumeration>>
        ON_CAMPUS
        OFF_CAMPUS
        AWAY
        BACKUP_ACTIVE
        UNKNOWN
    }
    class DocumentStatus {
        <<enumeration>>
        SUBMITTED
        IN_TRANSIT
        UNDER_REVIEW
        APPROVED
        REJECTED
        BLOCKED
    }
    class StepStatus {
        <<enumeration>>
        WAITING
        PENDING
        APPROVED
        REJECTED
        SKIPPED
    }
    class EscalationOutcome {
        <<enumeration>>
        REASSIGNED
        BLOCKED_NO_BACKUP
    }
    class NotificationChannel {
        <<enumeration>>
        EMAIL
        DASHBOARD
    }

    UserAccount <|-- Approver : specializes
    Office "0..1" o-- "0..*" UserAccount : houses
    Approver "0..1" --> "0..1" Approver : backs up
    UserAccount "1" --> "0..*" Document : submits
    DocumentType "1" <-- "0..*" Document : classified as
    Office "1" <-- "0..*" Document : current custody
    Office "1" <-- "0..*" Document : origin
    Document "1" *-- "1" QRTag : labeled by
    Document "1" *-- "1..*" ApprovalStep : routes through
    Document "1" *-- "1..*" CustodyLogEntry : has history
    ApprovalStep "0..*" --> "1" Office : takes place at
    ApprovalStep "0..*" --> "1" Approver : assigned to
    ApprovalStep "0..*" --> "0..1" Approver : decided by
    CustodyLogEntry "0..*" --> "0..1" Office : from
    CustodyLogEntry "0..*" --> "1" Office : to
    CustodyLogEntry "0..*" --> "1" UserAccount : logged by
    ApprovalStep "1" --> "0..*" Escalation : triggers
    Escalation "0..*" --> "1" Approver : from
    Escalation "0..*" --> "0..1" Approver : to
    Document "1" --> "0..*" Notification : generates
    Notification "0..*" --> "1" UserAccount : recipient
    Escalation ..> SystemSetting : reads threshold

    UserAccount ..> UserRole
    Approver ..> AvailabilityStatus
    Document ..> DocumentStatus
    ApprovalStep ..> StepStatus
    Escalation ..> EscalationOutcome
    Notification ..> NotificationChannel
```

---

## 3. Object Diagram (snapshot: a Leave of Absence form mid-route, escalated)

State at 2026-11-11 09:00: the department head has been Off-Campus for 30 h, so step 1 was escalated to the dean (the backup), who approved it. The document is now under review at the Registrar.

```mermaid
classDiagram
    direction TB

    class req["juan : UserAccount"] {
        userId = 101
        fullName = Juan dela Cruz
        role = REQUESTER
    }
    class head["drReyes : Approver"] {
        userId = 201
        positionTitle = CpE Department Head
        availabilityStatus = OFF_CAMPUS
        availabilitySince = 2026-11-10 03:00
    }
    class dean["drSantos : Approver"] {
        userId = 202
        positionTitle = Dean, COE
        availabilityStatus = ON_CAMPUS
    }
    class reg["engrCruz : Approver"] {
        userId = 203
        positionTitle = University Registrar
        availabilityStatus = ON_CAMPUS
    }
    class doc["loa001 : Document"] {
        trackingId = SCLS-2026-000001
        title = Leave of Absence - J. dela Cruz
        status = UNDER_REVIEW
        currentStepNo = 2
    }
    class qr["tag001 : QRTag"] {
        qrPayload = scls.bulsu.edu.ph/t/SCLS-2026-000001
    }
    class s1["step1 : ApprovalStep"] {
        stepNo = 1
        status = APPROVED
        decidedAt = 2026-11-11 08:40
    }
    class s2["step2 : ApprovalStep"] {
        stepNo = 2
        status = PENDING
        arrivedAt = 2026-11-11 08:55
    }
    class esc["esc001 : Escalation"] {
        outcome = REASSIGNED
        thresholdHours = 24
        escalatedAt = 2026-11-11 03:00
    }
    class cpe["cpeDept : Office"] {
        officeCode = CPE
    }
    class regOff["registrar : Office"] {
        officeCode = REG
    }
    class log2["log002 : CustodyLogEntry"] {
        loggedAt = 2026-11-11 08:55
    }

    req --> doc : submitted
    doc *-- qr
    doc *-- s1
    doc *-- s2
    doc *-- log2
    s1 --> head : assigned
    s1 --> dean : decided by
    s1 --> esc
    esc --> head : from
    esc --> dean : to
    head --> dean : backup
    s2 --> reg : assigned
    s1 --> cpe : at
    s2 --> regOff : at
    log2 --> cpe : from
    log2 --> regOff : to
    doc --> regOff : current custody
```

---

## 4. Package Diagram

```mermaid
flowchart TB
    subgraph presentation["«package» presentation"]
        P1[status_page]
        P2[approver_dashboard]
        P3[admin_console]
    end
    subgraph application["«package» application"]
        A1[submission_service]
        A2[custody_service]
        A3[approval_service]
        A4[escalation_service]
        A5[notification_service]
        A6[auth_service]
    end
    subgraph domain["«package» domain"]
        D1[Document · ApprovalStep · QRTag]
        D2[Office · UserAccount · Approver]
        D3[CustodyLogEntry · Escalation · Notification]
    end
    subgraph persistence["«package» persistence"]
        R1[repositories]
        R2[schema / migrations]
    end
    subgraph integration["«package» integration"]
        I1[sso_client]
        I2[mail_client]
        I3[qr_generator]
    end

    presentation -.->|«use»| application
    application -.->|«use»| domain
    application -.->|«use»| persistence
    application -.->|«use»| integration
    persistence -.->|«import»| domain
```

---

## 5. Component Diagram

```mermaid
flowchart LR
    subgraph Clients["Client Components"]
        StatusPage["«component»<br/>Requester Status Page"]
        Dashboard["«component»<br/>Approver Dashboard"]
        Console["«component»<br/>Office Admin Console"]
    end

    subgraph API["«subsystem» Logistics Tracking API"]
        Gateway["«component»<br/>REST Gateway"]
        AuthC["«component»<br/>Auth Module"]
        DocC["«component»<br/>Document & QR Module"]
        CustC["«component»<br/>Custody Module"]
        ApprC["«component»<br/>Approval Module"]
        EscC["«component»<br/>Escalation Scheduler"]
        NotifC["«component»<br/>Notification Module"]
    end

    DB[("«component»<br/>Relational Database")]
    SSO["«external»<br/>University SSO"]
    Mail["«external»<br/>Email Gateway"]

    StatusPage -->|HTTPS / JSON| Gateway
    Dashboard -->|HTTPS / JSON| Gateway
    Console -->|HTTPS / JSON| Gateway

    Gateway --> AuthC
    Gateway --> DocC
    Gateway --> CustC
    Gateway --> ApprC

    AuthC -->|OIDC / SAML| SSO
    DocC --> NotifC
    CustC --> NotifC
    ApprC --> NotifC
    EscC --> NotifC
    NotifC -->|SMTP| Mail

    DocC -->|SQL| DB
    CustC -->|SQL| DB
    ApprC -->|SQL| DB
    EscC -->|SQL| DB
    NotifC -->|SQL| DB
    AuthC -->|SQL| DB
```

---

## 6. Deployment Diagram

```mermaid
flowchart LR
    subgraph UserDevice["«device» Faculty / Student Device"]
        Browser["«execution environment»<br/>Web Browser<br/>(desktop or mobile)"]
    end

    subgraph OfficeDesk["«device» Office Desk Workstation"]
        DeskBrowser["«execution environment»<br/>Web Browser<br/>Admin Console"]
        Scanner["«device»<br/>USB QR Scanner"]
        Printer["«device»<br/>Label Printer"]
    end

    subgraph DataCenter["«node» University Data Center"]
        subgraph AppServer["«device» Application Server"]
            Web["«artifact»<br/>scls-web (static UI)"]
            Api["«artifact»<br/>scls-api"]
            Cron["«artifact»<br/>escalation-job<br/>(hourly)"]
        end
        subgraph DbServer["«device» Database Server"]
            Mysql["«execution environment»<br/>MySQL 8.0<br/>AES-256 at rest"]
        end
    end

    IdP["«node»<br/>University SSO IdP"]
    Smtp["«node»<br/>Campus SMTP Relay"]

    Browser -->|HTTPS / TLS 1.2+| Web
    Browser -->|HTTPS / TLS 1.2+| Api
    DeskBrowser -->|HTTPS / TLS 1.2+| Api
    Scanner -->|USB HID| DeskBrowser
    DeskBrowser -->|USB| Printer
    Api -->|TCP 3306 / TLS| Mysql
    Cron -->|TCP 3306 / TLS| Mysql
    Api -->|OIDC| IdP
    Api -->|SMTP / STARTTLS| Smtp
    Cron -->|SMTP / STARTTLS| Smtp
```

---

## 7. Sequence Diagrams

### 7.1 Submit Document (SRS 3.2.1)

```mermaid
sequenceDiagram
    autonumber
    actor R as Requester
    participant UI as Status Page
    participant API as Logistics API
    participant SSO as University SSO
    participant DB as Database
    participant MAIL as Email Gateway

    R->>UI: Fill form (type, title, approval chain)
    UI->>API: POST /documents (bearer token)
    activate API
    API->>SSO: Validate token
    SSO-->>API: user identity
    API->>DB: Verify every office and approver in the chain exists
    DB-->>API: result
    alt chain references an unknown office or approver
        API-->>UI: 422 Invalid approval chain
        UI-->>R: Show error
    else chain is valid
        API->>DB: BEGIN
        API->>DB: INSERT document (status = SUBMITTED)
        API->>DB: INSERT approval_step x N (status = WAITING)
        API->>DB: INSERT qr_tag
        API->>DB: INSERT custody_log_entry (intake at origin office)
        API->>DB: COMMIT
        API->>DB: INSERT notification (SUBMITTED)
        API->>MAIL: Send confirmation email
        API-->>UI: 201 Created (tracking_id, QR image)
        UI-->>R: Show tracking ID and printable QR label
    end
    deactivate API
```

### 7.2 Log Custody Handoff by QR Scan (SRS 3.2.2)

```mermaid
sequenceDiagram
    autonumber
    actor OA as Office Admin
    participant SC as QR Scanner
    participant CON as Admin Console
    participant API as Logistics API
    participant DB as Database
    participant MAIL as Email Gateway

    OA->>SC: Scan QR on arriving folder
    SC->>CON: tracking_id
    CON->>API: POST /documents/{tracking_id}/handoffs (to_office)
    activate API
    API->>DB: SELECT document and approval_step at current_step_no
    DB-->>API: document, expected office
    alt to_office is not the next office in the chain
        API->>DB: INSERT notification to office admin (flagged handoff)
        API-->>CON: 409 Flagged for administrator review
    else to_office matches the chain
        API->>DB: BEGIN
        API->>DB: INSERT custody_log_entry (from, to, logged_by)
        API->>DB: UPDATE document SET current_custody_office_id, status = UNDER_REVIEW
        API->>DB: UPDATE approval_step SET status = PENDING, arrived_at = now
        API->>DB: COMMIT
        par notify requester
            API->>MAIL: Document arrived at office
        and notify approver
            API->>DB: INSERT notification (DASHBOARD) for approver
        end
        API-->>CON: 200 Handoff confirmed
    end
    deactivate API
    Note over API,DB: custody_log_entry rows can never be updated or deleted (append-only triggers)
```

### 7.3 Approve or Reject (SRS 3.2.4)

```mermaid
sequenceDiagram
    autonumber
    actor AP as Approver or Backup
    participant DASH as Approver Dashboard
    participant API as Logistics API
    participant DB as Database
    participant MAIL as Email Gateway

    AP->>DASH: Open approval queue
    DASH->>API: GET /me/queue
    API->>DB: SELECT PENDING steps assigned to me or escalated to me
    DB-->>API: steps
    API-->>DASH: queue
    AP->>DASH: Approve or Reject with comment
    DASH->>API: POST /steps/{step_id}/decision
    activate API
    API->>DB: Load step, assigned approver, REASSIGNED escalations
    alt user is neither the assigned approver nor the escalated backup
        API-->>DASH: 403 Not authorized for this step
    else authorized
        API->>DB: BEGIN
        alt APPROVE and more steps remain
            API->>DB: UPDATE approval_step SET APPROVED, acting_approver_id, decided_at
            API->>DB: UPDATE document SET current_step_no + 1, status = IN_TRANSIT
        else APPROVE on final step
            API->>DB: UPDATE approval_step SET APPROVED
            API->>DB: UPDATE document SET status = APPROVED, closed_at = now
        else REJECT
            API->>DB: UPDATE approval_step SET REJECTED
            API->>DB: UPDATE remaining steps SET SKIPPED
            API->>DB: UPDATE document SET status = REJECTED, closed_at = now
        end
        API->>DB: COMMIT
        API->>DB: INSERT notification rows
        API->>MAIL: Notify requester and next custodian
        API-->>DASH: 200 Decision recorded
    end
    deactivate API
```

### 7.4 Automatic Escalation (SRS 3.2.5)

```mermaid
sequenceDiagram
    autonumber
    participant CRON as Scheduler (hourly)
    participant ESC as Escalation Service
    participant DB as Database
    participant MAIL as Email Gateway

    CRON->>ESC: run()
    activate ESC
    ESC->>DB: SELECT setting_value WHERE setting_key = escalation_threshold_hours
    DB-->>ESC: 24
    ESC->>DB: SELECT PENDING steps whose approver is OFF_CAMPUS or AWAY since more than 24 h and not yet escalated
    DB-->>ESC: stalled steps
    loop for each stalled step
        ESC->>DB: Load primary approver backup_user_id
        alt backup configured and backup is available
            ESC->>DB: INSERT escalation (REASSIGNED, from primary, to backup)
            ESC->>DB: UPDATE approver SET availability_status = BACKUP_ACTIVE (primary)
            ESC->>MAIL: Notify backup, requester and original approver
        else no backup, or backup also unavailable
            ESC->>DB: INSERT escalation (BLOCKED_NO_BACKUP, to = NULL)
            ESC->>DB: UPDATE document SET status = BLOCKED
            ESC->>MAIL: Notify office administrator (Blocked - No Backup Available)
        end
    end
    deactivate ESC
```

### 7.5 Track Document Status (SRS 3.2.6)

```mermaid
sequenceDiagram
    autonumber
    actor R as Requester
    participant UI as Status Page
    participant API as Logistics API
    participant DB as Database

    R->>UI: Enter tracking ID or scan QR
    UI->>API: GET /track/{tracking_id}
    API->>DB: SELECT document JOIN office, approval_step, approver
    alt tracking_id not found
        DB-->>API: no rows
        API-->>UI: 404 Tracking ID not found
    else found
        DB-->>API: document row
        API->>DB: SELECT custody_log_entry ORDER BY logged_at
        DB-->>API: history
        opt availability not updated today
            API->>API: Report approver availability as UNKNOWN
        end
        API-->>UI: status, custodian, current approver and availability, history
        UI-->>R: Render timeline
    end
```

---

## 8. Activity Diagrams

### 8.1 End-to-End Document Routing

```mermaid
flowchart TD
    Start((●)) --> A[Requester submits document]
    A --> B{Approval chain valid?}
    B -- No --> B1[Reject submission] --> End1((◉))
    B -- Yes --> C[Create document, steps, QR tag<br/>and intake custody entry]
    C --> D[Print and attach QR label]
    D --> E[Carry folder to next office]
    E --> F[Office admin scans QR]
    F --> G{Expected office?}
    G -- No --> G1[Flag for admin review] --> E
    G -- Yes --> H[Append custody log<br/>Step = PENDING, Doc = UNDER_REVIEW]
    H --> I{Approver available<br/>within 24 h?}
    I -- Yes --> J[Approver decides]
    I -- No --> K{Backup configured<br/>and available?}
    K -- Yes --> L[Escalate to backup] --> J
    K -- No --> M[Doc = BLOCKED<br/>Notify office admin]
    M --> M1[Admin assigns backup<br/>or approver returns] --> I
    J --> N{Decision}
    N -- Reject --> O[Doc = REJECTED<br/>remaining steps SKIPPED]
    N -- Approve --> P{More steps?}
    P -- Yes --> Q[Doc = IN_TRANSIT<br/>current_step_no + 1] --> E
    P -- No --> R[Doc = APPROVED]
    O --> S[Notify requester]
    R --> S
    S --> End2((◉))
```

### 8.2 Hourly Escalation Job

```mermaid
flowchart TD
    Start((●)) --> A[Read escalation_threshold_hours]
    A --> B[Query PENDING steps]
    B --> C{Any step left?}
    C -- No --> End((◉))
    C -- Yes --> D[Take next step]
    D --> E{Approver OFF_CAMPUS or AWAY<br/>longer than threshold?}
    E -- No --> C
    E -- Yes --> F{Already escalated?}
    F -- Yes --> C
    F -- No --> G{Backup configured?}
    G -- No --> J
    G -- Yes --> H{Backup available?}
    H -- Yes --> I[Record REASSIGNED escalation<br/>Primary = BACKUP_ACTIVE<br/>Notify backup, requester, primary]
    H -- No --> J[Record BLOCKED_NO_BACKUP<br/>Doc = BLOCKED<br/>Notify office admin]
    I --> C
    J --> C
```

---

## 9. State Machine Diagrams

### 9.1 Document Lifecycle

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : submit() / create steps, QR, intake log
    SUBMITTED --> IN_TRANSIT : dispatched from origin office
    SUBMITTED --> UNDER_REVIEW : first step is at origin office
    IN_TRANSIT --> UNDER_REVIEW : handoff logged at step office
    UNDER_REVIEW --> IN_TRANSIT : approve() [more steps]
    UNDER_REVIEW --> APPROVED : approve() [final step]
    UNDER_REVIEW --> REJECTED : reject()
    UNDER_REVIEW --> BLOCKED : escalation [no backup available]
    BLOCKED --> UNDER_REVIEW : backup assigned or approver returns
    APPROVED --> [*]
    REJECTED --> [*]

    note right of UNDER_REVIEW
        Escalation to an available backup
        keeps the document in UNDER_REVIEW
    end note
    note right of APPROVED
        closed_at is set on entry
        to APPROVED or REJECTED
    end note
```

### 9.2 Approval Step

```mermaid
stateDiagram-v2
    [*] --> WAITING : chain created
    WAITING --> PENDING : document arrives at step office
    WAITING --> SKIPPED : an earlier step was rejected
    state PENDING {
        [*] --> WithPrimary
        WithPrimary --> WithBackup : primary unavailable > threshold [backup available]
        WithBackup --> WithBackup : backup reviewing
    }
    PENDING --> APPROVED : decide(APPROVE) / set acting approver, decided_at
    PENDING --> REJECTED : decide(REJECT) / set acting approver, decided_at
    APPROVED --> [*]
    REJECTED --> [*]
    SKIPPED --> [*]
```

### 9.3 Approver Availability

```mermaid
stateDiagram-v2
    [*] --> UNKNOWN
    UNKNOWN --> ON_CAMPUS : setAvailability()
    state Unavailable {
        OFF_CAMPUS --> AWAY : setAvailability()
        AWAY --> OFF_CAMPUS : setAvailability()
    }
    UNKNOWN --> Unavailable : setAvailability()
    ON_CAMPUS --> Unavailable : setAvailability()
    Unavailable --> ON_CAMPUS : setAvailability()
    Unavailable --> BACKUP_ACTIVE : unavailable > 24 h [pending step and backup available]
    BACKUP_ACTIVE --> ON_CAMPUS : approver returns
    ON_CAMPUS --> UNKNOWN : no update by 6 AM
    Unavailable --> UNKNOWN : no update by 6 AM
```

---

## 10. Entity-Relationship Diagram

The full crow's-foot ERD with all columns is in `docs/06-data-modeling/data-modeling-scls.md` (Task 2). Summary view:

```mermaid
erDiagram
    OFFICE ||--o{ USER_ACCOUNT : houses
    USER_ACCOUNT ||--o| APPROVER : "is a"
    APPROVER |o--o| APPROVER : "backs up"
    USER_ACCOUNT ||--o{ DOCUMENT : submits
    DOCUMENT_TYPE ||--o{ DOCUMENT : classifies
    OFFICE ||--o{ DOCUMENT : "currently holds"
    DOCUMENT ||--|| QR_TAG : "is labeled by"
    DOCUMENT ||--|{ APPROVAL_STEP : "routes through"
    APPROVER ||--o{ APPROVAL_STEP : "is assigned"
    OFFICE ||--o{ APPROVAL_STEP : hosts
    DOCUMENT ||--|{ CUSTODY_LOG_ENTRY : "has history"
    OFFICE ||--o{ CUSTODY_LOG_ENTRY : receives
    APPROVAL_STEP ||--o{ ESCALATION : triggers
    DOCUMENT ||--o{ NOTIFICATION : generates
    USER_ACCOUNT ||--o{ NOTIFICATION : receives
```
