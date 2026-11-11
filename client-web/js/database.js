const SCHEMA_TABLES = [
  {
    name: "admin_roles",
    purpose: "Staff permission codes",
    columns: [
      ["role_code", "PK"],
      ["role_label", ""],
      ["sort_order", ""],
    ],
  },
  {
    name: "event_categories",
    purpose: "Wedding, debut, birthday, and other event types",
    columns: [
      ["category_code", "PK"],
      ["category_label", ""],
      ["sort_order", ""],
    ],
  },
  {
    name: "booking_statuses",
    purpose: "Reservation lifecycle codes",
    columns: [
      ["status_code", "PK"],
      ["status_label", ""],
      ["is_terminal", ""],
      ["sort_order", ""],
    ],
  },
  {
    name: "admin_users",
    purpose: "Staff who review and approve events",
    columns: [
      ["admin_id", "PK"],
      ["username", "UNIQUE"],
      ["email", "UNIQUE"],
      ["password_hash", "SECRET"],
      ["role_code", "FK"],
      ["is_active", ""],
      ["created_at", ""],
      ["last_login_at", ""],
    ],
  },
  {
    name: "catering_packages",
    purpose: "Sellable menu tiers",
    columns: [
      ["package_id", "PK"],
      ["package_name", "UNIQUE"],
      ["category_code", "FK"],
      ["base_price", "> 0"],
      ["min_pax", "≥ 30"],
      ["description", ""],
      ["is_available", ""],
      ["created_at", ""],
      ["updated_at", ""],
    ],
  },
  {
    name: "package_inclusions",
    purpose: "Line items belonging to a package",
    columns: [
      ["inclusion_id", "PK"],
      ["package_id", "FK"],
      ["inclusion_text", ""],
      ["sort_order", ""],
    ],
  },
  {
    name: "customers",
    purpose: "Guests who submit booking requests",
    columns: [
      ["customer_id", "PK"],
      ["full_name", ""],
      ["username", "UNIQUE"],
      ["contact_number", "PH mobile"],
      ["email", "UNIQUE"],
      ["password_hash", "SECRET"],
      ["email_verified_at", ""],
      ["last_login_at", ""],
      ["created_at", ""],
    ],
  },
  {
    name: "customer_sessions",
    purpose: "Signed-in guest sessions",
    columns: [
      ["token", "PK"],
      ["customer_id", "FK"],
      ["expires_at", ""],
      ["created_at", ""],
    ],
  },
  {
    name: "bookings",
    purpose: "Event reservations",
    columns: [
      ["booking_id", "PK"],
      ["customer_id", "FK"],
      ["package_id", "FK"],
      ["approved_by", "FK"],
      ["event_date", "ISO date"],
      ["venue_location", ""],
      ["guest_count", "≥ package min"],
      ["design_theme_notes", ""],
      ["reference_image_url", ""],
      ["tracking_token", "UNIQUE"],
      ["status_code", "FK"],
      ["created_at", ""],
      ["updated_at", ""],
    ],
  },
  {
    name: "booking_status_events",
    purpose: "Immutable audit trail of status changes",
    columns: [
      ["event_id", "PK"],
      ["booking_id", "FK"],
      ["from_status", "FK"],
      ["to_status", "FK"],
      ["notes", ""],
      ["changed_by", "FK"],
      ["created_at", ""],
    ],
  },
  {
    name: "email_otps",
    purpose: "Gmail one-time codes for signup and password reset",
    columns: [
      ["otp_id", "PK"],
      ["email", ""],
      ["purpose", "register / reset"],
      ["code_hash", "SECRET"],
      ["expires_at", ""],
      ["consumed_at", ""],
      ["created_at", ""],
    ],
  },
];

const RELATIONS = [
  ["admin_roles", "admin_users", "role_code"],
  ["event_categories", "catering_packages", "category_code"],
  ["booking_statuses", "bookings", "status_code"],
  ["customers", "bookings", "customer_id"],
  ["customers", "customer_sessions", "customer_id"],
  ["catering_packages", "bookings", "package_id"],
  ["catering_packages", "package_inclusions", "package_id"],
  ["admin_users", "bookings", "approved_by"],
  ["bookings", "booking_status_events", "booking_id"],
  ["booking_statuses", "booking_status_events", "from_status / to_status"],
];

let dbSnapshot = null;

function adminSubnav(active) {
  const items = [
    ["#/admin/dashboard", "Dashboard", "dashboard"],
    ["#/book", "Book", "book"],
    ["#/admin/reservations", "Reservations", "reservations"],
    ["#/admin/packages", "Packages", "packages"],
    ["#/admin/accounts", "Accounts", "accounts"],
    ["#/admin/database", "Database", "database"],
  ];
  return `<nav class="filters admin-subnav">${items
    .map(
      ([href, label, key]) =>
        `<a class="chip ${active === key ? "active" : ""}" href="${href}">${label}</a>`
    )
    .join("")}</nav>`;
}

function tableHtml(headers, rows) {
  if (!rows.length) return `<div class="empty">No records in this table.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((row) =>
    row
      .map((cell) => {
        const s = String(cell ?? "");
        return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
      })
      .join(",")
  );
  const blob = new Blob([`\ufeff${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function collectDatabase(packages, bookings, staff, listedCustomers = []) {
  const customersMap = new Map();
  for (const c of listedCustomers) {
    if (c?.customerId) customersMap.set(c.customerId, c);
  }
  for (const b of bookings) {
    const c = b.customer;
    if (c?.customerId && !customersMap.has(c.customerId)) customersMap.set(c.customerId, c);
  }
  const customers = [...customersMap.values()].sort((a, b) => a.customerId - b.customerId);
  const inclusions = [];
  for (const p of packages) {
    (p.inclusions || []).forEach((text, i) => {
      inclusions.push({
        packageId: p.packageId,
        packageName: p.packageName,
        sortOrder: i + 1,
        inclusionText: text,
      });
    });
  }
  return { packages, bookings, customers, inclusions, staff };
}

function schemaDiagram() {
  return `
    <div class="erd">
      ${SCHEMA_TABLES.map(
        (t) => `
        <article class="schema-card">
          <header>
            <strong>${escapeHtml(t.name)}</strong>
            <span>${escapeHtml(t.purpose)}</span>
          </header>
          <ul>
            ${t.columns
              .map(
                ([col, tag]) =>
                  `<li><code>${escapeHtml(col)}</code>${tag ? `<em>${escapeHtml(tag)}</em>` : ""}</li>`
              )
              .join("")}
          </ul>
        </article>`
      ).join("")}
    </div>
    <h3 class="db-subtitle">Relationships</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Parent</th><th></th><th>Child</th><th>Foreign key</th></tr></thead>
        <tbody>
          ${RELATIONS.map(
            ([parent, child, key]) =>
              `<tr><td><code>${escapeHtml(parent)}</code></td><td>1 — ∞</td><td><code>${escapeHtml(child)}</code></td><td>${escapeHtml(key)}</td></tr>`
          ).join("")}
        </tbody>
      </table>
    </div>`;
}

async function viewAdminDatabase() {
  if (!requireAdmin()) return "";
  const [{ data: packages }, { data: bookings }, listedCustomers, me] = await Promise.all([
    api.packages(),
    api.bookings(),
    api.customers().catch(() => ({ data: [] })),
    api.me().catch(() => ({ data: getAdminUser() })),
  ]);
  dbSnapshot = collectDatabase(packages, bookings, me.data, listedCustomers.data || []);
  const counts = {
    packages: dbSnapshot.packages.length,
    customers: dbSnapshot.customers.length,
    bookings: dbSnapshot.bookings.length,
    pending: dbSnapshot.bookings.filter((b) => b.status === "Pending").length,
    confirmed: dbSnapshot.bookings.filter((b) => b.status === "Confirmed").length,
  };
  const pkgRows = dbSnapshot.packages.map((p) => [
    p.packageId,
    escapeHtml(p.packageName),
    escapeHtml(p.eventCategory),
    php(p.basePrice),
    p.minPax,
    p.isAvailable ? "Yes" : "No",
    (p.inclusions || []).length,
  ]);
  const customerRows = dbSnapshot.customers.map((c) => [
    c.customerId,
    escapeHtml(c.fullName),
    escapeHtml(c.username || "—"),
    escapeHtml(c.contactNumber),
    escapeHtml(c.email),
    formatDate(c.createdAt),
    `<button class="btn btn-danger" type="button" data-del-customer="${c.customerId}" data-bookings="${c.bookingCount || 0}">Delete record</button>`,
  ]);
  const bookingRows = dbSnapshot.bookings.map((b) => [
    `<a href="#/admin/reservations/${b.bookingId}">#${b.bookingId}</a>`,
    escapeHtml(b.customer?.fullName || "—"),
    escapeHtml(b.package?.packageName || "—"),
    formatDate(b.eventDate),
    b.guestCount,
    escapeHtml(b.venueLocation),
    `<span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span>`,
    `<code class="token-mini">${escapeHtml(b.trackingToken)}</code>`,
    `<button class="btn btn-danger" type="button" data-del-booking="${b.bookingId}">Delete</button>`,
  ]);
  const inclusionRows = dbSnapshot.inclusions.map((i) => [
    i.packageId,
    escapeHtml(i.packageName),
    i.sortOrder,
    escapeHtml(i.inclusionText),
  ]);
  const staffRows = dbSnapshot.staff
    ? [[dbSnapshot.staff.adminId, escapeHtml(dbSnapshot.staff.username), escapeHtml(dbSnapshot.staff.email), escapeHtml(dbSnapshot.staff.role)]]
    : [];

  return `
    <section class="section db-studio">
      <div class="section-head">
        <div>
          <h2>Database</h2>
        </div>
        ${adminSubnav("database")}
      </div>
      <div class="db-stats">
        <article><span>Packages</span><strong>${counts.packages}</strong></article>
        <article><span>Customers</span><strong>${counts.customers}</strong></article>
        <article><span>Reservations</span><strong>${counts.bookings}</strong></article>
        <article><span>Pending / confirmed</span><strong>${counts.pending} / ${counts.confirmed}</strong></article>
      </div>
      <div class="toolbar" id="db-toolbar">
        <button class="chip active" type="button" data-pane="packages">Packages</button>
        <button class="chip" type="button" data-pane="inclusions">Inclusions</button>
        <button class="chip" type="button" data-pane="customers">Customers</button>
        <button class="chip" type="button" data-pane="bookings">Reservations</button>
        <button class="chip" type="button" data-pane="staff">Staff</button>
        <input id="db-search" placeholder="Search this table" />
        <button class="btn btn-ghost" type="button" id="db-export">Export CSV</button>
      </div>
      <div class="db-pane" data-pane-panel="packages">
        ${tableHtml(["ID", "Package", "Category", "Base price", "Min pax", "Available", "Inclusions"], pkgRows)}
      </div>
      <div class="db-pane" data-pane-panel="inclusions" hidden>
        ${tableHtml(["Package ID", "Package", "Order", "Inclusion"], inclusionRows)}
      </div>
      <div class="db-pane" data-pane-panel="customers" hidden>
        ${tableHtml(["ID", "Name", "Username", "Mobile", "Email", "Created", ""], customerRows)}
      </div>
      <div class="db-pane" data-pane-panel="bookings" hidden>
        ${tableHtml(["ID", "Guest", "Package", "Event date", "Pax", "Venue", "Status", "Tracking token", ""], bookingRows)}
      </div>
      <div class="db-pane" data-pane-panel="staff" hidden>
        ${tableHtml(["Admin ID", "Username", "Email", "Role"], staffRows)}
      </div>
    </section>`;
}

function bindAdminDatabase() {
  const toolbar = document.getElementById("db-toolbar");
  if (!toolbar) return;
  const search = document.getElementById("db-search");
  const exportBtn = document.getElementById("db-export");
  let current = "packages";
  const show = (name) => {
    current = name;
    toolbar.querySelectorAll("[data-pane]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.pane === name);
    });
    document.querySelectorAll("[data-pane-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panePanel !== name;
    });
    filterRows();
  };
  const filterRows = () => {
    const q = (search.value || "").trim().toLowerCase();
    const panel = document.querySelector(`[data-pane-panel="${current}"]`);
    if (!panel) return;
    panel.querySelectorAll("tbody tr").forEach((tr) => {
      tr.style.display = !q || tr.innerText.toLowerCase().includes(q) ? "" : "none";
    });
  };
  toolbar.onclick = (e) => {
    const btn = e.target.closest("[data-pane]");
    if (btn) show(btn.dataset.pane);
  };
  search.oninput = filterRows;
  exportBtn.onclick = () => {
    if (!dbSnapshot) return;
    const exporters = {
      packages: () =>
        downloadCsv(
          "stella-packages.csv",
          ["package_id", "package_name", "event_category", "base_price", "min_pax", "is_available"],
          dbSnapshot.packages.map((p) => [p.packageId, p.packageName, p.eventCategory, p.basePrice, p.minPax, p.isAvailable])
        ),
      inclusions: () =>
        downloadCsv(
          "stella-inclusions.csv",
          ["package_id", "package_name", "sort_order", "inclusion_text"],
          dbSnapshot.inclusions.map((i) => [i.packageId, i.packageName, i.sortOrder, i.inclusionText])
        ),
      customers: () =>
        downloadCsv(
          "stella-customers.csv",
          ["customer_id", "full_name", "contact_number", "email"],
          dbSnapshot.customers.map((c) => [c.customerId, c.fullName, c.contactNumber, c.email])
        ),
      bookings: () =>
        downloadCsv(
          "stella-bookings.csv",
          ["booking_id", "customer", "package", "event_date", "guest_count", "venue", "status", "tracking_token"],
          dbSnapshot.bookings.map((b) => [
            b.bookingId,
            b.customer?.fullName,
            b.package?.packageName,
            b.eventDate,
            b.guestCount,
            b.venueLocation,
            b.status,
            b.trackingToken,
          ])
        ),
      staff: () =>
        downloadCsv(
          "stella-staff.csv",
          ["admin_id", "username", "email", "role"],
          dbSnapshot.staff
            ? [[dbSnapshot.staff.adminId, dbSnapshot.staff.username, dbSnapshot.staff.email, dbSnapshot.staff.role]]
            : []
        ),
    };
    exporters[current]();
  };
  document.querySelectorAll("[data-del-customer]").forEach((btn) => {
    btn.onclick = async () => {
      const count = Number(btn.dataset.bookings || 0);
      const extra = count ? ` Linked bookings (${count}) will also be removed.` : "";
      if (!confirm(`Delete this customer record from the database?${extra}`)) return;
      try {
        await api.deleteCustomer(btn.dataset.delCustomer);
        render();
      } catch (err) {
        alert(err.message || "Could not delete the customer.");
      }
    };
  });
  document.querySelectorAll("[data-del-booking]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete this booking from the database?")) return;
      try {
        await api.deleteBooking(btn.dataset.delBooking);
        render();
      } catch (err) {
        alert(err.message || "Could not delete the booking.");
      }
    };
  });
}
