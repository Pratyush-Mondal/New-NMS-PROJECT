import hashlib
import hmac
import os

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
    connection = get_db_connection()

    if connection is None:
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

        if not admin or not admin["is_active"]:
            return None

        if not verify_password(password, admin["password_hash"]):
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

        connection = get_db_connection()

        if connection is None:
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
                return None

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