import os
import sys
import subprocess
import tempfile
import ctypes

TASK_NAME = "NeoMetaliks_LocalNMS"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Locate pythonw.exe
PYTHONW_PATH = os.path.join(PROJECT_DIR, "backend", "venv", "Scripts", "pythonw.exe")
if not os.path.exists(PYTHONW_PATH):
    PYTHONW_PATH = sys.executable.replace("python.exe", "pythonw.exe")

SCRIPT_PATH = os.path.join(PROJECT_DIR, "run_local_nms.py")
STARTUP_DIR = os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup")
STARTUP_VBS = os.path.join(STARTUP_DIR, "NeoMetaliks_LocalNMS.vbs")

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def build_task_xml():
    xml_content = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Neo Metaliks NMS Local Server (FastAPI Backend and Frontend)</Description>
    <Author>Neo Metaliks IT</Author>
    <URI>\\{TASK_NAME}</URI>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>5</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{PYTHONW_PATH}</Command>
      <Arguments>"{SCRIPT_PATH}"</Arguments>
      <WorkingDirectory>{PROJECT_DIR}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"""
    return xml_content

def install_user_startup_fallback():
    """Install background launcher into user's Startup folder as zero-privilege fallback."""
    vbs_content = f'''Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "{PROJECT_DIR}"
WshShell.Run """{PYTHONW_PATH}"" ""{SCRIPT_PATH}""", 0, False
'''
    try:
        with open(STARTUP_VBS, "w", encoding="utf-8") as f:
            f.write(vbs_content)
        print(f"[OK] User Startup fallback launcher registered: {STARTUP_VBS}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to write User Startup launcher: {e}")
        return False

def check_task_exists():
    try:
        res = subprocess.run(["schtasks", "/query", "/tn", TASK_NAME], capture_output=True, text=True)
        return res.returncode == 0
    except Exception:
        return False

def register_local_autostart():
    print("=" * 65)
    print("  NEO METALIKS NMS - LOCAL SERVER AUTOSTART REGISTRATION")
    print("=" * 65)
    print(f"Project Directory : {PROJECT_DIR}")
    print(f"Interpreter       : {PYTHONW_PATH}")
    print(f"Server Launcher   : {SCRIPT_PATH}")
    print(f"Task Scheduler Name : {TASK_NAME}")
    print("-" * 65)

    if not os.path.exists(PYTHONW_PATH):
        print(f"[ERROR] pythonw.exe not found at: {PYTHONW_PATH}")
        return False
    if not os.path.exists(SCRIPT_PATH):
        print(f"[ERROR] Launcher script not found at: {SCRIPT_PATH}")
        return False

    existing = check_task_exists()
    if existing:
        print(f"[INFO] Existing task '{TASK_NAME}' detected. Updating existing task configuration...")
    else:
        print(f"[INFO] Registering new task '{TASK_NAME}' with Windows Task Scheduler...")

    xml_text = build_task_xml()
    temp_xml = os.path.join(tempfile.gettempdir(), f"{TASK_NAME}.xml")
    with open(temp_xml, "w", encoding="utf-16") as f:
        f.write(xml_text)

    cmd = ["schtasks", "/create", "/tn", TASK_NAME, "/xml", temp_xml, "/f"]
    res = subprocess.run(cmd, capture_output=True, text=True)

    task_registered = False
    if res.returncode == 0:
        print(f"[SUCCESS] Windows Task Scheduler task '{TASK_NAME}' registered successfully.")
        task_registered = True
    else:
        print("[INFO] Direct Task Scheduler registration notice:")
        print("Details:", res.stderr.strip() or res.stdout.strip())
        print("-> Configuring User Startup shortcut (no administrative elevation needed)...")
        if install_user_startup_fallback():
            print("[SUCCESS] Windows user logon autostart registered via User Startup folder.")
            task_registered = True

    # Also install startup fallback just in case so logon trigger is doubly reliable
    if not os.path.exists(STARTUP_VBS):
        install_user_startup_fallback()

    print("-" * 65)
    print("Local NMS Server is now configured to start automatically on Windows user logon!")
    print(f"Local Server URL: http://127.0.0.1:8000")
    print(f"Runtime Log File: {os.path.join(PROJECT_DIR, 'logs', 'local_nms.log')}")
    print("=" * 65)
    return task_registered

def remove_local_autostart():
    print("=" * 65)
    print("  NEO METALIKS NMS - REMOVING LOCAL AUTOSTART")
    print("=" * 65)
    
    # 1. Remove Task Scheduler task
    if check_task_exists():
        res = subprocess.run(["schtasks", "/delete", "/tn", TASK_NAME, "/f"], capture_output=True, text=True)
        if res.returncode == 0:
            print(f"[SUCCESS] Task Scheduler task '{TASK_NAME}' deleted successfully.")
        else:
            print(f"[WARNING] Could not delete Task Scheduler task: {res.stderr.strip()}")
    else:
        print(f"[INFO] Task Scheduler task '{TASK_NAME}' was not registered.")

    # 2. Remove Startup folder VBS
    if os.path.exists(STARTUP_VBS):
        try:
            os.remove(STARTUP_VBS)
            print(f"[SUCCESS] User Startup launcher removed: {STARTUP_VBS}")
        except Exception as e:
            print(f"[WARNING] Could not remove User Startup launcher: {e}")
    else:
        print("[INFO] No User Startup launcher found in Startup folder.")

    print("=" * 65)
    print("[SUCCESS] Local autostart removal complete.")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--remove":
        remove_local_autostart()
    else:
        register_local_autostart()
