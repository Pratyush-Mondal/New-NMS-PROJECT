import subprocess
import time
import re
import os
import sys

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(PROJECT_DIR)
os.makedirs("logs", exist_ok=True)
URL_FILE = os.path.join(PROJECT_DIR, "logs", "live_public_url.txt")
LOG_FILE = os.path.join(PROJECT_DIR, "logs", "tunnel.log")

cmd = [os.path.join(PROJECT_DIR, "cloudflared.exe"), "tunnel", "--url", "http://127.0.0.1:8000"]

proc = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    encoding="utf-8",
    errors="replace"
)

tunnel_url = None
with open(LOG_FILE, "a", encoding="utf-8") as log_fp:
    for line in proc.stdout:
        log_fp.write(line)
        log_fp.flush()
        if not tunnel_url:
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
            if match:
                tunnel_url = match.group(0)
                print(f"[TUNNEL_ONLINE] {tunnel_url}", flush=True)
                with open(URL_FILE, "w", encoding="utf-8") as uf:
                    uf.write(tunnel_url + "\n")
