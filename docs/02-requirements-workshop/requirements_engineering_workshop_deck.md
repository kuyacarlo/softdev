---
marp: true
theme: custom-theme
title: Requirements Engineering Story - Smart Campus Logistics
description: A human-centric story of university document tracking requirements elicitation
author: BSCPE 3C - Group 2-1
style: |
  :root {
    --bg-start: #161224;
    --bg-end: #0a0812;
    --text-color: #e2dfeb;
    --primary-color: #ff9f89;
    --secondary-color: #b392ac;
    --accent-color: #b392ac;
    --link-color: #a29bfe;
    --code-bg: #261f35;
    --card-bg: #1f1832;
    --card-alt-bg: #141326;
    --border-color: #3d2f5a;
    --border-alt-color: #4b3d73;
  }
---

<!-- _backgroundColor: #0c0915 -->
<!-- _color: #ffffff -->

# <p class="tag">Requirements Engineering Case Study</p>

**Re-architecting Campus Document Flow**
*A human-centric engineering story of the "Smart Campus" Logistics System*

<br>
<br>

**Presented by Group 2-1 (BSCPE - 3C)**
*Francis Benedict Roque, Cyrus Angelo Lopez, John Carlo Santos, Mark Kean Santos*

---

# Tasks on hand

<div class="lower-text">

* **5 Whys: What happened** — The human bottleneck causing 3-day approval delays.
* **Zone of Investigation: What happened specifically** — Tracing the root cause of manual routing.
* **Fact vs Assumption Validation: What we think happens** — Distinguishing hard facts from behavioral assumptions.
* **Structured Problem Statement: What we think is the problem** - Specifying the actual problem at hand
* **Requirements Translation: What we can do to make it work** — Translating user pain into concrete requirements.

</div>

---

# The Problem
<div class="lower-text">

The symptom reported by university offices was simple: **"It takes 3 days to get a signature approved."**

When we looked closely at the daily campus operations, we saw why:

* **Invisible Custody:** Documents move physically between offices with no location tracking.
* **Unannounced Absence:** Workflows assume physical presence. If signers travel (e.g. Cebu, Japan), documents sit stranded.
* **Coordination Overhead:** Requesters spend hours calling offices to find their files.

</div>

---

# 1. 5 Whys
<div class="lower-text">

We performed a **5 Whys Analysis** to trace the delay bottleneck:


<div style="font-size: 1.3em; line-height: 1.6; text-align: center; margin-top: 7em;">

Signatures take 3 days.

---

# 1. 5 Whys

* **Why?** Handoffs are invisible and lack arrival alerts.
* **Why?** There is no audit registry of custody or signer availability.
* **Why?** Entities go through multiple offices multiple times to get progress updates
* **Why?** The decades-old manual process assumes physical presence.

---

# 1. 5 Whys: Fundamental Root Cause

<div style="font-size: 1.3em; line-height: 1.6; text-align: center; margin-top: 7em; padding: 0 2em;">

The university lacks a centralized digital custody log and availability tracking system to handle multi-office handoff data.

</div>

---

# 2. Zone of Investigation
<div class="lower-text">
To build a high-leverage solution, we mapped these operational challenges:
</div>

<div class="grid-50-50 " style="margin-top: 2em">
<div class="card">

### Signer Absence (Problem A)
Key approvers are travelling or unavailable, stalling the entire document routing.
* **Impact:** 9 / 10
* **Uncertainty:** 5 / 10

</div>
<div class="card alt">

### Physical Handoffs (Problem B)
Lack of visibility during physical handoffs between offices.
* **Impact:** 7 / 10
* **Uncertainty:** 6 / 10
* *Note: A tracking ID solves this, but it is secondary to fixing the availability block.*

</div>
</div>

 *Design Focus: We prioritized Problem A as tracking when signers are away solves the critical bottleneck.*
 
---

# 3. Fact vs Assumption Validation

<div class="lower-text">
To ground our requirements, we isolated hard facts from human hypotheses:
</div>

<div class="grid-50-50 " style="margin-top: 2em">
<div class="card">

### The Hard Fact (What we're working with)
* The current process is 100% paper-based.
* No electronic custody registry or handoff timestamps.
* No mechanism to check signatory availability.

</div>
<div class="card alt">

### The Hypothesis (What we think happens)
* Approvers will check a digital dashboard or act on alerts within hours.
* This behavioral consensus has not been validated.
* *Frictionless design is required to trigger this active participation.*

</div>
</div>

---

# 4. The Problem Statement

<div style="font-size: 1.3em; line-height: 1.6; text-align: center; margin-top: 7em;">

**Approving officers** need a way to **track documents, monitor signatory availability, and escalate to backups** because the manual routing process has zero visibility, causing cascading delays when key personnel travel.

</div>

---

# 5. Requirements Translation

<div class="lower-text">
We map the human pain point directly to technical equivalent requirement rules:
</div>

<div class="grid-50-50" style="margin-top: 2em;">
<div class="card">

### Customer Pain Point

<br/>

*"I submitted a document two days ago. I don't know if it's sitting on someone's desk, lost, or already approved. I have to keep calling around, wasting everyone's time."*

</div>
<div class="card alt">

### Functional Translation
The system shall:
1. **Assign a Unique ID** to track status.
2. **Display Availability Status** (`On-Campus`, `Off-Campus`, `Away`).
3. **Escalate Automatically** to backup signers if the primary is away for **>24 hours**.
4. **Log Custody Immutably** with timestamps.

</div>
</div>

---

# Key Constraints

<div class="lower-text">

Non-functional requirements guarantee the system is secure, fast, and easy to adopt:
</div>

* **Security:** SSO integration; custody logs encrypted in transit (TLS) and at rest (AES-256).
* **Performance:** Handoff updates sync in **5 seconds**; 99% uptime during office hours.
* **Adoption:** Daily availability sync at **6 AM**; no changes to existing signing rules or workflows.

---


# Re-imagining Campus Hand-offs

<div class="lower-text">

* **Solving the travel bottleneck:** Automatic routing keeps paperwork moving.
* **Zero workflow friction:** Keeps existing signing rules in place.
</div>

---
<!-- _backgroundColor: #0c0915 -->
<!-- _color: #ffffff -->

# Thank You

<div class="lower-text">

**Group 2-1 (BSCPE - 3C)**
*Requirements Engineering Blueprint*
</div>
