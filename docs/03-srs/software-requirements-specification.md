# **Software Requirements Specification (SRS)**

**Version:** 1.0  
**Prepared For:** Stella’s Event Management Services Website  
**Prepared By:** Group 2-1  
**Document Type:** Software Requirements Specification(SRS)  
**Classification:** Client Approval Copy

**1\. INTRODUCTION**

#### **1.1 Purpose**

The purpose of this Software Requirements Specification (SRS) is to define the complete requirements of the Stella’s Event Management Services Website, a web-based platform developed to promote the services offered by Casa de Stella Catering Services and provide customers with a convenient way to explore available catering packages and submit booking requests.

This document serves as:

* A formal agreement between Stella’s Event Management Services and the development team.  
* A reference for software design, implementation, testing, and deployment.  
* A guide for system maintenance and future enhancements.  
* A basis for validating that the system meets the business requirements of Casa de Stella Catering Services.  
* A formal agreement between Stella’s Event Management Services and the development team.  
* A reference for software design, implementation, testing, and deployment.  
* A guide for system maintenance and future enhancements.  
* A basis for validating that the system meets the business requirements of Casa de Stella Catering Services.

---

## **1.2 Business Problem**

Stella’s Event Management Services primarily handles customer inquiries and reservations through manual communication methods such **as phone calls, social media messaging, and walk-in consultations**. As customer inquiries increase, **it becomes more difficult to efficiently provide complete information regarding catering packages, food menus, pricing, event designs, and available services**.

These manual processes have resulted in:

* Delayed responses to customer inquiries.  
* Difficulty in showcasing available catering packages and event designs.  
* Limited accessibility to updated pricing and menu information.  
* Inefficient scheduling of customer appointments.  
* Manual handling of booking requests.  
* Increased administrative workload.

---

## **1.3 Root Cause Analysis**

### **Using the 5 Whys Engineering Framework**

**Symptom**

Customers experience delays and inconvenience when requesting catering services from Stella’s Event Management Services.

**Why \#1**

Customers need to contact the business manually to inquire about services and availability.

**Why \#2**

Complete information about catering packages, menus, pricing, and event designs is not digitally available.

**Why \#3**

Stella’s Event Management Services does not have an official website that customers can access anytime.

**Why \#4**

Bookings and appointments are managed manually through calls, social media, and personal visits.

**Why \#5**

The business lacks a dedicated online booking and information management system.

### **Fundamental Root Cause**

The absence of a centralized web-based platform for Stella’s Event Management Services results in inefficient customer inquiries, manual booking processes, and limited access to business information.

---

# **2\. SYSTEM OVERVIEW**

## **2.1 Product Name**

**Stella’s Event Management Services Website**

---

## **2.2 System Vision**

To provide Casa de Stella’s Event Management Services with a professional, user-friendly, and centralized online platform where customers can explore successful events catering services, browse food menus and event design inspirations, compare package pricing, schedule appointments, and submit booking requests while enabling administrators to efficiently manage business operations through a secure web-based system.

---

## **2.3 Objectives**

The system aims to:

* Promote the catering services offered by Stella’s Event Management Services.  
* Display available catering packages and pricing.  
* Showcase food menus and event design inspirations.  
* Provide customers with complete service information.  
* Allow customers to submit booking requests without creating an account.  
* Enable customers to schedule appointments or consultations.  
* Allow customers to provide their preferred event design, theme, special decorations, or customization requests through a written description and optional reference image uploads.  
* Allow administrators to efficiently manage website content and customer bookings.  
* Reduce manual reservation processing.  
* Improve customer satisfaction through an accessible online platform.

---

# **3\. SCOPE**

The Stella’s Event Management Services Website shall manage

### **Included**

* **Service and Profile Information**  
  * Catering packages  
  * Service inclusions  
  * Event categories  
  * Company profile  
* **Menu and Catalog Management**  
  * Main dishes, appetizers, desserts, beverages, and grazing options  
  * Brochure and event design gallery (weddings, birthdays, corporate events)  
  * Pricing updates for packages, services, and food items  
* **Booking and Appointment Workflows**  
  * Online booking request submissions  
  * Appointment scheduling and calendar management  
  * Event details (venue, date, guest count, theme)  
  * Customer customization requests (special decorations, written descriptions)  
  * Inspiration/reference image uploads  
  * Booking status tracking  
* **Administrative Operations**  
  * Management of website content and announcements  
  * Approval/denial of appointments  
  * Review of customer inquiries and design submissions  
  * Management of customer bookings

## **3.2 Excluded**

The system shall not:

* Replace existing accounting software.  
* Manage physical kitchen operations or inventory tracking in real-time.  
* Process online payments directly.  
* Function as a social media management platform.


---

# **4\. STAKEHOLDERS**

| Stakeholder | Interest |
| :---: | ----- |
| **Stella’s Event Management Services Owner** | Oversees business operations, monitors bookings, and ensures customer satisfaction. |
| **Events Manager** | Manages appointment schedules, customer inquiries, and event coordination. |
| **Logistics Coordinator** | Manages equipment inventory, transportation, and venue setup/teardown. |
| **Kitchen/Food Manager** | Oversees food inventory, menu availability, and kitchen staff preparation. |
| **Site Administrator** | Maintains website content, updates packages/pricing, and manages system security. |
| **Customers/Clients** | Browses catering packages, views menus/event designs, and submits booking requests. |

---

# **5\. USER CLASSES**

## **UC-1 Administrator**

Responsible for:

* Log in securely to the administration dashboard.  
* Manage catering packages and service information.  
* Add, edit, or remove food menu items.  
* Manage brochure and event design galleries.  
* Update package pricing and promotional offers.  
* View customer booking requests.  
* Review customer-submitted event design descriptions and reference images.  
* Manage customer customization requests related to event themes and decorations.  
* Approve, decline, or reschedule appointments.  
* Manage customer bookings.  
* Update website announcements and business information.  
* Monitor booking records and inquiries.

---

## **UC-2 Guest/User (Customer)**

Responsible for:

* Browse catering packages.  
* View food menu selections.  
* Explore brochure and event design inspirations.  
* Compare package pricing and service inclusions.  
* Submit booking requests.  
* Schedule appointments or consultations.  
* Provide event details (type, venue, date, guest count, and package).  
* Provide descriptions of preferred designs, themes, and special requests.  
* Upload inspiration or reference images for event setup.  
* Receive confirmation or follow-up communication regarding booking requests.

---

## **UC-3 Events Manager**

Responsible for:

* Review and approve appointment requests.  
* Communicate with customers regarding event details and special requests.  
* Coordinate event schedules with the logistics team.  
* Monitor booking status and updates.

---

## **UC-4 Logistics Coordinator**

Responsible for:

* Manage inventory of event equipment and decorations.  
* Coordinate transportation schedules for events.  
* Oversee setup and teardown of event venues.  
* Ensure all equipment is ready for confirmed bookings.  
  ---

## **UC-5 Kitchen/Food Manager**

Responsible for:

* Update food menu availability and pricing.  
* Coordinate with the events team on catering requirements for upcoming bookings.  
* Manage kitchen staff and food preparation workflows.  
* Monitor food inventory to ensure ability to fulfill booking orders.

---

# **6\. SYSTEM FEATURES**

## **6.1 Booking Management**

**Description:** The system shall allow customers to initiate and manage booking requests.  
**FR-001:** The system shall automatically generate a unique booking identifier.  
**FR-002:** The system shall record timestamp of booking submissions.  
**FR-003:** The system shall validate required fields (Date, Venue, Guest Count).  
---

## **6.2 Appointment Scheduling**

**FR-004:** The system shall allow customers to request specific appointment dates/times.  
**FR-005:** The system shall display appointment status (Pending, Confirmed, Declined).  
**FR-006:** The system shall allow administrators to reschedule appointments.  
---

## **6.3 Content Management (CMS)**

**FR-007:** The system shall allow administrators to add/edit/delete catering packages.  
**FR-008:** The system shall allow administrators to update food menu items and pricing.  
**FR-009:** The system shall support image uploads for event design galleries.  
---

## **6.4 Notification System**

**FR-010:** The system shall generate notifications for:

* New booking requests.  
* Appointment confirmation/updates.  
* Admin inquiries.

---

## **6.5 Search and Filter**

**FR-011:** The system shall allow customers to filter catering packages by event type.  
**FR-012:** The system shall allow customers to view pricing details for all services.  
---

# **7\. EXTERNAL INTERFACE REQUIREMENTS**

## **7.1 User Interface**

The interface shall be:

* Responsive (Mobile/Desktop/Tablet compatible).  
* Web-based.  
* Accessible.

---

## **7.2 Software Interface**

The system shall integrate with:

* Standard Email Systems (for notifications).  
* Modern Web Browsers.

# **8\. DATA REQUIREMENTS**

## **8.1 Core Entities**

* User (Admin credentials).  
* Booking (ID, Customer Info, Event Details).  
* Menu (Item, Description, Price, Image).  
* Appointment (ID, Date, Status, Client).

# **9\. BUSINESS RULES**

**BR-001:** Every booking must have a unique tracking number.  
**BR-002:** Booking requests must be submitted at least 7 days before the event.  
**BR-003:** Unauthorized users cannot access the administrative dashboard.  
**BR-004:** All booking status changes must be logged.  
**BR-005:** Only authorized administrators can update package pricing.

# **10\. NON-FUNCTIONAL REQUIREMENTS**

## **10.1 Performance**

**NFR-001:** Page loading time shall not exceed 3 seconds.  
**NFR-002:** The system shall support at least 100 concurrent users.  
---

## **10.2 Availability**

**NFR-003:** System availability shall be at least 99.9%.  
---

## **10.3 Security**

**NFR-004:** All sensitive customer data shall be encrypted (HTTPS/TLS).  
**NFR-005:** Role-Based Access Control (RBAC) shall be enforced for the dashboard.  
---

# **11\. SYSTEM CONSTRAINTS**

## **Technical Constraints**

* The system shall operate as a web-based application accessible through any modern web browsers (Google Chrome, Microsoft Edge, Mozilla Firefox, and Safari).  
* The system shall require a stable internet connection for customers and administrators to access website features.  
* The system shall support secure file uploads for customer-submitted inspiration or reference images.  
* The system shall use a relational database to securely store website content, booking requests, appointment schedules, customer customization requests, and uploaded reference images.  
* The system shall comply with current web security standards, including HTTPS encryption, secure authentication, and protection against unauthorized access.

## **Operational Constraints**

* Only authorized administrators shall have access to the administrative dashboard.  
* Customers shall not be required to create an account before submitting booking requests or scheduling appointments.  
* The accuracy of booking information depends on the completeness and correctness of the information provided by customers.  
* Uploaded inspiration or reference images shall be limited to supported image formats and maximum file size restrictions.  
* Scheduled website maintenance may temporarily limit system accessibility but should be performed during off-business hours whenever possible.

---

# **12\. ACCEPTANCE CRITERIA**

The client shall approve the system when:

**AC-01**  
Customers can successfully browse catering packages, food menus, pricing information, brochures, and event design galleries seamlessly.

**AC-02**  
Customers can submit booking requests without creating an account.

**AC-03**  
Customers can successfully schedule appointments and provide complete event details.

**AC-04**  
Customers can submit event design descriptions and optionally upload inspiration or reference images without errors.

**AC-05**  
Administrators can securely log in and manage catering packages, food menus, pricing, brochures, event galleries, bookings, appointments, and website content.

**AC-06**  
The system correctly stores and displays all submitted booking requests and customer customization details.

**AC-07**  
Security testing confirms that only authorized administrators can access the administrative dashboard and sensitive system functions.

---

# **13\. RISKS AND MITIGATION**

| Risk | Mitigation |
| ----- | ----- |
| Internet connectivity issues | Ensure reliable web hosting and optimize website performance. |
| Unauthorized access to the admin dashboard | Implement secure authentication, strong passwords, and role-based access control. |
| Loss of customer booking information | Perform automated database backups and recovery procedures. |
| Upload of unsupported or malicious image files | Validate file types, restrict file sizes, and scan uploaded files before storage. |
| Incorrect customer booking information | Require mandatory input validation and confirmation before submission. |
| Website downtime due to server failure | Use reliable hosting services with regular monitoring and backup servers when available. |

---

# **14\. FUTURE ENHANCEMENTS**

The system may later include:

* Online payment integration for reservation deposits and full payments.  
* Customer account registration for viewing booking history and appointment status.  
* SMS and email notification services for appointment confirmations and booking updates.  
* Live chat support between customers and administrators.  
* Interactive calendar showing available booking dates.  
* AI-powered recommendations for catering packages and event themes based on customer preferences.  
* Mobile application for Android and iOS devices.  
* Customer feedback and review management system.  
* Integration with social media platforms for automatic promotion of event packages and announcements.  
* Analytics dashboard for monitoring booking trends, customer preferences, and business performance.

---

# **15\. CONCLUSION**

The **Stella's Event Management Services Website** is designed to modernize the business operations of **Casa de Stella Catering Services** by providing a centralized, user-friendly, and secure web-based platform for promoting catering services and managing customer bookings. The system enables customers to conveniently browse catering packages, food menus, pricing information, brochures, and event design inspirations while allowing them to submit booking requests, schedule appointments, and communicate their preferred event themes and customization requests through written descriptions and optional reference image uploads. At the same time, the secure administrative dashboard allows authorized personnel to efficiently manage website content, customer inquiries, bookings, appointments, pricing, and event-related information. By reducing reliance on manual communication and reservation processes, the system improves operational efficiency, enhances customer satisfaction, and strengthens the online presence of Stella's Event Management Services. This Software Requirements Specification (SRS) provides a complete and verifiable foundation for the system's design, development, testing, deployment, and future enhancements.

