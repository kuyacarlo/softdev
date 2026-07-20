# Activity No. 1 – Requirements Engineering Workshop
## CPE 304 – Software Design (Lecture)

---

## Group Members
- Roque, Francis Benedict
- Lopez, Cyrus Angelo
- Santos, John Carlo
- Santos, Mark Kean

**Course/Year/Section:** BSCPE - 3C  
**Date:** 7-##-2026

---

## I. Objective
To apply engineering problem-solving strategies and elicitation techniques to translate ambiguous stakeholder needs into a structured, testable engineering blueprint.

---

## II. Engineering Scenario: "Smart Campus" Logistics System
The university administration reports that physical document tracking between offices is "too slow and unreliable." As computer engineers, your task is not just to "code a tracker," but to architect the requirements for an automated, secure logistics system.

---

## III. Workshop Tasks

### Task 1: Root Cause Excavation (The 5 Whys)

**Symptom:** "It takes 3 days to get a signature approved."

**Why 1?**  
Documents are physically moving between offices, but the location is invisible to requesters and approvers until someone physically discovers the paper, so delays accumulate silently with no mechanism to detect or escalate them.

**Why 2?**  
Because there is no mechanism that notifies approvers that a document is waiting for their action, and they are often unavailable, travelling, or off-campus (e.g., Team Lead in Japan for a learning trip, Admin in a business meeting in Cebu), while the status of documents is only known by whoever physically has it.

**Why 3?**  
Because there is no digital logging system that records which office holds the document, when it arrived there, when it passed to the next office, or the availability of signatories themselves.

**Why 4?**  
Because the multi-office approval workflow was designed decades ago as a purely manual, paper-based routing process, assuming all stakeholders are on-campus and always available during semester, and was never given an integration layer to handle handoff data.

**Fundamental Root Cause:**  
The university lacks a centralized digital custody log and status system, providing real-time visibility into both document location, documentary handoff timestamp, and current approver status across the approval chain in multiple offices.

---

### Task 2: The Zone of Investigation (Impact vs. Uncertainty)

Identify two specific problems within this logistics system. Rate them from 1 (Low) to 10 (High).

**Problem A:** Approval bottlenecks occur when key personnel (admin, other signatories) are unavailable, travelling, or outside campus, blocking document progression with no escalation path.  
*(Impact: 9 / Uncertainty: 5)*

**Problem B:** Lack of document location visibility during physical office handoffs.  
*(Impact: 7 / Uncertainty: 6)*

**Design Focus:**  
Problem A is prioritized since it has the highest combined impact and uncertainty, making it the primary focus of the design. To achieve an exemplary score, design focuses on the problem with the highest impact and uncertainty.

---

### Task 3: Fact vs. Assumption Validation

List one Validated Fact (Data-backed constraint) and one Assumption (Hypothesis) for this project.

**Engineering Fact:**  
The current approval process relies entirely on paper routing slips with no electronic custody log. There is no mechanism to determine signer availability. No handoff timestamps, no location markers, no record of which office currently holds a document at any given time, or where stakeholders are located.

**Stakeholder Assumption:**  
Approvers will check a centralized digital status dashboard or receive mobile notification within a few minutes to hours of a document arriving at their office, and will act on it promptly. In this context, the behavior has neither been observed nor validated; however, stakeholder consensus indicates that it is feasible.

---

### Task 4: Structured Problem Statement

Transform your findings into a professional engineering problem statement using the following syntax:  
**[User Persona] needs a way to [Action/Goal] because [Root Cause/Insight].**

**Statement:**  
Approving officers (faculty and staff) need a way to track document location, identify when primary approvers are unavailable, and automatically escalate to designated backup signers because the current paper-based routing process provides no visibility into either document custody or signer availability, causing cascading delays when key personnel are traveling or off-campus with no escalation mechanism.

---

### Task 5: Requirements Translation (Customer vs. Engineering Space)

Translate a user "pain point" into its technical equivalent.

**User Pain Point:**  
I submitted a document to the first office two days ago. I don't know if my request is sitting on someone's desk, lost, or already approved. I just have to keep calling around to ask, wasting everyone's time.

**Functional Requirement:**  
The system shall:
1. Assign a unique tracking ID to every document and update its status (Submitted, In Transit, Under Review, Approved, Rejected) in real time
2. Display the current approver name and availability status (On-Campus, Off-Campus, Away, Designated Backup) on the dashboard
3. Automatically route documents to a designated backup approver if the primary signer is marked unavailable for >24 hours
4. Maintain an immutable custody log showing which office holds the document at each timestamp
5. Notify both the requester and the current custodian via email and/or dashboard alert

**Non-Functional Requirement (Security/Performance):**  
- The system shall authenticate all users through university single sign-on
- All custody logs shall be encrypted in transit (TLS) and at rest (AES-256)
- Status updates shall be displayed within 5 seconds of a handoff or state change
- The system shall maintain 99% uptime during office hours (8 AM – 5 PM) and accept delayed sync during off-hours
- Approver availability shall update daily at 6 AM based on manual input from office administrators or integration with any scheduling application
- The system shall not require changes to existing approval authority or workflow procedures

---

## IV. Activity Instructions & Deliverables
1. **Group Alignment:** Form groups of 3-4 members (consistent with Lab Activity No. 1 groups)
2. **Originality Gate:** Solution ideas must be originally generated
3. **Submission:** Submit on or before the end of the set deadline

---

## V. Evaluation Rubric (Alignment with Syllabus)

| Criterion | Weight | Expectation |
|-----------|--------|-------------|
| **Problem Identification** | 20% | Correct rating of impact and uncertainty |
| **Assumptions/Statement** | 20% | Correct formulation of a structured problem statement |
| **Solution Originality** | 20% | Avoidance of existing product "clones" |
| **Problem-Solution Fit** | 40% | Logic follows the "Translation Engine" model |

---

## Submission Notes
- **Problem-Solution Fit Logic:** The root cause identifies two core gaps (location visibility + approver availability). Problem A prioritizes availability-driven delays. The functional requirements directly address this through backup routing and availability status display. The non-functional requirements (5-second response, 99% office-hours uptime) support the asynchronous escalation model without over-engineering.
- **Originality:** This design is campus-specific, addressing real scenarios (personnel traveling, off-campus meetings) that generic document trackers don't handle. The backup routing + availability tracking differentiates from standard "add a dashboard" solutions.
