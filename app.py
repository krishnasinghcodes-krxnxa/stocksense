from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# In-memory inventory store
PRODUCTS = [
    {
        "name": "Steel Rods",
        "sku": "STL-001",
        "category": "Raw Material",
        "stock": 1240,
        "unit": "kg",
        "location": "Main Warehouse",
        "status": "In Stock"
    },
    {
        "name": "Office Chairs",
        "sku": "CHR-102",
        "category": "Furniture",
        "stock": 86,
        "unit": "units",
        "location": "Warehouse 1",
        "status": "In Stock"
    },
    {
        "name": "Copper Wire",
        "sku": "CPR-208",
        "category": "Electrical",
        "stock": 18,
        "unit": "kg",
        "location": "Rack B",
        "status": "Low Stock"
    },
    {
        "name": "Steel Plates",
        "sku": "STP-309",
        "category": "Raw Material",
        "stock": 0,
        "unit": "kg",
        "location": "Production Floor",
        "status": "Out of Stock"
    }
]

OPERATIONS = [
    {
        "id": "REC-1042",
        "type": "Receipt",
        "product": "Steel Rods",
        "qty": "+50 kg",
        "location": "Main Warehouse",
        "status": "Done",
        "date": "26 Sep 2026"
    },
    {
        "id": "DEL-0821",
        "type": "Delivery",
        "product": "Office Chairs",
        "qty": "-10 units",
        "location": "Warehouse 1",
        "status": "Ready",
        "date": "26 Sep 2026"
    },
    {
        "id": "TRF-0448",
        "type": "Internal",
        "product": "Steel Rods",
        "qty": "120 kg",
        "location": "Main → Production",
        "status": "Waiting",
        "date": "25 Sep 2026"
    },
    {
        "id": "ADJ-0192",
        "type": "Adjustment",
        "product": "Copper Wire",
        "qty": "-3 kg",
        "location": "Rack B",
        "status": "Done",
        "date": "25 Sep 2026"
    }
]


@app.route("/")
def home():
    return jsonify({
        "message": "StockSense API is running!",
        "status": "online",
        "version": "1.1.0"
    })


@app.route("/api/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "StockSense API",
        "version": "1.1.0"
    }), 200


@app.route("/api/products", methods=["GET"])
def get_products():
    category = request.args.get("category")
    if category:
        filtered = [p for p in PRODUCTS if p.get("category", "").lower() == category.lower()]
        return jsonify({"products": filtered, "count": len(filtered)}), 200
    return jsonify({"products": PRODUCTS, "count": len(PRODUCTS)}), 200


@app.route("/api/products", methods=["POST"])
def add_product():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    sku = data.get("sku")
    if not name or not sku:
        return jsonify({"error": "Missing required fields: 'name' and 'sku'"}), 400

    # Check for duplicate SKU
    if any(p["sku"].upper() == sku.upper() for p in PRODUCTS):
        return jsonify({"error": f"Product with SKU '{sku}' already exists"}), 409

    stock = int(data.get("stock", 0))
    status = "Out of Stock" if stock == 0 else ("Low Stock" if stock < 20 else "In Stock")

    new_product = {
        "name": name.strip(),
        "sku": sku.strip().upper(),
        "category": data.get("category", "General").strip(),
        "stock": stock,
        "unit": data.get("unit", "units").strip(),
        "location": data.get("location", "Main Warehouse").strip(),
        "status": status
    }
    PRODUCTS.append(new_product)
    return jsonify({"message": "Product created successfully", "product": new_product}), 201


@app.route("/api/operations", methods=["GET"])
def get_operations():
    op_type = request.args.get("type")
    if op_type:
        filtered = [op for op in OPERATIONS if op.get("type", "").lower() == op_type.lower()]
        return jsonify({"operations": filtered, "count": len(filtered)}), 200
    return jsonify({"operations": OPERATIONS, "count": len(OPERATIONS)}), 200


@app.route("/api/stats", methods=["GET"])
def get_stats():
    total_products = len(PRODUCTS)
    low_stock = sum(1 for p in PRODUCTS if 0 < p.get("stock", 0) < 20)
    out_of_stock = sum(1 for p in PRODUCTS if p.get("stock", 0) == 0)
    in_stock = sum(1 for p in PRODUCTS if p.get("stock", 0) >= 20)
    total_operations = len(OPERATIONS)

    return jsonify({
        "total_products": total_products,
        "in_stock": in_stock,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "total_operations": total_operations
    }), 200


if __name__ == "__main__":
    app.run(debug=True)
