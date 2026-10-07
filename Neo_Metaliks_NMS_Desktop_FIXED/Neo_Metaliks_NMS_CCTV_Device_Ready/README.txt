NEO METALIKS NMS - DEVICE SAVE + PING READY FILES

Included:
frontend/index.html
frontend/script.js
frontend/style.css

Important:
1. Keep your existing backend/app/database.py and .env unchanged.
2. Replace the corresponding current files with these READY files.
3. The frontend Add Device form uses the current IDs:
   newDeviceId, newDeviceName, newDeviceType, newDeviceIp, newDeviceLocation.
4. Save Device now calls POST /api/devices, requires a JSON response containing device.id,
   then immediately calls POST /api/devices/{id}/ping.
5. A successful ping updates Online/Offline + latency.
6. If the device is unreachable, it remains saved and shows the ping failure status instead of undoing the save.
7. Devices with monitoring_enabled enabled are automatically pinged from the open dashboard using monitoring_interval (minimum 5 seconds client-side).
8. DELETE and manual PING buttons remain available.

Run backend from the backend folder:
uvicorn app.main:app --reload

Do not share .env or credentials.


uvicorn app.main:app --reload  (uvicorn reload er command)

cd "C:\Users\windows10 pro\OneDrive\Desktop\NML PROJECT\backend"  (terminal backend start command)
.\venv\Scripts\Activate.ps1  (activate command)
