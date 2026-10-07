import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


# backend/.env
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)


def _get_env(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value
    return default


def get_db_connection():
    """Create a MySQL connection using backend/.env settings.

    Supported names:
    MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
    """
    try:
        host = _get_env("MYSQL_HOST", "DB_HOST", default="127.0.0.1")
        port = int(_get_env("MYSQL_PORT", "DB_PORT", default="3306"))
        user = _get_env("MYSQL_USER", "DB_USER", default="root")
        password = _get_env("MYSQL_PASSWORD", "DB_PASSWORD", default="")
        database = _get_env(
            "MYSQL_DATABASE",
            "DB_NAME",
            default="neo_metaliks_nms",
        )

        return mysql.connector.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            autocommit=False,
        )
    except (mysql.connector.Error, ValueError):
        return None