const state = {
  currentPage: "dashboard",
  products: [
    { name: "Steel Rods", sku: "STL-001", category: "Raw Material", stock: 1240, unit: "kg", location: "Main Warehouse", status: "In Stock" },
    { name: "Office Chairs", sku: "CHR-102", category: "Furniture", stock: 86, unit: "units", location: "Warehouse 1", status: "In Stock" },
    { name: "Copper Wire", sku: "CPR-208", category: "Electrical", stock: 18, unit: "kg", location: "Rack B", status: "Low Stock" },
    { name: "Steel Plates", sku: "STP-309", category: "Raw Material", stock: 0, unit: "kg", location: "Production Floor", status: "Out of Stock" }
  ],
  operations: [
    { id: "REC-1042", type: "Receipt", product: "Steel Rods", qty: "+50 kg", location: "Main Warehouse", status: "Done", date: "26 Sep 2026" },
    { id: "DEL-0821", type: "Delivery", product: "Office Chairs", qty: "-10 units", location: "Warehouse 1", status: "Ready", date: "26 Sep 2026" },
    { id: "TRF-0448", type: "Internal", product: "Steel Rods", qty: "120 kg", location: "Main → Production", status: "Waiting", date: "25 Sep 2026" },
    { id: "ADJ-0192", type: "Adjustment", product: "Copper Wire", qty: "-3 kg", location: "Rack B", status: "Done", date: "25 Sep 2026" }
  ]
};

const pageTitles = {
  dashboard: ["Dashboard", "Inventory overview and operations"],
  products: ["Products", "Manage products and stock availability"],
  receipts: ["Receipts", "Track incoming inventory"],
  deliveries: ["Delivery Orders", "Manage outgoing stock"],
  transfers: ["Internal Transfers", "Move stock between locations"],
  adjustments: ["Inventory Adjustments", "Correct physical stock counts"],
  ledger: ["Stock Ledger", "Complete inventory movement history"],
  settings: ["Settings", "Manage warehouses and inventory rules"],
  profile: ["My Profile", "Manage your account"]
};

function showPage(page) {
  state.currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

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

function renderPage(page) {
  if (page === "dashboard") renderDashboard();
  if (page === "products") renderProducts();
  if (page === "receipts") renderOperations("Receipt");
  if (page === "deliveries") renderOperations("Delivery");
  if (page === "transfers") renderOperations("Internal");
  if (page === "adjustments") renderOperations("Adjustment");
  if (page === "ledger") renderLedger();
}

function renderDashboard() {
  const productTable = document.getElementById("dashboardProducts");

  if (!productTable) return;

  productTable.innerHTML = state.products.map(product => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-icon">${product.name.charAt(0)}</div>
          <div>
            <strong>${product.name}</strong>
            <span>${product.sku}</span>
          </div>
        </div>
      </td>
      <td>${product.category}</td>
      <td><strong>${product.stock}</strong> ${product.unit}</td>
      <td>${product.location}</td>
      <td>
        <span class="status ${product.status.toLowerCase().replaceAll(" ", "-")}">
          ${product.status}
        </span>
      </td>
    </tr>
  `).join("");
}

function renderProducts() {
  const table = document.getElementById("productsTable");

  if (!table) return;

  table.innerHTML = state.products.map(product => `
    <tr>
      <td>
        <div class="product-cell">
          <div class="product-icon">${product.name.charAt(0)}</div>
          <div>
            <strong>${product.name}</strong>
            <span>${product.sku}</span>
          </div>
        </div>
      </td>
      <td>${product.category}</td>
      <td>${product.stock} ${product.unit}</td>
      <td>${product.location}</td>
      <td>
        <span class="status ${product.status.toLowerCase().replaceAll(" ", "-")}">
          ${product.status}
        </span>
      </td>
      <td>
        <button class="table-action" onclick="editProduct('${product.sku}')">Edit</button>
      </td>
    </tr>
  `).join("");
}

function renderOperations(type) {
  const tableIds = {
"Receipt": "receiptsTable",
"Delivery": "deliveriesTable",
"Transfer": "transfersTable",
"Adjustment": "adjustmentsTable"
};

const table = document.getElementById(tableIds[type]);

  if (!table) return;

  const filtered = state.operations.filter(item => item.type === type);

  table.innerHTML = filtered.map(item => `
    <tr>
      <td><strong>${item.id}</strong></td>
      <td>${item.product}</td>
      <td>${item.qty}</td>
      <td>${item.location}</td>
      <td>
        <span class="status ${item.status.toLowerCase()}">
          ${item.status}
        </span>
      </td>
      <td>${item.date}</td>
    </tr>
  `).join("");
}

function renderLedger() {
  const table = document.getElementById("ledgerTable");

  if (!table) return;

  table.innerHTML = state.operations.map(item => `
    <tr>
      <td><strong>${item.id}</strong></td>
      <td>${item.type}</td>
      <td>${item.product}</td>
      <td>${item.qty}</td>
      <td>${item.location}</td>
      <td>${item.date}</td>
      <td>
        <span class="status ${item.status.toLowerCase()}">
          ${item.status}
        </span>
      </td>
    </tr>
  `).join("");
}

function searchProducts(value) {
  const query = value.toLowerCase();

  document.querySelectorAll("#productsTable tr").forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query)
      ? ""
      : "none";
  });
}

function editProduct(sku) {
  const product = state.products.find(item => item.sku === sku);

  if (product) {
    alert(`Edit Product: ${product.name}\nSKU: ${product.sku}`);
  }
}

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

function openProductModal() {
  openModal(
    "Create New Product",
    `
      <form class="modal-form" onsubmit="createProduct(event)">
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
            <input id="productCategory" required placeholder="Raw Material">
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
            <label>Location</label>
            <input id="productLocation" placeholder="Main Warehouse">
          </div>
        </div>

        <button class="primary-btn full-btn" type="submit">
          Create Product
        </button>
      </form>
    `
  );
}

function createProduct(event) {
  event.preventDefault();

  const name = document.getElementById("productName").value;
  const sku = document.getElementById("productSku").value;
  const category = document.getElementById("productCategory").value;
  const unit = document.getElementById("productUnit").value;
  const stock = Number(document.getElementById("productStock").value);
  const location = document.getElementById("productLocation").value || "Main Warehouse";

  state.products.push({
    name,
    sku,
    category,
    stock,
    unit,
    location,
    status: stock === 0 ? "Out of Stock" : stock < 20 ? "Low Stock" : "In Stock"
  });

  closeModal();
  renderProducts();
  updateStats();
}

function updateStats() {
  const total = state.products.length;
  const low = state.products.filter(p => p.stock > 0 && p.stock < 20).length;
  const out = state.products.filter(p => p.stock === 0).length;

  const totalProducts = document.getElementById("totalProducts");
  const lowStock = document.getElementById("lowStock");
  const outStock = document.getElementById("outStock");

  if (totalProducts) totalProducts.textContent = total;
  if (lowStock) lowStock.textContent = low;
  if (outStock) outStock.textContent = out;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      showPage(item.dataset.page);
    });
  });

  const search = document.getElementById("productSearch");

  if (search) {
    search.addEventListener("input", event => {
      searchProducts(event.target.value);
    });
  }

  document.querySelectorAll("[data-close-modal]").forEach(button => {
    button.addEventListener("click", closeModal);
  });

  renderDashboard();
  updateStats();
});