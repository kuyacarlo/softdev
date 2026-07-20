---
marp: true
theme: custom-theme
title: Logistics System Architecture
description: Overview of the Group2-1 Courier and Logistics System
author: Group2-1 Logistics Team
style: |
  :root {
    --bg-start: #0a192f;
    --bg-end: #020c1b;
    --text-color: #e6f1ff;
    --primary-color: #ff9f43;
    --secondary-color: #ff6b6b;
    --accent-color: #ffb8b8;
    --link-color: #64ffda;
    --code-bg: #0f1d30;
    --card-bg: #172a45;
    --card-alt-bg: #0a192f;
    --border-color: #23354c;
    --border-alt-color: #0f1d30;
  }
---

<!-- _backgroundColor: #020c1b -->
<!-- _color: #ffffff -->

# <p class="tag">System Design Overview</p>

**Technical Architecture & UML Subsystems Presentation**
Based on Object-Oriented Domain Driven Design
Courier & Logistics System

<br>

**Presented by Group 2-1 (BSCPE - 3C)**
*Francis Benedict Roque, Cyrus Angelo Lopez, John Carlo Santos, Mark Kean Santos*

---

# Agenda

<div class="lower-text">

* **Logistics Cycle Graph** — Unified Client & Parcel journey mapping
* **System Design Principles** — Object-Oriented Domain Driven Architecture
* **Subsystems Deep-Dive** — Detailed schemas for the 6 core components

</div>

---

# End-to-End Lifecycle: Client & Parcel Journeys

<div class="lower-text">

The non-linear, parallel processing lifecycle showing transaction and cargo flows:

</div>

<div class="flow-grid" style="margin-top: 6em">
  <div class="flow-column">
    <div class="flow-node start-node">
      Client<br>Order Booking
      <div style="font-size:0.75em; font-weight:normal; color:#a0a2aa; margin-top:5px;">Declares weight, size, value</div>
    </div>
  </div>
  <div class="flow-container" style="margin-top: 0px; gap: 20px;">
    <div class="flow-section" style="padding: 10px; display: flex; flex-direction: column; gap: 6px; align-items: center; text-align: center;">
      <div style="color: #ffb8b8; font-weight: bold; font-size: 0.8em; margin-bottom: 3px; text-align: center;">Financial Path</div><br/>
      <div class="flow-node alt" style="width: 90%;">Invoice Generated</div>
      <div class="flow-connector" style="margin: -2px 0;">↓</div>
      <div class="flow-node alt" style="width: 90%;">Payment Settled</div>
      <div class="flow-connector" style="margin: -2px 0;">↓</div>
      <div class="flow-node alt" style="width: 90%;">Receipt Emitted</div>
    </div>
    <div class="flow-section" style="padding: 10px; display: flex; flex-direction: column; gap: 6px; align-items: center; text-align: center;">
      <div style="color: #ffb8b8; font-weight: bold; font-size: 0.8em; margin-bottom: 3px; text-align: center;">Cargo Path</div><br/>
      <div class="flow-node" style="width: 90%;">Parcel Sorted (Zone)</div>
      <div class="flow-connector" style="margin: -2px 0;">↓</div>
      <div class="flow-node" style="width: 90%;">Shipment Assigned</div>
      <div class="flow-connector" style="margin: -2px 0;">↓</div>
      <div class="flow-node" style="width: 90%;">Courier Geolocation</div>
    </div>
  </div>
  <div class="flow-column">
    <div class="flow-node end-node">
      Final Delivery<br>& Verification
      <div style="font-size:0.75em; font-weight:normal; color:#a0a2aa; margin-top:5px;">Recipient signs & status closes</div>
    </div>
  </div>
</div>

---

# Unified Data Pipeline

<div class="lower-text">

Data flows through the system domains sequentially during a parcel's lifecycle:
</div>
<div class="pipeline" style="margin-top: 10em">
  <div class="step">Client<br><small>Initiates</small></div>
  <div class="arrow">➜</div>
  <div class="step alt">Parcel<br><small>Contained in</small></div>
  <div class="arrow">➜</div>
  <div class="step">Shipment<br><small>Billed via</small></div>
  <div class="arrow">➜</div>
  <div class="step alt">Invoice<br><small>Settled by</small></div>
  <div class="arrow">➜</div>
  <div class="step">Payment<br><small>Generates</small></div>
  <div class="arrow">➜</div>
  <div class="step alt">Receipt<br><small>Proof</small></div>
</div>

<!--
Logistics Trigger: Staff assigns Shipment; Parcel sizing maps to sorting routes.
Financial Trigger: Shipment generates Invoice; Payment clears billing ledger; Receipt is emitted.
-->

---

# Architectural Paradigm

<div class="lower-text">

* **Target Paradigm:** Object-Oriented Domain Driven Architecture
* **Structural Division:** Decoupled business domains partition operational, logistical, personnel, and billing systems into clean interfaces and classes.
* **Core Inheritance (Generalization):** Base entities (like `Staff`, `Shipment`, `Parcel`, `Invoice`, `Payment`, `Receipt`) define common logic, specialized by subclasses.
* **Core Contracts (Realization):** Decoupled interfaces (like `Navigable`, `Trackable`, `Insurable`, `BusinessInfo`, `Refundable`, `DisplayReceipt`) guarantee modular behavior.

</div>

---

# I. Payment Gateway Subsystem

<div class="grid-50-50">
<div>

Processes payment validation, authorization codes, and network settlement.

* `Payment` *(Abstract base)*: Base transaction properties (amount, status, timestamp).
* `Cash`: Local drawer currency accounting.
* `EWallet` *(Refundable)*: Mobile wallet API providers (e.g. Gcash, Paymaya).
* `Card` *(Refundable)*: Credit/Debit card merchant authentication.
* `Refundable` *(Interface)*: Digital channel refund processing contract.

</div>
<div>

<img src="diagrams/Payment.png" style="height: 340px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

# II. Proof of Purchase Subsystem

<div class="grid-50-50">
<div>

Generates multi-channel proofs of purchase following gateway settlement.

* `Receipt` *(Abstract base)*: Binds receipt record to invoice and payment details.
* `OnlineReceipt` *(DisplayReceipt)*: Email-dispatched HTML or PDF summaries.
* `PhysicalReceipt` *(DisplayReceipt)*: High-speed thermal paper printer formats.
* `SMSReceipt` *(DisplayReceipt)*: Character-optimized text alerts.
* `DisplayReceipt` *(Interface)*: Layout summaries formatting contract.

</div>
<div>

<img src="diagrams/Invoice1.png" style="height: 360px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

# III. Financial Auditing Subsystem

<div class="grid-50-50">
<div>

Computes base service rates, discounts, cashier details, and business billing headers.

* `Invoice` *(Abstract base)*: Ledger detailing cashier, discounts, and order totals.
* `CounterInvoice` *(BusinessInfo)*: Physical cashiers at retail hubs.
* `OnlineInvoice` *(BusinessInfo)*: Automated customer web order.
* `DeliverInvoice` *(BusinessInfo)*: Route fees for Cash/Pay on Delivery.
* `BusinessInfo` *(Interface)*: Imposes company credentials header.

</div>
<div>

<img src="diagrams/Invoice.png" style="height: 380px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

# IV. Physical Cargo Subsystem

<div class="grid-50-50">
<div>

Manages physical cargo dimensions, weight thresholds, and insurance limits.

* `Parcel` *(Abstract base)*: Encapsulates weight and unique parcel IDs.
* `SmallParcel` *(Insurable)*: Documents and packages under 2kg.
* `MediumParcel` *(Insurable)*: Boxed cargo under 10kg.
* `LargeParcel` *(Insurable)*: Pallets under 30kg requiring machinery.
* `Insurable` *(Interface)*: Assigns declared coverage valuation.

</div>
<div>

<img src="diagrams/Parcel.png" style="height: 330px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

# V. Consignment Transit Subsystem

<div class="grid-50-50">
<div>

Governs cargo movement pipelines, delivery speeds, and special configurations.

* `Shipment` *(Abstract base)*: Manages active transit states and tracking records.
* `StandardShipment` *(Trackable)*: Non-urgent, standard pricing lanes.
* `ExpressShipment` *(Trackable)*: Premium priority transit lanes.
* `SpecialShipment` *(Trackable)*: Fragile or hazardous goods handling.
* `Trackable` *(Interface)*: Standardizes customer query updates.

</div>
<div>

<img src="diagrams/Shipment.png" style="height: 380px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

# VI. Staff & Personnel Subsystem

<div class="grid-50-50">
<div>

Manages employee records, shifts, access control, and routing assignments.

* `Staff` *(Abstract base)*: Encapsulates generic details (name, contact, status, rating).
* `Courier` *(Navigable)*: Field transit personnel tracking vehicles and location.
* `SortingStaff` *(Navigable)*: Hub warehouse operators restricted to sorting zones.
* `Administrator`: Privileged configuration.
* `Navigable` *(Interface)*: Geolocation tracking contract.

</div>
<div>

<img src="diagrams/DeliveryPerson.png" style="height: 380px; width: auto; border-radius: 8px; display: block; margin: 0 auto;" />

</div>
</div>

---

<!-- _padding: 20px 40px -->

# Unified Class Diagram

![h:460](diagrams/UnifiedView.png)

<!--
Cross-Domain Association: Integrates financial flow (auditing, invoicing, payments, receipts) and operational logistics (cargo physical dimensions, transit pipelines, personnel routing).
-->

---

<!-- _backgroundColor: #020c1b -->
<!-- _color: #ffffff -->

# Thank You

<div class="lower-text">

**Group 2-1 (BSCPE - 3C)**
*Object-Oriented Domain Driven Architecture*

</div>
