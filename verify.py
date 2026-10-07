import sys
import os

sys.path.insert(0, os.path.abspath('backend'))
from app.database import get_db_connection


def verify():
    print("=== DATABASE CONNECTION ===")
    conn = get_db_connection()
    if not conn:
        print("Failed to connect.")
        return
    cursor = conn.cursor()
    cursor.execute("SHOW DATABASES;")
    dbs = [row[0] for row in cursor.fetchall()]
    print("Databases:", "neo_metaliks_nms" in dbs)
    
    cursor.execute("USE neo_metaliks_nms;")
    cursor.execute("SHOW TABLES;")
    tables = [row[0] for row in cursor.fetchall()]
    print("Tables:", tables)

    for t in tables:
        print(f"\n--- DESCRIBE {t} ---")
        cursor.execute(f"DESCRIBE {t};")
        for row in cursor.fetchall():
            print(row)
        
        print(f"\n--- SHOW CREATE TABLE {t} ---")
        cursor.execute(f"SHOW CREATE TABLE {t};")
        print(cursor.fetchone()[1])
        
    print("\n--- ADMINS COUNT ---")
    cursor.execute("SELECT COUNT(*) FROM admins;")
    print("Admins count:", cursor.fetchone()[0])
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    verify()
