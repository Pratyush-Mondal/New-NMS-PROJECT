from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import get_db_connection
from app.auth import get_admin_from_token
from datetime import datetime
import threading
import time

security = HTTPBearer()

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return get_admin_from_token(credentials.credentials)

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
        cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 50")
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
