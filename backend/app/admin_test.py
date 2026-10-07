from app.database import get_db_connection


def main():
    connection = get_db_connection()

    if connection is None:
        print("❌ Database connection failed.")
        return

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
                is_active
            FROM admins
            ORDER BY id
            """
        )

        admins = cursor.fetchall()

        print("✅ admins table connected successfully.")
        print(f"Current admin records: {len(admins)}")

        for admin in admins:
            print(
                f"ID={admin['id']} | "
                f"Name={admin['name']} | "
                f"Email={admin['email']} | "
                f"Active={admin['is_active']}"
            )

    except Exception as error:
        print(f"❌ Admin test failed: {error}")

    finally:
        if cursor:
            cursor.close()

        connection.close()


if __name__ == "__main__":
    main()