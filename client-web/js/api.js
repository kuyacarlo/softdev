const API_BASE =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost/stella-catering"
    : "";
const TOKEN_KEY = "stella_session_token";
const USER_KEY = "stella_session_user";

(function migrateLegacySession() {
  if (localStorage.getItem(TOKEN_KEY)) return;
  const oldToken = localStorage.getItem("stella_admin_token");
  const oldUser = localStorage.getItem("stella_admin_user");
  if (!oldToken) return;
  localStorage.setItem(TOKEN_KEY, oldToken);
  if (oldUser) {
    try {
      const user = JSON.parse(oldUser);
      user.role = user.role || "admin";
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }
})();

const CATEGORIES = ["Wedding", "Debut", "Birthday", "Corporate", "Special Event"];
const STATUSES = ["Pending", "Confirmed", "Declined", "Completed", "Cancelled"];
const PHONE_RE = /^(09|\+639)\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9._]{2,31}$/;
const IMAGE_TYPE_BY_EXT = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

function imageContentType(file) {
  if (file.type && /^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file.type;
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  return IMAGE_TYPE_BY_EXT[ext] || file.type || "application/octet-stream";
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getSessionUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function getAdminUser() {
  const user = getSessionUser();
  return user && user.role === "admin" ? user : null;
}

function getCustomerUser() {
  const user = getSessionUser();
  return user && user.role === "customer" ? user : null;
}

function assertEmail(email) {
  const value = String(email || "").trim();
  if (!EMAIL_RE.test(value)) {
    throw new Error("Enter a valid email address.");
  }
  return value;
}

function assertUsername(username) {
  const value = String(username || "").trim();
  if (!USERNAME_RE.test(value)) {
    throw new Error("Username must be 3–32 characters, start with a letter, and use only letters, numbers, dots, or underscores.");
  }
  return value;
}

const PACKAGE_BLURBS = {
  "Grand Emerald Wedding Package":
    "A ceremonial wedding reception: layered buffet service, a grand couple backdrop, and uniformed banquet staff for 50 guests and up.",
  "Pearl Debut Ensemble":
    "An 18th-birthday table with roses-and-candles styling, a celebration cake station, and a coordinated debut program.",
  "Garden Birthday Celebration":
    "A festive birthday spread with dessert and pasta stations, a themed backdrop, and a drinks bar for family gatherings.",
  "Corporate Executive Service":
    "A professional lunch or cocktail service with registration support and on-site AV for meetings, launches, and company events.",
  "Intimate Special Event":
    "A smaller gathering menu with a tasting for the hosts, intimate table styling, and a dedicated banquet captain.",
};

function packageDescription(pkg) {
  const stored = String(pkg?.description || "").trim();
  if (stored) return stored;
  const named = PACKAGE_BLURBS[pkg?.packageName];
  if (named) return named;
  const bits = (pkg?.inclusions || []).slice(0, 2);
  if (bits.length) return bits.join(" · ");
  const category = String(pkg?.eventCategory || "event").toLowerCase();
  return `${pkg?.packageName || "This package"} for ${category} gatherings, from ${pkg?.minPax || 30} guests.`;
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("stella_admin_token");
  localStorage.removeItem("stella_admin_user");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (options.auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body:
      options.body && typeof options.body === "object" && !(options.body instanceof Blob)
        ? JSON.stringify(options.body)
        : options.body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const issues = Array.isArray(data.error?.issues) ? data.error.issues : data.details;
    const fromIssues = Array.isArray(issues)
      ? issues.map((i) => i.message).filter(Boolean).join(" ")
      : "";
    const err = new Error(data.message || fromIssues || `Request failed (${res.status})`);
    err.details = issues;
    err.code = typeof data.error === "string" ? data.error : data.error?.name;
    err.status = res.status;
    throw err;
  }
  return data;
}

function php(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value.includes("T") || value.includes(" ") ? value.replace(" ", "T") : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function categoryImage(category) {
  const map = {
    Wedding: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
    Debut: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1200&q=80",
    Birthday: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1200&q=80",
    Corporate: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
    "Special Event": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
  };
  return map[category] || map.Wedding;
}

const api = {
  health: () => request("/api/health"),
  packages: (params = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.availableOnly) q.set("availableOnly", "true");
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/api/packages${suffix}`);
  },
  package: (id) => request(`/api/packages/${id}`),
  createPackage: (body) => request("/api/packages", { method: "POST", body, auth: true }),
  updatePackage: (id, body) => request(`/api/packages/${id}`, { method: "PUT", body, auth: true }),
  deletePackage: (id) => request(`/api/packages/${id}`, { method: "DELETE", auth: true }),
  customers: () => request("/api/customers", { auth: true }),
  deleteCustomer: (id, opts = {}) =>
    request(`/api/customers/${id}${opts.keep ? "?keep=1" : ""}`, { method: "DELETE", auth: true }),
  setCustomerActive: (id, isActive) =>
    request(`/api/customers/${id}`, { method: "PATCH", body: { isActive }, auth: true }),
  deleteBooking: (id) => request(`/api/bookings/${id}`, { method: "DELETE", auth: true }),
  createBooking: (body) => request("/api/bookings", { method: "POST", body, auth: true }),
  myBookings: () => request("/api/my/bookings", { auth: true }),
  bookings: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);
    const suffix = q.toString() ? `?${q}` : "";
    return request(`/api/bookings${suffix}`, { auth: true });
  },
  booking: (id) => request(`/api/bookings/${id}`, { auth: true }),
  updateBookingStatus: (id, body) =>
    request(`/api/bookings/${id}/status`, { method: "PATCH", body, auth: true }),
  track: (token) => request(`/api/track/${encodeURIComponent(token)}`),
  login: (body) => request("/api/auth/login", { method: "POST", body }),
  customerLogin: (body) => request("/api/auth/customer-login", { method: "POST", body }),
  register: (body) => request("/api/auth/register", { method: "POST", body }),
  sendOtp: (body) => request("/api/auth/otp", { method: "POST", body }),
  resetPassword: (body) => request("/api/auth/reset", { method: "POST", body }),
  logout: () => request("/api/auth/logout", { method: "POST", auth: true }),
  me: () => request("/api/auth/me", { auth: true }),
  presign: (body) => request("/api/uploads/presigned-url", { method: "POST", body, auth: true }),
  async uploadImage(file) {
    const contentType = imageContentType(file);
    if (!/^image\/(jpeg|png|webp|avif)$/.test(contentType)) {
      throw new Error("Only JPEG, PNG, WebP, and AVIF image formats are allowed.");
    }
    const signed = await api.presign({
      filename: file.name,
      contentType,
      fileSize: file.size,
    });
    const { uploadUrl, publicUrl } = signed.data;
    const target = uploadUrl.startsWith("http") ? uploadUrl : `${API_BASE}${uploadUrl}`;
    const uploaded = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: file,
    });
    const result = await uploaded.json().catch(() => ({}));
    if (!uploaded.ok || result.success === false) {
      throw new Error(result.message || `Image upload failed (${uploaded.status})`);
    }
    return result.data?.publicUrl || publicUrl;
  },
};
