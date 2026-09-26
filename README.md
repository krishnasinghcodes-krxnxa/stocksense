# StockSense — Intelligent Modular Inventory Management System

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![SQLite](https://img.shields.io/badge/SQLite-Stdlib-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(8%2F8)-10b981)]()

> A modular Inventory Management System (IMS) that digitizes and streamlines all stock-related operations within a business — replacing manual registers, disconnected spreadsheets, and fragmented tracking methods with a centralized, real-time, easy-to-use application.

---

## 📋 Table of Contents
1. [Overview & Problem Statement](#-overview--problem-statement)
2. [Target Users & Role Boundaries](#-target-users--role-boundaries)
3. [Core Features & Invariants](#-core-features--invariants)
4. [Engineering Standards & Agent Skills](#-engineering-standards--agent-skills)
5. [Analysis & Identified Changes](#-analysis--identified-changes)
6. [Suggested Add-ons & Future Roadmap](#-suggested-add-ons--future-roadmap)
7. [Running Locally](#-running-locally)
8. [Running Automated Tests](#-running-automated-tests)
9. [API Reference](#-api-reference)

---

## 🔍 Overview & Problem Statement

StockSense is built according to the specification outlined in **StockSense.pdf**. Traditional inventory handling often relies on paper registers, fragile Excel formulas, and verbal handoffs between warehouse floors. This introduces discrepancies between recorded stock and physical reality, missed vendor deliveries, unfulfilled customer shipments, and delayed stock transfers.

StockSense digitizes every stock movement through an **immutable Stock Ledger**, automated balance calculations upon validation, and real-time dashboard health metrics.

---

## 👥 Target Users & Role Boundaries

- **Inventory Managers**: Oversee catalog creation, set reordering rules/min-stock thresholds, monitor incoming receipts, approve discrepancies, and review move histories.
- **Warehouse Staff**: Execute physical picking and packing for deliveries, accept vendor receipts, execute internal transfers between racks/warehouses, and submit cycle count adjustments.

---

## ⚡ Core Features & Invariants

### 1. Product Catalog & Categories
- Complete SKU management, units of measure (`kg`, `units`, `litres`, `meters`), category classification (`Raw Material`, `Furniture`, `Electrical`), and minimum stock safety levels.
- Real-time stock availability tracking distributed across multiple warehouses and specific bays (e.g. *Main Warehouse*, *Warehouse 1*, *Production Floor*, *Rack B*).

### 2. Receipts (Incoming Goods)
- Used when materials or goods arrive from suppliers.
- **Workflow**: Create Receipt $\to$ Select Supplier & Products $\to$ Input Received Quantities $\to$ Validate.
- **Invariant**: Validating a receipt automatically increases total product stock and destination warehouse location balance, recording an immutable entry into the Stock Ledger.

### 3. Delivery Orders (Outgoing Goods)
- Used when fulfilling customer orders and dispatches.
- **Workflow**: Pick items $\to$ Pack items $\to$ Validate $\to$ Stock decreases automatically.
- **Invariant**: Prevents overselling with trust-boundary validation. Deducts stock only upon authorized validation.

### 4. Internal Transfers
- Shifts inventory inside company facilities (e.g., *Main Store $\to$ Production Rack*).
- **Invariant**: Total company stock remains unchanged; source location balance decreases while destination location balance increases. Logged with zero net delta in the ledger.

### 5. Stock Adjustments (Cycle Counts)
- Resolves mismatches between recorded ledger quantities and physical floor counts.
- **Invariant**: Calculates delta ($\Delta = \text{Counted} - \text{Recorded}$), applies adjustment to stock, and logs adjustment reason in the audit ledger.

### 6. Authentication & OTP Password Reset
- Secure account sign-up and authentication with salted **PBKDF2-HMAC-SHA256** password hashing.
- 6-digit **OTP-based password reset** workflow with expiration tracking.

### 7. Smart Filters & Real-Time Dashboard
- Real-time KPI cards: *Total Products*, *Low Stock Alerts*, *Out of Stock*, *Pending Receipts*, *Pending Deliveries*, *Internal Transfers Scheduled*.
- Dynamic filtering by document type, status (`Draft`, `Waiting`, `Ready`, `Done`, `Canceled`), warehouse location, and product category.
- CSV export for reporting.

---

## 🛠 Engineering Standards & Agent Skills

This repository implements development and agent guidelines from three foundational sources:

1. **[Matt Pocock's Skills (`mattpocock/skills`)](https://github.com/mattpocock/skills)**:
   - Domain modeling representing real warehouse entities.
   - Test-Driven Development (TDD) and verification for inventory mathematical invariants.
2. **[Ponytail (`DietrichGebert/ponytail`)](https://github.com/DietrichGebert/ponytail)**:
   - *Lazy senior dev mode*: YAGNI (You Aren't Gonna Need It), root-cause fixes over superficial patches.
   - Built-in Python standard library (`sqlite3`, `hashlib`, `secrets`) eliminating bloated database setup.
   - Native platform web standards (CSS variables, native forms, semantic tables, fetch API) with zero heavy frontend framework overhead.
3. **[ECC (`affaan-m/ECC`)](https://github.com/affaan-m/ECC)**:
   - Strict security boundaries: parameterized SQL statements preventing injection.
   - Safe ACID transaction handling (`BEGIN TRANSACTION ... COMMIT / ROLLBACK`).
   - Clean credential hygiene: zero sensitive tokens in source control.

Guidelines and rules are available in:
- `AGENTS.md` & `CLAUDE.md`
- `.agents/skills/`
- `.cursor/rules/`

---

## 💡 Analysis & Identified Changes

When analyzing the initial repository alongside `StockSense.pdf`, several critical gaps were identified and resolved:

| Component | Initial State | Required Change Implemented |
|---|---|---|
| **Styling** | `frontend/style.css` was **0 bytes (empty)**; UI was unstyled. | Engineered a comprehensive, dark-mode modern SaaS design system with CSS custom properties, responsive layouts, badges, and modal animations. |
| **Operations Routing** | Receipts, Deliveries, and Transfers shared duplicate `id="operationsTable"` or missing IDs; script looked up nonexistent IDs. | Fixed unique table IDs (`receiptsTable`, `deliveriesTable`, `transfersTable`, `adjustmentsTable`) and dynamic table rendering. |
| **Backend API** | `backend/app.py` was a 5-line placeholder with only `/`. | Built a complete REST API using Flask + SQLite supporting Auth, Products, Operations, Ledger, Warehouses, and Dashboard Stats. |
| **Inventory Accounting** | Form modals only showed browser `alert()` popups; no stock was adjusted. | Implemented atomic stock deduction, receipt replenishment, transfer routing, and validation endpoints that update stock in real time. |
| **Audit Ledger** | No persistent audit trail. | Created an immutable `stock_ledger` table logging every transaction with timestamps, users, references, and quantities. |
| **Authentication** | Missing; logout was an alert. | Created signup, login, session profile, and OTP-based password reset flows. |
| **DevOps / Repo Hygiene** | 1,195 Windows virtualenv files were committed to git. | Untracked Windows binaries from git, established `.gitignore`, and provided `requirements.txt`. |

---

## 🚀 Suggested Add-ons & Future Roadmap

To expand StockSense into a production-grade enterprise platform, the following additions are recommended:

1. **Barcode & QR Code Scanning (Webcam / PDA)**:
   - Integrate `html5-qrcode` to enable camera barcode scanning on mobile/tablet devices for rapid receiving, picking, and cycle counts without manual typing.
2. **Batch & Expiry Date Management**:
   - Track Batch/Lot numbers and expiration dates for perishable raw materials and chemicals, with automated FIFO/FEFO (First-Expired, First-Out) picking suggestions.
3. **Automated Purchase Orders (Reorder Triggers)**:
   - Automatically generate draft Purchase Orders when stock dips below the reorder point (`min_stock`), pre-filling vendor information.
4. **Printable PDF Delivery Slips & Picking Lists**:
   - Provide printable 1-click packing lists and shipping manifests for warehouse workers.
5. **Granular Role-Based Access Control (RBAC)**:
   - Differentiate permissions so Warehouse Staff can view and validate pick/pack tasks without modifying product prices, deleting records, or overriding ledger history.

---

## 💻 Running Locally

### Prerequisites
- Python 3.10+ (Python 3.11, 3.12, 3.13, 3.14 supported)
- `uv` (recommended) or `python3 -m venv`

### 1. Clone & Set Up Environment
```bash
# Clone the repository
git clone https://github.com/krishnasinghcodes-krxnxa/stocksense.git
cd stocksense

# Create virtual environment with uv or python3
uv venv .venv
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt
```

### 2. Initialize Database & Run
```bash
# Initialize SQLite database with seed data
python backend/db.py

# Start the full-stack server (serves both API & Frontend)
python app.py
```

Open your browser at **`http://127.0.0.1:5000`**.

### Demo Credentials
- **Email**: `krishna@example.com`
- **Password**: `password123`

---

## 🧪 Running Automated Tests

Run the comprehensive unit test suite:
```bash
source .venv/bin/activate
python -m unittest discover tests -v
```

---

## 📡 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Health check endpoint |
| `/api/auth/signup` | `POST` | Register a new user |
| `/api/auth/login` | `POST` | Authenticate user credentials |
| `/api/auth/forgot-password` | `POST` | Request 6-digit password reset OTP |
| `/api/auth/reset-password` | `POST` | Reset password using verified OTP |
| `/api/auth/me` | `GET` | Retrieve current user profile |
| `/api/products` | `GET` | Filter products (by search, category, location, status) |
| `/api/products` | `POST` | Create a new product |
| `/api/products/<id>` | `PUT` | Update product details and safety stock |
| `/api/operations` | `GET` | List operations (Receipts, Deliveries, Transfers, Adjustments) |
| `/api/operations` | `POST` | Create operation (optionally validate immediately) |
| `/api/operations/<id>/validate` | `POST` | Validate operation and update inventory ledger |
| `/api/ledger` | `GET` | Query immutable stock movement history |
| `/api/warehouses` | `GET` | List all configured warehouses and locations |
| `/api/dashboard/stats` | `GET` | Fetch real-time dashboard KPIs and health breakdown |

---

## 📄 License
MIT License. Crafted with engineering discipline and real-world utility.
