"""
StockSense Database Layer (SQLite stdlib)
Follows Ponytail (stdlib sqlite3, zero ORM bloat) and ECC (parameterized queries, ACID).
"""

import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "stocksense.db")

def get_db():
    active_path = os.environ.get("STOCKSENSE_DB", DB_PATH)
    conn = sqlite3.connect(active_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000
    ).hex()
    return hashed, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(new_hash, stored_hash)

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Inventory Manager',
        phone TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # OTP codes for password reset
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used INTEGER DEFAULT 0
    );
    """)

    # Warehouses
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS warehouses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT UNIQUE NOT NULL,
        location_info TEXT,
        active INTEGER DEFAULT 1
    );
    """)

    # Categories
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
    );
    """)

    # Products
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'units',
        stock REAL NOT NULL DEFAULT 0,
        min_stock REAL NOT NULL DEFAULT 20,
        location TEXT NOT NULL DEFAULT 'Main Warehouse',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Product stock breakdown per location
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS product_location_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        location_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE (product_id, location_name)
    );
    """)

    # Operations (Receipt, Delivery, Internal, Adjustment)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        sku TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        source_location TEXT,
        destination_location TEXT,
        partner TEXT,
        status TEXT NOT NULL DEFAULT 'Waiting',
        notes TEXT,
        created_by TEXT,
        date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Immutable Stock Ledger / Move History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS stock_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT,
        timestamp TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        sku TEXT NOT NULL,
        product_name TEXT NOT NULL,
        change_qty REAL NOT NULL,
        unit TEXT NOT NULL,
        source_location TEXT,
        destination_location TEXT,
        resulting_stock REAL NOT NULL,
        user_name TEXT,
        status TEXT NOT NULL DEFAULT 'Done',
        notes TEXT
    );
    """)

    conn.commit()

    # Seed initial demo data if tables are empty
    _seed_demo_data(cursor, conn)
    conn.close()

def _seed_demo_data(cursor, conn):
    cursor.execute("SELECT COUNT(*) as count FROM users;")
    if cursor.fetchone()["count"] == 0:
        pwd_hash, salt = hash_password("password123")
        cursor.execute("""
        INSERT INTO users (email, password_hash, salt, full_name, role, phone)
        VALUES (?, ?, ?, ?, ?, ?);
        """, ("krishna@example.com", pwd_hash, salt, "Krishna Singh", "Inventory Manager", "+91 98765 43210"))

    cursor.execute("SELECT COUNT(*) as count FROM warehouses;")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany("""
        INSERT INTO warehouses (code, name, location_info, active)
        VALUES (?, ?, ?, ?);
        """, [
            ("W1", "Main Warehouse", "Jalandhar • 8 locations", 1),
            ("W2", "Warehouse 1", "Jalandhar • 5 locations", 1),
            ("PF", "Production Floor", "Manufacturing • 4 locations", 1),
            ("RB", "Rack B", "Storage Bay 2", 1)
        ])

    cursor.execute("SELECT COUNT(*) as count FROM categories;")
    if cursor.fetchone()["count"] == 0:
        cursor.executemany("""
        INSERT INTO categories (name, description) VALUES (?, ?);
        """, [
            ("Raw Material", "Metals, alloys, raw fabrication stock"),
            ("Furniture", "Desks, chairs, commercial fixtures"),
            ("Electrical", "Cables, wiring, electronic accessories")
        ])

    cursor.execute("SELECT COUNT(*) as count FROM products;")
    if cursor.fetchone()["count"] == 0:
        demo_products = [
            ("Steel Rods", "STL-001", "Raw Material", 1240.0, "kg", 100.0, "Main Warehouse"),
            ("Office Chairs", "CHR-102", "Furniture", 86.0, "units", 20.0, "Warehouse 1"),
            ("Copper Wire", "CPR-208", "Electrical", 18.0, "kg", 25.0, "Rack B"),
            ("Steel Plates", "STP-309", "Raw Material", 0.0, "kg", 50.0, "Production Floor")
        ]
        for p in demo_products:
            cursor.execute("""
            INSERT INTO products (name, sku, category, stock, unit, min_stock, location)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """, p)
            prod_id = cursor.lastrowid
            cursor.execute("""
            INSERT INTO product_location_stock (product_id, location_name, quantity)
            VALUES (?, ?, ?);
            """, (prod_id, p[6], p[3]))

    cursor.execute("SELECT COUNT(*) as count FROM operations;")
    if cursor.fetchone()["count"] == 0:
        demo_ops = [
            ("REC-1042", "Receipt", 1, "Steel Rods", "STL-001", 50.0, "kg", "Steel Corp Supplies", "Main Warehouse", "Steel Corp Supplies", "Done", "26 Sep 2026"),
            ("DEL-0821", "Delivery", 2, "Office Chairs", "CHR-102", 10.0, "units", "Warehouse 1", "Apex Corp", "Apex Corp", "Ready", "26 Sep 2026"),
            ("TRF-0448", "Internal", 1, "Steel Rods", "STL-001", 120.0, "kg", "Main Warehouse", "Production Floor", "", "Waiting", "25 Sep 2026"),
            ("ADJ-0192", "Adjustment", 3, "Copper Wire", "CPR-208", -3.0, "kg", "Rack B", "Rack B", "", "Done", "25 Sep 2026")
        ]
        for op in demo_ops:
            cursor.execute("""
            INSERT INTO operations (id, type, product_id, product_name, sku, quantity, unit, source_location, destination_location, partner, status, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, op)

    cursor.execute("SELECT COUNT(*) as count FROM stock_ledger;")
    if cursor.fetchone()["count"] == 0:
        demo_ledger = [
            ("REC-1042", "2026-09-26 09:15:00", "Receipt", "STL-001", "Steel Rods", 50.0, "kg", "Steel Corp", "Main Warehouse", 1240.0, "Krishna Singh", "Done", "Vendor delivery received and verified"),
            ("DEL-0821", "2026-09-26 10:30:00", "Delivery", "CHR-102", "Office Chairs", -10.0, "units", "Warehouse 1", "Customer (Apex)", 86.0, "Krishna Singh", "Ready", "Picked & packed for dispatch"),
            ("TRF-0448", "2026-09-25 14:00:00", "Internal", "STL-001", "Steel Rods", 0.0, "kg", "Main Warehouse", "Production Floor", 1240.0, "Krishna Singh", "Waiting", "Shift stock for fabrication"),
            ("ADJ-0192", "2026-09-25 16:45:00", "Adjustment", "CPR-208", "Copper Wire", -3.0, "kg", "Rack B", "Rack B", 18.0, "Krishna Singh", "Done", "Physical cycle count discrepancy adjustment")
        ]
        for entry in demo_ledger:
            cursor.execute("""
            INSERT INTO stock_ledger (operation_id, timestamp, doc_type, sku, product_name, change_qty, unit, source_location, destination_location, resulting_stock, user_name, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, entry)

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
