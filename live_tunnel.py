import os
import sys
import re
import time
import socket
import subprocess
import webbrowser
import urllib.request

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CLOUDFLARED_EXE = os.path.join(PROJECT_DIR, "cloudflared.exe")

def is_port_open(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1.5)
            return s.connect_ex(("127.0.0.1", port)) == 0
    except Exception:
        return False

def ensure_services():
    print("[*] Checking local services...")
    
    # 1. MySQL on 3307
    if not is_port_open(3307):
        print("[!] MySQL (port 3307) is offline. Starting MySQL...")
        mysqld_path = r"C:\xampp\mysql\bin\mysqld.exe"
        if os.path.exists(mysqld_path):
            subprocess.Popen([mysqld_path, "--defaults-file=C:\\xampp\\mysql\\bin\\my.ini", "--standalone"],
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
            time.sleep(3)
        else:
            print("[WARNING] mysqld.exe not found at C:\\xampp\\mysql\\bin\\mysqld.exe")
    else:
        print("[+] MySQL: RUNNING (Port 3307)")

    # 2. FastAPI Backend on 8000
    if not is_port_open(8000):
        print("[!] FastAPI Backend (port 8000) is offline. Starting Backend...")
        backend_dir = os.path.join(PROJECT_DIR, "backend")
        backend_python = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
        if not os.path.exists(backend_python):
            backend_python = sys.executable
        subprocess.Popen([backend_python, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
                         cwd=backend_dir,
                         creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0)
        time.sleep(3)
    else:
        print("[+] FastAPI Backend: RUNNING (Port 8000)")

    # 3. Proxy Server on 8081
    if not is_port_open(8081):
        print("[!] Proxy Server (port 8081) is offline. Starting Proxy...")
        proxy_path = os.path.join(PROJECT_DIR, "Neo_Metaliks_NMS_Desktop_FIXED", "Neo_Metaliks_NMS_CCTV_Device_Ready", "proxy_server.py")
        subprocess.Popen([sys.executable, proxy_path],
                         cwd=os.path.dirname(proxy_path),
                         creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == "nt" else 0)
        time.sleep(2)
    else:
        print("[+] Proxy Server: RUNNING (Port 8081)")

def copy_to_clipboard(text):
    try:
        cmd = f'echo | set /p="{text}" | clip'
        subprocess.run(cmd, shell=True, check=False)
        return True
    except Exception:
        return False

def save_shortcuts(login_url):
    # Save to CURRENT_LIVE_LINK.txt
    txt_path = os.path.join(PROJECT_DIR, "CURRENT_LIVE_LINK.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(login_url + "\n")
    
    # Save URL shortcut on Project Root
    url_shortcut = os.path.join(PROJECT_DIR, "OPEN_LIVE_NMS.url")
    with open(url_shortcut, "w", encoding="utf-8") as f:
        f.write(f"[InternetShortcut]\nURL={login_url}\nIconIndex=0\n")
        
    # Save URL shortcut on User Desktops (both standard and OneDrive Desktop)
    desktop_paths = [
        os.path.join(os.path.expanduser("~"), "Desktop"),
        os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop"),
        os.path.dirname(PROJECT_DIR)  # which is Desktop itself!
    ]
    for dpath in desktop_paths:
        if os.path.exists(dpath):
            try:
                sc_file = os.path.join(dpath, "Neo_Metaliks_NMS_LIVE.url")
                with open(sc_file, "w", encoding="utf-8") as f:
                    f.write(f"[InternetShortcut]\nURL={login_url}\nIconIndex=0\n")
            except Exception:
                pass

def main():
    if sys.platform == "win32":
        os.system("color 0a")
        os.system("title NEO METALIKS NMS - LIVE CLOUDFLARE LAUNCHER")

    print("=" * 65)
    print("      NEO METALIKS NMS — AUTOMATIC LIVE TUNNEL & LAUNCHER")
    print("=" * 65)
    print()

    if not os.path.exists(CLOUDFLARED_EXE):
        print(f"[ERROR] cloudflared.exe was not found in: {PROJECT_DIR}")
        input("Press Enter to exit...")
        return

    ensure_services()

    print()
    print("[*] Launching Cloudflare Global Tunnel for Port 8081...")
    print("[*] Generating unique, secure HTTPS link. Please wait 3-5 seconds...")
    print("-" * 65)

    proc = subprocess.Popen(
        [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:8081"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    tunnel_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    # Read output to capture the URL
    while True:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
        if line:
            match = url_pattern.search(line)
            if match:
                tunnel_url = match.group(0)
                break

    if not tunnel_url:
        print("[ERROR] Could not extract Cloudflare tunnel URL!")
        if proc.poll() is not None:
            print(f"cloudflared exited with return code: {proc.returncode}")
        input("Press Enter to exit...")
        return

    login_url = f"{tunnel_url}/login.html"
    copy_to_clipboard(login_url)
    save_shortcuts(login_url)

    print()
    print("=" * 65)
    print("               >>> LIVE NMS ONLINE NOW <<<")
    print("=" * 65)
    print()
    print(f"  LOGIN URL : {login_url}")
    print()
    print("  [SUCCESS] Link automatically copied to clipboard (Ctrl + V)!")
    print("  [SUCCESS] Desktop shortcut 'Neo_Metaliks_NMS_LIVE' updated!")
    print("  [SUCCESS] Local file 'CURRENT_LIVE_LINK.txt' updated!")
    print()
    print("  --- ADMIN LOGIN CREDENTIALS ---")
    print("  Admin Email    : admin@neometaliks.com")
    print("  Admin Password : NML@Admin2026")
    print()
    print("=" * 65)
    print("[*] Automatically opening browser in 2 seconds...")
    time.sleep(2)

    try:
        webbrowser.open(login_url)
    except Exception as e:
        print(f"[!] Could not open browser automatically: {e}")

    print("[*] Tunnel is active. Keep this window OPEN while using NMS.")
    print("[*] Press Ctrl+C in this window anytime to stop the tunnel.")
    print("=" * 65)

    try:
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
    except KeyboardInterrupt:
        print("\n[*] Stopping Cloudflare tunnel...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        print("[+] Tunnel stopped.")

if __name__ == "__main__":
    main()
