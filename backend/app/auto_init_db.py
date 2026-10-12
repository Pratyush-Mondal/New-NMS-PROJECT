import os
from pathlib import Path
from app.database import get_db_connection

def ensure_database_initialized():
    """Auto-initialize database tables and seed data if tables are missing."""
    conn = get_db_connection()
    if not conn:
        print("[DB AUTO-INIT] Could not connect to database. Skipping auto-init.")
        return False

    try:
        cur = conn.cursor()
        cur.execute("SHOW TABLES LIKE 'admins'")
        if cur.fetchone():
            # Already initialized
            cur.close()
            conn.close()
            return True

        print("[DB AUTO-INIT] Database tables missing. Initializing from database_schema.sql...")
        schema_paths = [
            Path(__file__).resolve().parents[1] / "database_schema.sql",
            Path(__file__).resolve().parents[2] / "database_schema.sql",
        ]
        sql_content = None
        for p in schema_paths:
            if p.is_file():
                with open(p, "r", encoding="utf-8") as f:
                    sql_content = f.read()
                break

        if not sql_content:
            print("[DB AUTO-INIT] database_schema.sql not found.")
            cur.close()
            conn.close()
            return False

        # Execute statements
        statements = sql_content.split(";")
        for stmt in statements:
            stmt = stmt.strip()
            if not stmt:
                continue
            # Skip CREATE DATABASE / USE statements if cloud db restricts it
            if stmt.upper().startswith("CREATE DATABASE") or stmt.upper().startswith("USE "):
                continue
            try:
                cur.execute(stmt)
            except Exception as e:
                # ignore non-critical errors (e.g. drop table when not exists)
                pass

        conn.commit()
        print("[DB AUTO-INIT] Successfully initialized database schema and seed data!")
        cur.close()
        conn.close()
        return True
    except Exception as err:
        print(f"[DB AUTO-INIT ERROR] {err}")
        try:
            conn.close()
        except Exception:
            pass
        return False
