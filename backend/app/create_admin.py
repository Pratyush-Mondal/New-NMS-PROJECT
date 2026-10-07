import getpass
import hashlib
import secrets

from app.database import get_db_connection


SCRYPT_N = 16384
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64


def hash_password(password: str) -> str:
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

    return (
        f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}$"
        f"{salt.hex()}${derived.hex()}"
    )


def main():
    print("=== Neo Metaliks NMS - Create Administrator ===")

    name = input("Full name: ").strip()
    email = input("Email: ").strip().lower()
    phone = input("Phone (optional): ").strip() or None
    department = input("Department (optional): ").strip() or None
    location = input("Location (optional): ").strip() or None

    if not name or not email:
        print("Name and email are required.")
        return

    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        return

    connection = get_db_connection()

    if connection is None:
        print("Database connection failed. Check backend/.env and MySQL.")
        return

    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute(
            "SELECT id FROM admins WHERE email = %s LIMIT 1",
            (email,),
        )

        existing = cursor.fetchone()

        if existing:
            print(
                f"Admin already exists with ID {existing['id']}."
            )
            return

        password_hash = hash_password(password)

        cursor.execute(
            """
            INSERT INTO admins (
                name,
                email,
                password_hash,
                phone,
                department,
                location,
                is_active
            )
            VALUES (%s, %s, %s, %s, %s, %s, 1)
            """,
            (
                name,
                email,
                password_hash,
                phone,
                department,
                location,
            ),
        )

        admin_id = cursor.lastrowid

        connection.commit()

        print("Administrator created successfully.")
        print(f"Admin ID: {admin_id}")
        print(f"Email: {email}")

    except Exception as error:
        connection.rollback()
        print(f"Failed to create administrator: {error}")

    finally:
        if cursor:
            cursor.close()

        connection.close()


if __name__ == "__main__":
    main()