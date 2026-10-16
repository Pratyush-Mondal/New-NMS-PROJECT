from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import get_db_connection
from app.auth import get_admin_from_token
from app.report_analytics import generate_report_data, create_excel_report, create_csv_report, create_zip_report
from datetime import datetime
import threading
import time

security = HTTPBearer()

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    admin = get_admin_from_token(credentials.credentials)
    if not admin:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or expired session.")
    return admin

router = APIRouter()

def record_status_change_alert(db, cursor, source_type: str, code: str, name: str, old_status: str, new_status: str):
    """Records an alert and log whenever an asset transitions between Online and Offline."""
    if not old_status:
        if new_status == "Offline":
            old_status = "Online"
        else:
            return None
    if old_status == new_status:
        return None
    try:
        now_dt = datetime.now()
        disp_name = (name or code).strip()
        # Always resolve previous active/acknowledged alerts for this asset before recording new transition
        cursor.execute("""
            UPDATE alerts SET status = 'Resolved' WHERE source_name = %s AND status IN ('New', 'Acknowledged')
        """, (code,))

        if new_status == "Offline":
            sev = "Critical" if source_type == "Device" else "Warning"
            msg = f"{source_type} {code} ({disp_name}) went Offline"
            cursor.execute("""
                INSERT INTO alerts (source_type, source_name, message, severity, status, created_at)
                VALUES (%s, %s, %s, %s, 'New', %s)
            """, (source_type, code, msg, sev, now_dt))
            cursor.execute("""
                INSERT INTO logs (event_type, source_name, description, created_at)
                VALUES ('Status Change', %s, %s, %s)
            """, (code, msg, now_dt))
        elif new_status == "Online":
            msg = f"{source_type} {code} ({disp_name}) restored Online"
            cursor.execute("""
                INSERT INTO alerts (source_type, source_name, message, severity, status, created_at)
                VALUES (%s, %s, %s, 'Info', 'New', %s)
            """, (source_type, code, msg, now_dt))
            cursor.execute("""
                INSERT INTO logs (event_type, source_name, description, created_at)
                VALUES ('Status Change', %s, %s, %s)
            """, (code, msg, now_dt))
        if db:
            db.commit()
        return msg
    except Exception as e:
        print(f"[Alert Record Error]: {e}")
        return None


_last_sync_offline_time = 0.0

def sync_offline_alerts(cursor, db, force=False):
    """Ensure offline assets have an active alert recorded without duplicating or resurrecting acknowledged/resolved ones."""
    global _last_sync_offline_time
    now_ts = time.time()
    if not force and (now_ts - _last_sync_offline_time) < 3:
        return
    _last_sync_offline_time = now_ts
    try:
        now_dt = datetime.now()
        # 1. Devices
        cursor.execute("SELECT device_code, device_name, status FROM devices WHERE status = 'Offline'")
        for d in cursor.fetchall():
            cursor.execute("""
                SELECT id, status, severity, message FROM alerts 
                WHERE source_name = %s 
                  AND status IN ('New', 'Acknowledged')
                  AND severity IN ('Critical', 'Warning')
                LIMIT 1
            """, (d['device_code'],))
            existing_active = cursor.fetchone()
            if not existing_active:
                cursor.execute("UPDATE alerts SET status = 'Resolved' WHERE source_name = %s AND status IN ('New', 'Acknowledged')", (d['device_code'],))
                msg = f"Device {d['device_code']} ({d['device_name'] or d['device_code']}) went Offline"
                cursor.execute("""
                    INSERT INTO alerts (source_type, source_name, message, severity, status, created_at)
                    VALUES ('Device', %s, %s, 'Critical', 'New', %s)
                """, (d['device_code'], msg, now_dt))
                cursor.execute("""
                    INSERT INTO logs (event_type, source_name, description, created_at)
                    VALUES ('Status Change', %s, %s, %s)
                """, (d['device_code'], msg, now_dt))

        # 2. Cameras
        cursor.execute("SELECT camera_code, camera_name, status FROM cameras WHERE status = 'Offline'")
        for c in cursor.fetchall():
            cursor.execute("""
                SELECT id, status, severity, message FROM alerts 
                WHERE source_name = %s 
                  AND status IN ('New', 'Acknowledged')
                  AND severity IN ('Critical', 'Warning')
                LIMIT 1
            """, (c['camera_code'],))
            existing_active = cursor.fetchone()
            if not existing_active:
                cursor.execute("UPDATE alerts SET status = 'Resolved' WHERE source_name = %s AND status IN ('New', 'Acknowledged')", (c['camera_code'],))
                msg = f"Camera {c['camera_code']} ({c['camera_name'] or c['camera_code']}) went Offline"
                cursor.execute("""
                    INSERT INTO alerts (source_type, source_name, message, severity, status, created_at)
                    VALUES ('Camera', %s, %s, 'Warning', 'New', %s)
                """, (c['camera_code'], msg, now_dt))
                cursor.execute("""
                    INSERT INTO logs (event_type, source_name, description, created_at)
                    VALUES ('Status Change', %s, %s, %s)
                """, (c['camera_code'], msg, now_dt))

        # 3. Desktops
        cursor.execute("SELECT desktop_code, department, status FROM desktops WHERE status = 'Offline'")
        for dk in cursor.fetchall():
            cursor.execute("""
                SELECT id, status, severity, message FROM alerts 
                WHERE source_name = %s 
                  AND status IN ('New', 'Acknowledged')
                  AND severity IN ('Critical', 'Warning')
                LIMIT 1
            """, (dk['desktop_code'],))
            existing_active = cursor.fetchone()
            if not existing_active:
                cursor.execute("UPDATE alerts SET status = 'Resolved' WHERE source_name = %s AND status IN ('New', 'Acknowledged')", (dk['desktop_code'],))
                msg = f"Desktop {dk['desktop_code']} ({dk['department'] or dk['desktop_code']}) went Offline"
                cursor.execute("""
                    INSERT INTO alerts (source_type, source_name, message, severity, status, created_at)
                    VALUES ('Desktop', %s, %s, 'Warning', 'New', %s)
                """, (dk['desktop_code'], msg, now_dt))
                cursor.execute("""
                    INSERT INTO logs (event_type, source_name, description, created_at)
                    VALUES ('Status Change', %s, %s, %s)
                """, (dk['desktop_code'], msg, now_dt))

        # 4. Auto-resolve any lingering offline alerts for assets that are now Online
        cursor.execute("""
            UPDATE alerts a
            JOIN devices d ON a.source_name = d.device_code
            SET a.status = 'Resolved'
            WHERE d.status = 'Online' AND a.status IN ('New', 'Acknowledged') AND a.severity IN ('Critical', 'Warning')
        """)
        cursor.execute("""
            UPDATE alerts a
            JOIN cameras c ON a.source_name = c.camera_code
            SET a.status = 'Resolved'
            WHERE c.status = 'Online' AND a.status IN ('New', 'Acknowledged') AND a.severity IN ('Critical', 'Warning')
        """)
        cursor.execute("""
            UPDATE alerts a
            JOIN desktops dk ON a.source_name = dk.desktop_code
            SET a.status = 'Resolved'
            WHERE dk.status = 'Online' AND a.status IN ('New', 'Acknowledged') AND a.severity IN ('Critical', 'Warning')
        """)

        # Deduplicate keeping the NEWEST alert (delete older duplicates with a1.id < a2.id)
        cursor.execute('''
            DELETE a1 FROM alerts a1
            JOIN alerts a2 ON a1.source_name = a2.source_name AND a1.id < a2.id
            WHERE a1.status = 'New' AND a2.status = 'New'
        ''')
        if db:
            db.commit()
    except Exception as e:
        print(f"[Sync Offline Alerts Error]: {e}")


@router.get("/api/dashboard/stats")
def get_dashboard_stats(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        sync_offline_alerts(cursor, db)
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM devices")
        dev_stats = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM cameras")
        cam_stats = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM desktops")
        desk_stats = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as c FROM alerts WHERE status IN ('New', 'Acknowledged')")
        alerts_count = cursor.fetchone()["c"]

        total = int(dev_stats["t"] or 0) + int(cam_stats["t"] or 0) + int(desk_stats["t"] or 0)
        online = int(dev_stats["o"] or 0) + int(cam_stats["o"] or 0) + int(desk_stats["o"] or 0)
        offline = total - online

        return {
            "success": True,
            "total_devices": total,
            "online_devices": online,
            "offline_devices": offline,
            "active_alerts": alerts_count,
            "network_load": "Stable traffic",
            "breakdown": {
                "devices": {"total": int(dev_stats["t"] or 0), "online": int(dev_stats["o"] or 0)},
                "cameras": {"total": int(cam_stats["t"] or 0), "online": int(cam_stats["o"] or 0)},
                "desktops": {"total": int(desk_stats["t"] or 0), "online": int(desk_stats["o"] or 0)}
            }
        }
    finally:
        cursor.close()
        db.close()

@router.get("/api/network-map")
def get_network_map(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT device_code, device_name, ip_address, location, status, last_latency_ms FROM devices")
        return {"success": True, "nodes": cursor.fetchall()}
    finally:
        cursor.close()
        db.close()

@router.get("/api/alerts")
def get_alerts(status: str = None, admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500)
    cursor = db.cursor(dictionary=True)
    try:
        sync_offline_alerts(cursor, db)
        if status:
            cursor.execute("SELECT * FROM alerts WHERE status = %s ORDER BY created_at DESC LIMIT 200", (status,))
        else:
            cursor.execute("SELECT * FROM alerts ORDER BY CASE WHEN status = 'New' THEN 0 WHEN status = 'Acknowledged' THEN 1 ELSE 2 END, created_at DESC LIMIT 200")
        return {"success": True, "alerts": cursor.fetchall()}
    finally:
        cursor.close()
        db.close()

@router.put("/api/alerts/acknowledge")
def ack_alerts(admin=Depends(verify_admin)):
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE alerts SET status='Acknowledged' WHERE status='New'")
        db.commit()
        return {"success": True, "message": "All active alerts acknowledged"}
    finally:
        cursor.close()
        db.close()

@router.post("/api/alerts/clear")
@router.delete("/api/alerts")
def clear_all_alerts(admin=Depends(verify_admin)):
    db = get_db_connection()
    cursor = db.cursor()
    try:
        cursor.execute("UPDATE alerts SET status='Resolved' WHERE status IN ('New', 'Acknowledged')")
        db.commit()
        return {"success": True, "message": "All alerts cleared"}
    finally:
        cursor.close()
        db.close()

@router.get("/api/reports")
def get_reports(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT device_code as id, device_name as name, 'Device' as type, status, ip_address as ip, uptime_percent as uptime FROM devices")
        devs = cursor.fetchall()
        cursor.execute("SELECT camera_code as id, camera_name as name, 'CCTV' as type, status, ip_address as ip, uptime_percent as uptime FROM cameras")
        cams = cursor.fetchall()
        cursor.execute("SELECT desktop_code as id, department as name, 'Desktop' as type, status, ip_address as ip, uptime_percent as uptime FROM desktops")
        desks = cursor.fetchall()
        
        return {"success": True, "report": devs + cams + desks}
    finally:
        cursor.close()
        db.close()

@router.get("/api/reports/analytics")
def get_reports_analytics(from_date: str = None, to_date: str = None):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        return generate_report_data(db, from_date, to_date)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    finally:
        db.close()

@router.get("/api/reports/export/excel")
def export_reports_excel(from_date: str = None, to_date: str = None):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        report_data = generate_report_data(db, from_date, to_date)
        excel_bytes = create_excel_report(report_data)
        f_from = report_data["period"]["from_date"]
        f_to = report_data["period"]["to_date"]
        filename = f"Neo_Metaliks_Monitoring_Report_{f_from}_to_{f_to}.xlsx"
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    finally:
        db.close()

@router.get("/api/reports/export/csv")
def export_reports_csv(from_date: str = None, to_date: str = None):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        report_data = generate_report_data(db, from_date, to_date)
        csv_content = create_csv_report(report_data)
        f_from = report_data["period"]["from_date"]
        f_to = report_data["period"]["to_date"]
        filename = f"Neo_Metaliks_Monitoring_Report_{f_from}_to_{f_to}.csv"
        return Response(
            content=csv_content.encode("utf-8"),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    finally:
        db.close()

@router.get("/api/reports/export/zip")
def export_reports_zip(from_date: str = None, to_date: str = None):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        report_data = generate_report_data(db, from_date, to_date)
        zip_bytes = create_zip_report(report_data)
        f_from = report_data["period"]["from_date"]
        f_to = report_data["period"]["to_date"]
        filename = f"Neo_Metaliks_Monitoring_CSV_Bundle_{f_from}_to_{f_to}.zip"
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    finally:
        db.close()

last_status = {}

def status_monitor_loop():
    while True:
        db = None
        cursor = None
        try:
            db = get_db_connection()
            if db:
                cursor = db.cursor(dictionary=True)
                sync_offline_alerts(cursor, db)
                
                # Check transitions across all asset types
                for tbl, stype, c_col, n_col, pfx in [
                    ('devices', 'Device', 'device_code', 'device_name', 'dev_'),
                    ('cameras', 'Camera', 'camera_code', 'camera_name', 'cam_'),
                    ('desktops', 'Desktop', 'desktop_code', 'department', 'desk_')
                ]:
                    cursor.execute(f"SELECT id, {c_col} as code, {n_col} as name, status FROM {tbl}")
                    for r in cursor.fetchall():
                        key = f"{pfx}{r['id']}"
                        old = last_status.get(key)
                        if old is not None and old != r['status']:
                            record_status_change_alert(db, cursor, stype, r['code'], r['name'], old, r['status'])
                        last_status[key] = r['status']
        except Exception as e:
            pass
        finally:
            if cursor:
                try:
                    cursor.close()
                except Exception:
                    pass
            if db:
                try:
                    db.close()
                except Exception:
                    pass
        time.sleep(15)

threading.Thread(target=status_monitor_loop, daemon=True).start()


from pydantic import BaseModel

class GlobalSettingsRequest(BaseModel):
    alert: bool = True
    autoRecovery: bool = False
    autoRestart: bool = False
    emailNotification: bool = False
    soundNotification: bool = True
    automaticBackup: bool = False
    autoCleanup: bool = False
    historyRetention: int = 30
    backupRetention: int = 7

@router.put("/api/settings/global")
def update_global_settings(data: GlobalSettingsRequest, admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        settings_dict = data.dict()
        for k, v in settings_dict.items():
            cursor.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES (%s, %s) ON DUPLICATE KEY UPDATE setting_value = %s", (k, str(v), str(v)))
        db.commit()
        return {"success": True}
    finally:
        cursor.close()
        db.close()

@router.get("/api/settings/global")
def get_global_settings(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("SELECT setting_key, setting_value FROM system_settings")
        rows = cursor.fetchall()
        settings = {r["setting_key"]: r["setting_value"] for r in rows}
        return {"success": True, "settings": settings}
    finally:
        cursor.close()
        db.close()


# =========================================================
# ADMIN PANEL & SYSTEM MONITORING ENDPOINTS
# =========================================================

import hashlib
import secrets

SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64

def hash_scrypt_password(password: str) -> str:
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${derived.hex()}"


class AdminCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: str | None = None
    department: str | None = None
    location: str | None = None
    is_active: bool = True


class AdminStatusRequest(BaseModel):
    is_active: bool


@router.get("/api/admin/overview")
def get_admin_overview(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # 1. Admin counts
        cursor.execute("SELECT COUNT(*) as total, SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active FROM admins")
        admin_counts = cursor.fetchone()
        total_admins = int(admin_counts["total"] or 0)
        active_admins = int(admin_counts["active"] or 0)
        inactive_admins = total_admins - active_admins

        # 2. Asset counts
        cursor.execute("SELECT COUNT(*) as c FROM devices")
        dev_c = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) as c FROM cameras")
        cam_c = cursor.fetchone()["c"]
        cursor.execute("SELECT COUNT(*) as c FROM desktops")
        desk_c = cursor.fetchone()["c"]

        # 3. Recent activity removed per user request
        recent_activity = []

        return {
            "success": True,
            "total_admins": total_admins,
            "active_admins": active_admins,
            "inactive_admins": inactive_admins,
            "current_admin": {
                "id": admin["id"],
                "name": admin["name"],
                "email": admin["email"],
                "department": admin.get("department", "IT"),
                "location": admin.get("location", "NMS HQ")
            },
            "system_health": {
                "backend_status": "Operational (FastAPI Online)",
                "database_status": "Connected (MySQL nms)",
                "database_name": "nms",
                "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            },
            "monitoring_status": {
                "network_devices": dev_c,
                "cctv_cameras": cam_c,
                "desktops": desk_c,
                "service_status": "Active (Auto-monitoring running)"
            },
            "recent_activity": recent_activity
        }
    finally:
        cursor.close()
        db.close()


@router.get("/api/admin/list")
def list_administrators(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, name, email, phone, department, location, is_active, created_at, updated_at
            FROM admins
            ORDER BY id ASC
        """)
        admins = cursor.fetchall()
        for a in admins:
            if isinstance(a.get("created_at"), datetime):
                a["created_at"] = a["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if isinstance(a.get("updated_at"), datetime):
                a["updated_at"] = a["updated_at"].strftime("%Y-%m-%d %H:%M:%S")
            a["is_active"] = bool(a["is_active"])
        return {
            "success": True,
            "admins": admins,
            "total": len(admins)
        }
    finally:
        cursor.close()
        db.close()


@router.post("/api/admin/create")
def create_administrator(data: AdminCreateRequest, admin=Depends(verify_admin)):
    name = data.name.strip()
    email = data.email.strip().lower()
    password = data.password

    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Administrator name must be at least 2 characters.")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email address is required.")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        # Check duplicate email
        cursor.execute("SELECT id FROM admins WHERE LOWER(email) = %s LIMIT 1", (email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="An administrator with this email already exists.")

        pwd_hash = hash_scrypt_password(password)
        cursor.execute("""
            INSERT INTO admins (name, email, password_hash, phone, department, location, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            name,
            email,
            pwd_hash,
            data.phone.strip() if data.phone else None,
            data.department.strip() if data.department else None,
            data.location.strip() if data.location else None,
            1 if data.is_active else 0
        ))
        db.commit()
        new_id = cursor.lastrowid
        return {
            "success": True,
            "message": f"Administrator '{name}' created successfully.",
            "admin_id": new_id
        }
    finally:
        cursor.close()
        db.close()


@router.put("/api/admin/{admin_id}/status")
def update_admin_status(admin_id: int, data: AdminStatusRequest, admin=Depends(verify_admin)):
    if int(admin["id"]) == int(admin_id) and not data.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own logged-in administrator account.")

    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name FROM admins WHERE id = %s LIMIT 1", (admin_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Administrator not found.")

        cursor.execute("UPDATE admins SET is_active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s", (
            1 if data.is_active else 0,
            admin_id
        ))
        db.commit()
        status_text = "activated" if data.is_active else "deactivated"
        return {
            "success": True,
            "message": f"Administrator '{target['name']}' successfully {status_text}."
        }
    finally:
        cursor.close()
        db.close()


@router.delete("/api/admin/{admin_id}")
def delete_administrator(admin_id: int, admin=Depends(verify_admin)):
    if int(admin["id"]) == int(admin_id):
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account.")

    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name FROM admins WHERE id = %s LIMIT 1", (admin_id,))
        target = cursor.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="Administrator not found.")

        # Ensure at least 1 active admin remains
        cursor.execute("SELECT COUNT(*) as c FROM admins WHERE is_active = 1 AND id != %s", (admin_id,))
        active_remaining = cursor.fetchone()["c"]
        if active_remaining < 1:
            raise HTTPException(status_code=400, detail="Cannot delete the only remaining active administrator.")

        cursor.execute("DELETE FROM admins WHERE id = %s", (admin_id,))
        db.commit()
        return {
            "success": True,
            "message": f"Administrator '{target['name']}' removed successfully."
        }
    finally:
        cursor.close()
        db.close()


class AlertSimulateRequest(BaseModel):
    asset_type: str | None = None
    target_status: str | None = None


@router.post("/api/alerts/simulate")
def simulate_status_alert(data: AlertSimulateRequest | None = None, admin=Depends(verify_admin)):
    """Simulates a live Online <-> Offline status transition on an asset and records an alert."""
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        req_type = data.asset_type.lower() if (data and data.asset_type) else None
        target_st = data.target_status if (data and data.target_status) else None

        table_specs = [
            ('devices', 'Device', 'device_code', 'device_name', 'dev_'),
            ('cameras', 'Camera', 'camera_code', 'camera_name', 'cam_'),
            ('desktops', 'Desktop', 'desktop_code', 'department', 'desk_')
        ]
        if req_type:
            table_specs = [t for t in table_specs if t[1].lower() == req_type]
            if not table_specs:
                raise HTTPException(status_code=400, detail="Invalid asset_type. Must be Device, Camera, or Desktop.")

        chosen = None
        chosen_spec = None
        for tbl, stype, c_col, n_col, pfx in table_specs:
            cursor.execute(f"SELECT id, {c_col} as code, {n_col} as name, status FROM {tbl} ORDER BY RAND() LIMIT 1")
            row = cursor.fetchone()
            if row:
                chosen = row
                chosen_spec = (tbl, stype, c_col, n_col, pfx)
                break

        if not chosen:
            raise HTTPException(status_code=404, detail="No assets available to simulate.")

        tbl, stype, c_col, n_col, pfx = chosen_spec
        old_status = chosen['status'] or 'Online'
        if target_st in ('Online', 'Offline'):
            new_status = target_st
        else:
            new_status = 'Offline' if old_status == 'Online' else 'Online'

        now = datetime.now()
        cursor.execute(f"UPDATE {tbl} SET status = %s, updated_at = %s WHERE id = %s", (new_status, now, chosen['id']))
        msg = record_status_change_alert(db, cursor, stype, chosen['code'], chosen['name'], old_status, new_status)
        db.commit()

        # Update cache so monitor loop tracks the new state
        key = f"{pfx}{chosen['id']}"
        last_status[key] = new_status

        return {
            "success": True,
            "asset_type": stype,
            "id": chosen['id'],
            "code": chosen['code'],
            "name": chosen['name'],
            "old_status": old_status,
            "new_status": new_status,
            "message": msg or f"{stype} {chosen['code']} ({chosen['name']}) is now {new_status}"
        }
    finally:
        cursor.close()
        db.close()


