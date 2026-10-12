import sys
import io
if sys.platform == "win32":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import UploadFile, File
from fastapi.staticfiles import StaticFiles
import os
import platform
import re
import subprocess
import ipaddress
import threading
import time
from datetime import datetime
from app.auth import (
    authenticate_admin,
    create_access_token,
    get_admin_from_token
)
from app.database import get_db_connection


app = FastAPI(
    title="Neo Metaliks NMS API",
    version="1.0.0"
)
# ==========================================
# PROFILE PHOTO STORAGE
# ==========================================

import os
import shutil

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "uploads",
    "profile_photos"
)

os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "uploads"
    )),
    name="uploads"
)
security = HTTPBearer()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

from app.extra_routes import router as extra_router
app.include_router(extra_router)

# =========================================================
# ROOT
# =========================================================

FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "Neo_Metaliks_NMS_Desktop_FIXED",
    "Neo_Metaliks_NMS_CCTV_Device_Ready"
)

from starlette.responses import FileResponse

@app.get("/")
def root():
    login_path = os.path.join(FRONTEND_DIR, "login.html")
    if os.path.isfile(login_path):
        return FileResponse(login_path)
    return {
        "success": True,
        "message": "Neo Metaliks NMS Backend is running"
    }


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/api/health")
def health_check():
    return {
        "success": True,
        "status": "healthy"
    }


# =========================================================
# MYSQL DATABASE TEST
# =========================================================

@app.get("/api/db-test")
def database_test():

    connection = get_db_connection()

    if connection is None:
        return {
            "success": False,
            "database": "connection failed"
        }

    try:
        cursor = connection.cursor()

        cursor.execute("SELECT DATABASE()")
        result = cursor.fetchone()

        cursor.close()
        connection.close()

        return {
            "success": True,
            "database": result[0]
        }

    except Exception as error:

        try:
            connection.close()
        except Exception:
            pass

        return {
            "success": False,
            "error": str(error)
        }


# =========================================================
# LOGIN REQUEST MODEL
# =========================================================

class LoginRequest(BaseModel):
    email: str
    password: str
class ProfileUpdateRequest(BaseModel):
    name: str
    email: str
    phone: str | None = None
    department: str | None = None
    location: str | None = None

# =========================================================
# ADMIN LOGIN API
# =========================================================

@app.post("/api/auth/login")
def login_admin(data: LoginRequest):

    email = data.email.strip().lower()

    admin = authenticate_admin(
        email,
        data.password
    )

    if admin is None:
        return {
            "success": False,
            "message": "Invalid email or password."
        }

    access_token = create_access_token(
        admin["id"],
        admin["email"]
    )

    return {
        "success": True,
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "admin": {
            "id": admin["id"],
            "name": admin["name"],
            "email": admin["email"],
            "phone": admin["phone"],
            "department": admin["department"],
            "location": admin["location"]
        }
    }
@app.get("/api/auth/me")
def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    return {
        "success": True,
        "admin": {
            "id": admin["id"],
            "name": admin["name"],
            "email": admin["email"],
            "phone": admin["phone"],
            "department": admin["department"],
            "location": admin["location"],
            "profile_image": admin.get("profile_image")
        }
    }
@app.put("/api/auth/profile")
def update_admin_profile(
    data: ProfileUpdateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    # Token verify
    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # Basic validation
    name = data.name.strip()
    email = data.email.strip().lower()
    phone = data.phone.strip() if data.phone else None
    department = data.department.strip() if data.department else None
    location = data.location.strip() if data.location else None

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required."
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required."
        )

    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        # Check whether another admin already uses this email
        cursor.execute(
            """
            SELECT id
            FROM admins
            WHERE email = %s AND id != %s
            LIMIT 1
            """,
            (email, admin["id"])
        )

        existing_admin = cursor.fetchone()

        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="This email is already used by another admin."
            )

        # Update MySQL record
        cursor.execute(
            """
            UPDATE admins
            SET
                name = %s,
                email = %s,
                phone = %s,
                department = %s,
                location = %s
            WHERE id = %s
            """,
            (
                name,
                email,
                phone,
                department,
                location,
                admin["id"]
            )
        )

        connection.commit()

        return {
            "success": True,
            "message": "Administrator profile updated successfully.",
            "admin": {
                "id": admin["id"],
                "name": name,
                "email": email,
                "phone": phone,
                "department": department,
                "location": location
            }
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception as error:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:
        if cursor:
            cursor.close()

        connection.close()
        # ==========================================
# ADMIN PROFILE PHOTO UPLOAD
# ==========================================

@app.post("/api/auth/profile-photo")
async def upload_admin_profile_photo(
    file: UploadFile = File(...),
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    # Login token verify
    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # Only JPG and PNG allowed
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png"
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG images are allowed."
        )

    # Read image
    contents = await file.read()

    # Maximum 2 MB
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image size must be less than 2MB."
        )

    extension = allowed_types[file.content_type]

    filename = f"admin_{admin['id']}{extension}"

    file_path = os.path.join(
        UPLOAD_DIR,
        filename
    )

    # Delete previous photo
    for old_extension in [".jpg", ".png"]:
        old_file = os.path.join(
            UPLOAD_DIR,
            f"admin_{admin['id']}{old_extension}"
        )

        if os.path.exists(old_file):
            try:
                os.remove(old_file)
            except OSError:
                pass

    # Save new image
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

    except OSError as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save profile photo: {error}"
        )

    # Database path
    profile_image = (
        f"/uploads/profile_photos/{filename}"
    )

    connection = get_db_connection()

    if connection is None:

        try:
            os.remove(file_path)
        except OSError:
            pass

        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            UPDATE admins
            SET profile_image = %s
            WHERE id = %s
            """,
            (
                profile_image,
                admin["id"]
            )
        )

        connection.commit()

    except Exception as error:

        connection.rollback()

        try:
            os.remove(file_path)
        except OSError:
            pass

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        connection.close()

    return {
        "success": True,
        "message": "Profile photo uploaded successfully.",
        "profile_image": profile_image
    }


# ==========================================
# DEVICES - GET ALL DEVICES
# ==========================================

@app.get("/api/devices")
def get_devices(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    
    token = credentials.credentials

    # Verify logged-in admin
    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id,
                device_code,
                device_name,
                device_type,
                ip_address,
                mac_address,
                location,
                description,
                status,
                monitoring_enabled,
                monitoring_interval,
                last_check,
                last_latency_ms,
                uptime_percent,
                created_at,
                updated_at
            FROM devices
            ORDER BY id DESC
            """
        )

        devices = cursor.fetchall()

        return {
            "success": True,
            "count": len(devices),
            "devices": devices
        }

    except Exception as error:

     raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
              cursor.close()

    connection.close()


# ==========================================
# DESKTOP CREATE MODEL
# ==========================================

class DesktopCreateRequest(BaseModel):

    desktop_code: str
    department: str | None = None
    location: str | None = None
    ip_address: str
    operating_system: str | None = None

    cpu_usage: float = 0
    ram_usage: float = 0

    status: str = "Unknown"

    monitoring_enabled: bool = True
    monitoring_interval: int = 30

# ==========================================
# DESKTOP MONITORING SETTINGS MODEL
# ==========================================

class DesktopMonitoringSettingsRequest(BaseModel):

    enabled: bool
    selected_location: str | None = None

      # ==========================================
# DESKTOPS - GET ALL DESKTOPS
# ==========================================

@app.get("/api/desktops")
def get_desktops(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    # ------------------------------------------
    # VERIFY LOGGED-IN ADMIN
    # ------------------------------------------

    token = credentials.credentials

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # ------------------------------------------
    # DATABASE CONNECTION
    # ------------------------------------------

    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = connection.cursor(dictionary=True)

        # ------------------------------------------
        # GET ALL DESKTOPS
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                desktop_code,
                department,
                location,
                ip_address,
                operating_system,
                cpu_usage,
                ram_usage,
                status,
                monitoring_enabled,
                monitoring_interval,
                last_check,
                last_latency_ms,
                total_checks,
                successful_checks,
                uptime_percent,
                created_at,
                updated_at
            FROM desktops
            ORDER BY id DESC
            """
        )

        desktops = cursor.fetchall()

        return {
            "success": True,
            "count": len(desktops),
            "desktops": desktops
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        connection.close()


# ==========================================
# DESKTOPS - CREATE DESKTOP
# ==========================================

@app.post("/api/desktops")
def create_desktop(
    data: DesktopCreateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    # ------------------------------------------
    # VERIFY LOGGED-IN ADMIN
    # ------------------------------------------

    token = credentials.credentials

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # ------------------------------------------
    # BASIC VALIDATION
    # ------------------------------------------

    desktop_code = data.desktop_code.strip()
    ip_address = data.ip_address.strip()

    if not desktop_code:
        raise HTTPException(
            status_code=400,
            detail="Desktop ID is required."
        )

    if not ip_address:
        raise HTTPException(
            status_code=400,
            detail="IP address is required."
        )

    if data.monitoring_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Monitoring interval must be greater than 0."
        )

    if data.cpu_usage < 0 or data.cpu_usage > 100:
        raise HTTPException(
            status_code=400,
            detail="CPU usage must be between 0 and 100."
        )

    if data.ram_usage < 0 or data.ram_usage > 100:
        raise HTTPException(
            status_code=400,
            detail="RAM usage must be between 0 and 100."
        )

    # ------------------------------------------
    # DATABASE CONNECTION
    # ------------------------------------------

    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = connection.cursor(dictionary=True)

        # ------------------------------------------
        # CHECK DUPLICATE DESKTOP ID
        # ------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM desktops
            WHERE desktop_code = %s
            LIMIT 1
            """,
            (desktop_code,)
        )

        existing_desktop = cursor.fetchone()

        if existing_desktop:

            raise HTTPException(
                status_code=400,
                detail="Desktop ID already exists."
            )

        # ------------------------------------------
        # CHECK DUPLICATE IP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM desktops
            WHERE ip_address = %s
            LIMIT 1
            """,
            (ip_address,)
        )

        existing_ip = cursor.fetchone()

        if existing_ip:

            raise HTTPException(
                status_code=400,
                detail="IP address already exists."
            )

        # ------------------------------------------
        # INSERT DESKTOP
        # ------------------------------------------

        cursor.execute(
            """
            INSERT INTO desktops (
                desktop_code,
                department,
                location,
                ip_address,
                operating_system,
                cpu_usage,
                ram_usage,
                status,
                monitoring_enabled,
                monitoring_interval
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            )
            """,
            (
                desktop_code,
                data.department,
                data.location,
                ip_address,
                data.operating_system,
                data.cpu_usage,
                data.ram_usage,
                data.status,
                1 if data.monitoring_enabled else 0,
                data.monitoring_interval
            )
        )

        connection.commit()

        desktop_id = cursor.lastrowid

        # ------------------------------------------
        # GET CREATED DESKTOP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                desktop_code,
                department,
                location,
                ip_address,
                operating_system,
                cpu_usage,
                ram_usage,
                status,
                monitoring_enabled,
                monitoring_interval,
                last_check,
                last_latency_ms,
                total_checks,
                successful_checks,
                uptime_percent,
                created_at,
                updated_at
            FROM desktops
            WHERE id = %s
            """,
            (desktop_id,)
        )

        desktop = cursor.fetchone()

        return {
            "success": True,
            "message": "Desktop created successfully.",
            "desktop": desktop
        }

    except HTTPException:

        connection.rollback()
        raise

    except Exception as error:

        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        connection.close()

# ==========================================================
# DESKTOP - UPDATE
# ==========================================================

class DesktopUpdateRequest(BaseModel):
    desktop_code: str | None = None
    department: str | None = None
    location: str | None = None
    ip_address: str | None = None
    operating_system: str | None = None
    cpu_usage: float | None = None
    ram_usage: float | None = None
    status: str | None = None
    monitoring_enabled: bool | None = None
    monitoring_interval: int | None = None



# ==========================================================
# DESKTOP - DELETE
# ==========================================================

@app.delete("/api/desktops/{desktop_id}")
def delete_desktop(
    desktop_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    get_admin_from_token(token)

    db = get_db_connection()
    cursor = None

    try:
        cursor = db.cursor(dictionary=True)

        # ------------------------------------------
        # CHECK DESKTOP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                desktop_code
            FROM desktops
            WHERE id = %s
            LIMIT 1
            """,
            (desktop_id,)
        )

        desktop = cursor.fetchone()

        if not desktop:
            raise HTTPException(
                status_code=404,
                detail="Desktop not found."
            )

        # ------------------------------------------
        # DELETE
        # ------------------------------------------

        cursor.execute(
            """
            DELETE FROM desktops
            WHERE id = %s
            """,
            (desktop_id,)
        )

        db.commit()

        return {
            "success": True,
            "message": "Desktop deleted successfully.",
            "desktop_id": desktop_id,
            "desktop_code": desktop["desktop_code"]
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()



    token = credentials.credentials

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id,
                enabled,
                selected_location,
                updated_at
            FROM desktop_monitoring_settings
            WHERE id = 1
            LIMIT 1
            """
        )

        settings = cursor.fetchone()

        if settings is None:

            cursor.execute(
                """
                INSERT INTO desktop_monitoring_settings
                    (id, enabled, selected_location)
                VALUES
                    (1, 0, NULL)
                """
            )

            db.commit()

            settings = {
                "id": 1,
                "enabled": 0,
                "selected_location": None
            }

        return {
            "success": True,
            "enabled": bool(settings["enabled"]),
            "selected_location": settings["selected_location"],
            "updated_at": settings.get("updated_at")
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()



    token = credentials.credentials

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    selected_location = (
        data.selected_location.strip()
        if data.selected_location
        else None
    )

    # ------------------------------------------
    # ON হলে location অবশ্যই লাগবে
    # ------------------------------------------

    if data.enabled and not selected_location:

        raise HTTPException(
            status_code=400,
            detail="Please select a desktop location."
        )

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor()

        # ------------------------------------------
        # SAVE MASTER MONITORING STATE
        # ------------------------------------------

        cursor.execute(
            """
            UPDATE desktop_monitoring_settings
            SET
                enabled = %s,
                selected_location = %s
            WHERE id = 1
            """,
            (
                1 if data.enabled else 0,
                selected_location
            )
        )

        # ------------------------------------------
        # OFF = STOP ALL DESKTOP MONITORING
        # ------------------------------------------

        if not data.enabled:

            cursor.execute(
                """
                UPDATE desktops
                SET monitoring_enabled = 0
                """
            )

        # ------------------------------------------
        # ON = ONLY SELECTED LOCATION
        # ------------------------------------------

        else:

            # First stop all desktops
            cursor.execute(
                """
                UPDATE desktops
                SET monitoring_enabled = 0
                """
            )

            # Then enable selected location
            cursor.execute(
                """
                UPDATE desktops
                SET monitoring_enabled = 1
                WHERE LOWER(TRIM(location))
                    = LOWER(TRIM(%s))
                """,
                (selected_location,)
            )

        db.commit()

        return {
            "success": True,
            "message": (
                "Desktop monitoring enabled."
                if data.enabled
                else "Desktop monitoring disabled."
            ),
            "enabled": data.enabled,
            "selected_location": selected_location
        }

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()

        # ==========================================
# DEVICE CREATE MODEL
# ==========================================

class DeviceCreateRequest(BaseModel):
    device_code: str
    device_name: str
    device_type: str
    ip_address: str
    mac_address: str | None = None
    location: str | None = None
    description: str | None = None
    monitoring_enabled: bool = True
    monitoring_interval: int = 30


# ==========================================
# CCTV CREATE MODEL
# ==========================================

class CameraCreateRequest(BaseModel):

    camera_code: str
    camera_name: str
    ip_address: str
    location: str | None = None

    monitoring_enabled: bool = True

    # Normal CCTV check interval
    # Default = 30 minutes
    monitoring_interval: int = 1800

    # Offline camera retry interval
    # Default = 2 minutes
    offline_retry_interval: int = 120

# ==========================================
# NETWORK MONITORING SETTINGS MODEL
# ==========================================

class NetworkMonitoringSettingsRequest(BaseModel):
    enabled: bool
    interval: int

# ==========================================
# DESKTOP MONITORING SETTINGS MODEL
# ==========================================

class DesktopMonitoringSettingsRequest(BaseModel):
    enabled: bool
    selected_location: str | None = None

    # ==========================================
# GET NETWORK MONITORING SETTINGS
# ==========================================

@app.get("/api/settings/network")
def get_network_monitoring_settings(
    admin=Depends(get_current_admin)
):

    db = get_db_connection()
    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                COUNT(*) AS total_devices,
                SUM(
                    CASE
                        WHEN monitoring_enabled = 1
                        THEN 1
                        ELSE 0
                    END
                ) AS enabled_devices,
                MIN(monitoring_interval) AS monitoring_interval
            FROM devices
            """
        )

        result = cursor.fetchone()

        total_devices = int(
            result["total_devices"] or 0
        )

        enabled_devices = int(
            result["enabled_devices"] or 0
        )

        interval = int(
            result["monitoring_interval"] or 60
        )

        enabled = (
            total_devices > 0
            and enabled_devices == total_devices
        )

        return {
            "success": True,
            "enabled": enabled,
            "interval": interval
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================
# UPDATE NETWORK MONITORING SETTINGS
# ==========================================

@app.put("/api/settings/network")
def update_network_monitoring_settings(
    data: NetworkMonitoringSettingsRequest,
    admin=Depends(get_current_admin)
):

    if data.interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Network monitoring interval must be greater than 0."
        )

    db = get_db_connection()
    cursor = None

    try:

        cursor = db.cursor()

        cursor.execute(
            """
            UPDATE devices
            SET
                monitoring_enabled = %s,
                monitoring_interval = %s
            """,
            (
                1 if data.enabled else 0,
                data.interval
            )
        )

        db.commit()

        return {
            "success": True,
            "message": "Network monitoring settings updated successfully.",
            "enabled": data.enabled,
            "interval": data.interval
        }

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================
# DESKTOP MONITORING SETTINGS - GET
# ==========================================

@app.get("/api/desktops/monitoring")
def get_desktop_monitoring_settings(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    get_admin_from_token(credentials.credentials)

    conn = get_db_connection()

    if conn is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT enabled, selected_location
            FROM desktop_monitoring_settings
            WHERE id = 1
            LIMIT 1
        """)

        settings = cursor.fetchone()

        if settings is None:
            cursor.execute("""
                INSERT INTO desktop_monitoring_settings
                    (id, enabled, selected_location)
                VALUES
                    (1, 0, NULL)
            """)

            conn.commit()

            settings = {
                "enabled": 0,
                "selected_location": None
            }

        return {
            "success": True,
            "enabled": bool(settings["enabled"]),
            "selected_location": settings["selected_location"]
        }

    finally:
        cursor.close()
        conn.close()


# ==========================================
# DESKTOP MONITORING SETTINGS - UPDATE
# ==========================================

@app.put("/api/desktops/monitoring")
def update_desktop_monitoring_settings(
    request: DesktopMonitoringSettingsRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    get_admin_from_token(credentials.credentials)

    conn = get_db_connection()

    if conn is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = conn.cursor(dictionary=True)

    try:

        selected_location = (
            request.selected_location.strip()
            if request.selected_location
            else None
        )

        # ======================================
        # MONITORING ON
        # ======================================

        if request.enabled:

            if not selected_location:
                raise HTTPException(
                    status_code=400,
                    detail="Please select a desktop location."
                )

            # Check whether location exists
            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM desktops
                WHERE LOWER(TRIM(location)) = LOWER(TRIM(%s))
            """, (selected_location,))

            location_result = cursor.fetchone()

            if not location_result or location_result["total"] == 0:
                raise HTTPException(
                    status_code=400,
                    detail="No desktops found for the selected location."
                )

            # First disable monitoring for ALL desktops
            cursor.execute("""
                UPDATE desktops
                SET monitoring_enabled = 0
            """)

            # Enable ONLY selected location
            cursor.execute("""
                UPDATE desktops
                SET monitoring_enabled = 1
                WHERE LOWER(TRIM(location)) = LOWER(TRIM(%s))
            """, (selected_location,))

        # ======================================
        # MONITORING OFF
        # ======================================

        else:

            selected_location = None

            # Stop monitoring every desktop
            cursor.execute("""
                UPDATE desktops
                SET monitoring_enabled = 0
            """)

        # ======================================
        # SAVE MASTER MONITORING STATE
        # ======================================

        cursor.execute("""
            INSERT INTO desktop_monitoring_settings
                (id, enabled, selected_location)
            VALUES
                (1, %s, %s)
            ON DUPLICATE KEY UPDATE
                enabled = VALUES(enabled),
                selected_location = VALUES(selected_location)
        """, (
            1 if request.enabled else 0,
            selected_location
        ))

        conn.commit()

        return {
            "success": True,
            "message": (
                "Desktop monitoring enabled."
                if request.enabled
                else "Desktop monitoring disabled."
            ),
            "enabled": bool(request.enabled),
            "selected_location": selected_location
        }

    except HTTPException:
        conn.rollback()
        raise

    except Exception as error:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Desktop monitoring update failed: {str(error)}"
        )

    finally:
        cursor.close()
        conn.close()


@app.put("/api/desktops/{desktop_id}")
def update_desktop(
    desktop_id: int,
    data: DesktopUpdateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials
    get_admin_from_token(token)

    db = get_db_connection()
    cursor = None

    try:
        cursor = db.cursor(dictionary=True)

        # ------------------------------------------
        # CHECK DESKTOP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM desktops
            WHERE id = %s
            LIMIT 1
            """,
            (desktop_id,)
        )

        existing = cursor.fetchone()

        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Desktop not found."
            )

        # ------------------------------------------
        # UPDATE ONLY PROVIDED FIELDS
        # ------------------------------------------

        fields = []
        values = []

        update_data = data.model_dump(exclude_unset=True)

        if "desktop_code" in update_data:
            fields.append("desktop_code = %s")
            values.append(update_data["desktop_code"])

        if "department" in update_data:
            fields.append("department = %s")
            values.append(update_data["department"])

        if "location" in update_data:
            fields.append("location = %s")
            values.append(update_data["location"])

        if "ip_address" in update_data:
            fields.append("ip_address = %s")
            values.append(update_data["ip_address"])

        if "operating_system" in update_data:
            fields.append("operating_system = %s")
            values.append(update_data["operating_system"])

        if "cpu_usage" in update_data:
            fields.append("cpu_usage = %s")
            values.append(update_data["cpu_usage"])

        if "ram_usage" in update_data:
            fields.append("ram_usage = %s")
            values.append(update_data["ram_usage"])

        if "status" in update_data:
            fields.append("status = %s")
            values.append(update_data["status"])

        if "monitoring_enabled" in update_data:
            fields.append("monitoring_enabled = %s")
            values.append(
                1 if update_data["monitoring_enabled"] else 0
            )

        if "monitoring_interval" in update_data:
            fields.append("monitoring_interval = %s")
            values.append(update_data["monitoring_interval"])

        if not fields:
            raise HTTPException(
                status_code=400,
                detail="No fields provided for update."
            )

        # ------------------------------------------
        # UPDATE MYSQL
        # ------------------------------------------

        values.append(desktop_id)

        query = f"""
            UPDATE desktops
            SET {", ".join(fields)}
            WHERE id = %s
        """

        cursor.execute(query, tuple(values))

        db.commit()

        # ------------------------------------------
        # LOAD UPDATED DESKTOP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                desktop_code,
                department,
                location,
                ip_address,
                operating_system,
                cpu_usage,
                ram_usage,
                status,
                monitoring_enabled,
                monitoring_interval,
                last_check,
                last_latency_ms,
                total_checks,
                successful_checks,
                uptime_percent,
                created_at,
                updated_at
            FROM desktops
            WHERE id = %s
            LIMIT 1
            """,
            (desktop_id,)
        )

        desktop = cursor.fetchone()

        return {
            "success": True,
            "message": "Desktop updated successfully.",
            "desktop": desktop
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()



    # ==========================================
# DEVICES - CREATE DEVICE
# ==========================================

# ==========================================
# CREATE DEVICE
# ==========================================

@app.post("/api/devices")
def create_device(
    data: DeviceCreateRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    # ------------------------------------------
    # VERIFY LOGGED-IN ADMIN
    # ------------------------------------------

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # ------------------------------------------
    # CLEAN INPUT VALUES
    # ------------------------------------------

    device_code = data.device_code.strip()
    device_name = data.device_name.strip()
    device_type = data.device_type.strip()
    ip_address = data.ip_address.strip()

    mac_address = (
        data.mac_address.strip()
        if data.mac_address
        else None
    )

    location = (
        data.location.strip()
        if data.location
        else None
    )

    description = (
        data.description.strip()
        if data.description
        else None
    )

    # ------------------------------------------
    # REQUIRED FIELD VALIDATION
    # ------------------------------------------

    if not device_code:
        raise HTTPException(
            status_code=400,
            detail="Device code is required."
        )

    if not device_name:
        raise HTTPException(
            status_code=400,
            detail="Device name is required."
        )

    if not device_type:
        raise HTTPException(
            status_code=400,
            detail="Device type is required."
        )

    if not ip_address:
        raise HTTPException(
            status_code=400,
            detail="IP address is required."
        )

    # ------------------------------------------
    # MONITORING INTERVAL VALIDATION
    # ------------------------------------------

    if data.monitoring_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Monitoring interval must be greater than 0."
        )

    # ------------------------------------------
    # DATABASE CONNECTION
    # ------------------------------------------

    connection = get_db_connection()

    if connection is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = connection.cursor(dictionary=True)

        # ------------------------------------------
        # CHECK DUPLICATE DEVICE CODE
        # ------------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM devices
            WHERE device_code = %s
            LIMIT 1
            """,
            (device_code,)
        )

        existing_code = cursor.fetchone()

        if existing_code:
            raise HTTPException(
                status_code=400,
                detail="Device code already exists."
            )

        # ------------------------------------------
        # CHECK DUPLICATE IP
        # ------------------------------------------

        cursor.execute(
            """
            SELECT id, device_code
            FROM devices
            WHERE ip_address = %s
            LIMIT 1
            """,
            (ip_address,)
        )

        existing_ip = cursor.fetchone()

        if existing_ip:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"IP address already belongs to device "
                    f"{existing_ip['device_code']}."
                )
            )

        # ------------------------------------------
        # INSERT DEVICE
        # ------------------------------------------

        cursor.execute(
            """
            INSERT INTO devices (
                device_code,
                device_name,
                device_type,
                ip_address,
                mac_address,
                location,
                description,
                status,
                monitoring_enabled,
                monitoring_interval
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                device_code,
                device_name,
                device_type,
                ip_address,
                mac_address,
                location,
                description,
                "Unknown",
                1 if data.monitoring_enabled else 0,
                data.monitoring_interval
            )
        )

        # ------------------------------------------
        # GET NEW DEVICE ID
        # ------------------------------------------

        device_id = cursor.lastrowid

        if not device_id:
            connection.rollback()

            raise HTTPException(
                status_code=500,
                detail="Device ID could not be generated."
            )

        # ------------------------------------------
        # SAVE TO MYSQL
        # ------------------------------------------

        connection.commit()

        # ------------------------------------------
        # GET CREATED DEVICE
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                device_code,
                device_name,
                device_type,
                ip_address,
                mac_address,
                location,
                description,
                status,
                monitoring_enabled,
                monitoring_interval,
                last_check,
                last_latency_ms,
                uptime_percent,
                created_at,
                updated_at
            FROM devices
            WHERE id = %s
            LIMIT 1
            """,
            (device_id,)
        )

        device = cursor.fetchone()

        if not device:
            raise HTTPException(
                status_code=500,
                detail="Device was inserted but could not be loaded."
            )

        # ------------------------------------------
        # SUCCESS RESPONSE
        # ------------------------------------------

        return {
            "success": True,
            "message": "Device created successfully.",
            "device": device
        }

    except HTTPException:
        connection.rollback()
        raise

    except Exception as error:
        connection.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        connection.close()



        # ==========================================
# DEVICE PING
# ==========================================


# ==========================================
# DEVICE PING
# ==========================================

@app.post("/api/devices/{device_id}/ping")
def ping_device(
    device_id: int,
    admin=Depends(get_current_admin)
):
    db = get_db_connection()
    cursor = None

    try:
        cursor = db.cursor(dictionary=True)

        # ------------------------------------------
        # GET DEVICE
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                device_code,
                device_name,
                ip_address,
                total_checks,
                successful_checks,
                uptime_percent
            FROM devices
            WHERE id = %s
            LIMIT 1
            """,
            (device_id,)
        )

        device = cursor.fetchone()

        if not device:
            raise HTTPException(
                status_code=404,
                detail="Device not found"
            )

        ip_address = device["ip_address"]

        # ------------------------------------------
        # PING COMMAND
        # ------------------------------------------

        if platform.system().lower() == "windows":

            command = [
                "ping",
                "-n",
                "1",
                "-w",
                "1000",
                ip_address
            ]

        else:

            command = [
                "ping",
                "-c",
                "1",
                "-W",
                "1",
                ip_address
            ]

        # ------------------------------------------
        # EXECUTE PING
        # ------------------------------------------

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=1
        )

        output = result.stdout + result.stderr

        ping_success = (
            result.returncode == 0
        )

        # ------------------------------------------
        # GET LATENCY
        # ------------------------------------------

        latency = None

        match = re.search(
            r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms",
            output,
            re.IGNORECASE
        )

        if match:
            latency = float(match.group(1))

        # ------------------------------------------
        # STATUS
        # ------------------------------------------

        status = (
            "Online"
            if ping_success
            else "Offline"
        )

        now = datetime.now()

        # ------------------------------------------
        # EXISTING COUNTERS
        # ------------------------------------------

        total_checks = int(
            device["total_checks"] or 0
        )

        successful_checks = int(
            device["successful_checks"] or 0
        )

        # Every ping = 1 check
        total_checks += 1

        # Successful ping = successful check
        if ping_success:
            successful_checks += 1

        # ------------------------------------------
        # CALCULATE UPTIME
        # ------------------------------------------

        uptime_percent = (
            successful_checks /
            total_checks
        ) * 100

        uptime_percent = round(
            uptime_percent,
            2
        )

        # ------------------------------------------
        # UPDATE DATABASE
        # ------------------------------------------

        cursor.execute(
            """
            UPDATE devices
            SET
                status = %s,
                last_check = %s,
                last_latency_ms = %s,
                total_checks = %s,
                successful_checks = %s,
                uptime_percent = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                status,
                now,
                latency,
                total_checks,
                successful_checks,
                uptime_percent,
                now,
                device_id
            )
        )

        db.commit()

        # ------------------------------------------
        # SUCCESS RESPONSE
        # ------------------------------------------

        return {
            "success": True,
            "device_id": device["id"],
            "device_code": device["device_code"],
            "device_name": device["device_name"],
            "ip_address": ip_address,
            "status": status,
            "latency_ms": latency,
            "total_checks": total_checks,
            "successful_checks": successful_checks,
            "uptime_percent": uptime_percent,
            "last_check": now.isoformat(),
            "message": (
                "Ping successful"
                if ping_success
                else "Ping failed"
            )
        }

    except HTTPException:
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================
# CCTV - GET ALL CAMERAS
# ==========================================

@app.get("/api/cameras")
def get_cameras(
    admin=Depends(get_current_admin)
):

    db = get_db_connection()
    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id,
                camera_code,
                camera_name,
                ip_address,
                location,
                status,
                monitoring_enabled,
                monitoring_interval,
                offline_retry_interval,
                last_check,
                last_latency_ms,
                total_checks,
                successful_checks,
                uptime_percent,
                created_at,
                updated_at
            FROM cameras
            ORDER BY id DESC
            """
        )

        cameras = cursor.fetchall()

        return {
            "success": True,
            "count": len(cameras),
            "cameras": cameras
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================
# CCTV - CREATE CAMERA
# ==========================================

@app.post("/api/cameras")
def create_camera(
    data: CameraCreateRequest,
    admin=Depends(get_current_admin)
):

    camera_code = data.camera_code.strip()
    camera_name = data.camera_name.strip()
    ip_address = data.ip_address.strip()
    location = (
        data.location.strip()
        if data.location
        else None
    )

    if not camera_code:
        raise HTTPException(
            status_code=400,
            detail="Camera code is required."
        )

    if not camera_name:
        raise HTTPException(
            status_code=400,
            detail="Camera name is required."
        )

    if not ip_address:
        raise HTTPException(
            status_code=400,
            detail="IP address is required."
        )

    if data.monitoring_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Monitoring interval must be greater than 0."
        )

    if data.offline_retry_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Offline retry interval must be greater than 0."
        )

    db = get_db_connection()
    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        # --------------------------------------
        # DUPLICATE CAMERA CODE
        # --------------------------------------

        cursor.execute(
            """
            SELECT id
            FROM cameras
            WHERE camera_code = %s
            LIMIT 1
            """,
            (camera_code,)
        )

        existing_code = cursor.fetchone()

        if existing_code:

            raise HTTPException(
                status_code=400,
                detail="Camera code already exists."
            )

        # --------------------------------------
        # DUPLICATE IP
        # --------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                camera_code
            FROM cameras
            WHERE ip_address = %s
            LIMIT 1
            """,
            (ip_address,)
        )

        existing_ip = cursor.fetchone()

        if existing_ip:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"IP address already belongs to "
                    f"camera {existing_ip['camera_code']}."
                )
            )

        # --------------------------------------
        # INSERT CAMERA
        # --------------------------------------

        cursor.execute(
            """
            INSERT INTO cameras (
                camera_code,
                camera_name,
                ip_address,
                location,
                status,
                monitoring_enabled,
                monitoring_interval,
                offline_retry_interval
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s
            )
            """,
            (
                camera_code,
                camera_name,
                ip_address,
                location,
                "Unknown",
                1 if data.monitoring_enabled else 0,
                data.monitoring_interval,
                data.offline_retry_interval
            )
        )

        camera_id = cursor.lastrowid

        db.commit()

        # --------------------------------------
        # LOAD CREATED CAMERA
        # --------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                camera_code,
                camera_name,
                ip_address,
                location,
                status,
                monitoring_enabled,
                monitoring_interval,
                offline_retry_interval,
                last_check,
                last_latency_ms,
                total_checks,
                successful_checks,
                uptime_percent,
                created_at,
                updated_at
            FROM cameras
            WHERE id = %s
            LIMIT 1
            """,
            (camera_id,)
        )

        camera = cursor.fetchone()

        return {
            "success": True,
            "message": "CCTV camera created successfully.",
            "camera": camera
        }

    except HTTPException:

        db.rollback()
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()

# ==========================================
# CCTV - REAL PING / HEALTH CHECK
# ==========================================

@app.post("/api/cameras/{camera_id}/ping")
def ping_camera(
    camera_id: int,
    admin=Depends(get_current_admin)
):

    db = get_db_connection()
    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        # --------------------------------------
        # GET CAMERA
        # --------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                camera_code,
                camera_name,
                ip_address,
                total_checks,
                successful_checks,
                uptime_percent
            FROM cameras
            WHERE id = %s
            LIMIT 1
            """,
            (camera_id,)
        )

        camera = cursor.fetchone()

        if not camera:

            raise HTTPException(
                status_code=404,
                detail="Camera not found."
            )

        ip_address = camera["ip_address"]

        # --------------------------------------
        # WINDOWS / LINUX PING COMMAND
        # --------------------------------------

        if platform.system().lower() == "windows":

            command = [
                "ping",
                "-n",
                "1",
                "-w",
                "1000",
                ip_address
            ]

        else:

            command = [
                "ping",
                "-c",
                "1",
                "-W",
                "1",
                ip_address
            ]

        # --------------------------------------
        # EXECUTE PING
        # --------------------------------------

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=1
        )

        output = (
            result.stdout +
            result.stderr
        )

        ping_success = (
            result.returncode == 0
        )

        # --------------------------------------
        # GET LATENCY
        # --------------------------------------

        latency = None

        match = re.search(
            r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms",
            output,
            re.IGNORECASE
        )

        if match:

            latency = float(
                match.group(1)
            )

        # --------------------------------------
        # STATUS
        # --------------------------------------

        status = (
            "Online"
            if ping_success
            else "Offline"
        )

        now = datetime.now()

        # --------------------------------------
        # EXISTING COUNTERS
        # --------------------------------------

        total_checks = int(
            camera["total_checks"] or 0
        )

        successful_checks = int(
            camera["successful_checks"] or 0
        )

        # Every ping = one check
        total_checks += 1

        # Successful ping
        if ping_success:

            successful_checks += 1

        # --------------------------------------
        # CALCULATE UPTIME
        # --------------------------------------

        uptime_percent = (
            successful_checks /
            total_checks
        ) * 100

        uptime_percent = round(
            uptime_percent,
            2
        )

        # --------------------------------------
        # UPDATE CAMERA
        # --------------------------------------

        cursor.execute(
            """
            UPDATE cameras
            SET
                status = %s,
                last_check = %s,
                last_latency_ms = %s,
                total_checks = %s,
                successful_checks = %s,
                uptime_percent = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                status,
                now,
                latency,
                total_checks,
                successful_checks,
                uptime_percent,
                now,
                camera_id
            )
        )

        db.commit()

        # --------------------------------------
        # RESPONSE
        # --------------------------------------

        print(
            f"[NMS CCTV] "
            f"{camera['camera_code']} | "
            f"{ip_address} | "
            f"{status} | "
            f"Latency={latency if latency is not None else '-'} ms | "
            f"Uptime={uptime_percent}%"
        )

        return {
            "success": True,
            "camera_id": camera["id"],
            "camera_code": camera["camera_code"],
            "camera_name": camera["camera_name"],
            "ip_address": ip_address,
            "status": status,
            "latency_ms": latency,
            "total_checks": total_checks,
            "successful_checks": successful_checks,
            "uptime_percent": uptime_percent,
            "last_check": now.isoformat(),
            "message": (
                "Camera ping successful"
                if ping_success
                else "Camera ping failed"
            )
        }

    except HTTPException:
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()

# ==========================================================
# CCTV MONITORING SETTINGS
# ==========================================================

class CameraMonitoringSettingsRequest(BaseModel):
    camera_monitoring: bool
    camera_interval: int
    camera_retry_interval: int

@app.put("/api/settings/camera")
def update_camera_monitoring_settings(
    data: CameraMonitoringSettingsRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    # ------------------------------------------
    # VERIFY ADMIN
    # ------------------------------------------

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    # ------------------------------------------
    # VALIDATE CAMERA INTERVAL
    # ------------------------------------------

    if data.camera_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Camera interval must be greater than 0."
        )

    # ------------------------------------------
    # VALIDATE OFFLINE RETRY INTERVAL
    # ------------------------------------------

    if data.camera_retry_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Camera retry interval must be greater than 0."
        )

    # ------------------------------------------
    # DATABASE CONNECTION
    # ------------------------------------------

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor()

        # --------------------------------------
        # APPLY SETTINGS TO ALL CCTV CAMERAS
        # --------------------------------------

        cursor.execute(
            """
            UPDATE cameras
            SET
                monitoring_enabled = %s,
                monitoring_interval = %s,
                offline_retry_interval = %s,
                updated_at = %s
            """,
            (
                1 if data.camera_monitoring else 0,
                data.camera_interval,
                data.camera_retry_interval,
                datetime.now()
            )
        )

        db.commit()

        return {
            "success": True,
            "message": "CCTV monitoring settings updated successfully.",
            "camera_monitoring": data.camera_monitoring,
            "camera_interval": data.camera_interval,
            "camera_retry_interval": data.camera_retry_interval
        }

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================================
# GET CCTV MONITORING SETTINGS
# ==========================================================

@app.get("/api/settings/camera")
def get_camera_monitoring_settings(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    # ------------------------------------------
    # VERIFY ADMIN
    # ------------------------------------------

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                monitoring_enabled,
                monitoring_interval,
                offline_retry_interval
            FROM cameras
            ORDER BY id ASC
            LIMIT 1
            """
        )

        row = cursor.fetchone()

        if not row:

            return {
                "success": True,
                "camera_monitoring": True,
                "camera_interval": 1800,
                "camera_retry_interval": 120
            }

        return {
            "success": True,
            "camera_monitoring": bool(
                row["monitoring_enabled"]
            ),
            "camera_interval": row["monitoring_interval"],
            "camera_retry_interval":
                row["offline_retry_interval"]
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================================
# GET CCTV MONITORING SETTINGS
# ==========================================================

@app.get("/api/settings/camera")
def get_camera_monitoring_settings(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):

    token = credentials.credentials

    # ------------------------------------------
    # VERIFY ADMIN
    # ------------------------------------------

    admin = get_admin_from_token(token)

    if admin is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token."
        )

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                monitoring_enabled,
                monitoring_interval,
                offline_retry_interval
            FROM cameras
            ORDER BY id ASC
            LIMIT 1
            """
        )

        row = cursor.fetchone()

        # No CCTV exists yet
        if not row:

            return {
                "success": True,
                "camera_monitoring": True,
                "camera_interval": 1800,
                "camera_retry_interval": 120
            }

        return {
            "success": True,
            "camera_monitoring": bool(
                row["monitoring_enabled"]
            ),
            "camera_interval": row["monitoring_interval"],
            "camera_retry_interval":
                row["offline_retry_interval"]
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


    # ------------------------------------------
    # VALIDATE CAMERA INTERVAL
    # ------------------------------------------

    if data.camera_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Camera interval must be greater than 0."
        )

    # ------------------------------------------
    # VALIDATE OFFLINE RETRY INTERVAL
    # ------------------------------------------

    if data.camera_retry_interval <= 0:
        raise HTTPException(
            status_code=400,
            detail="Camera retry interval must be greater than 0."
        )

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor()

        # --------------------------------------
        # APPLY SETTINGS TO ALL CCTV CAMERAS
        # --------------------------------------

        cursor.execute(
            """
            UPDATE cameras
            SET
                monitoring_enabled = %s,
                monitoring_interval = %s,
                offline_retry_interval = %s,
                updated_at = %s
            """,
            (
                1 if data.camera_monitoring else 0,
                data.camera_interval,
                data.camera_retry_interval,
                datetime.now()
            )
        )

        db.commit()

        return {
            "success": True,
            "message": "CCTV monitoring settings updated successfully.",
            "camera_monitoring": data.camera_monitoring,
            "camera_interval": data.camera_interval,
            "camera_retry_interval": data.camera_retry_interval
        }

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


# ==========================================================
# DELETE CCTV CAMERA API
# ==========================================================

@app.delete("/api/cameras/{camera_id}")
def delete_camera(
    camera_id: int,
    admin=Depends(get_current_admin)
):

    db = get_db_connection()

    if db is None:
        raise HTTPException(
            status_code=500,
            detail="Database connection failed."
        )

    cursor = None

    try:

        cursor = db.cursor(dictionary=True)

        # ------------------------------------------
        # CHECK CAMERA EXISTS
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                id,
                camera_code,
                camera_name,
                ip_address
            FROM cameras
            WHERE id = %s
            LIMIT 1
            """,
            (camera_id,)
        )

        camera = cursor.fetchone()

        if not camera:
            raise HTTPException(
                status_code=404,
                detail="CCTV camera not found."
            )

        # ------------------------------------------
        # PERMANENT DELETE
        # ------------------------------------------

        cursor.execute(
            """
            DELETE FROM cameras
            WHERE id = %s
            """,
            (camera_id,)
        )

        db.commit()

        return {
            "success": True,
            "message": "CCTV camera permanently deleted.",
            "deleted_camera": {
                "id": camera["id"],
                "camera_code": camera["camera_code"],
                "camera_name": camera["camera_name"],
                "ip_address": camera["ip_address"]
            }
        }

    except HTTPException:
        db.rollback()
        raise

    except Exception as error:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        if cursor:
            cursor.close()

        db.close()


        # ==========================================
# DELETE DEVICE
# ==========================================

@app.delete("/api/devices/{device_id}")
def delete_device(
    device_id: int,
    admin=Depends(get_current_admin)
):
    db = get_db_connection()
    cursor = None

    try:
        cursor = db.cursor(dictionary=True)

        # আগে device আছে কিনা check
        cursor.execute(
            """
            SELECT
                id,
                device_code,
                device_name,
                ip_address
            FROM devices
            WHERE id = %s
            """,
            (device_id,)
        )

        device = cursor.fetchone()

        if not device:
            raise HTTPException(
                status_code=404,
                detail="Device not found"
            )

        # Device permanently delete
        cursor.execute(
            """
            DELETE FROM devices
            WHERE id = %s
            """,
            (device_id,)
        )

        db.commit()

        return {
            "success": True,
            "message": "Device deleted successfully.",
            "deleted_device": {
                "id": device["id"],
                "device_code": device["device_code"],
                "device_name": device["device_name"],
                "ip_address": device["ip_address"]
            }
        }

    finally:
        if cursor:
            cursor.close()

        db.close()


  # ==========================================================
# NMS AUTOMATIC DEVICE MONITORING ENGINE
# ==========================================================

monitoring_stop_event = threading.Event()
monitoring_thread = None


# ----------------------------------------------------------
# PING ONE DEVICE
# ----------------------------------------------------------

def automatic_ping_device(device):
    """
    Automatically ping one enabled device.
    Updates status, latency, uptime and last_check.
    """

    db = None
    cursor = None

    try:

        device_id = device["id"]
        device_code = device["device_code"]
        ip_address = device["ip_address"]

        # --------------------------------------------------
        # BUILD PING COMMAND
        # --------------------------------------------------

        if platform.system().lower() == "windows":

            command = [
                "ping",
                "-n",
                "1",
                "-w",
                "1000",
                ip_address
            ]

        else:

            command = [
                "ping",
                "-c",
                "1",
                "-W",
                "1",
                ip_address
            ]


        # --------------------------------------------------
        # EXECUTE REAL PING
        # --------------------------------------------------

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=3
        )


        output = (
            result.stdout +
            result.stderr
        )


        ping_success = (
            result.returncode == 0
        )


        # --------------------------------------------------
        # READ LATENCY
        # --------------------------------------------------

        latency = None

        match = re.search(
            r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms",
            output,
            re.IGNORECASE
        )

        if match:

            latency = float(
                match.group(1)
            )


        # --------------------------------------------------
        # STATUS
        # --------------------------------------------------

        status = (
            "Online"
            if ping_success
            else "Offline"
        )


        now = datetime.now()


        # --------------------------------------------------
        # DATABASE CONNECTION
        # --------------------------------------------------

        db = get_db_connection()

        if db is None:

            print(
                f"[NMS MONITOR] "
                f"{device_code} -> Database connection failed"
            )

            return


        cursor = db.cursor(
            dictionary=True
        )


        # --------------------------------------------------
        # LOCK CURRENT COUNTERS
        # --------------------------------------------------

        cursor.execute(
            """
            SELECT
                total_checks,
                successful_checks
            FROM devices
            WHERE id = %s
            LIMIT 1
            FOR UPDATE
            """,
            (device_id,)
        )


        current = cursor.fetchone()


        if not current:

            db.rollback()
            return


        total_checks = int(
            current["total_checks"] or 0
        )


        successful_checks = int(
            current["successful_checks"] or 0
        )


        # --------------------------------------------------
        # UPDATE CHECK COUNTERS
        # --------------------------------------------------

        total_checks += 1


        if ping_success:

            successful_checks += 1


        # --------------------------------------------------
        # CALCULATE UPTIME
        # --------------------------------------------------

        uptime_percent = (
            successful_checks /
            total_checks
        ) * 100


        uptime_percent = round(
            uptime_percent,
            2
        )


        # --------------------------------------------------
        # SAVE RESULT
        # --------------------------------------------------

        cursor.execute(
            """
            UPDATE devices
            SET
                status = %s,
                last_check = %s,
                last_latency_ms = %s,
                total_checks = %s,
                successful_checks = %s,
                uptime_percent = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                status,
                now,
                latency,
                total_checks,
                successful_checks,
                uptime_percent,
                now,
                device_id
            )
        )


        db.commit()


        print(
            f"[NMS MONITOR] "
            f"{device_code} | "
            f"{ip_address} | "
            f"{status} | "
            f"Latency={latency if latency is not None else '-'} ms | "
            f"Uptime={uptime_percent}%"
        )


    except subprocess.TimeoutExpired:

        print(
            f"[NMS MONITOR] "
            f"{device.get('device_code', device.get('id'))} "
            f"-> Ping timeout"
        )


    except Exception as error:

        if db:

            try:
                db.rollback()
            except Exception:
                pass


        print(
            f"[NMS MONITOR ERROR] "
            f"{device.get('device_code', device.get('id'))}: "
            f"{error}"
        )


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


# ==========================================================
# AUTOMATIC MONITORING LOOP
# ==========================================================

def automatic_monitoring_loop():

    print(
        "[SUCCESS] NMS automatic device monitoring started."
    )


    while not monitoring_stop_event.is_set():

        db = None
        cursor = None


        try:

            db = get_db_connection()


            if db is None:

                monitoring_stop_event.wait(
                    5
                )

                continue


            cursor = db.cursor(
                dictionary=True
            )


            # ------------------------------------------------
            # GET ENABLED DEVICES
            # ------------------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
                    device_code,
                    device_name,
                    ip_address,
                    monitoring_enabled,
                    monitoring_interval,
                    last_check
                FROM devices
                WHERE monitoring_enabled = 1
                ORDER BY id
                """
            )


            devices = cursor.fetchall()


            # ------------------------------------------------
            # CHECK DEVICES
            # ------------------------------------------------

            for device in devices:

                if monitoring_stop_event.is_set():

                    break


                # --------------------------------------------
                # DEVICE INTERVAL
                # --------------------------------------------

                interval = int(
                    device.get(
                        "monitoring_interval"
                    ) or 60
                )


                if interval <= 0:

                    interval = 60


                # --------------------------------------------
                # LAST CHECK
                # --------------------------------------------

                last_check = (
                    device.get("last_check")
                )


                # --------------------------------------------
                # FIRST CHECK
                # --------------------------------------------

                if last_check is None:

                    automatic_ping_device(
                        device
                    )

                    continue


                # --------------------------------------------
                # CALCULATE ELAPSED TIME
                # --------------------------------------------

                try:
                    if isinstance(last_check, datetime):
                        elapsed = (datetime.now() - last_check).total_seconds()
                    else:
                        clean_str = str(last_check).strip().replace(" ", "T")
                        last_check_dt = datetime.fromisoformat(clean_str)
                        elapsed = (datetime.now() - last_check_dt).total_seconds()
                except Exception:
                    elapsed = 0


                # --------------------------------------------
                # DEVICE CHECK DUE?
                # --------------------------------------------

                if elapsed >= interval:

                    automatic_ping_device(
                        device
                    )


        except Exception as error:

            print(
                f"[NMS MONITOR LOOP ERROR] {error}"
            )


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


        # ----------------------------------------------------
        # LOOP CHECK
        # ----------------------------------------------------
        # Checks every 1 second whether a device is due.
        # Actual ping happens only when that device's
        # configured monitoring_interval has elapsed.
        # ----------------------------------------------------

        monitoring_stop_event.wait(
            1
        )


    print(
        "🛑 NMS automatic device monitoring stopped."
    )

# ==========================================================
# NMS AUTOMATIC DESKTOP MONITORING ENGINE
# ==========================================================

desktop_monitoring_stop_event = threading.Event()
desktop_monitoring_thread = None


# ----------------------------------------------------------
# PING ONE DESKTOP
# ----------------------------------------------------------

def automatic_ping_desktop(desktop):

    db = None
    cursor = None

    try:

        desktop_id = desktop["id"]
        desktop_code = desktop["desktop_code"]
        ip_address = desktop["ip_address"]

        # ------------------------------------------
        # BUILD PING COMMAND
        # ------------------------------------------

        if platform.system().lower() == "windows":

            command = [
                "ping",
                "-n",
                "1",
                "-w",
                "1000",
                ip_address
            ]

        else:

            command = [
                "ping",
                "-c",
                "1",
                "-W",
                "1",
                ip_address
            ]

        # ------------------------------------------
        # REAL PING
        # ------------------------------------------

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=3
        )

        output = (
            result.stdout +
            result.stderr
        )

        ping_success = (
            result.returncode == 0
        )

        # ------------------------------------------
        # LATENCY
        # ------------------------------------------

        latency = None

        match = re.search(
            r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms",
            output,
            re.IGNORECASE
        )

        if match:

            latency = float(
                match.group(1)
            )

        # ------------------------------------------
        # STATUS
        # ------------------------------------------

        status = (
            "Online"
            if ping_success
            else "Offline"
        )

        now = datetime.now()

        # ------------------------------------------
        # DATABASE
        # ------------------------------------------

        db = get_db_connection()

        if db is None:

            print(
                f"[DESKTOP MONITOR] "
                f"{desktop_code} -> Database connection failed"
            )

            return

        cursor = db.cursor(
            dictionary=True
        )

        # ------------------------------------------
        # GET CURRENT COUNTERS
        # ------------------------------------------

        cursor.execute(
            """
            SELECT
                total_checks,
                successful_checks
            FROM desktops
            WHERE id = %s
            LIMIT 1
            """,
            (desktop_id,)
        )

        current = cursor.fetchone()

        if not current:
            return

        total_checks = (
            int(current["total_checks"] or 0)
            + 1
        )

        successful_checks = (
            int(current["successful_checks"] or 0)
            + (1 if ping_success else 0)
        )

        uptime_percent = (
            (
                successful_checks /
                total_checks
            ) * 100
            if total_checks > 0
            else 0
        )

        uptime_percent = round(
            uptime_percent,
            2
        )

        # ------------------------------------------
        # SAVE RESULT
        # ------------------------------------------

        cursor.execute(
            """
            UPDATE desktops
            SET
                status = %s,
                last_check = %s,
                last_latency_ms = %s,
                total_checks = %s,
                successful_checks = %s,
                uptime_percent = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (
                status,
                now,
                latency,
                total_checks,
                successful_checks,
                uptime_percent,
                now,
                desktop_id
            )
        )

        db.commit()

        print(
            f"[DESKTOP MONITOR] "
            f"{desktop_code} | "
            f"{ip_address} | "
            f"{status} | "
            f"Latency="
            f"{latency if latency is not None else '-'} ms | "
            f"Uptime={uptime_percent}%"
        )

    except subprocess.TimeoutExpired:

        print(
            f"[DESKTOP MONITOR] "
            f"{desktop.get('desktop_code', desktop.get('id'))} "
            f"-> Ping timeout"
        )

    except Exception as error:

        if db:

            try:
                db.rollback()
            except Exception:
                pass

        print(
            f"[DESKTOP MONITOR ERROR] "
            f"{desktop.get('desktop_code', desktop.get('id'))}: "
            f"{error}"
        )

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


# ----------------------------------------------------------
# AUTOMATIC DESKTOP MONITORING LOOP
# ----------------------------------------------------------

def automatic_desktop_monitoring_loop():

    print(
        "🖥️ NMS automatic desktop monitoring started."
    )

    while not desktop_monitoring_stop_event.is_set():

        db = None
        cursor = None

        try:

            db = get_db_connection()

            if db is None:

                desktop_monitoring_stop_event.wait(5)
                continue

            cursor = db.cursor(
                dictionary=True
            )

            # ------------------------------------------
            # GET MASTER MONITORING SETTINGS
            # ------------------------------------------

            cursor.execute(
                """
                SELECT
                    enabled,
                    selected_location
                FROM desktop_monitoring_settings
                WHERE id = 1
                LIMIT 1
                """
            )

            settings = cursor.fetchone()

            # ------------------------------------------
            # MASTER OFF
            # ------------------------------------------

            if not settings:

                desktop_monitoring_stop_event.wait(2)
                continue

            monitoring_enabled = (
                int(settings["enabled"] or 0) == 1
            )

            selected_location = (
                settings["selected_location"]
            )

            if (
                not monitoring_enabled
                or not selected_location
            ):

                desktop_monitoring_stop_event.wait(2)
                continue

            # ------------------------------------------
            # GET ONLY SELECTED LOCATION
            # ------------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
                    desktop_code,
                    location,
                    ip_address,
                    monitoring_enabled,
                    monitoring_interval,
                    last_check
                FROM desktops
                WHERE monitoring_enabled = 1
                  AND LOWER(TRIM(location))
                      = LOWER(TRIM(%s))
                ORDER BY id
                """,
                (selected_location,)
            )

            desktops = cursor.fetchall()

            # ------------------------------------------
            # CHECK DESKTOPS
            # ------------------------------------------

            for desktop in desktops:

                if desktop_monitoring_stop_event.is_set():
                    break

                interval = int(
                    desktop.get(
                        "monitoring_interval"
                    ) or 30
                )

                if interval <= 0:
                    interval = 30

                last_check = (
                    desktop.get("last_check")
                )

                # --------------------------------------
                # FIRST CHECK
                # --------------------------------------

                if last_check is None:

                    automatic_ping_desktop(
                        desktop
                    )

                    continue

                # --------------------------------------
                # ELAPSED TIME
                # --------------------------------------

                try:
                    if isinstance(last_check, datetime):
                        elapsed = (datetime.now() - last_check).total_seconds()
                    else:
                        clean_str = str(last_check).strip().replace(" ", "T")
                        last_check_dt = datetime.fromisoformat(clean_str)
                        elapsed = (datetime.now() - last_check_dt).total_seconds()
                except Exception:
                    elapsed = 0

                # --------------------------------------
                # PING ONLY WHEN DUE
                # --------------------------------------

                if elapsed >= interval:

                    automatic_ping_desktop(
                        desktop
                    )

        except Exception as error:

            print(
                f"[DESKTOP MONITOR LOOP ERROR] "
                f"{error}"
            )

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

        # ------------------------------------------
        # CHECK EVERY 1 SECOND
        # Actual ping happens only when interval
        # has elapsed.
        # ------------------------------------------

        desktop_monitoring_stop_event.wait(1)

    print(
        "🛑 NMS automatic desktop monitoring stopped."
    )


# ==========================================
# AUTOMATIC CCTV MONITORING LOOP
# ==========================================

def automatic_cctv_monitoring_loop():

    print("[CCTV] NMS automatic CCTV monitoring started.")

    while not cctv_monitoring_stop_event.is_set():

        db = None
        cursor = None

        try:

            db = get_db_connection()

            if db is None:
                print("[ERROR] CCTV monitor: database connection failed.")
                cctv_monitoring_stop_event.wait(5)
                continue

            cursor = db.cursor(dictionary=True)

            # ------------------------------------------
            # GET ALL ENABLED CAMERAS
            # ------------------------------------------

            cursor.execute(
                """
                SELECT
                    id,
                    camera_code,
                    camera_name,
                    ip_address,
                    status,
                    monitoring_enabled,
                    monitoring_interval,
                    offline_retry_interval,
                    last_check,
                    total_checks,
                    successful_checks
                FROM cameras
                WHERE monitoring_enabled = 1
                ORDER BY id
                """
            )

            cameras = cursor.fetchall()

            # ------------------------------------------
            # CHECK EACH CAMERA
            # ------------------------------------------

            for camera in cameras:

                if cctv_monitoring_stop_event.is_set():
                    break

                now = datetime.now()

                last_check = camera["last_check"]

                # --------------------------------------
                # FIND CURRENT CHECK INTERVAL
                # --------------------------------------

                if camera["status"] == "Offline":
                    check_interval = (
                        camera["offline_retry_interval"]
                        or 120
                    )
                else:
                    check_interval = (
                        camera["monitoring_interval"]
                        or 1800
                    )

                # --------------------------------------
                # CHECK IF CAMERA IS DUE
                # --------------------------------------

                camera_due = False

                if last_check is None:

                    camera_due = True

                else:

                    try:
                        if isinstance(last_check, datetime):
                            elapsed_seconds = (now - last_check).total_seconds()
                        else:
                            clean_str = str(last_check).strip().replace(" ", "T")
                            last_check_dt = datetime.fromisoformat(clean_str)
                            elapsed_seconds = (now - last_check_dt).total_seconds()
                    except Exception:
                        elapsed_seconds = check_interval

                    if elapsed_seconds >= check_interval:
                        camera_due = True

                if not camera_due:
                    continue

                # --------------------------------------
                # PING CAMERA
                # --------------------------------------

                ip_address = camera["ip_address"]

                if platform.system().lower() == "windows":

                    command = [
                        "ping",
                        "-n", "1",
                        "-w", "1000",
                        ip_address
                    ]

                else:

                    command = [
                        "ping",
                        "-c", "1",
                        "-W", "1",
                        ip_address
                    ]

                ping_success = False
                latency = None

                try:

                    result = subprocess.run(
                        command,
                        capture_output=True,
                        text=True,
                        timeout=3
                    )

                    output = (
                        result.stdout +
                        result.stderr
                    )

                    ping_success = (
                        result.returncode == 0
                    )

                    match = re.search(
                        r"time[=<]\s*(\d+(?:\.\d+)?)\s*ms",
                        output,
                        re.IGNORECASE
                    )

                    if match:
                        latency = float(
                            match.group(1)
                        )

                except Exception as ping_error:

                    print(
                        f"[ERROR] CCTV ping error | "
                        f"{ip_address} | "
                        f"{ping_error}"
                    )

                # --------------------------------------
                # NEW STATUS
                # --------------------------------------

                status = (
                    "Online"
                    if ping_success
                    else "Offline"
                )

                now = datetime.now()

                total_checks = (
                    int(camera["total_checks"] or 0)
                    + 1
                )

                successful_checks = (
                    int(
                        camera["successful_checks"]
                        or 0
                    )
                    + (1 if ping_success else 0)
                )

                uptime_percent = (
                    (
                        successful_checks
                        / total_checks
                    ) * 100
                    if total_checks > 0
                    else 0
                )

                # --------------------------------------
                # SAVE CCTV RESULT
                # --------------------------------------

                cursor.execute(
                    """
                    UPDATE cameras
                    SET
                        status = %s,
                        last_check = %s,
                        last_latency_ms = %s,
                        total_checks = %s,
                        successful_checks = %s,
                        uptime_percent = %s,
                        updated_at = %s
                    WHERE id = %s
                    """,
                    (
                        status,
                        now,
                        latency,
                        total_checks,
                        successful_checks,
                        uptime_percent,
                        now,
                        camera["id"]
                    )
                )

                db.commit()

                latency_text = (
                    f"{latency:.1f} ms"
                    if latency is not None
                    else "-"
                )

                print(
                    f"[NMS CCTV] "
                    f"{camera['camera_code']} | "
                    f"{ip_address} | "
                    f"{status} | "
                    f"Latency={latency_text} | "
                    f"Uptime={uptime_percent:.2f}%"
                )

        except Exception as error:

            print(
                f"[ERROR] CCTV automatic monitoring error: "
                f"{error}"
            )

            if db:
                try:
                    db.rollback()
                except Exception:
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

        # ------------------------------------------
        # CHECK EVERY 1 SECOND
        # Actual ping happens only when camera
        # monitoring interval has elapsed.
        # ------------------------------------------

        cctv_monitoring_stop_event.wait(1)

    print(
        "🛑 NMS automatic CCTV monitoring stopped."
    )


from app.extra_routes import router as extra_router
app.include_router(extra_router)

# ==========================================================
# START AUTOMATIC MONITORING
# ==========================================================

@app.on_event("startup")
def start_automatic_monitoring():
    try:
        from app.auto_init_db import ensure_database_initialized
        ensure_database_initialized()
    except Exception as e:
        print(f"[STARTUP DB INIT] {e}")

    global monitoring_thread
    global cctv_monitoring_thread
    global desktop_monitoring_thread
    
    # ==========================================
    # START DEVICE MONITORING
    # ==========================================

    if (
        monitoring_thread is None
        or not monitoring_thread.is_alive()
    ):

        monitoring_stop_event.clear()

        monitoring_thread = threading.Thread(
            target=automatic_monitoring_loop,
            name="NMS-Automatic-Device-Monitor",
            daemon=True
        )

        monitoring_thread.start()

        print("[SUCCESS] NMS automatic device monitoring started.")

    # ==========================================
    # START CCTV MONITORING
    # ==========================================

    if (
        cctv_monitoring_thread is None
        or not cctv_monitoring_thread.is_alive()
    ):

        cctv_monitoring_stop_event.clear()

        cctv_monitoring_thread = threading.Thread(
            target=automatic_cctv_monitoring_loop,
            name="NMS-Automatic-CCTV-Monitor",
            daemon=True
        )

        cctv_monitoring_thread.start()

        print("[CCTV] NMS automatic CCTV monitoring started.")


    # ==========================================
    # START DESKTOP MONITORING
    # ==========================================

    if (
        desktop_monitoring_thread is None
        or not desktop_monitoring_thread.is_alive()
    ):

        desktop_monitoring_stop_event.clear()

        desktop_monitoring_thread = threading.Thread(
            target=automatic_desktop_monitoring_loop,
            name="NMS-Automatic-Desktop-Monitor",
            daemon=True
        )

        desktop_monitoring_thread.start()

        print(
            "🖥️ NMS automatic desktop monitoring started."
        )

# ==========================================================
# STOP AUTOMATIC MONITORING
# ==========================================================

@app.on_event("shutdown")
def stop_automatic_monitoring():

    global monitoring_thread
    global cctv_monitoring_thread
    global desktop_monitoring_thread

    # ==========================================
    # STOP DEVICE MONITORING
    # ==========================================

    monitoring_stop_event.set()

    if (
        monitoring_thread is not None
        and monitoring_thread.is_alive()
    ):

        monitoring_thread.join(
            timeout=5
        )

    monitoring_thread = None

    # ==========================================
    # STOP CCTV MONITORING
    # ==========================================

    cctv_monitoring_stop_event.set()

    if (
        cctv_monitoring_thread is not None
        and cctv_monitoring_thread.is_alive()
    ):

        cctv_monitoring_thread.join(
            timeout=5
        )

    cctv_monitoring_thread = None

    print(
        "🛑 NMS device + CCTV monitoring shutdown complete."
    )

    # ==========================================
    # STOP DESKTOP MONITORING
    # ==========================================

    desktop_monitoring_stop_event.set()

    if (
        desktop_monitoring_thread is not None
        and desktop_monitoring_thread.is_alive()
    ):

        desktop_monitoring_thread.join(
            timeout=5
        )

    desktop_monitoring_thread = None

# ==========================================
# CCTV AUTOMATIC MONITORING CONTROL
# ==========================================

cctv_monitoring_thread = None
cctv_monitoring_stop_event = threading.Event()

# ==========================================
# FRONTEND STATIC FILES FOR CLOUD HOSTING
# ==========================================
@app.get("/{full_path:path}", include_in_schema=False)
def serve_frontend_files(full_path: str):
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    if not full_path or full_path == "/":
        target = os.path.join(FRONTEND_DIR, "login.html")
        if not os.path.isfile(target):
            target = os.path.join(root_dir, "login.html")
    else:
        clean = full_path.lstrip("/")
        target = os.path.join(FRONTEND_DIR, clean)
        if not os.path.isfile(target):
            target = os.path.join(root_dir, clean)

    if os.path.isfile(target):
        headers = {}
        if target.endswith((".html", ".js", ".css")):
            headers["Cache-Control"] = "no-cache"
        return FileResponse(target, headers=headers)

    login_fallback = os.path.join(FRONTEND_DIR, "login.html")
    if not os.path.isfile(login_fallback):
        login_fallback = os.path.join(root_dir, "login.html")
    if os.path.isfile(login_fallback):
        return FileResponse(login_fallback)

    return {"detail": "Not Found"}
