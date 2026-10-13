import os
import sys
import subprocess
import tempfile
import ctypes

TASK_NAME = "NeoMetaliks_PlantProbe"
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHONW_PATH = os.path.join(PROJECT_DIR, "backend", "venv", "Scripts", "pythonw.exe")
if not os.path.exists(PYTHONW_PATH):
    PYTHONW_PATH = sys.executable.replace("python.exe", "pythonw.exe")
SCRIPT_PATH = os.path.join(PROJECT_DIR, "plant_lan_probe.py")
STARTUP_DIR = os.path.expandvars(r"%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup")
STARTUP_VBS = os.path.join(STARTUP_DIR, "NeoMetaliks_PlantProbe.vbs")

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        return False

def build_task_xml():
    xml_content = f"""<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Neo Metaliks NMS Plant LAN Automatic Monitoring Agent</Description>
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
    """Install non-elevated VBS background launcher into user's Startup folder as fallback."""
    vbs_content = f'''Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "{PROJECT_DIR}"
WshShell.Run """{PYTHONW_PATH}"" ""{SCRIPT_PATH}""", 0, False
'''
    try:
        with open(STARTUP_VBS, "w", encoding="utf-8") as f:
            f.write(vbs_content)
        print(f"[SUCCESS] User Startup fallback launcher installed: {STARTUP_VBS}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to write User Startup launcher: {e}")
        return False

def register_task():
    print("=" * 65)
    print("  NEO METALIKS NMS - WINDOWS AUTO-STARTUP TASK SETUP")
    print("=" * 65)
    print(f"Project Directory : {PROJECT_DIR}")
    print(f"Interpreter       : {PYTHONW_PATH}")
    print(f"Probe Script      : {SCRIPT_PATH}")
    print(f"Task Name         : {TASK_NAME}")
    print("-" * 65)

    if not os.path.exists(PYTHONW_PATH):
        print(f"[ERROR] pythonw.exe not found at: {PYTHONW_PATH}")
        return False
    if not os.path.exists(SCRIPT_PATH):
        print(f"[ERROR] probe script not found at: {SCRIPT_PATH}")
        return False

    xml_text = build_task_xml()
    temp_xml = os.path.join(tempfile.gettempdir(), f"{TASK_NAME}.xml")
    
    with open(temp_xml, "w", encoding="utf-16") as f:
        f.write(xml_text)
    
    # 1. Register task with schtasks
    cmd = ["schtasks", "/create", "/tn", TASK_NAME, "/xml", temp_xml, "/f"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("[WARNING] Could not register via Task Scheduler directly:")
        print("Details:", res.stderr.strip() or res.stdout.strip())
        if "access is denied" in (res.stderr + res.stdout).lower():
            print("\n-> Note: Windows Task Scheduler requires Administrator privileges.")
            print("-> Attempting user Startup folder installation (zero elevation required)...")
            install_user_startup_fallback()
            # Also launch background process now
            subprocess.Popen([PYTHONW_PATH, SCRIPT_PATH], cwd=PROJECT_DIR)
            print("[SUCCESS] Probe launched in background via pythonw.exe.")
            print("-" * 65)
            print("Auto-startup configured via User Startup folder!")
            print(f"Persistent activity log: {os.path.join(PROJECT_DIR, 'logs', 'plant_probe.log')}")
            return True
        return False
    
    print("[SUCCESS] Task registered in Windows Task Scheduler.")

    # 2. Run the task now
    run_res = subprocess.run(["schtasks", "/run", "/tn", TASK_NAME], capture_output=True, text=True)
    if run_res.returncode == 0:
        print("[SUCCESS] Task launched in the background.")
    else:
        print(f"[INFO] Launch note: {run_res.stderr.strip() or run_res.stdout.strip()}")

    # 3. Query status
    q_res = subprocess.run(["schtasks", "/query", "/tn", TASK_NAME, "/fo", "LIST"], capture_output=True, text=True)
    print("\n--- Current Scheduled Task Status ---")
    print(q_res.stdout.strip())
    print("-" * 65)
    print("Monitoring is now configured to start automatically on every user logon!")
    print(f"Persistent activity log: {os.path.join(PROJECT_DIR, 'logs', 'plant_probe.log')}")
    return True

if __name__ == "__main__":
    register_task()
