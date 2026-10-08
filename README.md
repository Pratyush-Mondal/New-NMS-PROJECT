# Neo Metaliks Network Management System (NMS)

A robust, full-stack Network Management System designed for Neo Metaliks. This application provides real-time monitoring and management of network devices, servers, and CCTV cameras.

## Features

- **Dynamic Dashboard**: View live statistics, system health, and critical metrics at a glance.
- **CCTV Monitoring**: Manage and monitor CCTV cameras, with ping tests and status updates.
- **Network Map**: Visual representation of the network topology and active devices.
- **Alerts & Incidents**: Real-time notifications for offline devices, high latency, and high resource utilization.
- **Reports & Analytics**: Generate comprehensive reports on device uptime and network health.
- **Admin Management**: Secure login (JWT based) and customizable administrator profiles.

## Architecture

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, and pure CSS for a lightweight, high-performance, and responsive user interface.
- **Backend**: Python 3, FastAPI, and Uvicorn providing a fast and asynchronous REST API.
- **Database**: SQLite with SQLAlchemy ORM, securely storing devices, cameras, and admin credentials (scrypt hashing).

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js/Live Server (optional, for frontend development)

### Backend Setup

1. Navigate to the `backend` directory.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate # Windows
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the backend server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. Navigate to `Neo_Metaliks_NMS_Desktop_FIXED/Neo_Metaliks_NMS_CCTV_Device_Ready`.
2. Serve the directory using any HTTP server (e.g., Python's built-in `http.server` or VS Code Live Server):
   ```bash
   python -m http.server 5500
   ```
3. Open `http://127.0.0.1:5500/login.html` in your browser.

## Credentials

By default, access the system using the configured admin credentials.

## License

All rights reserved. Neo Metaliks Network Management System.
