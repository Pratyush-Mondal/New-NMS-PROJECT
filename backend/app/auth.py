import hashlib
import hmac
import os
import time

import jwt

from app.database import get_db_connection


JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing from backend/.env")

JWT_ALGORITHM = "HS256"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify scrypt password hashes stored by create_admin.py."""
    try:
        parts = stored_hash.split("$")

        if len(parts) != 6 or parts[0] != "scrypt":
            return False

        n = int(parts[1])
        r = int(parts[2])
        p = int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected_hash = bytes.fromhex(parts[5])

        actual_hash = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected_hash),
        )

        return hmac.compare_digest(actual_hash, expected_hash)

    except (ValueError, TypeError):
        return False


def authenticate_admin(email: str, password: str):
    import sys
    print(f"DEBUG: authenticate_admin called with email={email}", file=sys.stderr)
    connection = get_db_connection()

    if connection is None:
        print("DEBUG: connection is None", file=sys.stderr)
        return None

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                id,
                name,
                email,
                password_hash,
                phone,
                department,
                location,
                is_active
            FROM admins
            WHERE email = %s
            LIMIT 1
            """,
            (email.lower(),),
        )

        admin = cursor.fetchone()

        if not admin:
            print("DEBUG: admin not found in DB", file=sys.stderr)
            return None
            
        if not admin["is_active"]:
            print("DEBUG: admin is inactive", file=sys.stderr)
            return None

        is_valid = verify_password(password, admin["password_hash"])
        print(f"DEBUG: verify_password returned {is_valid}", file=sys.stderr)
        
        if not is_valid:
            return None

        return admin

    finally:
        if cursor:
            cursor.close()

        connection.close()


def create_access_token(admin_id: int, email: str):
    payload = {
        "sub": str(admin_id),
        "email": email,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


_ADMIN_CACHE = {}
_ADMIN_CACHE_TIME = {}


def get_admin_from_token(token: str):
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        admin_id = payload.get("sub")

        if not admin_id:
            return None

        # Check in-memory cache (30s TTL)
        now = time.time()
        cached = _ADMIN_CACHE.get(str(admin_id))
        if cached and (now - _ADMIN_CACHE_TIME.get(str(admin_id), 0)) < 30:
            return cached

        connection = get_db_connection()

        if connection is None:
            return cached or None

        cursor = None

        try:
            cursor = connection.cursor(dictionary=True)

            cursor.execute(
                """
                SELECT
                    id,
                    name,
                    email,
                    phone,
                    department,
                    location,
                    profile_image,
                    is_active
                FROM admins
                WHERE id = %s
                LIMIT 1
                """,
                (int(admin_id),),
            )

            admin = cursor.fetchone()

            if not admin or not admin["is_active"]:
                _ADMIN_CACHE.pop(str(admin_id), None)
                return None

            _ADMIN_CACHE[str(admin_id)] = admin
            _ADMIN_CACHE_TIME[str(admin_id)] = now
            return admin

        finally:
            if cursor:
                cursor.close()

            connection.close()

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
    ):
        return None

