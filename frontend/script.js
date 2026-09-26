/**
 * StockSense — Inventory Management System Client
 * Seamlessly integrates with Flask SQLite REST backend with robust offline fallback.
 */

const API_BASE = "http://127.0.0.1:5000/api"; // Relative to origin

const state = {
  currentUser: {
    id: 1,
    full_name: "Krishna Singh",
    email: "krishna@example.com",
    role: "Inventory Manager",
    phone: "+91 98765 43210"
  },
  currentPage: "dashboard",
  products: [],
  operations: [],
  ledger: [],
  warehouses: [],
  categories: [],
  stats: {
    total_products: 4,
    low_stock_count: 1,
    out_stock_count: 1,
    pending_receipts: 1,
    pending_deliveries: 1,
    internal_transfers: 1,
    health: { healthy_pct: 75.0, low_pct: 12.5, out_pct: 12.5 }
  },
  filters: {
    docType: "All document types",
    status: "All statuses",
    warehouse: "All warehouses",
    category: "All categories"
  },
  productFilter: {
    search: "",
    category: "All Categories",
    location: "All Locations"
  }
};

const pageTitles = {
  dashboard: ["Dashboard", "Inventory overview and operations"],
  products: ["Products", "Manage products and stock availability"],
  receipts: ["Receipts", "Track incoming inventory from vendors"],
  deliveries: ["Delivery Orders", "Pick, pack, and validate outgoing goods"],
  transfers: ["Internal Transfers", "Move stock between warehouses and locations"],
  adjustments: ["Inventory Adjustments", "Reconcile recorded stock with physical counts"],
  ledger: ["Stock Ledger", "Immutable inventory audit trail and move history"],
  settings: ["Settings", "Configure warehouses, categories, and inventory rules"],
  profile: ["My Profile", "Manage your account and credentials"]
};

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : "✕"}</span>
    <div>${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// ==========================================
// API CLIENT
// ==========================================
async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "An error occurred");
    }
    return data;
  } catch (err) {
    console.warn(`API call to ${endpoint} failed:`, err.message);
    throw err;
  }
}

async function loadAllData() {
  try {
    const [products, operations, ledger, warehouses, categories, stats, me] = await Promise.all([
      apiCall("/api/products").catch(() => null),
      apiCall("/api/operations").catch(() => null),
      apiCall("/api/ledger").catch(() => null),
      apiCall("/api/warehouses").catch(() => null),
      apiCall("/api/categories").catch(() => null),
      apiCall("/api/dashboard/stats").catch(() => null),
      apiCall("/api/auth/me").catch(() => null)
    ]);

    if (products) state.products = products;
    if (operations) state.operations = operations;
    if (ledger) state.ledger = ledger;
    if (warehouses) state.warehouses = warehouses;
    if (categories) state.categories = categories;
    if (stats) state.stats = stats;
    if (me) {
      state.currentUser = me;
      updateUserUI();
    }
  } catch (e) {
    console.info("Running in demo mode with pre-seeded data.");
  }

  renderPage(state.currentPage);
  updateKPIs();
}

function updateUserUI() {
  const u = state.currentUser;
  const initials = u.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  const sidebarName = document.getElementById("sidebarUserName");
  const sidebarRole = document.getElementById("sidebarUserRole");
  const sidebarAvatar = document.getElementById("sidebarAvatar");

  const topName = document.getElementById("topUserName");
  const topRole = document.getElementById("topUserRole");
  const topAvatar = document.getElementById("topAvatar");

  if (sidebarName) sidebarName.textContent = u.full_name;
  if (sidebarRole) sidebarRole.textContent = u.role;
  if (sidebarAvatar) sidebarAvatar.textContent = initials;

  if (topName) topName.textContent = u.full_name.split(" ")[0];
  if (topRole) topRole.textContent = u.role.includes("Manager") ? "Manager" : "Staff";
  if (topAvatar) topAvatar.textContent = initials;
}

// ==========================================
// NAVIGATION & PAGE ROUTING
// ==========================================
function showPage(page) {
  state.currentPage = page;

  document.querySelectorAll(".page").forEach(sec => sec.classList.remove("active"));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === page);
  });

  const title = document.getElementById("pageTitle");
  const subtitle = document.getElementById("pageSubtitle");
  if (pageTitles[page]) {
    title.textContent = pageTitles[page][0];
    subtitle.textContent = pageTitles[page][1];
  }

  renderPage(page);
}

async function loadProducts() {
  try {
    const response = await fetch(`${API_URL}/products`);
    const data = await response.json();

    if (response.ok && data.products) {
      state.products = data.products;
      renderDashboard();
      renderProducts();
      updateStats();
    }
  } catch (error) {
    console.error("Failed to load products:", error);
  }
}

async function loadOperations() {
  try {
    const response = await fetch(`${API_URL}/operations`);
    const data = await response.json();

    if (response.ok && data.operations) {
      state.operations = data.operations;

      if (state.currentPage === "receipts") {
        renderOperations("Receipt");
      }

      if (state.currentPage === "deliveries") {
        renderOperations("Delivery");
      }

      if (state.currentPage === "transfers") {
        renderOperations("Internal");
      }

      if (state.currentPage === "adjustments") {
        renderOperations("Adjustment");
      }

      if (state.currentPage === "ledger") {
        renderLedger();
      }
    }
  } catch (error) {
    console.error("Failed to load operations:", error);
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_URL}/stats`);
    const data = await response.json();

    if (response.ok) {
      const totalProducts = document.getElementById("totalProducts");
      const lowStock = document.getElementById("lowStock");
      const outStock = document.getElementById("outStock");

      if (totalProducts) {
        totalProducts.textContent = data.total_products ?? state.products.length;
      }

      if (lowStock) {
        lowStock.textContent = data.low_stock ?? 0;
      }

      if (outStock) {
        outStock.textContent = data.out_of_stock ?? 0;
      }
    }
  } catch (error) {
    console.error("Failed to load stats:", error);
    updateStats();
  }
}

function renderPage(page) {
  if (page === "dashboard") renderDashboard();
  else if (page === "products") renderProducts();
  else if (page === "receipts") renderOperations("Receipt");
  else if (page === "deliveries") renderOperations("Delivery");
  else if (page === "transfers") renderOperations("Internal");
  else if (page === "adjustments") renderAdjustments();
  else if (page === "ledger") renderLedger();
  else if (page === "settings") renderSettings();
  else if (page === "profile") renderProfile();
}

// ==========================================
// DASHBOARD RENDERING
// ==========================================
function updateKPIs() {
  const total = state.products.length;
  const low = state.products.filter(p => p.stock > 0 && p.stock <= (p.min_stock || 20)).length;
  const out = state.products.filter(p => p.stock <= 0).length;

  const pendingRec = state.operations.filter(o => o.type === "Receipt" && o.status !== "Done" && o.status !== "Canceled").length;
  const pendingDel = state.operations.filter(o => o.type === "Delivery" && o.status !== "Done" && o.status !== "Canceled").length;
  const pendingTrf = state.operations.filter(o => o.type === "Internal" && o.status !== "Done" && o.status !== "Canceled").length;

  const totalEl = document.getElementById("totalProducts");
  const lowEl = document.getElementById("lowStock");
  const outEl = document.getElementById("outStock");

  if (totalEl) totalEl.textContent = total;
  if (lowEl) lowEl.textContent = low;
  if (outEl) outEl.textContent = out;

  // Sidebar badges
  const navReceipts = document.querySelector('.nav-item[data-page="receipts"] .nav-count');
  const navDeliveries = document.querySelector('.nav-item[data-page="deliveries"] .nav-count');
  const navTransfers = document.querySelector('.nav-item[data-page="transfers"] .nav-count');

  if (navReceipts) navReceipts.textContent = pendingRec;
  if (navDeliveries) navDeliveries.textContent = pendingDel;
  if (navTransfers) navTransfers.textContent = pendingTrf;
}

function renderDashboard() {
  const tbody = document.getElementById("dashboardProducts");
  if (!tbody) return;

  let filtered = [...state.products];
  const { docType, status, warehouse, category } = state.filters;

  if (category && category !== "All categories") {
    filtered = filtered.filter(p => p.category === category);
  }
  if (warehouse && warehouse !== "All warehouses") {
    filtered = filtered.filter(p => p.location === warehouse);
  }
  if (status && status !== "All statuses") {
    filtered = filtered.filter(p => p.status.toLowerCase() === status.toLowerCase());
  }

  tbody.innerHTML = filtered.length ? filtered.map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-icon">${p.name.charAt(0)}</div>
          <div>
            <strong>${p.name}</strong>
            <span>${p.sku}</span>
          </div>
        </div>
      </td>
      <td>${p.category}</td>
      <td><strong>${p.stock}</strong> ${p.unit}</td>
      <td>${p.location}</td>
      <td>
        <span class="status ${p.status.toLowerCase().replaceAll(" ", "-")}">
          ${p.status}
        </span>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">No products match the selected filters.</td></tr>`;

  // Update Stock Health UI
  const total = state.products.length || 1;
  const healthyCount = state.products.filter(p => p.stock > (p.min_stock || 20)).length;
  const lowCount = state.products.filter(p => p.stock > 0 && p.stock <= (p.min_stock || 20)).length;
  const outCount = state.products.filter(p => p.stock <= 0).length;

  const healthyPct = Math.round((healthyCount / total) * 100);
  const lowPct = Math.round((lowCount / total) * 100);
  const outPct = 100 - healthyPct - lowPct;

  const healthRing = document.querySelector(".health-ring");
  if (healthRing) {
    healthRing.style.background = `conic-gradient(var(--green) 0% ${healthyPct}%, var(--orange) ${healthyPct}% ${healthyPct + lowPct}%, var(--red) ${healthyPct + lowPct}% 100%)`;
    healthRing.innerHTML = `
      <div>
        <strong>${healthyPct}%</strong>
        <span>Healthy</span>
      </div>
    `;
  }

  const healthList = document.querySelector(".health-list");
  if (healthList) {
    healthList.innerHTML = `
      <div>
        <span><i class="dot green-dot"></i>Healthy Stock</span>
        <strong>${healthyPct}%</strong>
      </div>
      <div>
        <span><i class="dot orange-dot"></i>Low Stock</span>
        <strong>${lowPct}%</strong>
      </div>
      <div>
        <span><i class="dot red-dot"></i>Out of Stock</span>
        <strong>${outPct}%</strong>
      </div>
    `;
  }

  // Update Recent Operations
  const activityList = document.querySelector(".activity-list");
  if (activityList && state.operations.length) {
    const recent = state.operations.slice(0, 4);
    activityList.innerHTML = recent.map(op => {
      const iconClass = op.type.toLowerCase();
      const symbol = op.type === "Receipt" ? "↓" : op.type === "Delivery" ? "↑" : op.type === "Internal" ? "⇄" : "±";
      return `
        <div class="activity">
          <div class="activity-icon ${iconClass}">${symbol}</div>
          <div>
            <strong>${op.product_name || op.product} ${op.type.toLowerCase()}</strong>
            <span>${Math.abs(op.quantity || parseFloat(op.qty) || 0)} ${op.unit || ""} • ${op.destination_location || op.location || "Warehouse"}</span>
          </div>
          <time>${op.date || "Today"}</time>
        </div>
      `;
    }).join("");
  }

  // Update Low Stock Alerts
  const alertsPanel = document.querySelector(".alerts-panel");
  if (alertsPanel) {
    const lowAndOut = state.products.filter(p => p.stock <= (p.min_stock || 20));
    const badge = alertsPanel.querySelector(".alert-badge");
    if (badge) badge.textContent = `${lowAndOut.length} alerts`;

    const alertItems = lowAndOut.slice(0, 3).map(p => {
      const min = p.min_stock || 20;
      const pct = Math.min(100, Math.max(5, Math.round((p.stock / min) * 100)));
      const isRed = p.stock <= 0;
      return `
        <div class="alert-item">
          <div class="alert-product ${isRed ? "red-bg" : ""}">${p.name.substring(0, 2).toUpperCase()}</div>
          <div class="alert-info">
            <strong>${p.name}</strong>
            <span>${p.stock} ${p.unit} remaining (min: ${min})</span>
            <div class="progress">
              <i style="width: ${pct}%"></i>
            </div>
          </div>
          <button onclick="openModal('Create Receipt', receiptForm('${p.name}'))">Reorder</button>
        </div>
      `;
    }).join("");

    const existingAlerts = alertsPanel.querySelectorAll(".alert-item");
    existingAlerts.forEach(el => el.remove());
    alertsPanel.insertAdjacentHTML("beforeend", alertItems || `<p style="color:var(--text-muted); font-size:0.85rem; padding:12px 0;">All product stocks are healthy!</p>`);
  }
}

// ==========================================
// PRODUCTS PAGE
// ==========================================
function renderProducts() {
  const tbody = document.getElementById("productsTable");
  if (!tbody) return;

  let list = [...state.products];
  const { search, category, location } = state.productFilter;

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }
  if (category && category !== "All Categories") {
    list = list.filter(p => p.category === category);
  }
  if (location && location !== "All Locations") {
    list = list.filter(p => p.location === location);
  }

  const countBadge = document.querySelector("#page-products .table-count");
  if (countBadge) countBadge.textContent = `${list.length} products`;

  tbody.innerHTML = list.length ? list.map(p => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-icon">${p.name.charAt(0)}</div>
          <div>
            <strong>${p.name}</strong>
            <span>${p.sku}</span>
          </div>
        </div>
      </td>
      <td>${p.category}</td>
      <td><strong>${p.stock}</strong> ${p.unit}</td>
      <td>${p.location}</td>
      <td>
        <span class="status ${p.status.toLowerCase().replaceAll(" ", "-")}">
          ${p.status}
        </span>
      </td>
      <td>
        <button class="table-action" onclick="openEditProductModal(${p.id || 0}, '${p.sku}')">Edit</button>
      </td>
    </tr>
  `).join("") : `<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">No products found matching criteria.</td></tr>`;
}

// ==========================================
// OPERATIONS: RECEIPTS, DELIVERIES, TRANSFERS
// ==========================================
function renderOperations(type) {
  const tableIds = {
    "Receipt": "receiptsTable",
    "Delivery": "deliveriesTable",
    "Internal": "transfersTable"
  };

  const tbody = document.getElementById(tableIds[type]);
  if (!tbody) return;

  const ops = state.operations.filter(o => o.type === type);

  if (type === "Receipt") {
    tbody.innerHTML = ops.length ? ops.map(op => `
      <tr>
        <td><strong>${op.id}</strong></td>
        <td>${op.partner || op.source_location || "Vendor"}</td>
        <td>${op.product_name || op.product}</td>
        <td><strong>+${Math.abs(op.quantity || parseFloat(op.qty) || 0)}</strong> ${op.unit || ""}</td>
        <td><span class="status ${op.status.toLowerCase()}">${op.status}</span></td>
        <td>${op.date || "26 Sep 2026"}</td>
        <td>
          ${op.status !== "Done" ? `<button class="table-action validate-btn" onclick="validateOp('${op.id}')">Validate</button>` : `<span style="color:var(--green); font-size:0.8rem;">✓ Done</span>`}
        </td>
      </tr>
    `).join("") : `<tr><td colspan="7" style="text-align:center; padding: 20px; color:var(--text-muted)">No receipts found.</td></tr>`;
  } else if (type === "Delivery") {
    tbody.innerHTML = ops.length ? ops.map(op => `
      <tr>
        <td><strong>${op.id}</strong></td>
        <td>${op.product_name || op.product}</td>
        <td><strong>-${Math.abs(op.quantity || parseFloat(op.qty) || 0)}</strong> ${op.unit || ""}</td>
        <td>${op.source_location || op.location || "Warehouse 1"}</td>
        <td><span class="status ${op.status.toLowerCase()}">${op.status}</span></td>
        <td>${op.date || "26 Sep 2026"}</td>
        <td>
          ${op.status !== "Done" ? `<button class="table-action validate-btn" onclick="validateOp('${op.id}')">Validate</button>` : `<span style="color:var(--green); font-size:0.8rem;">✓ Done</span>`}
        </td>
      </tr>
    `).join("") : `<tr><td colspan="7" style="text-align:center; padding: 20px; color:var(--text-muted)">No deliveries found.</td></tr>`;
  } else if (type === "Internal") {
    tbody.innerHTML = ops.length ? ops.map(op => `
      <tr>
        <td><strong>${op.id}</strong></td>
        <td>${op.product_name || op.product}</td>
        <td><strong>${Math.abs(op.quantity || parseFloat(op.qty) || 0)}</strong> ${op.unit || ""}</td>
        <td>${op.source_location || "Main"} → ${op.destination_location || "Production"}</td>
        <td><span class="status ${op.status.toLowerCase()}">${op.status}</span></td>
        <td>${op.date || "25 Sep 2026"}</td>
        <td>
          ${op.status !== "Done" ? `<button class="table-action validate-btn" onclick="validateOp('${op.id}')">Validate</button>` : `<span style="color:var(--green); font-size:0.8rem;">✓ Done</span>`}
        </td>
      </tr>
    `).join("") : `<tr><td colspan="7" style="text-align:center; padding: 20px; color:var(--text-muted)">No transfers found.</td></tr>`;
  }
}

// ==========================================
// ADJUSTMENTS PAGE
// ==========================================
function renderAdjustments() {
  const tbody = document.getElementById("adjustmentsTable");
  if (!tbody) return;

  const adjOps = state.operations.filter(o => o.type === "Adjustment");

  tbody.innerHTML = adjOps.length ? adjOps.map(op => {
    const qty = op.quantity || parseFloat(op.qty) || 0;
    const isNegative = qty < 0;
    return `
      <tr>
        <td><strong>${op.id}</strong></td>
        <td>${op.product_name || op.product}</td>
        <td>${op.source_location || "Rack B"}</td>
        <td>—</td>
        <td>—</td>
        <td class="${isNegative ? "negative-text" : "positive-text"}" style="font-weight:700; color:${isNegative ? "var(--red)" : "var(--green)"}">
          ${qty > 0 ? "+" : ""}${qty} ${op.unit || ""}
        </td>
        <td><span class="status done">${op.status}</span></td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td><strong>ADJ-0192</strong></td>
      <td>Copper Wire</td>
      <td>Rack B</td>
      <td>21 kg</td>
      <td>18 kg</td>
      <td style="color:var(--red); font-weight:700;">-3 kg</td>
      <td><span class="status done">Done</span></td>
    </tr>
  `;
}

// ==========================================
// STOCK LEDGER PAGE
// ==========================================
function renderLedger() {
  const tbody = document.getElementById("ledgerTable");
  if (!tbody) return;

  const entries = state.ledger.length ? state.ledger : state.operations.map(o => ({
    operation_id: o.id,
    doc_type: o.type,
    product_name: o.product_name || o.product,
    change_qty: o.quantity || (o.qty ? parseFloat(o.qty) : 0),
    unit: o.unit || "kg",
    source_location: o.source_location || o.location,
    timestamp: o.date || "26 Sep 2026",
    status: o.status
  }));

  tbody.innerHTML = entries.map(e => {
    const qty = e.change_qty;
    const qtyColor = qty > 0 ? "var(--green)" : qty < 0 ? "var(--red)" : "var(--text-secondary)";
    return `
      <tr>
        <td><strong>${e.operation_id || e.id || "LED-000"}</strong></td>
        <td>${e.doc_type || e.type}</td>
        <td>${e.product_name || e.product}</td>
        <td style="color:${qtyColor}; font-weight:700;">
          ${qty > 0 ? "+" : ""}${qty} ${e.unit || ""}
        </td>
        <td>${e.source_location || e.destination_location || "Warehouse"}</td>
        <td>${e.timestamp || e.date}</td>
        <td><span class="status ${e.status ? e.status.toLowerCase() : "done"}">${e.status || "Done"}</span></td>
      </tr>
    `;
  }).join("");
}

// ==========================================
// SETTINGS & PROFILE
// ==========================================
function renderSettings() {
  const list = document.querySelector(".warehouse-list");
  if (!list) return;

  const whs = state.warehouses.length ? state.warehouses : [
    { code: "W1", name: "Main Warehouse", location_info: "Jalandhar • 8 locations" },
    { code: "W2", name: "Warehouse 1", location_info: "Jalandhar • 5 locations" },
    { code: "PF", name: "Production Floor", location_info: "Manufacturing • 4 locations" }
  ];

  list.innerHTML = whs.map(w => `
    <div class="warehouse">
      <div class="warehouse-icon">${w.code}</div>
      <div>
        <strong>${w.name}</strong>
        <span>${w.location_info || "Active location"}</span>
      </div>
      <span class="active-badge">Active</span>
      <button style="color:var(--text-muted)">⋮</button>
    </div>
  `).join("");
}

function renderProfile() {
  const card = document.querySelector(".profile-card");
  if (card) {
    const u = state.currentUser;
    const initials = u.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    card.querySelector(".profile-avatar").textContent = initials;
    card.querySelector("h3").textContent = u.full_name;
    card.querySelector("p").textContent = u.role;
  }
}

// ==========================================
// VALIDATE OPERATION ACTION
// ==========================================
async function validateOp(opId) {
  try {
    const res = await apiCall(`/api/operations/${opId}/validate`, { method: "POST" });
    showToast(res.message || "Operation validated. Stock updated!");
    await loadAllData();
  } catch (err) {
    // Offline simulation
    const op = state.operations.find(o => o.id === opId);
    if (op) {
      op.status = "Done";
      const p = state.products.find(prod => prod.sku === op.sku || prod.name === op.product_name);
      if (p) {
        if (op.type === "Receipt") p.stock += (op.quantity || 50);
        if (op.type === "Delivery") p.stock = Math.max(0, p.stock - (op.quantity || 10));
      }
      showToast(`Operation ${opId} marked as Done.`);
      renderPage(state.currentPage);
      updateKPIs();
    } else {
      showToast(err.message, "error");
    }
  }
}

// ==========================================
// MODAL FORMS
// ==========================================
function openModal(title, content) {
  const modal = document.getElementById("modal");
  if (!modal) return;
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = content;
  modal.classList.add("show");
}

function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.classList.remove("show");
}

// Product Creation Modal
function openProductModal() {
  openModal(
    "Create New Product",
    `
      <form class="modal-form" onsubmit="handleCreateProduct(event)">
        <div class="form-grid">
          <div>
            <label>Product Name</label>
            <input id="productName" required placeholder="e.g. Steel Rods">
          </div>
          <div>
            <label>SKU / Code</label>
            <input id="productSku" required placeholder="e.g. STL-001">
          </div>
          <div>
            <label>Category</label>
            <select id="productCategory">
              <option>Raw Material</option>
              <option>Furniture</option>
              <option>Electrical</option>
              <option>General</option>
            </select>
          </div>
          <div>
            <label>Unit of Measure</label>
            <select id="productUnit">
              <option>units</option>
              <option>kg</option>
              <option>litres</option>
              <option>meters</option>
            </select>
          </div>
          <div>
            <label>Initial Stock</label>
            <input id="productStock" type="number" min="0" value="0">
          </div>
          <div>
            <label>Reorder Level (Min Stock)</label>
            <input id="productMinStock" type="number" min="1" value="20">
          </div>
          <div style="grid-column: 1 / -1;">
            <label>Storage Location</label>
            <select id="productLocation">
              <option>Main Warehouse</option>
              <option>Warehouse 1</option>
              <option>Production Floor</option>
              <option>Rack B</option>
            </select>
          </div>
        </div>
        <button class="primary-btn full-btn" type="submit">Create Product</button>
      </form>
    `
  );
}

async function handleCreateProduct(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("productName").value.trim(),
    sku: document.getElementById("productSku").value.trim(),
    category: document.getElementById("productCategory").value,
    unit: document.getElementById("productUnit").value,
    stock: parseFloat(document.getElementById("productStock").value) || 0,
    min_stock: parseFloat(document.getElementById("productMinStock").value) || 20,
    location: document.getElementById("productLocation").value
  };

  try {
    const res = await apiCall("/api/products", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast(res.message || "Product created successfully!");
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Edit Product Modal
function openEditProductModal(id, sku) {
  const p = state.products.find(item => item.sku === sku || item.id === id);
  if (!p) return;

  openModal(
    `Edit Product: ${p.name}`,
    `
      <form class="modal-form" onsubmit="handleUpdateProduct(event, ${p.id || 0})">
        <div class="form-grid single-col">
          <div>
            <label>Product Name</label>
            <input id="editProdName" value="${p.name}" required>
          </div>
          <div>
            <label>Category</label>
            <input id="editProdCategory" value="${p.category}" required>
          </div>
          <div>
            <label>Minimum Stock Threshold</label>
            <input id="editProdMinStock" type="number" value="${p.min_stock || 20}" required>
          </div>
          <div>
            <label>Primary Location</label>
            <input id="editProdLocation" value="${p.location || 'Main Warehouse'}">
          </div>
        </div>
        <button class="primary-btn full-btn" type="submit">Save Changes</button>
      </form>
    `
  );
}

async function handleUpdateProduct(e, prodId) {
  e.preventDefault();
  const payload = {
    name: document.getElementById("editProdName").value.trim(),
    category: document.getElementById("editProdCategory").value.trim(),
    min_stock: parseFloat(document.getElementById("editProdMinStock").value),
    location: document.getElementById("editProdLocation").value.trim()
  };

  try {
    const res = await apiCall(`/api/products/${prodId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast(res.message || "Product updated successfully!");
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Receipts Form
function receiptForm(defaultProduct = "") {
  const prodOptions = state.products.map(p => `
    <option value="${p.sku}" ${p.name === defaultProduct ? "selected" : ""}>
      ${p.name} (${p.sku})
    </option>
  `).join("");

  return `
    <form class="modal-form" onsubmit="handleCreateOperation(event, 'Receipt')">
      <div class="form-grid">
        <div>
          <label>Supplier / Vendor</label>
          <input id="opPartner" required placeholder="e.g. Apex Steel Ltd">
        </div>
        <div>
          <label>Product</label>
          <select id="opProduct" required>${prodOptions}</select>
        </div>
        <div>
          <label>Quantity Received</label>
          <input id="opQty" type="number" min="1" required placeholder="50">
        </div>
        <div>
          <label>Destination Warehouse</label>
          <select id="opDst">
            <option>Main Warehouse</option>
            <option>Warehouse 1</option>
            <option>Production Floor</option>
            <option>Rack B</option>
          </select>
        </div>
        <div style="grid-column: 1 / -1;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="opAutoValidate" checked style="width:auto;">
            Validate immediately and add to inventory
          </label>
        </div>
      </div>
      <button class="primary-btn full-btn" type="submit">Create Receipt</button>
    </form>
  `;
}

// Delivery Form
function deliveryForm() {
  const prodOptions = state.products.map(p => `
    <option value="${p.sku}">${p.name} (${p.sku}) - Stock: ${p.stock}</option>
  `).join("");

  return `
    <form class="modal-form" onsubmit="handleCreateOperation(event, 'Delivery')">
      <div class="form-grid">
        <div>
          <label>Customer / Order Reference</label>
          <input id="opPartner" required placeholder="e.g. Order #8841 (Acme Corp)">
        </div>
        <div>
          <label>Product</label>
          <select id="opProduct" required>${prodOptions}</select>
        </div>
        <div>
          <label>Quantity to Dispatch</label>
          <input id="opQty" type="number" min="1" required placeholder="10">
        </div>
        <div>
          <label>Source Location</label>
          <select id="opSrc">
            <option>Main Warehouse</option>
            <option>Warehouse 1</option>
            <option>Production Floor</option>
          </select>
        </div>
        <div style="grid-column: 1 / -1;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="opAutoValidate" checked style="width:auto;">
            Validate immediately and deduct from stock
          </label>
        </div>
      </div>
      <button class="primary-btn full-btn" type="submit">Create Delivery Order</button>
    </form>
  `;
}

// Transfer Form
function transferForm() {
  const prodOptions = state.products.map(p => `
    <option value="${p.sku}">${p.name} (${p.sku})</option>
  `).join("");

  return `
    <form class="modal-form" onsubmit="handleCreateOperation(event, 'Internal')">
      <div class="form-grid">
        <div>
          <label>Product</label>
          <select id="opProduct" required>${prodOptions}</select>
        </div>
        <div>
          <label>Quantity</label>
          <input id="opQty" type="number" min="1" required placeholder="50">
        </div>
        <div>
          <label>From Location</label>
          <select id="opSrc">
            <option>Main Warehouse</option>
            <option>Warehouse 1</option>
            <option>Rack B</option>
          </select>
        </div>
        <div>
          <label>To Destination</label>
          <select id="opDst">
            <option>Production Floor</option>
            <option>Warehouse 1</option>
            <option>Main Warehouse</option>
            <option>Rack B</option>
          </select>
        </div>
        <div style="grid-column: 1 / -1;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" id="opAutoValidate" checked style="width:auto;">
            Validate immediately and record internal shift
          </label>
        </div>
      </div>
      <button class="primary-btn full-btn" type="submit">Schedule Internal Transfer</button>
    </form>
  `;
}

// Adjustment Form
function adjustmentForm() {
  const prodOptions = state.products.map(p => `
    <option value="${p.sku}" data-stock="${p.stock}">${p.name} (${p.sku}) - Recorded: ${p.stock} ${p.unit}</option>
  `).join("");

  return `
    <form class="modal-form" onsubmit="handleAdjustmentSubmit(event)">
      <div class="form-grid">
        <div>
          <label>Product</label>
          <select id="adjProduct" onchange="updateAdjRecorded(this)">
            ${prodOptions}
          </select>
        </div>
        <div>
          <label>Location</label>
          <select id="adjLocation">
            <option>Rack B</option>
            <option>Main Warehouse</option>
            <option>Warehouse 1</option>
            <option>Production Floor</option>
          </select>
        </div>
        <div>
          <label>Recorded Stock</label>
          <input id="adjRecorded" type="number" readonly value="${state.products[0]?.stock || 0}">
        </div>
        <div>
          <label>Physical Count</label>
          <input id="adjCounted" type="number" required placeholder="Enter actual count" oninput="calculateAdjDiff()">
        </div>
      </div>
      <div class="adjustment-note" id="adjDifferenceMsg">
        The difference between physical count and recorded stock will be calculated and updated in the ledger.
      </div>
      <button class="primary-btn full-btn" type="submit">Validate Adjustment</button>
    </form>
  `;
}

function updateAdjRecorded(selectEl) {
  const opt = selectEl.options[selectEl.selectedIndex];
  const stock = opt.getAttribute("data-stock") || 0;
  document.getElementById("adjRecorded").value = stock;
  calculateAdjDiff();
}

function calculateAdjDiff() {
  const rec = parseFloat(document.getElementById("adjRecorded")?.value) || 0;
  const counted = parseFloat(document.getElementById("adjCounted")?.value);
  const msgEl = document.getElementById("adjDifferenceMsg");

  if (!isNaN(counted) && msgEl) {
    const diff = counted - rec;
    msgEl.innerHTML = `Discrepancy: <strong>${diff > 0 ? "+" : ""}${diff}</strong> units. Stock will be adjusted to <strong>${counted}</strong>.`;
  }
}

async function handleAdjustmentSubmit(e) {
  e.preventDefault();
  const sku = document.getElementById("adjProduct").value;
  const recorded = parseFloat(document.getElementById("adjRecorded").value) || 0;
  const counted = parseFloat(document.getElementById("adjCounted").value);
  const location = document.getElementById("adjLocation").value;

  if (isNaN(counted)) {
    showToast("Please enter a valid physical count.", "error");
    return;
  }

  const diff = counted - recorded;

  try {
    const res = await apiCall("/api/operations", {
      method: "POST",
      body: JSON.stringify({
        type: "Adjustment",
        sku,
        quantity: diff,
        source_location: location,
        destination_location: location,
        validate: true,
        notes: `Physical cycle count adjustment. Counted: ${counted}, Recorded: ${recorded}`
      })
    });
    showToast(res.message || "Stock adjustment validated successfully!");
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleCreateOperation(e, type) {
  e.preventDefault();
  const sku = document.getElementById("opProduct").value;
  const qty = parseFloat(document.getElementById("opQty").value);
  const partner = document.getElementById("opPartner")?.value || "";
  const src = document.getElementById("opSrc")?.value || "";
  const dst = document.getElementById("opDst")?.value || "";
  const validate = document.getElementById("opAutoValidate")?.checked ?? false;

  try {
    const res = await apiCall("/api/operations", {
      method: "POST",
      body: JSON.stringify({
        type,
        sku,
        quantity: qty,
        partner,
        source_location: src,
        destination_location: dst,
        validate
      })
    });
    showToast(res.message || `${type} created successfully!`);
    closeModal();
    await loadAllData();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==========================================
// AUTHENTICATION MODAL & OTP FLOW
// ==========================================
function openAuthModal(view = "login") {
  if (view === "login") {
    openModal(
      "Account Login",
      `
        <form class="modal-form" onsubmit="handleAuthLogin(event)">
          <div class="form-grid single-col">
            <div>
              <label>Email Address</label>
              <input id="loginEmail" type="email" value="${state.currentUser.email}" required>
            </div>
            <div>
              <label>Password</label>
              <input id="loginPassword" type="password" value="password123" required>
            </div>
          </div>
          <button class="primary-btn full-btn" type="submit">Sign In</button>
          <div style="display:flex; justify-content:space-between; margin-top:14px; font-size:0.8rem;">
            <a href="javascript:void(0)" onclick="openAuthModal('forgot')" style="color:var(--primary)">Forgot password?</a>
            <a href="javascript:void(0)" onclick="openAuthModal('signup')" style="color:var(--text-secondary)">Create account</a>
          </div>
        </form>
      `
    );
  } else if (view === "signup") {
    openModal(
      "Create StockSense Account",
      `
        <form class="modal-form" onsubmit="handleAuthSignup(event)">
          <div class="form-grid">
            <div style="grid-column:1/-1">
              <label>Full Name</label>
              <input id="regName" required placeholder="Krishna Singh">
            </div>
            <div style="grid-column:1/-1">
              <label>Email Address</label>
              <input id="regEmail" type="email" required placeholder="user@company.com">
            </div>
            <div>
              <label>Password</label>
              <input id="regPassword" type="password" required>
            </div>
            <div>
              <label>Role</label>
              <select id="regRole">
                <option>Inventory Manager</option>
                <option>Warehouse Staff</option>
              </select>
            </div>
          </div>
          <button class="primary-btn full-btn" type="submit">Sign Up</button>
          <p style="text-align:center; margin-top:12px; font-size:0.8rem;">
            Already have an account? <a href="javascript:void(0)" onclick="openAuthModal('login')" style="color:var(--primary)">Sign in</a>
          </p>
        </form>
      `
    );
  } else if (view === "forgot") {
    openModal(
      "Reset Password via OTP",
      `
        <form class="modal-form" id="otpRequestForm" onsubmit="handleRequestOTP(event)">
          <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:14px;">
            Enter your registered email address to receive a 6-digit one-time password (OTP).
          </p>
          <div class="form-grid single-col">
            <div>
              <label>Email Address</label>
              <input id="otpEmail" type="email" value="${state.currentUser.email}" required>
            </div>
          </div>
          <button class="primary-btn full-btn" type="submit">Send OTP Code</button>
        </form>

        <form class="modal-form" id="otpVerifyForm" style="display:none;" onsubmit="handleResetPassword(event)">
          <div class="form-grid single-col">
            <div class="adjustment-note" id="otpNotice">
              OTP has been generated. Enter the code below.
            </div>
            <div>
              <label>6-Digit OTP Code</label>
              <input id="otpCode" maxlength="6" required placeholder="e.g. 123456">
            </div>
            <div>
              <label>New Password</label>
              <input id="otpNewPassword" type="password" required placeholder="Enter strong password">
            </div>
          </div>
          <button class="primary-btn full-btn" type="submit">Confirm & Reset Password</button>
        </form>
      `
    );
  }
}

async function handleAuthLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  try {
    const res = await apiCall("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    state.currentUser = res.user;
    updateUserUI();
    showToast(`Welcome back, ${res.user.full_name}!`);
    closeModal();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleAuthSignup(e) {
  e.preventDefault();
  const payload = {
    full_name: document.getElementById("regName").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    password: document.getElementById("regPassword").value.trim(),
    role: document.getElementById("regRole").value
  };

  try {
    const res = await apiCall("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.currentUser = res.user;
    updateUserUI();
    showToast("Account created successfully!");
    closeModal();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleRequestOTP(e) {
  e.preventDefault();
  const email = document.getElementById("otpEmail").value.trim();

  try {
    const res = await apiCall("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });

    document.getElementById("otpRequestForm").style.display = "none";
    const verifyForm = document.getElementById("otpVerifyForm");
    verifyForm.style.display = "block";

    if (res.otp) {
      document.getElementById("otpNotice").innerHTML = `Demo OTP generated: <strong style="color:var(--primary); font-size:1.1rem;">${res.otp}</strong>`;
      document.getElementById("otpCode").value = res.otp;
    }
    showToast("OTP code sent to email!");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const email = document.getElementById("otpEmail").value.trim();
  const otp = document.getElementById("otpCode").value.trim();
  const new_password = document.getElementById("otpNewPassword").value.trim();

  try {
    const res = await apiCall("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, new_password })
    });
    showToast(res.message || "Password reset successful! Please log in.");
    openAuthModal("login");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==========================================
// EXPORT CSV
// ==========================================
function exportProductsCSV() {
  const headers = ["Product Name", "SKU", "Category", "Stock", "Unit", "Location", "Status"];
  const rows = state.products.map(p => [
    `"${p.name}"`,
    `"${p.sku}"`,
    `"${p.category}"`,
    p.stock,
    `"${p.unit}"`,
    `"${p.location}"`,
    `"${p.status}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `stocksense_products_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("Product catalog exported to CSV.");
}

// ==========================================
// EVENT LISTENERS INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Navigation
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => showPage(item.dataset.page));
  });

  // Global search
  const globalSearch = document.querySelector(".global-search input");
  if (globalSearch) {
    globalSearch.addEventListener("input", e => {
      state.productFilter.search = e.target.value;
      if (state.currentPage === "dashboard" || state.currentPage === "products") {
        renderProducts();
      }
    });
  }

  // Keyboard shortcut Cmd/Ctrl + K for global search
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      globalSearch?.focus();
    }
  });

  // Product Search on Products Page
  const searchInput = document.getElementById("productSearch");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      state.productFilter.search = e.target.value;
      renderProducts();
    });
  }

  // Product Toolbar Filters
  const prodCat = document.getElementById("productCategoryFilter");
  if (prodCat) {
    prodCat.addEventListener("change", e => {
      state.productFilter.category = e.target.value;
      renderProducts();
    });
  }

  const prodLoc = document.getElementById("productLocationFilter");
  if (prodLoc) {
    prodLoc.addEventListener("change", e => {
      state.productFilter.location = e.target.value;
      renderProducts();
    });
  }

  // Dashboard Smart Filters
  const fDoc = document.getElementById("filterDocType");
  const fStat = document.getElementById("filterStatus");
  const fWh = document.getElementById("filterWarehouse");
  const fCat = document.getElementById("filterCategory");
  const fReset = document.getElementById("filterResetBtn");

  if (fDoc) fDoc.addEventListener("change", e => { state.filters.docType = e.target.value; renderDashboard(); });
  if (fStat) fStat.addEventListener("change", e => { state.filters.status = e.target.value; renderDashboard(); });
  if (fWh) fWh.addEventListener("change", e => { state.filters.warehouse = e.target.value; renderDashboard(); });
  if (fCat) fCat.addEventListener("change", e => { state.filters.category = e.target.value; renderDashboard(); });

  if (fReset) {
    fReset.addEventListener("click", () => {
      if (fDoc) fDoc.selectedIndex = 0;
      if (fStat) fStat.selectedIndex = 0;
      if (fWh) fWh.selectedIndex = 0;
      if (fCat) fCat.selectedIndex = 0;
      state.filters = {
        docType: "All document types",
        status: "All statuses",
        warehouse: "All warehouses",
        category: "All categories"
      };
      renderDashboard();
      showToast("Filters reset.");
    });
  }

  // Modal close buttons
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", closeModal);
  });

  // Load initial data
  loadAllData();
});
