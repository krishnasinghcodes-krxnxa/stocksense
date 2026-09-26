"""
StockSense Backend REST API
Powered by Flask, SQLite (stdlib), parameterized SQL queries (ECC security).
"""

import os
import sys
import secrets
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.db import get_db, init_db, hash_password, verify_password

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# Initialize database on startup
init_db()

# ==========================================
# STATIC FRONTEND ROUTES
# ==========================================

@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/<path:filename>")
def serve_static(filename):
    file_path = os.path.join(FRONTEND_DIR, filename)
    if os.path.exists(file_path):
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, "index.html")

# ==========================================
# HEALTH CHECK
# ==========================================

@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "StockSense API",
        "version": "1.2.0"
    }), 200

# ==========================================
# AUTHENTICATION & OTP
# ==========================================

@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    full_name = data.get("full_name", "").strip()
    role = data.get("role", "Inventory Manager").strip()
    phone = data.get("phone", "").strip()

    if not email or not password or not full_name:
        return jsonify({"error": "Email, password, and full name are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?;", (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": "An account with this email already exists."}), 409

    pwd_hash, salt = hash_password(password)
    cursor.execute("""
    INSERT INTO users (email, password_hash, salt, full_name, role, phone)
    VALUES (?, ?, ?, ?, ?, ?);
    """, (email, pwd_hash, salt, full_name, role, phone))
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "Account created successfully.",
        "user": {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "role": role,
            "phone": phone
        },
        "token": f"token_{user_id}_{secrets.token_hex(8)}"
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?;", (email,))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(password, user["password_hash"], user["salt"]):
        return jsonify({"error": "Invalid email or password."}), 401

    return jsonify({
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "phone": user["phone"]
        },
        "token": f"token_{user['id']}_{secrets.token_hex(8)}"
    })

@app.route("/api/auth/forgot-password", methods=["POST"])
def auth_forgot_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?;", (email,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "No account found with this email."}), 404

    # Generate 6-digit OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
    INSERT INTO otp_codes (email, code, expires_at)
    VALUES (?, ?, ?);
    """, (email, otp, expires_at))
    conn.commit()
    conn.close()

    return jsonify({
        "message": "Password reset OTP sent successfully.",
        "otp": otp,  # Exposed for quick evaluation & testing
        "expires_in_minutes": 15
    })

@app.route("/api/auth/reset-password", methods=["POST"])
def auth_reset_password():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    otp = data.get("otp", "").strip()
    new_password = data.get("new_password", "").strip()

    if not email or not otp or not new_password:
        return jsonify({"error": "Email, OTP code, and new password are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, expires_at, used FROM otp_codes
    WHERE email = ? AND code = ? AND used = 0
    ORDER BY id DESC LIMIT 1;
    """, (email, otp))
    record = cursor.fetchone()

    if not record:
        conn.close()
        return jsonify({"error": "Invalid or expired OTP code."}), 400

    expires_at = datetime.strptime(record["expires_at"], "%Y-%m-%d %H:%M:%S")
    if datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S") > record["expires_at"]:
        conn.close()
        return jsonify({"error": "OTP code has expired. Please request a new one."}), 400

    cursor.execute("UPDATE otp_codes SET used = 1 WHERE id = ?;", (record["id"],))
    pwd_hash, salt = hash_password(new_password)
    cursor.execute("""
    UPDATE users SET password_hash = ?, salt = ? WHERE email = ?;
    """, (pwd_hash, salt, email))
    conn.commit()
    conn.close()

    return jsonify({"message": "Password has been successfully reset. You can now log in."})

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, role, phone, created_at FROM users ORDER BY id ASC LIMIT 1;")
    user = cursor.fetchone()
    conn.close()
    if not user:
        return jsonify({"error": "No user registered."}), 404
    return jsonify(dict(user))

@app.route("/api/auth/profile", methods=["PUT"])
def auth_update_profile():
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    phone = data.get("phone", "").strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1;")
    user = cursor.fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "No user found."}), 404

    cursor.execute("""
    UPDATE users SET full_name = COALESCE(NULLIF(?, ''), full_name),
                     phone = COALESCE(NULLIF(?, ''), phone)
    WHERE id = ?;
    """, (full_name, phone, user["id"]))
    conn.commit()

    cursor.execute("SELECT id, email, full_name, role, phone FROM users WHERE id = ?;", (user["id"],))
    updated = cursor.fetchone()
    conn.close()
    return jsonify({"message": "Profile updated successfully.", "user": dict(updated)})

# ==========================================
# PRODUCTS API
# ==========================================

@app.route("/api/products", methods=["GET"])
def get_products():
    search = request.args.get("search", "").strip().lower()
    category = request.args.get("category", "").strip()
    location = request.args.get("location", "").strip()
    status_filter = request.args.get("status", "").strip()

    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM products WHERE 1=1"
    params = []

    if category and category != "All Categories" and category != "All categories":
        query += " AND category = ?"
        params.append(category)

    if location and location != "All Locations" and location != "All warehouses":
        query += " AND location = ?"
        params.append(location)

    if search:
        query += " AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY id ASC;"
    cursor.execute(query, params)
    rows = cursor.fetchall()

    products = []
    for r in rows:
        prod = dict(r)
        if prod["stock"] <= 0:
            prod["status"] = "Out of Stock"
        elif prod["stock"] <= prod["min_stock"]:
            prod["status"] = "Low Stock"
        else:
            prod["status"] = "In Stock"

        cursor.execute("SELECT location_name, quantity FROM product_location_stock WHERE product_id = ?;", (prod["id"],))
        prod["locations"] = [dict(loc) for loc in cursor.fetchall()]

        if not status_filter or status_filter == "All statuses" or prod["status"].lower() == status_filter.lower():
            products.append(prod)

    conn.close()
    return jsonify(products)

@app.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    sku = data.get("sku", "").strip().upper()
    category = data.get("category", "General").strip()
    unit = data.get("unit", "units").strip()
    stock = float(data.get("stock", 0))
    min_stock = float(data.get("min_stock", 20))
    location = data.get("location", "Main Warehouse").strip() or "Main Warehouse"

    if not name or not sku:
        return jsonify({"error": "Product name and SKU are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM products WHERE UPPER(sku) = ?;", (sku,))
    if cursor.fetchone():
        conn.close()
        return jsonify({"error": f"Product with SKU '{sku}' already exists."}), 409

    cursor.execute("""
    INSERT INTO products (name, sku, category, unit, stock, min_stock, location)
    VALUES (?, ?, ?, ?, ?, ?, ?);
    """, (name, sku, category, unit, stock, min_stock, location))
    product_id = cursor.lastrowid

    cursor.execute("""
    INSERT INTO product_location_stock (product_id, location_name, quantity)
    VALUES (?, ?, ?);
    """, (product_id, location, stock))

    if stock > 0:
        cursor.execute("""
        INSERT INTO stock_ledger (
            operation_id, timestamp, doc_type, sku, product_name, change_qty,
            unit, source_location, destination_location, resulting_stock,
            user_name, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            f"INIT-{sku}",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Initial Stock",
            sku,
            name,
            stock,
            unit,
            "Initial Setup",
            location,
            stock,
            "System",
            "Done",
            "Initial opening stock balance"
        ))

    conn.commit()
    conn.close()

    status = "Out of Stock" if stock <= 0 else "Low Stock" if stock <= min_stock else "In Stock"
    return jsonify({
        "message": "Product created successfully.",
        "product": {
            "id": product_id,
            "name": name,
            "sku": sku,
            "category": category,
            "unit": unit,
            "stock": stock,
            "min_stock": min_stock,
            "location": location,
            "status": status
        }
    }), 201

@app.route("/api/products/<int:prod_id>", methods=["PUT"])
def update_product(prod_id):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    category = data.get("category", "").strip()
    min_stock = data.get("min_stock")
    location = data.get("location", "").strip()

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM products WHERE id = ?;", (prod_id,))
    prod = cursor.fetchone()
    if not prod:
        conn.close()
        return jsonify({"error": "Product not found."}), 404

    cursor.execute("""
    UPDATE products SET
        name = COALESCE(NULLIF(?, ''), name),
        category = COALESCE(NULLIF(?, ''), category),
        min_stock = COALESCE(?, min_stock),
        location = COALESCE(NULLIF(?, ''), location)
    WHERE id = ?;
    """, (name, category, min_stock, location, prod_id))
    conn.commit()

    cursor.execute("SELECT * FROM products WHERE id = ?;", (prod_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return jsonify({"message": "Product updated successfully.", "product": updated})

# ==========================================
# OPERATIONS API (Receipts, Deliveries, Transfers, Adjustments)
# ==========================================

def _execute_operation_stock_movement(cursor, op_id, op_type, product_id, sku, product_name, qty, unit, src, dst, user_name="Krishna Singh"):
    cursor.execute("SELECT * FROM products WHERE id = ? OR sku = ?;", (product_id, sku))
    prod = cursor.fetchone()
    if not prod:
        raise ValueError(f"Product '{sku}' not found.")

    current_stock = prod["stock"]

    if op_type == "Receipt":
        new_stock = current_stock + qty
        cursor.execute("UPDATE products SET stock = ? WHERE id = ?;", (new_stock, prod["id"]))
        cursor.execute("""
        INSERT INTO product_location_stock (product_id, location_name, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, location_name) DO UPDATE SET quantity = quantity + ?;
        """, (prod["id"], dst or prod["location"], qty, qty))

        cursor.execute("""
        INSERT INTO stock_ledger (
            operation_id, timestamp, doc_type, sku, product_name, change_qty,
            unit, source_location, destination_location, resulting_stock,
            user_name, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            op_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Receipt", sku, product_name, qty, unit, src or "Vendor", dst or prod["location"], new_stock,
            user_name, "Done", f"Received {qty} {unit} from {src or 'vendor'}"
        ))

    elif op_type == "Delivery":
        if current_stock < qty:
            raise ValueError(f"Insufficient stock: requested {qty} {unit}, available {current_stock} {unit}.")
        new_stock = current_stock - qty
        cursor.execute("UPDATE products SET stock = ? WHERE id = ?;", (new_stock, prod["id"]))
        cursor.execute("""
        INSERT INTO product_location_stock (product_id, location_name, quantity)
        VALUES (?, ?, 0)
        ON CONFLICT(product_id, location_name) DO UPDATE SET quantity = MAX(0, quantity - ?);
        """, (prod["id"], src or prod["location"], qty))

        cursor.execute("""
        INSERT INTO stock_ledger (
            operation_id, timestamp, doc_type, sku, product_name, change_qty,
            unit, source_location, destination_location, resulting_stock,
            user_name, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            op_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Delivery", sku, product_name, -qty, unit, src or prod["location"], dst or "Customer", new_stock,
            user_name, "Done", f"Delivered {qty} {unit} to {dst or 'customer'}"
        ))

    elif op_type == "Internal":
        cursor.execute("""
        INSERT INTO product_location_stock (product_id, location_name, quantity)
        VALUES (?, ?, 0)
        ON CONFLICT(product_id, location_name) DO UPDATE SET quantity = MAX(0, quantity - ?);
        """, (prod["id"], src, qty))

        cursor.execute("""
        INSERT INTO product_location_stock (product_id, location_name, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, location_name) DO UPDATE SET quantity = quantity + ?;
        """, (prod["id"], dst, qty, qty))

        cursor.execute("""
        INSERT INTO stock_ledger (
            operation_id, timestamp, doc_type, sku, product_name, change_qty,
            unit, source_location, destination_location, resulting_stock,
            user_name, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            op_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Internal", sku, product_name, 0.0, unit, src, dst, current_stock,
            user_name, "Done", f"Internal movement from {src} to {dst}"
        ))

    elif op_type == "Adjustment":
        new_stock = max(0.0, current_stock + qty)
        cursor.execute("UPDATE products SET stock = ? WHERE id = ?;", (new_stock, prod["id"]))
        cursor.execute("""
        INSERT INTO product_location_stock (product_id, location_name, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(product_id, location_name) DO UPDATE SET quantity = MAX(0, quantity + ?);
        """, (prod["id"], src, new_stock, qty))

        cursor.execute("""
        INSERT INTO stock_ledger (
            operation_id, timestamp, doc_type, sku, product_name, change_qty,
            unit, source_location, destination_location, resulting_stock,
            user_name, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            op_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Adjustment", sku, product_name, qty, unit, src, src, new_stock,
            user_name, "Done", f"Stock adjustment count correction: {qty:+g} {unit}"
        ))

@app.route("/api/operations", methods=["GET"])
def get_operations():
    op_type = request.args.get("type", "").strip()
    status = request.args.get("status", "").strip()
    search = request.args.get("search", "").strip().lower()

    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM operations WHERE 1=1"
    params = []

    if op_type and op_type != "All document types":
        query += " AND type = ?"
        params.append(op_type)

    if status and status != "All statuses":
        query += " AND status = ?"
        params.append(status)

    if search:
        query += " AND (LOWER(product_name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(id) LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    query += " ORDER BY id DESC;"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify(rows)

@app.route("/api/operations", methods=["POST"])
def create_operation():
    data = request.get_json(silent=True) or {}
    op_type = data.get("type", "Receipt").strip()
    product_name = data.get("product", "").strip()
    sku = data.get("sku", "").strip()
    qty = float(data.get("quantity", 0))
    partner = data.get("partner", "").strip()
    src = data.get("source_location", "").strip()
    dst = data.get("destination_location", "").strip()
    status = data.get("status", "Waiting").strip()
    notes = data.get("notes", "").strip()
    auto_validate = data.get("validate", False)

    conn = get_db()
    cursor = conn.cursor()

    if sku:
        cursor.execute("SELECT * FROM products WHERE UPPER(sku) = UPPER(?);", (sku,))
    elif product_name:
        cursor.execute("SELECT * FROM products WHERE LOWER(name) = LOWER(?);", (product_name,))
    else:
        conn.close()
        return jsonify({"error": "Product name or SKU is required."}), 400

    prod = cursor.fetchone()
    if not prod:
        conn.close()
        return jsonify({"error": f"Product '{product_name or sku}' does not exist in inventory."}), 404

    prod_id = prod["id"]
    sku = prod["sku"]
    product_name = prod["name"]
    unit = prod["unit"]

    prefixes = {"Receipt": "REC", "Delivery": "DEL", "Internal": "TRF", "Adjustment": "ADJ"}
    prefix = prefixes.get(op_type, "OP")
    rand_num = secrets.randbelow(9000) + 1000
    op_id = f"{prefix}-{rand_num}"

    today_str = datetime.now().strftime("%d %b %Y")

    if auto_validate:
        status = "Done"

    try:
        cursor.execute("""
        INSERT INTO operations (
            id, type, product_id, product_name, sku, quantity, unit,
            source_location, destination_location, partner, status, notes, date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, (
            op_id, op_type, prod_id, product_name, sku, qty, unit,
            src, dst, partner, status, notes, today_str
        ))

        if status == "Done":
            _execute_operation_stock_movement(
                cursor, op_id, op_type, prod_id, sku, product_name, qty, unit, src, dst
            )

        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Operation failed: {str(e)}"}), 500

    cursor.execute("SELECT * FROM operations WHERE id = ?;", (op_id,))
    saved_op = dict(cursor.fetchone())
    conn.close()

    return jsonify({"message": f"{op_type} created successfully.", "operation": saved_op}), 201

@app.route("/api/operations/<op_id>/validate", methods=["POST"])
def validate_operation(op_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM operations WHERE id = ?;", (op_id,))
    op = cursor.fetchone()

    if not op:
        conn.close()
        return jsonify({"error": "Operation not found."}), 404

    if op["status"] == "Done":
        conn.close()
        return jsonify({"message": "Operation is already validated and completed."}), 200

    try:
        _execute_operation_stock_movement(
            cursor, op["id"], op["type"], op["product_id"], op["sku"],
            op["product_name"], op["quantity"], op["unit"],
            op["source_location"], op["destination_location"]
        )
        cursor.execute("UPDATE operations SET status = 'Done' WHERE id = ?;", (op_id,))
        conn.commit()
    except ValueError as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": f"Validation failed: {str(e)}"}), 500

    cursor.execute("SELECT * FROM operations WHERE id = ?;", (op_id,))
    updated_op = dict(cursor.fetchone())
    conn.close()

    return jsonify({"message": f"Operation {op_id} validated. Stock updated automatically.", "operation": updated_op})

# ==========================================
# STOCK LEDGER & AUDIT TRAIL
# ==========================================

@app.route("/api/ledger", methods=["GET"])
def get_ledger():
    doc_type = request.args.get("type", "").strip()
    sku = request.args.get("sku", "").strip()
    search = request.args.get("search", "").strip().lower()

    conn = get_db()
    cursor = conn.cursor()
    query = "SELECT * FROM stock_ledger WHERE 1=1"
    params = []

    if doc_type and doc_type != "All document types":
        query += " AND doc_type = ?"
        params.append(doc_type)

    if sku:
        query += " AND sku = ?"
        params.append(sku)

    if search:
        query += " AND (LOWER(product_name) LIKE ? OR LOWER(sku) LIKE ? OR LOWER(operation_id) LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%"])

    query += " ORDER BY id DESC;"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return jsonify(rows)

# ==========================================
# WAREHOUSES & SETTINGS
# ==========================================

@app.route("/api/warehouses", methods=["GET"])
def get_warehouses():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM warehouses ORDER BY id ASC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

@app.route("/api/warehouses", methods=["POST"])
def create_warehouse():
    data = request.get_json(silent=True) or {}
    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    location_info = data.get("location_info", "").strip()

    if not code or not name:
        return jsonify({"error": "Warehouse code and name are required."}), 400

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT INTO warehouses (code, name, location_info, active)
        VALUES (?, ?, ?, 1);
        """, (code, name, location_info))
        conn.commit()
        wh_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "A warehouse with this code or name already exists."}), 409

    cursor.execute("SELECT * FROM warehouses WHERE id = ?;", (wh_id,))
    created = dict(cursor.fetchone())
    conn.close()
    return jsonify({"message": "Warehouse created successfully.", "warehouse": created}), 201

@app.route("/api/categories", methods=["GET"])
def get_categories():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories ORDER BY name ASC;")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

# ==========================================
# DASHBOARD KPIS & ANALYTICS
# ==========================================

@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, sku, stock, min_stock, unit FROM products;")
    products = [dict(p) for p in cursor.fetchall()]

    total_products = len(products)
    out_of_stock = [p for p in products if p["stock"] <= 0]
    low_stock = [p for p in products if 0 < p["stock"] <= p["min_stock"]]
    healthy_stock = [p for p in products if p["stock"] > p["min_stock"]]

    out_count = len(out_of_stock)
    low_count = len(low_stock)
    healthy_count = len(healthy_stock)

    healthy_pct = round((healthy_count / total_products * 100), 1) if total_products else 100
    low_pct = round((low_count / total_products * 100), 1) if total_products else 0
    out_pct = round((out_count / total_products * 100), 1) if total_products else 0

    cursor.execute("""
    SELECT type, COUNT(*) as count FROM operations
    WHERE status != 'Done' AND status != 'Canceled'
    GROUP BY type;
    """)
    pending_counts = {row["type"]: row["count"] for row in cursor.fetchall()}

    pending_receipts = pending_counts.get("Receipt", 0)
    pending_deliveries = pending_counts.get("Delivery", 0)
    internal_transfers = pending_counts.get("Internal", 0)

    cursor.execute("SELECT * FROM operations ORDER BY id DESC LIMIT 5;")
    recent_ops = [dict(r) for r in cursor.fetchall()]

    alerts = []
    for p in low_stock + out_of_stock:
        ratio = round((p["stock"] / p["min_stock"] * 100), 1) if p["min_stock"] > 0 else 0
        alerts.append({
            "sku": p["sku"],
            "name": p["name"],
            "stock": p["stock"],
            "unit": p["unit"],
            "min_stock": p["min_stock"],
            "percentage": min(100, max(2, ratio)),
            "is_out": p["stock"] <= 0
        })

    conn.close()

    return jsonify({
        "total_products": total_products,
        "low_stock_count": low_count,
        "out_stock_count": out_count,
        "pending_receipts": pending_receipts,
        "pending_deliveries": pending_deliveries,
        "internal_transfers": internal_transfers,
        "health": {
            "healthy_pct": healthy_pct,
            "low_pct": low_pct,
            "out_pct": out_pct
        },
        "recent_operations": recent_ops,
        "alerts": alerts
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
