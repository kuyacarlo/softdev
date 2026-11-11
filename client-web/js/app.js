function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  return { parts, query, path: "/" + parts.join("/") };
}

function navHtml(route) {
  const admin = getAdminUser();
  const customer = getCustomerUser();
  const link = (href, label, match) =>
    `<a href="${href}" class="${route.path.startsWith(match) ? "active" : ""}">${label}</a>`;
  const signOut = `<button class="btn btn-ghost" id="logout">Sign out</button>`;
  if (admin) {
    return `
      ${link("#/admin/dashboard", "Dashboard", "/admin/dashboard")}
      ${link("#/book", "Book", "/book")}
      ${link("#/admin/reservations", "Reservations", "/admin/reservations")}
      ${link("#/admin/packages", "Packages", "/admin/packages")}
      ${link("#/admin/accounts", "Accounts", "/admin/accounts")}
      ${link("#/admin/database", "Database", "/admin/database")}
      ${signOut}
    `;
  }
  return `
    <a href="#/" class="${route.path === "/" ? "active" : ""}">Home</a>
    ${link("#/packages", "Packages", "/packages")}
    ${link("#/book", "Book", "/book")}
    ${link("#/track", "Track", "/track")}
    ${
      customer
        ? `${link("#/account", "Dashboard", "/account")} ${signOut}`
        : `${link("#/login", "Sign in", "/login")} <a class="btn btn-primary nav-cta" href="#/register">Create account</a>`
    }
  `;
}

function setNav() {
  const route = parseHash();
  document.getElementById("nav").innerHTML = navHtml(route);
  const staff = document.getElementById("staff-link");
  if (staff) staff.hidden = Boolean(getCustomerUser() || getAdminUser());
  document.body.classList.toggle("is-admin", Boolean(getAdminUser()));
  document.body.classList.toggle("is-customer", Boolean(getCustomerUser()));
  const logout = document.getElementById("logout");
  if (logout) {
    logout.onclick = async () => {
      const wasAdmin = Boolean(getAdminUser());
      try {
        await api.logout();
      } catch {
        /* still clear locally */
      }
      clearSession();
      location.hash = wasAdmin ? "#/admin" : "#/";
      render();
    };
  }
}

function nextAfterAuth() {
  const pending = sessionStorage.getItem("stella_next") || "#/account";
  sessionStorage.removeItem("stella_next");
  return pending.startsWith("#/") ? pending : "#/account";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function errorBox(err) {
  const details = Array.isArray(err.details)
    ? `<ul>${err.details
        .map((d) => {
          const field = d.field || (Array.isArray(d.path) ? d.path.join(".") : "");
          const msg = d.message || JSON.stringify(d);
          return `<li>${escapeHtml(field ? `${field}: ${msg}` : msg)}</li>`;
        })
        .join("")}</ul>`
    : "";
  return `<div class="alert">${escapeHtml(err.message)}${details}</div>`;
}

function packageCard(pkg) {
  return `
    <article class="card">
      <div class="card-media" style="background-image:url('${categoryImage(pkg.eventCategory)}')"></div>
      <div class="card-body">
        <span class="badge">${escapeHtml(pkg.eventCategory)}</span>
        <h3>${escapeHtml(pkg.packageName)}</h3>
        <p class="pkg-desc">${escapeHtml(packageDescription(pkg))}</p>
        <div class="price">${php(pkg.basePrice)}</div>
        <p class="muted">From ${pkg.minPax} guests · ${pkg.isAvailable ? "Available" : "Unavailable"}</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/packages/${pkg.packageId}">Details</a>
          ${pkg.isAvailable ? `<a class="btn btn-ghost" href="#/book?packageId=${pkg.packageId}">Book</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

async function viewHome() {
  const pkgs = await api.packages({ availableOnly: true });
  return `
    <section class="hero">
      <div>
        <div class="kicker">Casa de Stella Catering</div>
        <h1>Tables dressed for the days you will remember.</h1>
        <p class="lede">Choose a package, send a date request, and follow it from first inquiry to the last toast.</p>
        <div class="hero-actions">
          ${
            getCustomerUser() || getAdminUser()
              ? `<a class="btn btn-primary" href="#/book">Request a booking</a>`
              : `<a class="btn btn-primary" href="#/book">Book a date</a>`
          }
          <a class="btn btn-ghost" href="#/packages">View packages</a>
        </div>
      </div>
      <div class="hero-card">
        <span>Weddings, debuts, birthdays &amp; corporate tables</span>
        <p>Service for 30 guests and up, styled for Bulacan gatherings and beyond.</p>
      </div>
    </section>
    <section class="account-band">
      <div>
        <div class="kicker">Safe booking</div>
        <h2>How to book</h2>
        <p class="muted">Send a date request in four steps. The events team reviews availability and posts updates you can follow anytime.</p>
      </div>
      <ol class="account-steps">
        <li><strong>1. Choose a package</strong><span>Open Packages and pick the event style that fits your gathering</span></li>
        <li><strong>2. Open Book</strong><span>Enter the guest name, mobile, email, date, venue, and headcount</span></li>
        <li><strong>3. Submit the request</strong><span>Send it at least 7 days ahead; minimum guests follow the package</span></li>
        <li><strong>4. Track the reservation</strong><span>Save the tracking token and watch the status until the event day</span></li>
      </ol>
    </section>
    <section class="section">
      <div class="section-head">
        <h2>Featured packages</h2>
        <a href="#/packages">See all</a>
      </div>
      <div class="grid">${pkgs.data.map(packageCard).join("") || `<div class="empty">No packages are listed yet.</div>`}</div>
    </section>
  `;
}

async function viewPackages(route) {
  const category = route.query.category || "";
  const pkgs = await api.packages({
    category: category || undefined,
    availableOnly: true,
  });
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Catalog</div>
          <h2>Catering packages</h2>
        </div>
      </div>
      <div class="filters">
        <a class="chip ${!category ? "active" : ""}" href="#/packages">All</a>
        ${CATEGORIES.map(
          (c) => `<a class="chip ${category === c ? "active" : ""}" href="#/packages?category=${encodeURIComponent(c)}">${c}</a>`
        ).join("")}
      </div>
      <div class="grid" style="margin-top:1.2rem">
        ${pkgs.data.length ? pkgs.data.map(packageCard).join("") : `<div class="empty">No packages in this category.</div>`}
      </div>
    </section>
  `;
}

async function viewPackage(id) {
  const { data: pkg } = await api.package(id);
  const inclusions = (pkg.inclusions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <section class="section detail">
      <div class="detail-media" style="background-image:url('${categoryImage(pkg.eventCategory)}')"></div>
      <div>
        <div class="kicker">${escapeHtml(pkg.eventCategory)}</div>
        <h2>${escapeHtml(pkg.packageName)}</h2>
        <p class="lede">${escapeHtml(packageDescription(pkg))}</p>
        <div class="price">${php(pkg.basePrice)}</div>
        <p class="muted">Minimum ${pkg.minPax} guests</p>
        <h3>Inclusions</h3>
        <ul class="list">${inclusions || "<li>Details to be confirmed with the events team.</li>"}</ul>
        <div class="hero-actions">
          ${
            pkg.isAvailable
              ? `<a class="btn btn-primary" href="#/book?packageId=${pkg.packageId}">Book this package</a>`
              : `<div class="notice">This package is currently unavailable.</div>`
          }
        </div>
      </div>
    </section>
  `;
}

function localISODate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MIN_LEAD_DAYS = 7;

async function viewBook(route) {
  const customer = getCustomerUser();
  const admin = getAdminUser();
  if (!customer && !admin) {
    if (route.query.packageId) sessionStorage.setItem("stella_next", `#/book?packageId=${encodeURIComponent(route.query.packageId)}`);
    else sessionStorage.setItem("stella_next", "#/book");
    return `
      <div class="login-wrap">
        <div class="kicker">Secure booking</div>
        <h2>Sign in to request a date</h2>
        <p class="muted">Create an account first, or sign in as staff to book for a guest.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/login">Sign in</a>
          <a class="btn btn-ghost" href="#/register">Create an account</a>
        </div>
      </div>`;
  }
  const pkgs = await api.packages({ availableOnly: true });
  const selected = route.query.packageId || (pkgs.data[0] && String(pkgs.data[0].packageId)) || "";
  const email = customer?.email || "";
  return `
    <section class="section">
      <div class="kicker">${admin ? "Staff booking" : "Your booking"}</div>
      <h2>Request your date</h2>
      <p class="muted">${
        admin
          ? "Book on behalf of a guest. Philippine mobile numbers only. At least " + MIN_LEAD_DAYS + " days ahead; guest minimum follows the selected package."
          : `We’ll confirm availability with the events team. Booked under <strong>${escapeHtml(email)}</strong>. Philippine mobile numbers only. Book at least ${MIN_LEAD_DAYS} days ahead; guest minimum follows the selected package.`
      }</p>
      <form class="form two" id="book-form">
        <label>Full name<input name="fullName" required minlength="2" value="${escapeHtml(customer?.fullName || "")}" /></label>
        <label>Mobile number<input name="contactNumber" required pattern="^(09|\\+639)\\d{9}$" value="${escapeHtml(customer?.contactNumber || "")}" /></label>
        <label>Email<input name="email" type="email" required value="${escapeHtml(email)}" ${customer ? "readonly" : ""} /></label>
        <label>Package
          <select name="packageId" required>
            ${pkgs.data
              .map(
                (p) =>
                  `<option value="${p.packageId}" data-min-pax="${p.minPax}" ${String(p.packageId) === selected ? "selected" : ""}>${escapeHtml(p.packageName)} · ${php(p.basePrice)} · min ${p.minPax}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>Event date<input name="eventDate" type="date" required min="${localISODate(MIN_LEAD_DAYS)}" /></label>
        <label>Guest count<input name="guestCount" type="number" required min="30" value="50" /></label>
        <label class="span-2">Venue<input name="venueLocation" required minlength="5" placeholder="Hiyas Convention Center, Malolos, Bulacan" /></label>
        <label class="span-2">Design &amp; theme notes<textarea name="designThemeNotes" maxlength="1000" placeholder="Rustic garden theme with pastel floral accents"></textarea></label>
        <label class="span-2">Inspiration photo (optional, jpeg/png/webp/avif, max 5MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /></label>
        <div class="span-2" id="book-status"></div>
        <div class="span-2"><button class="btn btn-primary" type="submit">Submit booking request</button></div>
      </form>
    </section>
  `;
}

async function bindBook() {
  const form = document.getElementById("book-form");
  if (!form) return;
  const pkgSelect = form.elements.packageId;
  const guestInput = form.elements.guestCount;
  const syncMinPax = () => {
    const min = Number(pkgSelect.selectedOptions[0]?.dataset.minPax || 30);
    guestInput.min = String(min);
    if (Number(guestInput.value) < min) guestInput.value = String(min);
  };
  pkgSelect.onchange = syncMinPax;
  syncMinPax();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const status = document.getElementById("book-status");
    const btn = form.querySelector("button[type=submit]");
    const fd = new FormData(form);
    btn.disabled = true;
    status.innerHTML = `<div class="notice">Sending your request…</div>`;
    try {
      const phone = String(fd.get("contactNumber") || "").trim();
      if (!PHONE_RE.test(phone)) throw new Error("Use a Philippine mobile number such as 09171234567 or +639171234567.");
      const eventDate = String(fd.get("eventDate"));
      const minDate = localISODate(MIN_LEAD_DAYS);
      if (!eventDate || eventDate < minDate) {
        throw new Error(`Event date must be at least ${MIN_LEAD_DAYS} days in advance.`);
      }
      const minPax = Number(pkgSelect.selectedOptions[0]?.dataset.minPax || 30);
      const guestCount = Number(fd.get("guestCount"));
      if (!Number.isFinite(guestCount) || guestCount < minPax) {
        throw new Error(`This package requires a minimum of ${minPax} guests.`);
      }
      let referenceImageUrl;
      const photo = fd.get("photo");
      if (photo && photo.size) {
        if (photo.size > 5 * 1024 * 1024) throw new Error("Photo must be 5MB or smaller.");
        referenceImageUrl = await api.uploadImage(photo);
      }
      const payload = {
        fullName: String(fd.get("fullName")).trim(),
        contactNumber: phone,
        email: String(fd.get("email")).trim(),
        packageId: Number(fd.get("packageId")),
        eventDate,
        venueLocation: String(fd.get("venueLocation")).trim(),
        guestCount,
      };
      const notes = String(fd.get("designThemeNotes") || "").trim();
      if (notes) payload.designThemeNotes = notes;
      if (referenceImageUrl) payload.referenceImageUrl = referenceImageUrl;
      const created = await api.createBooking(payload);
      const token = created.data.trackingToken;
      const follow = getAdminUser()
        ? `<a class="btn btn-primary" href="#/admin/reservations">Open reservations</a>`
        : `<a class="btn btn-primary" href="#/track/${encodeURIComponent(token)}">Track this booking</a>`;
      status.innerHTML = `
        <div class="success">
          Booking #${created.data.bookingId} is ${created.data.status}. Save your tracking token:
          <div class="token-box">${escapeHtml(token)}</div>
          <p>${follow}</p>
        </div>`;
      form.reset();
    } catch (err) {
      status.innerHTML = errorBox(err);
    } finally {
      btn.disabled = false;
    }
  };
}

async function viewTrack(route) {
  const token = route.parts[1] || route.query.token || "";
  let body = "";
  if (token) {
    try {
      const { data } = await api.track(token);
      body = `
        <div class="card"><div class="card-body">
          <span class="badge ${escapeHtml(data.status)}">${escapeHtml(data.status)}</span>
          <h3>${escapeHtml(data.packageName)}</h3>
          <p>${escapeHtml(data.eventCategory)} · ${php(data.basePrice)}</p>
          <p><strong>${escapeHtml(data.customerName)}</strong></p>
          <p>${formatDate(data.eventDate)} · ${data.guestCount} guests</p>
          <p>${escapeHtml(data.venueLocation)}</p>
          ${data.designThemeNotes ? `<p class="muted">${escapeHtml(data.designThemeNotes)}</p>` : ""}
          ${data.referenceImageUrl ? `<img alt="Inspiration" src="${escapeHtml(data.referenceImageUrl)}" style="margin-top:1rem;border-radius:16px;max-height:280px;object-fit:cover" />` : ""}
          <p class="muted">Updated ${formatDate(data.updatedAt)}</p>
        </div></div>`;
    } catch (err) {
      body = errorBox(err);
    }
  }
  return `
    <section class="section">
      <div class="kicker">Guest tracking</div>
      <h2>Follow your reservation</h2>
      <form class="form" id="track-form" style="max-width:560px;margin-bottom:1.5rem">
        <label>Tracking token<input name="token" required minlength="10" value="${escapeHtml(token)}" placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890" /></label>
        <button class="btn btn-primary" type="submit">Look up</button>
      </form>
      ${body}
    </section>
  `;
}

function bindTrack() {
  const form = document.getElementById("track-form");
  if (!form) return;
  form.onsubmit = (e) => {
    e.preventDefault();
    const token = new FormData(form).get("token");
    location.hash = `#/track/${encodeURIComponent(String(token).trim())}`;
  };
}

function authSwitch(text, href, label) {
  return `<p class="auth-switch">${text} <a href="${href}">${label}</a></p>`;
}

function passwordField(attrs = "required minlength=\"6\" autocomplete=\"current-password\"", label = "Password") {
  return `<label>${label}
    <span class="password-field">
      <input name="password" type="password" ${attrs} />
      <button class="password-toggle" type="button">Show</button>
    </span>
  </label>`;
}

function bindPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((btn) => {
    btn.onclick = () => {
      const input = btn.previousElementSibling;
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
    };
  });
}

function signInHtml() {
  return `
    <div class="login-wrap">
      <div class="kicker">Account</div>
      <h2>Sign in</h2>
      <form class="form" id="sign-in-form">
        <label>Email or username
          <input name="account" required autocomplete="username" placeholder="you@email.com" />
        </label>
        ${passwordField()}
        <div id="login-status"></div>
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>
      <p class="auth-switch"><a href="#/forgot">Forgot password?</a></p>
      ${authSwitch("New guest?", "#/register", "Create an account")}
    </div>
  `;
}

async function viewCustomerLogin() {
  if (getAdminUser()) {
    location.hash = "#/admin/dashboard";
    return "";
  }
  if (getCustomerUser()) {
    location.hash = nextAfterAuth();
    return "";
  }
  return signInHtml();
}

async function signInAsStaff(account, password) {
  const res = await api.login({ account, username: account, email: account, password });
  setSession(res.data.token, { ...res.data.user, role: "admin" });
  location.hash = "#/admin/dashboard";
}

function bindSignIn() {
  bindPasswordToggles();
  const form = document.getElementById("sign-in-form");
  if (!form) return;
  const staffOnly = form.dataset.role === "admin";
  form.onsubmit = async (e) => {
    e.preventDefault();
    const status = document.getElementById("login-status");
    const fd = new FormData(form);
    const account = String(fd.get("account") || "").trim();
    const password = String(fd.get("password") || "");
    try {
      if (!staffOnly) {
        try {
          const res = await api.customerLogin({ account, password });
          setSession(res.data.token, res.data.user);
          location.hash = nextAfterAuth();
          return;
        } catch {
          /* try staff credentials next */
        }
      }
      await signInAsStaff(account, password);
    } catch (err) {
      status.innerHTML = errorBox(err);
    }
  };
}

async function viewRegister() {
  if (getAdminUser()) {
    location.hash = "#/admin/dashboard";
    return "";
  }
  if (getCustomerUser()) {
    location.hash = "#/book";
    return "";
  }
  return `
    <div class="login-wrap">
      <div class="kicker">Create account</div>
      <h2>Join Casa de Stella</h2>
      <p class="muted">Choose a username so you can sign in with that name or your email.</p>
      <form class="form" id="register-form">
        <label>Full name<input name="fullName" required minlength="2" autocomplete="name" placeholder="Maria Santos" /></label>
        <label>Username<input name="username" required minlength="3" maxlength="32" autocomplete="username" placeholder="maria.santos" pattern="[A-Za-z][A-Za-z0-9._]{2,31}" /></label>
        <label>Mobile number<input name="contactNumber" required pattern="^(09|\\+639)\\d{9}$" placeholder="09171234567" /></label>
        <label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@email.com" /></label>
        ${passwordField("required minlength=\"8\" autocomplete=\"new-password\"")}
        <div id="register-status"></div>
        <button class="btn btn-primary" type="submit">Create account</button>
      </form>
      ${authSwitch("Already have an account?", "#/login", "Sign in")}
    </div>
  `;
}

function bindRegister() {
  bindPasswordToggles();
  const form = document.getElementById("register-form");
  if (!form) return;
  const status = document.getElementById("register-status");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const phone = String(fd.get("contactNumber") || "").trim();
    if (!PHONE_RE.test(phone)) {
      status.innerHTML = errorBox(new Error("Use a Philippine mobile number such as 09171234567 or +639171234567."));
      return;
    }
    try {
      const res = await api.register({
        fullName: String(fd.get("fullName")).trim(),
        username: assertUsername(String(fd.get("username")).trim()),
        contactNumber: phone,
        email: assertEmail(String(fd.get("email")).trim()),
        password: String(fd.get("password")),
      });
      setSession(res.data.token, res.data.user);
      location.hash = nextAfterAuth();
    } catch (err) {
      status.innerHTML = errorBox(err);
    }
  };
}

async function viewForgot() {
  if (getCustomerUser() || getAdminUser()) {
    location.hash = getAdminUser() ? "#/admin/dashboard" : "#/account";
    return "";
  }
  return `
    <div class="login-wrap">
      <div class="kicker">Account recovery</div>
      <h2>Reset password</h2>
      <p class="muted">We’ll email an OTP to the Gmail on the account. Enter that code with a new password.</p>
      <form class="form" id="reset-form">
        <label>Username<input name="username" required minlength="3" maxlength="32" autocomplete="username" /></label>
        <label>Gmail<input name="email" type="email" required autocomplete="email" /></label>
        <label>Gmail verification code
          <input class="otp-input" name="otp" inputmode="numeric" maxlength="6" pattern="\\d{6}" autocomplete="one-time-code" placeholder="000000" />
        </label>
        ${passwordField("required minlength=\"8\" autocomplete=\"new-password\"", "New password")}
        <div id="reset-status"></div>
        <div class="otp-actions">
          <button class="btn btn-ghost" type="button" id="send-reset-otp">Email me a code</button>
          <button class="btn btn-primary" type="submit">Update password</button>
        </div>
      </form>
      ${authSwitch("Remembered it?", "#/login", "Sign in")}
    </div>
  `;
}

function bindReset() {
  bindPasswordToggles();
  const form = document.getElementById("reset-form");
  if (!form) return;
  const status = document.getElementById("reset-status");
  const sendBtn = document.getElementById("send-reset-otp");
  sendBtn.onclick = async () => {
    try {
      sendBtn.disabled = true;
      const fd = new FormData(form);
      const res = await api.sendOtp({
        purpose: "reset",
        username: assertUsername(String(fd.get("username")).trim()),
        email: assertEmail(String(fd.get("email")).trim()),
      });
      status.innerHTML = `<div class="success">${escapeHtml(res.message || "Code sent. Check your Gmail.")}</div>`;
    } catch (err) {
      status.innerHTML = errorBox(err);
    } finally {
      sendBtn.disabled = false;
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await api.resetPassword({
        username: assertUsername(String(fd.get("username")).trim()),
        email: assertEmail(String(fd.get("email")).trim()),
        password: String(fd.get("password")),
        otp: String(fd.get("otp") || "").trim(),
      });
      status.innerHTML = `<div class="success">Password updated. You can sign in now.</div>`;
      setTimeout(() => {
        location.hash = "#/login";
      }, 700);
    } catch (err) {
      status.innerHTML = errorBox(err);
    }
  };
}

function countByStatus(list) {
  return list.reduce((acc, b) => {
    const key = b.status || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function viewAccount() {
  const customer = getCustomerUser();
  if (!customer) {
    location.hash = "#/login";
    return "";
  }
  const { data } = await api.myBookings();
  const counts = countByStatus(data);
  const cards = data
    .map(
      (b) => `
      <article class="card"><div class="card-body">
        <span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span>
        <h3>${escapeHtml(b.package?.packageName || "Booking")}</h3>
        <p>${formatDate(b.eventDate)} · ${b.guestCount} guests</p>
        <p>${escapeHtml(b.venueLocation)}</p>
        <p class="muted">Token: ${escapeHtml(b.trackingToken)}</p>
        <a class="btn btn-ghost" href="#/track/${encodeURIComponent(b.trackingToken)}">Track</a>
      </div></article>`
    )
    .join("");
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Dashboard</div>
          <h2>${escapeHtml(customer.fullName)}</h2>
          <p class="muted">@${escapeHtml(customer.username || "guest")} · ${escapeHtml(customer.email)} · ${escapeHtml(customer.contactNumber)}</p>
        </div>
        <a class="btn btn-primary" href="#/book">New booking</a>
      </div>
      <div class="db-stats">
        <article><span>Reservations</span><strong>${data.length}</strong></article>
        <article><span>Pending</span><strong>${counts.Pending || 0}</strong></article>
        <article><span>Confirmed</span><strong>${counts.Confirmed || 0}</strong></article>
        <article><span>Completed</span><strong>${counts.Completed || 0}</strong></article>
      </div>
      <div class="dash-actions">
        <a href="#/book"><strong>Request a date</strong><span>Choose a package and send a booking request.</span></a>
        <a href="#/packages"><strong>Browse packages</strong><span>Read descriptions and inclusions before you book.</span></a>
        <a href="#/track"><strong>Track a reservation</strong><span>Enter your token to follow status updates.</span></a>
      </div>
      <div class="section-head"><h3>Your reservations</h3></div>
      <div class="grid">${cards || `<div class="empty">No reservations yet. <a href="#/book">Request a date</a>.</div>`}</div>
    </section>
  `;
}

async function viewAdminDashboard() {
  if (!requireAdmin()) return "";
  const [bookings, packages] = await Promise.all([api.bookings(), api.packages()]);
  const list = bookings.data || [];
  const pkgs = packages.data || [];
  const counts = countByStatus(list);
  const upcoming = [...list]
    .sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)))
    .slice(0, 6);
  const rows = upcoming
    .map(
      (b) => `
      <tr>
        <td>#${b.bookingId}</td>
        <td>${escapeHtml(b.customer?.fullName || "—")}</td>
        <td>${escapeHtml(b.package?.packageName || "—")}</td>
        <td>${formatDate(b.eventDate)}</td>
        <td><span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></td>
        <td><a href="#/admin/reservations/${b.bookingId}">Open</a></td>
      </tr>`
    )
    .join("");
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Admin</div>
          <h2>Dashboard</h2>
        </div>
        ${adminSubnav("dashboard")}
      </div>
      <div class="db-stats">
        <article><span>Total reservations</span><strong>${list.length}</strong></article>
        <article><span>Pending</span><strong>${counts.Pending || 0}</strong></article>
        <article><span>Confirmed</span><strong>${counts.Confirmed || 0}</strong></article>
        <article><span>Packages</span><strong>${pkgs.length}</strong></article>
      </div>
      <div class="dash-actions">
        <a href="#/admin/reservations?status=Pending"><strong>Review pending</strong><span>${counts.Pending || 0} request${(counts.Pending || 0) === 1 ? "" : "s"} waiting for a decision.</span></a>
        <a href="#/admin/packages"><strong>Manage packages</strong><span>Edit names, prices, and descriptions guests see.</span></a>
        <a href="#/admin/accounts"><strong>Guest accounts</strong><span>Set accounts active or inactive.</span></a>
        <a href="#/admin/database"><strong>Database</strong><span>Inspect tables, guests, and reservation records.</span></a>
      </div>
      <div class="section-head">
        <h3>Upcoming requests</h3>
        <a href="#/admin/reservations">All reservations</a>
      </div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>ID</th><th>Guest</th><th>Package</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No reservations yet.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

async function viewAdminLogin() {
  if (getCustomerUser()) {
    location.hash = "#/";
    return "";
  }
  if (getAdminUser()) {
    location.hash = "#/admin/dashboard";
    return "";
  }
  return `
    <div class="login-wrap">
      <div class="kicker">Staff</div>
      <h2>Sign in</h2>
      <form class="form" id="sign-in-form" data-role="admin">
        <label>Email or username
          <input name="account" required autocomplete="username" placeholder="admin@stellascatering.com" />
        </label>
        ${passwordField()}
        <div id="login-status"></div>
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>
    </div>
  `;
}

function requireAdmin() {
  if (getCustomerUser()) {
    location.hash = "#/";
    return false;
  }
  if (!getAdminUser()) {
    location.hash = "#/admin";
    return false;
  }
  return true;
}

async function viewAdminAccounts() {
  if (!requireAdmin()) return "";
  const { data } = await api.customers();
  const rows = data
    .filter((c) => c.hasAccount !== false)
    .map((c) => {
      const active = c.isActive !== false;
      return `
      <tr>
        <td>#${c.customerId}</td>
        <td>${escapeHtml(c.fullName)}</td>
        <td>${escapeHtml(c.username || "—")}</td>
        <td>${escapeHtml(c.email)}</td>
        <td>${escapeHtml(c.contactNumber)}</td>
        <td>${c.bookingCount}</td>
        <td><span class="badge ${active ? "Confirmed" : "Declined"}">${active ? "Active" : "Inactive"}</span></td>
        <td>
          <button class="btn ${active ? "btn-ghost" : "btn-primary"}" type="button" data-set-active="${c.customerId}" data-active="${active ? "0" : "1"}">
            ${active ? "Set inactive" : "Set active"}
          </button>
        </td>
      </tr>`;
    })
    .join("");
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Admin</div>
          <h2>Guest accounts</h2>
        </div>
        ${adminSubnav("accounts")}
      </div>
      <div id="account-msg"></div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Email</th><th>Mobile</th><th>Reservations</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">No guest accounts yet.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function bindAccountStatus() {
  document.querySelectorAll("[data-set-active]").forEach((btn) => {
    btn.onclick = async () => {
      const msg = document.getElementById("account-msg");
      const next = btn.dataset.active === "1";
      try {
        const res = await api.setCustomerActive(btn.dataset.setActive, next);
        if (msg) msg.innerHTML = `<div class="success">${escapeHtml(res.message || (next ? "Account is now active." : "Account is now inactive."))}</div>`;
        render();
      } catch (err) {
        if (msg) msg.innerHTML = errorBox(err);
      }
    };
  });
}

async function viewAdminBookings(route) {
  if (!requireAdmin()) return "";
  const status = route.query.status || "";
  const tokenQ = String(route.query.token || "").trim();
  const list = await api.bookings({
    status: status || undefined,
    startDate: route.query.startDate || undefined,
    endDate: route.query.endDate || undefined,
  });
  const needle = tokenQ.toLowerCase();
  const filtered = needle
    ? (list.data || []).filter((b) => String(b.trackingToken || "").toLowerCase().includes(needle))
    : list.data || [];
  const rows = filtered
    .map(
      (b) => `
      <tr>
        <td>#${b.bookingId}</td>
        <td>${escapeHtml(b.customer?.fullName || "—")}</td>
        <td>${escapeHtml(b.package?.packageName || "—")}</td>
        <td>${formatDate(b.eventDate)}</td>
        <td>${b.guestCount}</td>
        <td><code class="token-mini">${escapeHtml(b.trackingToken || "")}</code></td>
        <td><span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></td>
        <td>
          <a href="#/admin/reservations/${b.bookingId}">Open</a>
          · <button class="btn btn-ghost" type="button" data-del-booking="${b.bookingId}">Delete</button>
        </td>
      </tr>`
    )
    .join("");
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Admin</div>
          <h2>Reservations</h2>
        </div>
        ${adminSubnav("reservations")}
      </div>
      <form class="toolbar" id="booking-filters">
        <input name="token" value="${escapeHtml(tokenQ)}" placeholder="Search tracking token" autocomplete="off" />
        <select name="status">
          <option value="">All statuses</option>
          ${STATUSES.map((s) => `<option ${status === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
        <input type="date" name="startDate" value="${escapeHtml(route.query.startDate || "")}" />
        <input type="date" name="endDate" value="${escapeHtml(route.query.endDate || "")}" />
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>ID</th><th>Guest</th><th>Package</th><th>Date</th><th>Pax</th><th>Token</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8">${tokenQ ? "No reservation matches that token." : "No reservations yet."}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function bindRecordDeletes() {
  document.querySelectorAll("[data-del-booking]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete this booking from the database?")) return;
      try {
        await api.deleteBooking(btn.dataset.delBooking);
        location.hash = "#/admin/reservations";
        render();
      } catch (err) {
        alert(err.message || "Could not delete the booking.");
      }
    };
  });
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
}

function bindBookingFilters() {
  const form = document.getElementById("booking-filters");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const token = String(fd.get("token") || "").trim();
    const q = new URLSearchParams();
    for (const key of ["token", "status", "startDate", "endDate"]) {
      const v = String(fd.get(key) || "").trim();
      if (v) q.set(key, v);
    }
    if (token) {
      try {
        const list = await api.bookings();
        const exact = (list.data || []).filter(
          (b) => String(b.trackingToken || "").toLowerCase() === token.toLowerCase()
        );
        if (exact.length === 1) {
          location.hash = `#/admin/reservations/${exact[0].bookingId}`;
          return;
        }
      } catch {
        /* fall through to filtered list */
      }
    }
    location.hash = `#/admin/reservations${q.toString() ? "?" + q : ""}`;
  };
}

async function viewAdminBooking(id) {
  if (!requireAdmin()) return "";
  const { data: b } = await api.booking(id);
  return `
    <section class="section">
      <a href="#/admin/reservations">← All reservations</a>
      <h2>Reservation #${b.bookingId}</h2>
      <p><span class="badge ${escapeHtml(b.status)}">${escapeHtml(b.status)}</span></p>
      <p><strong>${escapeHtml(b.customer?.fullName)}</strong> · ${escapeHtml(b.customer?.contactNumber)} · ${escapeHtml(b.customer?.email)}</p>
      <p>${escapeHtml(b.package?.packageName)} · ${formatDate(b.eventDate)} · ${b.guestCount} guests</p>
      <p>${escapeHtml(b.venueLocation)}</p>
      ${b.designThemeNotes ? `<p class="muted">${escapeHtml(b.designThemeNotes)}</p>` : ""}
      <p class="muted">Token: ${escapeHtml(b.trackingToken)}</p>
      <form class="form" id="status-form" style="max-width:480px;margin-top:1.5rem">
        <label>Update status
          <select name="status">
            ${STATUSES.map((s) => `<option ${b.status === s ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </label>
        <label>Internal notes<input name="notes" placeholder="Confirmed after phone consultation" /></label>
        <div id="status-msg"></div>
        <button class="btn btn-primary" type="submit">Save status</button>
      </form>
      <p style="margin-top:1.5rem">
        <button class="btn btn-danger" type="button" data-del-booking="${b.bookingId}">Delete reservation</button>
      </p>
    </section>
  `;
}

function bindStatusForm(id) {
  const form = document.getElementById("status-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const msg = document.getElementById("status-msg");
    try {
      const body = { status: String(fd.get("status")) };
      const notes = String(fd.get("notes") || "").trim();
      if (notes) body.notes = notes;
      await api.updateBookingStatus(id, body);
      msg.innerHTML = `<div class="success">Status updated.</div>`;
      render();
    } catch (err) {
      msg.innerHTML = errorBox(err);
    }
  };
}

function inclusionRows(list = [""]) {
  return list
    .map(
      (item) =>
        `<div class="toolbar"><input name="inclusion" value="${escapeHtml(item)}" placeholder="5-course buffet" /><button type="button" class="btn btn-ghost remove-inc">Remove</button></div>`
    )
    .join("");
}

async function viewAdminPackages() {
  if (!requireAdmin()) return "";
  const { data } = await api.packages();
  const rows = data
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.packageName)}</td>
        <td>${escapeHtml(p.eventCategory)}</td>
        <td>${php(p.basePrice)}</td>
        <td>${p.minPax}</td>
        <td>${p.isAvailable ? "Yes" : "No"}</td>
        <td>
          <a href="#/admin/packages/${p.packageId}">Edit</a>
          · <button class="btn btn-ghost" data-del="${p.packageId}">Delete</button>
        </td>
      </tr>`
    )
    .join("");
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <div class="kicker">Admin</div>
          <h2>Packages</h2>
        </div>
        <div class="hero-actions">
          ${adminSubnav("packages")}
          <a class="btn btn-primary" href="#/admin/packages/new">New package</a>
        </div>
      </div>
      <div id="pkg-msg"></div>
      <div style="overflow:auto">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Min pax</th><th>Available</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6">No packages.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function bindPackageDeletes() {
  document.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm("Delete or deactivate this package?")) return;
      const msg = document.getElementById("pkg-msg");
      try {
        const res = await api.deletePackage(btn.dataset.del);
        msg.innerHTML = `<div class="success">${escapeHtml(res.message || "Done.")}</div>`;
        render();
      } catch (err) {
        msg.innerHTML = errorBox(err);
      }
    };
  });
}

async function viewPackageForm(id) {
  if (!requireAdmin()) return "";
  const isNew = !id || id === "new";
  const pkg = isNew ? { inclusions: [""], isAvailable: true, minPax: 50 } : (await api.package(id)).data;
  return `
    <section class="section">
      <a href="#/admin/packages">← Packages</a>
      <h2>${isNew ? "New package" : "Edit package"}</h2>
      <form class="form two" id="pkg-form">
        <label>Name<input name="packageName" required minlength="3" value="${escapeHtml(pkg.packageName || "")}" /></label>
        <label>Category
          <select name="eventCategory">
            ${CATEGORIES.map((c) => `<option ${pkg.eventCategory === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </label>
        <label>Base price<input name="basePrice" type="number" min="1" step="1" required value="${pkg.basePrice || ""}" /></label>
        <label>Minimum pax<input name="minPax" type="number" min="30" required value="${pkg.minPax || 30}" /></label>
        <label class="span-2">Description
          <textarea name="description" rows="3" maxlength="600" placeholder="What this package is for, the mood of the table, and who it suits.">${escapeHtml(pkg.description || "")}</textarea>
        </label>
        <label>Available
          <select name="isAvailable">
            <option value="true" ${pkg.isAvailable ? "selected" : ""}>Yes</option>
            <option value="false" ${!pkg.isAvailable ? "selected" : ""}>No</option>
          </select>
        </label>
        <div class="span-2">
          <p>Inclusions</p>
          <div id="inc-list">${inclusionRows(pkg.inclusions && pkg.inclusions.length ? pkg.inclusions : [""])}</div>
          <button type="button" class="btn btn-ghost" id="add-inc">Add inclusion</button>
        </div>
        <div class="span-2" id="pkg-form-msg"></div>
        <div class="span-2"><button class="btn btn-primary" type="submit">Save package</button></div>
      </form>
    </section>
  `;
}

function bindPackageForm(id) {
  const form = document.getElementById("pkg-form");
  if (!form) return;
  const list = document.getElementById("inc-list");
  document.getElementById("add-inc").onclick = () => {
    list.insertAdjacentHTML("beforeend", inclusionRows([""]));
  };
  list.onclick = (e) => {
    if (e.target.classList.contains("remove-inc")) e.target.parentElement.remove();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const msg = document.getElementById("pkg-form-msg");
    const inclusions = [...form.querySelectorAll('input[name="inclusion"]')]
      .map((i) => i.value.trim())
      .filter(Boolean);
    const body = {
      packageName: String(fd.get("packageName")).trim(),
      eventCategory: String(fd.get("eventCategory")),
      basePrice: Number(fd.get("basePrice")),
      minPax: Number(fd.get("minPax")),
      isAvailable: fd.get("isAvailable") === "true",
      description: String(fd.get("description") || "").trim(),
      inclusions,
    };
    try {
      if (!id || id === "new") await api.createPackage(body);
      else await api.updatePackage(id, body);
      location.hash = "#/admin/packages";
    } catch (err) {
      msg.innerHTML = errorBox(err);
    }
  };
}

async function render() {
  const app = document.getElementById("app");
  const route = parseHash();
  setNav();
  if (route.path.startsWith("/admin") && getCustomerUser()) {
    location.hash = "#/";
    return;
  }
  app.innerHTML = `<section class="section"><p class="muted">Loading…</p></section>`;
  try {
    const p = route.parts;
    if (p.length === 0) {
      app.innerHTML = await viewHome();
    } else if (p[0] === "packages" && p[1]) {
      app.innerHTML = await viewPackage(p[1]);
    } else if (p[0] === "packages") {
      app.innerHTML = await viewPackages(route);
    } else if (p[0] === "book") {
      app.innerHTML = await viewBook(route);
      await bindBook();
    } else if (p[0] === "login") {
      app.innerHTML = await viewCustomerLogin();
      bindSignIn();
    } else if (p[0] === "register") {
      app.innerHTML = await viewRegister();
      bindRegister();
    } else if (p[0] === "verify") {
      location.hash = "#/register";
      return;
    } else if (p[0] === "forgot" || p[0] === "reset") {
      app.innerHTML = await viewForgot();
      bindReset();
    } else if (p[0] === "account" || p[0] === "dashboard") {
      app.innerHTML = await viewAccount();
    } else if (p[0] === "track") {
      app.innerHTML = await viewTrack(route);
      bindTrack();
    } else if (p[0] === "admin" && p[1] === "dashboard") {
      app.innerHTML = await viewAdminDashboard();
    } else if (p[0] === "admin" && (p[1] === "bookings" || p[1] === "reservations") && p[2]) {
      app.innerHTML = await viewAdminBooking(p[2]);
      bindStatusForm(p[2]);
      bindRecordDeletes();
    } else if (p[0] === "admin" && (p[1] === "bookings" || p[1] === "reservations")) {
      app.innerHTML = await viewAdminBookings(route);
      bindBookingFilters();
      bindRecordDeletes();
    } else if (p[0] === "admin" && p[1] === "packages" && p[2]) {
      app.innerHTML = await viewPackageForm(p[2]);
      bindPackageForm(p[2]);
    } else if (p[0] === "admin" && p[1] === "packages") {
      app.innerHTML = await viewAdminPackages();
      bindPackageDeletes();
    } else if (p[0] === "admin" && p[1] === "accounts") {
      app.innerHTML = await viewAdminAccounts();
      bindAccountStatus();
    } else if (p[0] === "admin" && p[1] === "database") {
      app.innerHTML = await viewAdminDatabase();
      bindAdminDatabase();
    } else if (p[0] === "admin") {
      if (getCustomerUser()) {
        location.hash = "#/";
        return;
      }
      if (getAdminUser()) {
        location.hash = "#/admin/dashboard";
        return;
      }
      app.innerHTML = await viewAdminLogin();
      bindSignIn();
    } else {
      app.innerHTML = `<section class="section"><h2>Page not found</h2><a href="#/">Go home</a></section>`;
    }
  } catch (err) {
    if (String(err.message).toLowerCase().includes("unauthorized") || err.status === 401) {
      const wasAdmin = Boolean(getAdminUser());
      clearSession();
      location.hash = wasAdmin ? "#/admin" : "#/login";
      return;
    }
    app.innerHTML = `<section class="section">${errorBox(err)}</section>`;
  }
  document.title = "Casa de Stella Catering";
}

window.addEventListener("hashchange", render);
render();
