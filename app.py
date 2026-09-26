"""
StockSense Server Entry Point
Runs the Flask application serving both the REST API and the Frontend.
"""

import os
from backend.app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting StockSense on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
