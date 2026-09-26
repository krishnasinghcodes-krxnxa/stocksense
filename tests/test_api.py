"""
Automated Test Suite for StockSense API
Following Matt Pocock's TDD & Engineering Rigor and Ponytail's minimal test philosophy.
"""

import unittest
import json
import os
import sys

# Setup environment
os.environ["FLASK_ENV"] = "testing"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEST_DB = os.path.join(BASE_DIR, "test_stocksense.db")
os.environ["STOCKSENSE_DB"] = TEST_DB

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app import app
from backend.db import get_db, init_db

class StockSenseTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(TEST_DB):
            os.remove(TEST_DB)
        init_db()

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB):
            try:
                os.remove(TEST_DB)
            except OSError:
                pass

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_01_health_check(self):
        response = self.app.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "healthy")

    def test_02_auth_login_and_otp_flow(self):
        # Default user login
        res = self.app.post("/api/auth/login", json={
            "email": "krishna@example.com",
            "password": "password123"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["full_name"], "Krishna Singh")

        # Forgot password -> generates OTP
        res_otp = self.app.post("/api/auth/forgot-password", json={
            "email": "krishna@example.com"
        })
        self.assertEqual(res_otp.status_code, 200)
        otp_data = res_otp.get_json()
        self.assertIn("otp", otp_data)
        otp = otp_data["otp"]

        # Reset password with valid OTP
        res_reset = self.app.post("/api/auth/reset-password", json={
            "email": "krishna@example.com",
            "otp": otp,
            "new_password": "newpassword456"
        })
        self.assertEqual(res_reset.status_code, 200)

        # Login with new password
        res_login_new = self.app.post("/api/auth/login", json={
            "email": "krishna@example.com",
            "password": "newpassword456"
        })
        self.assertEqual(res_login_new.status_code, 200)

        # Reset back for demo convenience
        res_otp2 = self.app.post("/api/auth/forgot-password", json={"email": "krishna@example.com"})
        self.app.post("/api/auth/reset-password", json={
            "email": "krishna@example.com",
            "otp": res_otp2.get_json()["otp"],
            "new_password": "password123"
        })

    def test_03_create_product(self):
        res = self.app.post("/api/products", json={
            "name": "Aluminum Bars",
            "sku": "ALU-500",
            "category": "Raw Material",
            "stock": 100.0,
            "unit": "kg",
            "min_stock": 25.0,
            "location": "Main Warehouse"
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data["product"]["sku"], "ALU-500")

        # Duplicate SKU rejection
        res_dup = self.app.post("/api/products", json={
            "name": "Aluminum Bars 2",
            "sku": "ALU-500",
            "category": "Raw Material"
        })
        self.assertEqual(res_dup.status_code, 409)

    def test_04_receipt_increases_stock_and_logs_ledger(self):
        # Get current stock
        res_prod = self.app.get("/api/products?search=ALU-500")
        prod = res_prod.get_json()[0]
        initial_stock = prod["stock"]

        # Create Receipt and validate
        res_rec = self.app.post("/api/operations", json={
            "type": "Receipt",
            "sku": "ALU-500",
            "quantity": 50.0,
            "partner": "Alu Suppliers Inc",
            "destination_location": "Main Warehouse",
            "validate": True
        })
        self.assertEqual(res_rec.status_code, 201)

        # Verify stock increased
        res_prod_after = self.app.get("/api/products?search=ALU-500")
        prod_after = res_prod_after.get_json()[0]
        self.assertEqual(prod_after["stock"], initial_stock + 50.0)

        # Verify Ledger entry exists
        res_ledger = self.app.get("/api/ledger?sku=ALU-500")
        ledger_entries = res_ledger.get_json()
        self.assertTrue(any(e["doc_type"] == "Receipt" and e["change_qty"] == 50.0 for e in ledger_entries))

    def test_05_delivery_decreases_stock_and_prevents_oversell(self):
        # Get current stock of ALU-500 (150 kg)
        res_prod = self.app.get("/api/products?search=ALU-500")
        current_stock = res_prod.get_json()[0]["stock"]

        # Attempt to deliver more than available
        res_over = self.app.post("/api/operations", json={
            "type": "Delivery",
            "sku": "ALU-500",
            "quantity": current_stock + 999.0,
            "partner": "Heavy Buyer",
            "source_location": "Main Warehouse",
            "validate": True
        })
        self.assertEqual(res_over.status_code, 400)

        # Valid delivery
        res_del = self.app.post("/api/operations", json={
            "type": "Delivery",
            "sku": "ALU-500",
            "quantity": 30.0,
            "partner": "Valid Buyer",
            "source_location": "Main Warehouse",
            "validate": True
        })
        self.assertEqual(res_del.status_code, 201)

        # Verify stock decreased
        res_prod_after = self.app.get("/api/products?search=ALU-500")
        self.assertEqual(res_prod_after.get_json()[0]["stock"], current_stock - 30.0)

    def test_06_internal_transfer_moves_locations(self):
        # Initial stock of ALU-500
        res_prod = self.app.get("/api/products?search=ALU-500")
        total_stock_before = res_prod.get_json()[0]["stock"]

        res_trf = self.app.post("/api/operations", json={
            "type": "Internal",
            "sku": "ALU-500",
            "quantity": 20.0,
            "source_location": "Main Warehouse",
            "destination_location": "Production Floor",
            "validate": True
        })
        self.assertEqual(res_trf.status_code, 201)

        # Total stock remains the same
        res_prod_after = self.app.get("/api/products?search=ALU-500")
        self.assertEqual(res_prod_after.get_json()[0]["stock"], total_stock_before)

    def test_07_stock_adjustment(self):
        # Adjust stock of ALU-500
        res_adj = self.app.post("/api/operations", json={
            "type": "Adjustment",
            "sku": "ALU-500",
            "quantity": -5.0,  # 5 kg damage/loss adjustment
            "source_location": "Main Warehouse",
            "validate": True
        })
        self.assertEqual(res_adj.status_code, 201)

    def test_08_dashboard_kpis(self):
        res = self.app.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("total_products", data)
        self.assertIn("health", data)
        self.assertIn("healthy_pct", data["health"])
        self.assertIn("pending_receipts", data)

if __name__ == "__main__":
    unittest.main()
