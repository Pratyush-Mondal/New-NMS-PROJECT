import os
import urllib.parse
from pathlib import Path
import threading
import mysql.connector
import mysql.connector.pooling
from dotenv import load_dotenv


# backend/.env
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

_db_pool = None
_pool_lock = threading.Lock()


def _get_env(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value not in (None, ""):
            return value
    return default


DEFAULT_DB_URL = "mysql://2v9Ac8dmNnbuaJg.root:3K1EV2DPGMMw6yEb@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test"

def _init_pool():
    global _db_pool
    # 1. Cloud connection URL (TiDB, Aiven, Railway, Render)
    db_url = _get_env("DATABASE_URL", "MYSQL_URL", default=DEFAULT_DB_URL)
    if db_url:
        try:
            parsed = urllib.parse.urlparse(db_url)
            host = parsed.hostname or "127.0.0.1"
            port = parsed.port or 3306
            user = parsed.username or "root"
            password = urllib.parse.unquote(parsed.password or "")
            database = (parsed.path or "").lstrip("/") or "neo_metaliks_nms"

            try:
                _db_pool = mysql.connector.pooling.MySQLConnectionPool(
                    pool_name="nms_main_pool",
                    pool_size=32,
                    pool_reset_session=True,
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=database,
                    ssl_disabled=False,
                    connection_timeout=5
                )
                print("[DB Pool Initialized] Cloud connection pool ready (SSL)")
                return
            except Exception as e:
                print(f"[DB Pool SSL init fallback]: {e}")
                _db_pool = mysql.connector.pooling.MySQLConnectionPool(
                    pool_name="nms_main_pool",
                    pool_size=32,
                    pool_reset_session=True,
                    host=host,
                    port=port,
                    user=user,
                    password=password,
                    database=database,
                    connection_timeout=5
                )
                print("[DB Pool Initialized] Cloud connection pool ready (plain)")
                return
        except Exception as e:
            print(f"[DB Pool URL Init Failed] {e}")

    # 2. Local environment variables
    host = _get_env("MYSQL_HOST", "DB_HOST", default="127.0.0.1")
    primary_port = int(_get_env("MYSQL_PORT", "DB_PORT", default="3306"))
    user = _get_env("MYSQL_USER", "DB_USER", default="root")
    password = _get_env("MYSQL_PASSWORD", "DB_PASSWORD", default="")
    database = _get_env("MYSQL_DATABASE", "DB_NAME", default="neo_metaliks_nms")

    try:
        _db_pool = mysql.connector.pooling.MySQLConnectionPool(
            pool_name="nms_main_pool",
            pool_size=32,
            pool_reset_session=True,
            host=host,
            port=primary_port,
            user=user,
            password=password,
            database=database,
            connection_timeout=5
        )
        print("[DB Pool Initialized] Local connection pool ready")
    except Exception as e:
        print(f"[DB Local Pool Init Failed] {e}")


def get_db_connection():
    """Obtain a reusable MySQL connection from connection pool with fast fallbacks."""
    global _db_pool
    if _db_pool is None:
        with _pool_lock:
            if _db_pool is None:
                _init_pool()

    if _db_pool is not None:
        import time
        for attempt in range(4):
            try:
                conn = _db_pool.get_connection()
                if conn and conn.is_connected():
                    return conn
                elif conn:
                    conn.reconnect(attempts=2, delay=0.2)
                    return conn
            except Exception as e:
                if attempt < 3:
                    time.sleep(0.1)
                else:
                    print(f"[DB Pool busy, trying fallback]: {e}")

    # Fallback to direct cloud connection if pool is busy
    db_url = _get_env("DATABASE_URL", "MYSQL_URL", default=DEFAULT_DB_URL)
    if db_url:
        try:
            parsed = urllib.parse.urlparse(db_url)
            return mysql.connector.connect(
                host=parsed.hostname or "127.0.0.1",
                port=parsed.port or 3306,
                user=parsed.username or "root",
                password=urllib.parse.unquote(parsed.password or ""),
                database=(parsed.path or "").lstrip("/") or "neo_metaliks_nms",
                ssl_disabled=False,
                connection_timeout=5
            )
        except Exception:
            pass

    # Final local fallback
    host = _get_env("MYSQL_HOST", "DB_HOST", default="127.0.0.1")
    primary_port = int(_get_env("MYSQL_PORT", "DB_PORT", default="3306"))
    user = _get_env("MYSQL_USER", "DB_USER", default="root")
    password = _get_env("MYSQL_PASSWORD", "DB_PASSWORD", default="")
    database = _get_env("MYSQL_DATABASE", "DB_NAME", default="neo_metaliks_nms")

    for p in (primary_port, 3307):
        try:
            return mysql.connector.connect(
                host=host,
                port=p,
                user=user,
                password=password,
                database=database,
                connection_timeout=3
            )
        except Exception:
            continue
    return None