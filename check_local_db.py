import sys
import os
from pathlib import Path

# Add backend directory to sys.path
PROJECT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_DIR / "backend"))

def check_db():
    try:
        # pyrefly: ignore [missing-import]
        from app.database import get_db_connection
        conn = get_db_connection()
        if not conn:
            print("[ERROR] Database connection could not be established.")
            print("Please check your database configuration in backend\\.env.")
            return False

        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM devices")
        dev_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM cameras")
        cam_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM admins")
        admin_count = cur.fetchone()[0]

        cur.close()
        conn.close()

        print("[OK] Database connection verified successfully.")
        print(f"     Found {dev_count} registered devices, {cam_count} cameras, and {admin_count} active admin account(s).")
        return True
    except Exception as e:
        print(f"[ERROR] Database validation error: {e}")
        return False

if __name__ == "__main__":
    success = check_db()
    sys.exit(0 if success else 1)
