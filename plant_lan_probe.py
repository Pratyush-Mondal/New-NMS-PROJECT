import os
import sys
import time
import subprocess
import socket
import re
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# Ensure backend modules can be imported
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(PROJECT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Configure persistent logging (logs/plant_probe.log)
LOG_DIR = os.path.join(PROJECT_DIR, "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_FILE = os.path.join(LOG_DIR, "plant_probe.log")

logger = logging.getLogger("PlantProbe")
logger.setLevel(logging.INFO)

# Rotating file handler (5MB, 3 backups)
rfh = RotatingFileHandler(LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
rfh.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))
logger.addHandler(rfh)

# Console handler
try:
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%H:%M:%S"))
    logger.addHandler(ch)
except Exception:
    pass

from app.database import get_db_connection

_INSTANCE_LOCK_SOCK = None

def acquire_single_instance_lock(port: int = 49250) -> bool:
    """
    Prevent launching duplicate monitoring processes on the host.
    Binds a dedicated loopback port. The OS kernel automatically releases
    the socket when the process exits or terminates.
    """
    global _INSTANCE_LOCK_SOCK
    _INSTANCE_LOCK_SOCK = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _INSTANCE_LOCK_SOCK.bind(("127.0.0.1", port))
        return True
    except OSError:
        logger.warning(
            "Another instance of plant_lan_probe is already running (lock port %d in use). Exiting duplicate process cleanly.",
            port
        )
        return False

def ping_host(ip_address, timeout_sec=0.8):
    """
    Real ICMP / Socket ping directly from Plant LAN.
    Returns (is_online, latency_ms)
    """
    if not ip_address or not str(ip_address).strip():
        return False, None
    
    ip_str = str(ip_address).strip()
    
    # 1. System ping binary
    try:
        cmd = ["ping", "-n", "1", "-w", str(int(timeout_sec * 1000)), ip_str]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec + 0.5)
        if res.returncode == 0:
            match = re.search(r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms", res.stdout, re.IGNORECASE)
            lat = float(match.group(1)) if match else 2.0
            return True, max(0.5, lat)
    except Exception:
        pass
        
    # 2. Socket-based probe fallback (common ports: 80, 443, 554, 8000, 37777, 445, 135, 3389, 22)
    probe_ports = [80, 443, 554, 8000, 37777, 445, 135, 3389, 22]
    sock_timeout = min(timeout_sec, 0.4)
    for port in probe_ports:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(sock_timeout)
        t_start = time.perf_counter()
        try:
            ret = s.connect_ex((ip_str, port))
            t_elapsed = (time.perf_counter() - t_start) * 1000
            if ret == 0 or ret in (111, 10061): # connection successful or actively refused = host is ONLINE
                return True, round(max(0.5, t_elapsed), 2)
        except Exception:
            pass
        finally:
            try:
                s.close()
            except Exception:
                pass
                
    return False, None

def run_probe_cycle():
    """Execute one complete scan across Devices, Cameras, and Desktops and commit to TiDB Cloud."""
    db = get_db_connection()
    if not db:
        logger.error("Database connection failed. Retrying in next cycle...")
        return
        
    cursor = db.cursor(dictionary=True)
    try:
        now = datetime.now()
        
        # 1. Probe Devices
        cursor.execute("SELECT id, device_code, device_name, ip_address, status, last_latency_ms, total_checks, successful_checks FROM devices WHERE monitoring_enabled = 1")
        devices = cursor.fetchall()
        
        def probe_dev(d):
            is_online, lat = ping_host(d["ip_address"])
            return d, is_online, lat
            
        with ThreadPoolExecutor(max_workers=10) as executor:
            dev_results = list(executor.map(probe_dev, devices))
            
        dev_online = 0
        for d, is_online, lat in dev_results:
            st = "Online" if is_online else "Offline"
            if is_online:
                dev_online += 1
            tot = int(d.get("total_checks") or 0) + 1
            succ = int(d.get("successful_checks") or 0) + (1 if is_online else 0)
            upt = round((succ / tot) * 100, 2)
            lat_val = lat if is_online else None
            cursor.execute("""
                UPDATE devices
                SET status = %s, last_latency_ms = %s, last_check = %s, total_checks = %s, successful_checks = %s, uptime_percent = %s, updated_at = %s
                WHERE id = %s
            """, (st, lat_val, now, tot, succ, upt, now, d["id"]))
            
        # 2. Probe Desktops
        cursor.execute("SELECT id, desktop_code, ip_address, status, last_latency_ms, total_checks, successful_checks FROM desktops WHERE monitoring_enabled = 1")
        desktops = cursor.fetchall()
        
        def probe_desk(dk):
            is_online, lat = ping_host(dk["ip_address"])
            return dk, is_online, lat
            
        with ThreadPoolExecutor(max_workers=8) as executor:
            desk_results = list(executor.map(probe_desk, desktops))
            
        desk_online = 0
        for dk, is_online, lat in desk_results:
            st = "Online" if is_online else "Offline"
            if is_online:
                desk_online += 1
            tot = int(dk.get("total_checks") or 0) + 1
            succ = int(dk.get("successful_checks") or 0) + (1 if is_online else 0)
            upt = round((succ / tot) * 100, 2)
            lat_val = lat if is_online else None
            cursor.execute("""
                UPDATE desktops
                SET status = %s, last_latency_ms = %s, last_check = %s, total_checks = %s, successful_checks = %s, uptime_percent = %s, updated_at = %s
                WHERE id = %s
            """, (st, lat_val, now, tot, succ, upt, now, dk["id"]))

        # 3. Probe Cameras
        cursor.execute("SELECT id, camera_code, camera_name, ip_address, status, last_latency_ms, total_checks, successful_checks FROM cameras WHERE monitoring_enabled = 1")
        cameras = cursor.fetchall()
        
        def probe_cam(c):
            is_online, lat = ping_host(c["ip_address"])
            return c, is_online, lat
            
        with ThreadPoolExecutor(max_workers=15) as executor:
            cam_results = list(executor.map(probe_cam, cameras))
            
        cam_online = 0
        for c, is_online, lat in cam_results:
            st = "Online" if is_online else "Offline"
            if is_online:
                cam_online += 1
            tot = int(c.get("total_checks") or 0) + 1
            succ = int(c.get("successful_checks") or 0) + (1 if is_online else 0)
            upt = round((succ / tot) * 100, 2)
            lat_val = lat if is_online else None
            cursor.execute("""
                UPDATE cameras
                SET status = %s, last_latency_ms = %s, last_check = %s, total_checks = %s, successful_checks = %s, uptime_percent = %s, updated_at = %s
                WHERE id = %s
            """, (st, lat_val, now, tot, succ, upt, now, c["id"]))

        db.commit()
        logger.info("Plant Probe Synced -> Devices Online: %d/%d | Desktops: %d/%d | Cameras: %d/%d",
                    dev_online, len(devices), desk_online, len(desktops), cam_online, len(cameras))
        
    except Exception as e:
        db.rollback()
        logger.error("Plant Probe DB Error: %s", e)
    finally:
        cursor.close()
        db.close()

def main():
    if not acquire_single_instance_lock():
        sys.exit(0)

    logger.info("=" * 60)
    logger.info("  NEO METALIKS NMS - ON-PREMISES PLANT LAN PROBE AGENT")
    logger.info("=" * 60)
    logger.info("Direct physical monitor for Plant LAN (192.168.x.x) -> TiDB Cloud")
    logger.info("Persistent log active: %s", LOG_FILE)
    
    # Run continuous loop
    while True:
        try:
            run_probe_cycle()
        except KeyboardInterrupt:
            logger.info("Agent received stop signal. Exiting cleanly.")
            break
        except Exception as e:
            logger.error("Unhandled loop exception: %s", e)
        time.sleep(10)

if __name__ == "__main__":
    main()
