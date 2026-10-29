import { createClient } from "@supabase/supabase-js";
import "./style.css";

const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const groups = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
const icon = (paths) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const icons = {
 Dashboard: icon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 10h18M10 10v11"/>'),
 Donors: icon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>'),
 Inventory: icon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M3 15h18M7 6h2M7 12h2M7 18h2"/>'),
 Requests: icon('<path d="M7 17 17 7M7 7h10v10"/>'),
 Activity: icon('<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'),
 Accounts: icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'),
};
const date = (v) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const stamp = (v) =>
  new Date(v).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const day = (n) => new Date(Date.now() + n * 864e5).toISOString();
const passwordValid = (p) =>
  p.length >= 8 &&
  /[A-Z]/.test(p) &&
  /[a-z]/.test(p) &&
  /[0-9]/.test(p) &&
  /[^A-Za-z0-9]/.test(p);
let configured;
try {
  configured = JSON.parse(
    localStorage.getItem("bloodflow.connection") || "null",
  );
} catch {
  configured = null;
}
const url = import.meta.env.VITE_SUPABASE_URL || configured?.url;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || configured?.key;
let client;
try {
  if (url && key && !url.includes("YOUR-PROJECT"))
    client = createClient(url, key);
} catch {
  /* Connection form remains available. */
}
let mode = "live",
  profile = null,
  page = "Dashboard",
  data = {},
  heartbeatTimer,
  loading = false;
let demo;
const app = $("#app");
const status = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;
const empty = (text) =>
  `<div class="empty"><span>◇</span><h3>Nothing here yet</h3><p>${esc(text)}</p></div>`;
const field = (label, name, type = "text", extra = "") =>
  `<label>${label}<input name="${name}" type="${type}" ${extra} required></label>`;
const groupField = () =>
  `<label>Blood group<select name="group" aria-label="Blood group">${groups.map((g) => `<option>${g}</option>`).join("")}</select></label>`;
const button = (label, action, id, cls = "secondary") =>
  `<button class="${cls}" data-action="${action}" ${id !== undefined ? `data-id="${esc(id)}"` : ""}>${label}</button>`;
const staff = () => ["staff", "admin"].includes(profile?.role);
function toast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = `toast ${error ? "error" : ""}`;
  el.setAttribute("role", error ? "alert" : "status");
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 6500);
}
function login(message = "") {
  clearInterval(heartbeatTimer);
  profile = null;
  app.innerHTML = `<main class="login"><section class="login-story"><a class="brand" href="#"><span class="mark">♥</span> BloodFlow<span class="brand-dot">.</span></a><div><span class="eyebrow">EVERY UNIT HAS A STORY</span><h1>A little clarity.<br>A lot of care.</h1><p>A shared workspace for the people who keep blood moving. Track every donation, protect every unit, and make the next step clear.</p><div class="story-art"><div class="blood-drop">♥</div><span class="floating top">↗ &nbsp; Connected care</span><span class="floating bottom">✓ &nbsp; Every unit accounted for</span></div></div><small>Blood management, thoughtfully organised.<br>Classroom prototype · fictional records only</small></section><section class="login-panel"><div class="login-box"><span class="eyebrow">WELCOME TO BLOODFLOW</span><h2>Good to see you.</h2><p class="muted">Sign in to your blood bank workspace.</p>${message ? `<p class="notice">${esc(message)}</p>` : ""}${!client ? '<p class="notice">Your shared database is not connected yet. Explore the sample workspace or connect your Supabase project below.</p>' : ""}<form id="login-form">${field("Email or mobile number", "identifier", "text", 'autocomplete="username" placeholder="you@example.com or +919876543210"')}${field("Password", "password", "password", 'autocomplete="current-password" minlength="8"')}<label class="check"><input type="checkbox" id="show-password"> Show password</label><button class="primary wide" ${!client ? "disabled" : ""}>Sign in <span>→</span></button><p id="login-error" role="alert" class="form-error"></p></form><div class="divider"><span>Just looking around?</span></div><button class="secondary wide" data-action="demo">Explore sample workspace →</button><p class="fine">Sample mode uses fictional data in this browser tab. It has no real accounts or shared database.</p><details><summary>Connect a Supabase project</summary><form id="connection-form">${field("Project URL", "url", "url", 'placeholder="https://your-project.supabase.co"')}${field("Publishable / anon key (public)", "key", "text", 'placeholder="sb_publishable_…"')}<p class="fine">Use only the public browser key. Never enter a service role or secret key.</p><button class="secondary wide">Save connection</button></form></details><p class="fine">Accounts are created by your administrator. Contact them for access or password recovery.</p></div></section></main>`;
  $("#show-password").onchange = (e) =>
    ($("#login-form [name=password]").type = e.target.checked
      ? "text"
      : "password");
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      identifier = f.get("identifier").trim();
    const b = e.target.querySelector("button");
    b.disabled = true;
    b.textContent = "Signing in…";
    try {
      if (!client) throw Error("Connect your database first.");
      const credentials = identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { phone: identifier.replace(/[\s()-]/g, "") };
      if (credentials.phone && !/^\+[1-9]\d{7,14}$/.test(credentials.phone))
        throw Error(
          "Enter a mobile number with its country code, such as +91.",
        );
      const { error } = await client.auth.signInWithPassword({
        ...credentials,
        password: f.get("password"),
      });
      if (error)
        throw Error(
          "Unable to sign in. Check your details or try again later.",
        );
      mode = "live";
      await openSession();
    } catch (err) {
      if ($("#login-error")) $("#login-error").textContent = err.message;
    } finally {
      b.disabled = false;
      b.innerHTML = "Sign in →";
    }
  };
  $("#connection-form").onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target),
      u = f.get("url").trim(),
      k = f.get("key").trim();
    try {
      const parsed = new URL(u);
      if (
        parsed.protocol !== "https:" ||
        !parsed.hostname.endsWith(".supabase.co")
      )
        throw Error("Use the HTTPS project URL from Supabase.");
      if (k.startsWith("sb_secret_"))
        throw Error("Secret keys cannot be used in the browser.");
      if (k.split(".").length === 3) {
        const payload = JSON.parse(
          atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        if (payload.role !== "anon")
          throw Error("Use only the anon or publishable key.");
      }
      if (!k.startsWith("sb_publishable_") && k.split(".").length !== 3)
        throw Error("Enter your public Supabase publishable or anon key.");
      localStorage.setItem(
        "bloodflow.connection",
        JSON.stringify({ url: u, key: k }),
      );
      location.reload();
    } catch (err) {
      toast(err.message, true);
    }
  };
}
function createDemo() {
  const donors = [
    "Aarav",
    "Diya",
    "Kabir",
    "Meera",
    "Isha",
    "Rohan",
    "Anaya",
    "Vihaan",
  ].map((name, i) => ({
    donor_id: i + 1,
    name: `${name} Demo`,
    contact: `Fictional donor · D00${i + 1}`,
    blood_group: ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"][i],
    created_at: day(-20),
  }));
  return {
    donors,
    donations: donors.map((d) => ({
      donation_id: d.donor_id,
      donor_id: d.donor_id,
      collected_at: day(-10),
    })),
    blood_units: donors.flatMap((d) =>
      [2, 6, 18, -1].map((days, i) => ({
        unit_id: `BF-${String(d.donor_id).padStart(2, "0")}${i + 1}`,
        donation_id: d.donor_id,
        blood_group: d.blood_group,
        product: "PRBC",
        expires_at: day(days),
        release_status: i === 2 ? "quarantine" : "released",
        screening_note: "Fictional screening record",
      })),
    ),
    requests: [
      {
        request_id: 1,
        requester_id: "requester",
        patient_ref: "DEMO-P001",
        blood_group: "O+",
        quantity: 2,
        product: "PRBC",
        status: "pending",
        created_at: day(-1),
      },
    ],
    allocations: [],
    audit_events: [
      {
        event_id: 1,
        action: "Fictional workspace opened",
        entity_ref: "Sample data",
        occurred_at: day(0),
      },
    ],
    profiles: [
      { user_id: "admin", display_name: "Raju Repalle", role: "admin" },
      { user_id: "staff", display_name: "Staff Demo", role: "staff" },
      {
        user_id: "requester",
        display_name: "Requester Demo",
        role: "requester",
      },
    ],
    stock_thresholds: groups.map((g) => ({ blood_group: g, minimum_units: 3 })),
    settings: [{ expiry_window_days: 7 }],
  };
}
async function openSession() {
  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) {
      login();
      return;
    }
    const result = await client
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (result.error)
      throw Error(
        "Your account profile is unavailable. Ask your administrator to apply the database schema and assign your role.",
      );
    profile = result.data;
    page = "Dashboard";
    await load();
    await client.rpc("heartbeat");
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(async () => {
      if (document.visibilityState === "visible") await client.rpc("heartbeat");
    }, 60000);
  } catch (e) {
    login(e.message);
  }
}
async function load() {
  loading = true;
  try {
    if (mode === "demo") {
      data = structuredClone(demo);
      if (!staff()) {
        data.requests = data.requests.filter(
          (r) => r.requester_id === profile.user_id,
        );
        data.allocations = data.allocations.filter((a) =>
          data.requests.some((r) => r.request_id === a.request_id),
        );
      }
      data.statistics = { registered: 3, today: 1, active: 1 };
    } else {
      const tables = staff()
        ? [
            "donors",
            "donations",
            "blood_units",
            "requests",
            "allocations",
            "audit_events",
            "stock_thresholds",
            "settings",
          ]
        : ["requests", "allocations"];
      if (profile.role === "admin") tables.push("profiles");
      const results = await Promise.all(
        tables.map(async (t) => {
          const r = await client.from(t).select("*");
          if (r.error) throw Error(`${t}: ${r.error.message}`);
          return [t, r.data];
        }),
      );
      data = Object.fromEntries(results);
      if (profile.role === "admin") {
        const r = await client.rpc("user_statistics");
        if (r.error) throw r.error;
        data.statistics = r.data;
      }
    }
    render();
  } catch (e) {
    toast(`Could not refresh workspace: ${e.message}`, true);
    if (!document.querySelector(".shell"))
      app.innerHTML = `<main class="connection-error"><h1>Workspace unavailable</h1><p>Check the database connection and schema, then retry.</p>${button("Retry", "refresh")}${button("Sign out", "logout")}</main>`;
  } finally {
    loading = false;
  }
}
function available(u) {
  return (
    u.release_status === "released" &&
    new Date(u.expires_at) > new Date() &&
    !data.allocations.some(
      (a) =>
        a.unit_id === u.unit_id && ["reserved", "issued"].includes(a.status),
    )
  );
}
function unitState(u) {
  const a = data.allocations.find(
    (a) => a.unit_id === u.unit_id && ["reserved", "issued"].includes(a.status),
  );
  return (
    a?.status ||
    (new Date(u.expires_at) <= new Date()
      ? "expired"
      : u.release_status === "released"
        ? "available"
        : u.release_status)
  );
}
function render() {
  const tabs = staff()
    ? [
        "Dashboard",
        "Donors",
        "Inventory",
        "Requests",
        "Activity",
        ...(profile.role === "admin" ? ["Accounts"] : []),
      ]
    : ["Dashboard", "Requests"];
  if (!tabs.includes(page)) page = "Dashboard";
  app.innerHTML = `<div class="shell"><aside><a class="brand" href="#"><span class="mark">♥</span> BloodFlow<span class="brand-dot">.</span></a><div class="workspace-label">WORKSPACE <span>01</span></div><nav>${tabs.map((t) => `<button data-action="navigate" data-id="${t}" class="nav-item ${page === t ? "selected" : ""}"><span>${icons[t]}</span>${t}${t === "Requests" ? `<b>${data.requests.filter((r) => r.status === "pending").length}</b>` : ""}</button>`).join("")}</nav><div class="sidebar-note"><span>♥</span><strong>Care in every detail.</strong><p>One donation.<br>Many possibilities.</p></div><div class="account"><div class="avatar">${esc(profile.display_name[0])}</div><div><strong>${esc(profile.display_name)}</strong><small>${esc(profile.role === "admin" ? "Administrator" : profile.role)}</small></div><button data-action="logout" aria-label="Sign out of workspace" title="Sign out">${icon('<path d="M9 4H4v16h5M10 12h11M17 8l4 4-4 4"/>')}</button></div></aside><main class="workspace"><header class="topbar"><span>Blood bank workspace <span class="slash">/</span> <strong>${page}</strong></span><div><span class="connection-dot"></span> ${mode === "demo" ? "Sample workspace" : "Shared database"} ${button("↻ Refresh", "refresh")}${button("Password", "password")}${button("Sign out", "logout")}</div></header>${mode === "demo" ? `<div class="demo-bar"><span><strong>Sample mode</strong> · Fictional data, saved in this tab only.</span><label>View as <select id="demo-role" aria-label="Demo role">${["admin", "staff", "requester"].map((r) => `<option ${profile.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></label></div>` : ""}<div class="content"><div class="page-heading"><div><span class="eyebrow">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span><h1>${page === "Dashboard" ? `A clearer picture${staff() ? "." : " of your requests."}` : page}</h1><p>${{ Dashboard: staff() ? "Every donation matters. Here’s where things stand today." : "Submit requests and follow their progress in one place.", Donors: "The people at the heart of every donation.", Inventory: "Every unit, from donation to its next chapter.", Requests: "The right units. The right request. A clear trail.", Activity: "A record of care, one action at a time.", Accounts: "Manage access to your shared workspace." }[page]}</p></div><div class="heading-actions">${page === "Donors" ? button("+ Add donor", "add-donor", undefined, "primary") : page === "Inventory" ? button("+ Record donation", "add-unit", undefined, "primary") : page === "Requests" || page === "Dashboard" ? button("+ New request", "add-request", undefined, "primary") : ""}</div></div><div id="page-content">${{ Dashboard: dashboard, Donors: donorsView, Inventory: inventoryView, Requests: requestsView, Activity: activityView, Accounts: accountsView }[page]()}</div><footer>BloodFlow <span>•</span> Packed red cells · Single blood bank <span class="footer-right">Classroom prototype · Fictional references only</span></footer></div></main></div>`;
  $("#demo-role")?.addEventListener("change", (e) => {
    profile = demo.profiles.find((p) => p.role === e.target.value);
    load();
  });
  $("#search")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    document
      .querySelectorAll("tbody tr")
      .forEach((r) => (r.hidden = !r.textContent.toLowerCase().includes(q)));
  });
}
function metric(label, value, detail, accent = "") {
  return `<article class="metric ${accent}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}
function dashboard() {
  if (!staff())
    return `<div class="metrics three">${metric("Your requests", data.requests.length, "All submitted requests")}${metric("Awaiting action", data.requests.filter((r) => ["pending", "approved"].includes(r.status)).length, "Pending or approved")}${metric("Completed", data.requests.filter((r) => r.status === "issued").length, "Units issued")}</div>${requestTable(data.requests)}`;
  const units = data.blood_units,
    window = data.settings[0].expiry_window_days;
  const expiring = units
    .filter(
      (u) => available(u) && new Date(u.expires_at) < new Date(day(window)),
    )
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at));
  return `<div class="metrics">${metric("Available units", units.filter(available).length, "Released, unexpired & unreserved", "red")}${metric("Pending requests", data.requests.filter((r) => r.status === "pending").length, "Waiting for staff approval")}${metric("Expiring soon", expiring.length, `Available · next ${window} days`)}${metric("Units issued", data.allocations.filter((a) => a.status === "issued").length, "Recorded in allocation history")}</div><div class="dashboard-grid"><section class="card stock-card"><div class="section-heading"><div><span class="eyebrow">LIVE INVENTORY</span><h2>Small units. Big impact.</h2></div><span class="pill">PRBC</span></div><div class="blood-groups">${groups
    .map((g) => {
      const n = units.filter((u) => u.blood_group === g && available(u)).length,
        t = data.stock_thresholds.find(
          (t) => t.blood_group === g,
        ).minimum_units;
      return `<div class="group-card ${n < t ? "low" : ""}"><span class="group-name">${g}</span><strong>${n}<small> units</small></strong><span class="stock-label">${n < t ? "↓ Low stock" : "✓ In stock"}</span><small>Minimum ${t}</small></div>`;
    })
    .join(
      "",
    )}</div><p class="card-note">Only released, unexpired and unreserved units count toward available stock.</p></section><section class="care-card"><span class="eyebrow">THOUGHTFUL ALLOCATION</span><div class="care-art">♥<span>+</span></div><h2>First to expire.<br>First in line.</h2><p>Reservations select the earliest eligible units, so every donation has its best chance to help.</p>${button("View inventory →", "navigate", "Inventory")}</section></div><div class="dashboard-grid bottom-grid"><section class="card"><div class="section-heading"><h2>Coming up on expiry</h2><span class="pill">${window} day window</span></div>${
    expiring.length
      ? `<div class="expiry-list">${expiring
          .slice(0, 5)
          .map(
            (u) =>
              `<div><span class="blood-tag">${u.blood_group}</span><div><strong>${esc(u.unit_id)}</strong><small>Packed red cells</small></div><span>${date(u.expires_at)}<small class="urgent">${Math.max(1, Math.ceil((new Date(u.expires_at) - Date.now()) / 864e5))} days left</small></span></div>`,
          )
          .join("")}</div>`
      : empty("No available units are approaching expiry.")
  }</section><section class="card"><div class="section-heading"><h2>Latest requests</h2>${button("View all →", "navigate", "Requests")}</div>${
    data.requests.length
      ? `<div class="recent-list">${data.requests
          .slice()
          .sort((a, b) => b.request_id - a.request_id)
          .slice(0, 4)
          .map(
            (r) =>
              `<div><span class="blood-tag">${r.blood_group}</span><div><strong>${esc(r.patient_ref)}</strong><small>${r.quantity} units · Request #${r.request_id}</small></div>${status(r.status)}</div>`,
          )
          .join("")}</div>`
      : empty("New requests will appear here.")
  }</section></div>${profile.role === "admin" ? `<section class="card admin-stats"><div><span class="eyebrow">ADMINISTRATOR ONLY</span><h2>Your workspace, together.</h2></div>${metric("Registered users", data.statistics.registered, "Unique application accounts")}${metric("Users signed in today", data.statistics.today, "Asia/Kolkata calendar day")}${metric("Active in last 5 minutes", data.statistics.active, "Distinct users · 1-minute heartbeat")}</section>` : ""}`;
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>${rows.length ? "" : empty("New records will appear here.")}</div>`;
}
function toolbar(text) {
  return `<div class="section-heading"><h2>${text}</h2><input id="search" class="search" aria-label="Search records" placeholder="Search records…"></div>`;
}
function donorsView() {
  return `<section class="card">${toolbar(`${data.donors.length} donors`)}${table(
    ["Donor", "Blood group", "Contact / reference", "Donations", ""],
    data.donors.map(
      (d) =>
        `<tr><td><strong>${esc(d.name)}</strong><small>DONOR #${d.donor_id}</small></td><td><span class="blood-tag">${d.blood_group}</span></td><td>${esc(d.contact)}</td><td>${data.donations.filter((x) => x.donor_id === d.donor_id).length}</td><td>${button("View history", "donor-history", d.donor_id)}</td></tr>`,
    ),
  )}</section>`;
}
function inventoryView() {
  return `<section class="card">${toolbar(`${data.blood_units.length} tracked units`)}${table(
    ["Unit ID", "Blood group", "Product", "Expires", "Status", ""],
    data.blood_units
      .slice()
      .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
      .map(
        (u) =>
          `<tr><td><strong>${esc(u.unit_id)}</strong></td><td><span class="blood-tag">${u.blood_group}</span></td><td>Packed red cells</td><td>${date(u.expires_at)}</td><td>${status(unitState(u))}</td><td>${u.release_status === "quarantine" ? button("Review screening", "review-unit", u.unit_id) : ""}</td></tr>`,
      ),
  )}</section>`;
}
function requestTable(requests) {
  return `<section class="card">${toolbar("Request register")}${table(
    ["Request", "Group", "Units", "Created", "Status", "Actions"],
    requests
      .slice()
      .sort((a, b) => b.request_id - a.request_id)
      .map(
        (r) =>
          `<tr><td><strong>${esc(r.patient_ref)}</strong><small>REQUEST #${r.request_id}</small></td><td><span class="blood-tag">${r.blood_group}</span></td><td>${r.quantity}</td><td>${date(r.created_at)}</td><td>${status(r.status)}</td><td class="row-actions">${staff() && r.status === "pending" ? button("Approve", "approve-request", r.request_id) : ""}${staff() && r.status === "approved" ? button("Reserve units", "reserve-request", r.request_id, "primary") : ""}${staff() && r.status === "reserved" ? button("Issue units", "issue-request", r.request_id, "primary") : ""}${["pending", "approved", "reserved"].includes(r.status) ? button("Cancel", "cancel-request", r.request_id) : ""}${button("Details", "request-details", r.request_id)}</td></tr>`,
      ),
  )}</section>`;
}
function requestsView() {
  return requestTable(data.requests);
}
function activityView() {
  return `<section class="card">${toolbar("Activity history")}${table(
    ["Action", "Record", "Recorded at"],
    data.audit_events
      .slice()
      .sort((a, b) => b.event_id - a.event_id)
      .map(
        (e) =>
          `<tr><td><strong>${esc(e.action)}</strong></td><td>${esc(e.entity_ref)}</td><td>${stamp(e.occurred_at)}</td></tr>`,
      ),
  )}</section>`;
}
function accountsView() {
  return `<section class="card"><div class="section-heading"><div><h2>Workspace accounts</h2><p class="muted">Create accounts in Supabase Authentication first, then assign their role here.</p></div></div>${table(
    ["Name", "Role", "User ID", ""],
    data.profiles.map(
      (p) =>
        `<tr><td><strong>${esc(p.display_name)}</strong></td><td>${status(p.role)}</td><td class="mono">${esc(p.user_id)}</td><td>${p.user_id !== profile.user_id ? button("Change role", "change-role", p.user_id) : "Your account"}</td></tr>`,
    ),
  )}</section><section class="card settings"><h2>Stock alert settings</h2><p class="muted">Project thresholds, not medical standards.</p>${button("Edit thresholds", "settings")}</section><section class="card settings"><h2>Change your password</h2><p class="muted">At least 8 characters, including uppercase, lowercase, a number and a special character.</p>${button("Change password", "password")}</section>`;
}
function modal(title, body, onSubmit, submit = "Save") {
  const dialog = document.createElement("dialog");
  dialog.innerHTML = `<form><div class="modal-heading"><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close dialog">×</button></div><div class="modal-body">${body}</div><p class="form-error" role="alert"></p><div class="modal-footer"><button type="button" class="secondary" data-close>Close</button>${onSubmit ? `<button class="primary" type="submit">${submit}</button>` : ""}</div></form>`;
  document.body.append(dialog);
  dialog
    .querySelectorAll("[data-close]")
    .forEach((b) => (b.onclick = () => dialog.close()));
  dialog.addEventListener("close", () => dialog.remove());
  dialog.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    const b = dialog.querySelector("[type=submit]");
    b.disabled = true;
    try {
      await onSubmit(new FormData(e.target));
      dialog.close();
      await load();
      toast("Saved successfully.");
    } catch (err) {
      dialog.querySelector(".form-error").textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
  dialog.showModal();
  return dialog;
}
async function rpc(name, args) {
  if (mode === "live") {
    const r = await client.rpc(name, args);
    if (r.error) throw Error(r.error.message);
    return r.data;
  }
  const r = demo.requests.find((r) => r.request_id === Number(args?.p_request));
  const audit = (action, entity) =>
    demo.audit_events.push({
      event_id: demo.audit_events.length + 1,
      action,
      entity_ref: String(entity),
      occurred_at: day(0),
    });
  const id = (rows) =>
    Math.max(0, ...rows.map((r) => r.donor_id || r.request_id || 0)) + 1;
  switch (name) {
    case "add_donor":
      demo.donors.push({
        donor_id: id(demo.donors),
        name: args.p_name,
        contact: args.p_contact,
        blood_group: args.p_group,
        created_at: day(0),
      });
      break;
    case "add_unit": {
      if (demo.blood_units.some((u) => u.unit_id === args.p_unit))
        throw Error("This unit ID already exists.");
      if (
        new Date(args.p_expires) <= new Date(args.p_collected) ||
        new Date(args.p_collected) > new Date()
      )
        throw Error(
          "Expiry must follow collection; collection cannot be in the future.",
        );
      const d = demo.donors.find((d) => d.donor_id === Number(args.p_donor)),
        n = demo.donations.length + 1;
      demo.donations.push({
        donation_id: n,
        donor_id: d.donor_id,
        collected_at: args.p_collected,
      });
      demo.blood_units.push({
        unit_id: args.p_unit,
        donation_id: n,
        blood_group: d.blood_group,
        product: "PRBC",
        expires_at: args.p_expires,
        release_status: "quarantine",
      });
      break;
    }
    case "review_unit":
      Object.assign(
        demo.blood_units.find((u) => u.unit_id === args.p_unit),
        { release_status: args.p_decision, screening_note: args.p_note },
      );
      break;
    case "create_request":
      demo.requests.push({
        request_id: id(demo.requests),
        requester_id: profile.user_id,
        patient_ref: args.p_patient,
        blood_group: args.p_group,
        quantity: Number(args.p_quantity),
        status: "pending",
        created_at: day(0),
      });
      break;
    case "approve_request":
      r.status = "approved";
      r.compatibility_note = args.p_note;
      r.compatibility_by = profile.user_id;
      break;
    case "reserve_request": {
      if (r.status === "reserved" || r.status === "issued") return;
      if (r.status !== "approved") throw Error("Request must be approved.");
      const selected = demo.blood_units
        .filter((u) => u.blood_group === r.blood_group && available(u))
        .sort(
          (a, b) =>
            new Date(a.expires_at) - new Date(b.expires_at) ||
            a.unit_id.localeCompare(b.unit_id),
        )
        .slice(0, r.quantity);
      if (selected.length !== r.quantity)
        throw Error("Insufficient available stock; no units were reserved.");
      selected.forEach((u) =>
        demo.allocations.push({
          request_id: r.request_id,
          unit_id: u.unit_id,
          status: "reserved",
          reserved_at: day(0),
        }),
      );
      r.status = "reserved";
      break;
    }
    case "issue_request": {
      const a = demo.allocations.filter(
        (a) => a.request_id === r.request_id && a.status === "reserved",
      );
      if (
        r.status !== "reserved" ||
        !r.compatibility_by ||
        a.length !== r.quantity ||
        a.some(
          (a) =>
            new Date(
              demo.blood_units.find((u) => u.unit_id === a.unit_id).expires_at,
            ) <= new Date(),
        )
      )
        throw Error("Reserved units must be unexpired and approved.");
      a.forEach((a) => {
        a.status = "issued";
        a.issued_at = day(0);
      });
      r.status = "issued";
      break;
    }
    case "cancel_request":
      if (r.status === "issued")
        throw Error("Issued records cannot be cancelled.");
      demo.allocations
        .filter((a) => a.request_id === r.request_id && a.status === "reserved")
        .forEach((a) => (a.status = "cancelled"));
      r.status = "cancelled";
      break;
    case "update_settings":
      demo.stock_thresholds.find(
        (t) => t.blood_group === args.p_group,
      ).minimum_units = Number(args.p_minimum);
      demo.settings[0].expiry_window_days = Number(args.p_window);
      break;
    case "set_role":
      demo.profiles.find((p) => p.user_id === args.p_user).role = args.p_role;
      break;
  }
  audit(
    name.replaceAll("_", " "),
    args?.p_request || args?.p_unit || args?.p_name || "Workspace",
  );
}
const actions = {
  demo: () => {
    mode = "demo";
    demo = createDemo();
    profile = demo.profiles[0];
    page = "Dashboard";
    load();
  },
  navigate: (id) => {
    page = id;
    render();
  },
  refresh: () => load(),
  logout: async () => {
    if (mode === "live" && client) {
      await client.rpc("end_activity");
      const { error } = await client.auth.signOut();
      if (error) throw Error("Sign out failed. Try again.");
    }
    demo = null;
    mode = "live";
    login();
  },
  "add-donor": () =>
    modal(
      "Add a fictional donor",
      `${field("Full name", "name", "text", 'maxlength="100"')}${field("Contact / fictional reference", "contact", "text", 'maxlength="100"')}${groupField()}`,
      (f) =>
        rpc("add_donor", {
          p_name: f.get("name").trim(),
          p_contact: f.get("contact").trim(),
          p_group: f.get("group"),
        }),
    ),
  "add-unit": () => {
    if (!data.donors.length) {
      toast("Add a donor first.", true);
      return;
    }
    modal(
      "Record a donation",
      `<p class="notice">Each new unit starts in quarantine. Staff must record screening before release.</p><label>Donor<select name="donor" aria-label="Donor">${data.donors.map((d) => `<option value="${d.donor_id}">${esc(d.name)} · ${d.blood_group}</option>`).join("")}</select></label>${field("Unique unit ID / barcode", "unit", "text", 'maxlength="60"')}${field("Collection date and time", "collected", "datetime-local")}${field("Actual expiry date and time", "expires", "datetime-local")}<p class="fine">Enter the actual labelled expiry. The app does not calculate medical shelf life.</p>`,
      (f) =>
        rpc("add_unit", {
          p_donor: Number(f.get("donor")),
          p_unit: f.get("unit").trim(),
          p_collected: new Date(f.get("collected")).toISOString(),
          p_expires: new Date(f.get("expires")).toISOString(),
        }),
    );
  },
  "review-unit": (id) =>
    modal(
      "Record screening decision",
      `<p>Unit <strong>${esc(id)}</strong></p><label>Decision<select name="decision"><option value="released">Release after screening</option><option value="rejected">Reject</option><option value="discarded">Discard</option></select></label>${field("Screening note / fictional approval reference", "note", "text", 'minlength="3" maxlength="500"')}`,
      (f) =>
        rpc("review_unit", {
          p_unit: id,
          p_decision: f.get("decision"),
          p_note: f.get("note"),
        }),
    ),
  "add-request": () =>
    modal(
      "New blood request",
      `${field("Fictional patient reference", "patient", "text", 'placeholder="DEMO-P002" maxlength="80"')}${groupField()}${field("Number of packed red cell units", "quantity", "number", 'min="1" max="100" value="1"')}<p class="fine">Exact blood group allocation is an inventory policy. A staff member must record compatibility approval.</p>`,
      (f) =>
        rpc("create_request", {
          p_patient: f.get("patient").trim(),
          p_group: f.get("group"),
          p_quantity: Number(f.get("quantity")),
        }),
      "Submit request",
    ),
  "approve-request": (id) =>
    modal(
      "Record compatibility approval",
      `<p>Confirm that staff have checked request #${esc(id)}. BloodFlow does not determine clinical compatibility.</p>${field("Staff compatibility approval reference", "note", "text", 'minlength="3" maxlength="500"')}`,
      (f) =>
        rpc("approve_request", {
          p_request: Number(id),
          p_note: f.get("note"),
        }),
      "Approve request",
    ),
  "reserve-request": (id) =>
    modal(
      "Reserve units",
      `<p>Reserve all required units for request #${esc(id)} using earliest expiry first. If there is not enough usable stock, nothing will change.</p>`,
      () => rpc("reserve_request", { p_request: Number(id) }),
      "Reserve units",
    ),
  "issue-request": (id) =>
    modal(
      "Issue reserved units",
      `<p>Issue all reserved units for request #${esc(id)}? Expiry, release and approval will be checked again. Issued units remain permanently in the history.</p>`,
      () => rpc("issue_request", { p_request: Number(id) }),
      "Confirm issue",
    ),
  "cancel-request": (id) =>
    modal(
      "Cancel request",
      `<p>Cancel request #${esc(id)} and release its reserved units back into stock?</p>`,
      () => rpc("cancel_request", { p_request: Number(id) }),
      "Cancel request",
    ),
  "request-details": (id) => {
    const r = data.requests.find((r) => r.request_id === Number(id)),
      a = data.allocations.filter((a) => a.request_id === r.request_id);
    modal(
      `Request #${id}`,
      `<p><strong>${esc(r.patient_ref)}</strong> · ${r.blood_group} · ${r.quantity} units</p><p>${status(r.status)}</p><p>Approval: ${esc(r.compatibility_note || "Awaiting staff approval")}</p><h3>Allocation history</h3>${
        a.length
          ? table(
              ["Unit", "Status"],
              a.map(
                (a) =>
                  `<tr><td>${esc(a.unit_id)}</td><td>${status(a.status)}</td></tr>`,
              ),
            )
          : "<p>No units allocated yet.</p>"
      }`,
    );
  },
  "donor-history": (id) => {
    const d = data.donors.find((d) => d.donor_id === Number(id)),
      donations = data.donations.filter((x) => x.donor_id === d.donor_id);
    modal(
      `${d.name} · Donation history`,
      donations.length
        ? table(
            ["Collected", "Units"],
            donations.map(
              (x) =>
                `<tr><td>${date(x.collected_at)}</td><td>${data.blood_units
                  .filter((u) => u.donation_id === x.donation_id)
                  .map((u) => esc(u.unit_id))
                  .join(", ")}</td></tr>`,
            ),
          )
        : "<p>No donations recorded yet.</p>",
    );
  },
  "change-role": (id) =>
    modal(
      "Change account access",
      '<label>Role<select name="role"><option value="requester">Requester — own requests only</option><option value="staff">Staff — inventory and requests</option><option value="admin">Administrator — full workspace access</option></select></label>',
      (f) => rpc("set_role", { p_user: id, p_role: f.get("role") }),
    ),
  settings: () =>
    modal(
      "Stock alert settings",
      `${groupField()}${field("Minimum available units for this group", "minimum", "number", 'min="0" max="1000" value="5"')}${field("Expiry alert window (all groups, days)", "window", "number", `min="1" max="90" value="${data.settings[0].expiry_window_days}"`)}`,
      (f) =>
        rpc("update_settings", {
          p_group: f.get("group"),
          p_minimum: Number(f.get("minimum")),
          p_window: Number(f.get("window")),
        }),
    ),
  password: () => {
    const d = modal(
      "Change your password",
      `${field("New password", "password", "password", 'autocomplete="new-password" minlength="8"')}<ul id="password-rules" class="fine"></ul>`,
      async (f) => {
        if (!passwordValid(f.get("password")))
          throw Error("Meet all five password requirements.");
        if (mode === "demo")
          throw Error(
            "Sample mode has no real passwords. Connect Supabase to manage accounts.",
          );
        const { error } = await client.auth.updateUser({
          password: f.get("password"),
        });
        if (error) throw error;
      },
    );
    const input = d.querySelector("input");
    input.oninput = () => {
      const p = input.value;
      d.querySelector("#password-rules").innerHTML = [
        [p.length >= 8, "8 or more characters"],
        [/[A-Z]/.test(p), "Uppercase letter"],
        [/[a-z]/.test(p), "Lowercase letter"],
        [/\d/.test(p), "Number"],
        [/[^A-Za-z0-9]/.test(p), "Special character"],
      ]
        .map(([ok, t]) => `<li>${ok ? "✓" : "○"} ${t}</li>`)
        .join("");
    };
    input.oninput();
  },
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  e.preventDefault();
  b.disabled = true;
  try {
    await actions[b.dataset.action]?.(b.dataset.id);
  } catch (err) {
    toast(err.message, true);
  } finally {
    b.disabled = false;
  }
});
if (client) {
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && mode === "live")
      login("Your session has ended. Please sign in again.");
  });
  openSession();
} else login();
