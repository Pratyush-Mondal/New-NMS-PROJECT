import os
import urllib.parse
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
    """Create a MySQL connection using env settings or cloud connection URL.

    Supported variables:
    DATABASE_URL, MYSQL_URL, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
    """
    # 1. Check for single cloud connection URL (TiDB, Aiven, Railway, Render)
    db_url = _get_env("DATABASE_URL", "MYSQL_URL")
    if db_url:
        try:
            parsed = urllib.parse.urlparse(db_url)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 3306
            user = parsed.username or "root"
            password = urllib.parse.unquote(parsed.password or "")
            database = (parsed.path or "").lstrip("/") or "neo_metaliks_nms"
            
            # Cloud databases (like TiDB, Aiven) often require SSL
            try:
                return mysql.connector.connect(
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=database,
                    autocommit=False,
                    ssl_disabled=False
                )
            except Exception:
                return mysql.connector.connect(
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=database,
                    autocommit=False
                )
        except Exception as e:
            print(f"[DB Cloud URL Connection Failed] {e}")

    # 2. Check individual environment variables
    host = _get_env("MYSQL_HOST", "DB_HOST", default="127.0.0.1")
    primary_port = int(_get_env("MYSQL_PORT", "DB_PORT", default="3306"))
    user = _get_env("MYSQL_USER", "DB_USER", default="root")
    password = _get_env("MYSQL_PASSWORD", "DB_PASSWORD", default="")
    database = _get_env(
        "MYSQL_DATABASE",
        "DB_NAME",
        default="neo_metaliks_nms",
    )

    ports_to_try = [primary_port]
    for alt in (3306, 3307):
        if alt not in ports_to_try:
            ports_to_try.append(alt)

    for p in ports_to_try:
        try:
            return mysql.connector.connect(
                host=host,
                port=p,
                user=user,
                password=password,
                database=database,
                autocommit=False,
            )
        except (mysql.connector.Error, ValueError):
            continue
    return None