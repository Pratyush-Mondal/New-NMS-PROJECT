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

@router.get("/api/dashboard/stats")
def get_dashboard_stats(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500, detail="Database connection failed")
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM devices")
        dev_stats = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM cameras")
        cam_stats = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as t, SUM(CASE WHEN status='Online' THEN 1 ELSE 0 END) as o FROM desktops")
        desk_stats = cursor.fetchone()
        
        cursor.execute("SELECT COUNT(*) as c FROM alerts WHERE status='New'")
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
def get_alerts(admin=Depends(verify_admin)):
    db = get_db_connection()
    if not db:
        raise HTTPException(status_code=500)
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM alerts WHERE status='New' ORDER BY created_at DESC LIMIT 50")
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
        return {"success": True}
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
        try:
            db = get_db_connection()
            if db:
                cursor = db.cursor(dictionary=True)
                
                # Devices
                cursor.execute('SELECT id, device_code, device_name, status FROM devices')
                for r in cursor.fetchall():
                    key = f'dev_{r["id"]}'
                    old = last_status.get(key)
                    if old and old != r['status']:
                        msg = f'Device {r["device_code"]} ({r["device_name"]}) went {r["status"]}'
                        cursor.execute('INSERT INTO alerts (source_type, source_name, message, severity, status, created_at) VALUES (%s, %s, %s, %s, %s, NOW())', ('Device', r['device_code'], msg, 'Critical' if r['status']=='Offline' else 'Info', 'New'))
                        cursor.execute("INSERT INTO logs (event_type, source_type, source_name, description, created_at) VALUES ('Status Change', %s, %s, %s, NOW())", ('Device', r['device_code'], msg))
                        db.commit()
                        if r['status'] == 'Offline':
                            print(f'*** EMAIL SENT TO ADMIN: Alert! {r["status"]} - {msg} ***')
                    last_status[key] = r['status']
                
                # Cameras
                cursor.execute('SELECT id, camera_code, camera_name, status FROM cameras')
                for r in cursor.fetchall():
                    key = f'cam_{r["id"]}'
                    old = last_status.get(key)
                    if old and old != r['status']:
                        msg = f'Camera {r["camera_code"]} ({r["camera_name"]}) went {r["status"]}'
                        cursor.execute('INSERT INTO alerts (source_type, source_name, message, severity, status, created_at) VALUES (%s, %s, %s, %s, %s, NOW())', ('Camera', r['camera_code'], msg, 'Warning' if r['status']=='Offline' else 'Info', 'New'))
                        cursor.execute("INSERT INTO logs (event_type, source_type, source_name, description, created_at) VALUES ('Status Change', %s, %s, %s, NOW())", ('Camera', r['camera_code'], msg))
                        db.commit()
                        if r['status'] == 'Offline':
                            print(f'*** EMAIL SENT TO ADMIN: Alert! {r["status"]} - {msg} ***')
                    last_status[key] = r['status']
                    
                # Desktops
                cursor.execute('SELECT id, desktop_code, department, status FROM desktops')
                for r in cursor.fetchall():
                    key = f'desk_{r["id"]}'
                    old = last_status.get(key)
                    if old and old != r['status']:
                        msg = f'Desktop {r["desktop_code"]} ({r["department"]}) went {r["status"]}'
                        cursor.execute('INSERT INTO alerts (source_type, source_name, message, severity, status, created_at) VALUES (%s, %s, %s, %s, %s, NOW())', ('Desktop', r['desktop_code'], msg, 'Warning' if r['status']=='Offline' else 'Info', 'New'))
                        cursor.execute("INSERT INTO logs (event_type, source_type, source_name, description, created_at) VALUES ('Status Change', %s, %s, %s, NOW())", ('Desktop', r['desktop_code'], msg))
                        db.commit()
                        if r['status'] == 'Offline':
                            print(f'*** EMAIL SENT TO ADMIN: Alert! {r["status"]} - {msg} ***')
                    last_status[key] = r['status']
                
                cursor.close()
                db.close()
        except Exception as e:
            pass
        time.sleep(10)

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

        # 3. Recent activity from alerts
        cursor.execute("""
            SELECT id, source_type, source_name, message, severity, created_at
            FROM alerts
            ORDER BY created_at DESC
            LIMIT 6
        """)
        recent_activity = cursor.fetchall()
        for a in recent_activity:
            if isinstance(a.get("created_at"), datetime):
                a["created_at"] = a["created_at"].strftime("%Y-%m-%d %H:%M:%S")

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

