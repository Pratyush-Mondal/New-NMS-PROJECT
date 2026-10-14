import os
import sys
import time
import socket
from datetime import datetime

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_DIR)
os.makedirs(os.path.join(PROJECT_DIR, "logs"), exist_ok=True)
LOG_FILE = os.path.join(PROJECT_DIR, "logs", "local_nms.log")

LOCK_PORT = 49255
_lock_socket = None

def acquire_instance_lock():
    global _lock_socket
    try:
        _lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _lock_socket.bind(("127.0.0.1", LOCK_PORT))
        _lock_socket.listen(1)
        return True
    except socket.error:
        return False

def check_port_in_use(port=8000):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0

def ensure_env_file():
    env_file = os.path.join(PROJECT_DIR, "backend", ".env")
    if not os.path.exists(env_file):
        default_content = (
            "DATABASE_URL=mysql://2v9Ac8dmNnbuaJg.root:3K1EV2DPGMMw6yEb@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test\n"
            "MYSQL_HOST=127.0.0.1\n"
            "MYSQL_PORT=3307\n"
            "MYSQL_USER=root\n"
            "MYSQL_PASSWORD=\n"
            "MYSQL_DATABASE=neo_metaliks_nms\n"
            "JWT_SECRET=zP2CxWJeZngbA4tVz8OcU_t6wDXWZFHTEX_uGj56q_CzFwEJO8E-Xvds3xpJYQkI\n"
        )
        try:
            with open(env_file, "w", encoding="utf-8") as f:
                f.write(default_content)
        except Exception:
            pass

class DualLogger:
    def __init__(self, filepath, stream):
        self.stream = stream
        self.file = open(filepath, "a", encoding="utf-8", buffering=1)

    def write(self, data):
        try:
            if self.stream:
                self.stream.write(data)
                self.stream.flush()
        except Exception:
            pass
        try:
            self.file.write(data)
            self.file.flush()
        except Exception:
            pass

    def flush(self):
        try:
            if self.stream:
                self.stream.flush()
        except Exception:
            pass
        try:
            self.file.flush()
        except Exception:
            pass

def main():
    ensure_env_file()
    if not acquire_instance_lock() or check_port_in_use(8000):
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [INFO] Instance already active or port 8000 in use. Exiting duplicate process cleanly.\n")
        print("[INFO] Neo Metaliks NMS is already running on http://127.0.0.1:8000")
        sys.exit(0)

    # Setup file + console logging
    sys.stdout = DualLogger(LOG_FILE, sys.stdout)
    sys.stderr = DualLogger(LOG_FILE, sys.stderr)

    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"\n=======================================================")
    print(f"[{now_str}] Neo Metaliks Local NMS Server Starting...")
    print(f"Project Directory : {PROJECT_DIR}")
    print(f"Local Access URL  : http://127.0.0.1:8000")
    print(f"Single Instance   : Locked on port {LOCK_PORT}")
    print(f"=======================================================\n")

    sys.path.insert(0, os.path.join(PROJECT_DIR, "backend"))

    try:
        # pyrefly: ignore [missing-import]
        import uvicorn
        uvicorn.run("app.main:app", host="0.0.0.0", port=8000, app_dir="backend", log_level="info")
    except Exception as e:
        err_now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{err_now}] [CRITICAL ERROR] Server failed to start: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
