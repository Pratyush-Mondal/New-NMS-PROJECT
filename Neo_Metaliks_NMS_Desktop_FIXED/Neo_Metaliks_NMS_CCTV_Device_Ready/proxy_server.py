import os
import sys
import http.server
import urllib.request
import urllib.error
import socket

PORT = 8081
BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_DIR = os.path.dirname(os.path.abspath(__file__))

class UnifiedNMSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        if hasattr(self, "path") and any(self.path.split("?")[0].endswith(ext) for ext in (".html", ".js")):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        if self.path.startswith("/api/") or self.path.startswith("/uploads/") or self.path in ("/docs", "/openapi.json"):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
        else:
            super().do_OPTIONS()

    def do_GET(self):
        if self._is_backend_route():
            self._proxy("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self._is_backend_route():
            self._proxy("POST")
        else:
            super().do_POST()

    def do_PUT(self):
        if self._is_backend_route():
            self._proxy("PUT")
        else:
            super().do_PUT()

    def do_DELETE(self):
        if self._is_backend_route():
            self._proxy("DELETE")
        else:
            super().do_DELETE()

    def do_PATCH(self):
        if self._is_backend_route():
            self._proxy("PATCH")
        else:
            self.send_error(501, "Unsupported method")

    def _is_backend_route(self):
        return self.path.startswith("/api/") or self.path.startswith("/uploads/") or self.path in ("/docs", "/openapi.json")

    def _proxy(self, method):
        target = f"{BACKEND_URL}{self.path}"
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        req_headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ("host", "content-length"):
                req_headers[key] = val

        req = urllib.request.Request(target, data=body, headers=req_headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                self.send_response(res.status)
                for header, val in res.getheaders():
                    if header.lower() not in ("transfer-encoding", "content-encoding", "connection"):
                        self.send_header(header, val)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(res.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for header, val in e.headers.items():
                if header.lower() not in ("transfer-encoding", "content-encoding", "connection"):
                    self.send_header(header, val)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as err:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(f'{{"error": "Backend unavailable: {err}"}}'.encode("utf-8"))

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    lan_ip = get_lan_ip()
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), UnifiedNMSHandler)
    print("=" * 60)
    print("NEO METALIKS NMS - UNIFIED GATEWAY (PORT 8081)")
    print("=" * 60)
    print(f"Local Access       : http://localhost:{PORT}/index.html")
    print(f"LAN Access (Wi-Fi) : http://{lan_ip}:{PORT}/index.html")
    print("API Proxy          : Active (All /api calls forwarded to Backend 8000)")
    print("=" * 60)
    server.serve_forever()

if __name__ == "__main__":
    main()
