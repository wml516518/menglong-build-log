import http.server
import importlib.util
import json
import os
import socket
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parents[2]
NGINX = Path(os.environ.get("NGINX_BINARY", "/private/tmp/portfolio-nginx-runtime/sbin/nginx"))


def free_port():
    with socket.socket() as server:
        server.bind(("127.0.0.1", 0))
        return server.getsockname()[1]


class Backend(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"path": self.path}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


class RouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not NGINX.is_file():
            raise unittest.SkipTest("Nginx test binary is unavailable")
        cls.temporary = tempfile.TemporaryDirectory()
        temp = Path(cls.temporary.name)
        (temp / "logs").mkdir()
        cls.nginx_port, cls.ai_port, cls.lol_port = free_port(), free_port(), free_port()
        cls.backends = [http.server.ThreadingHTTPServer(("127.0.0.1", port), Backend) for port in [cls.ai_port, cls.lol_port]]
        for backend in cls.backends:
            threading.Thread(target=backend.serve_forever, daemon=True).start()
        spec = importlib.util.spec_from_file_location("activate", ROOT / "scripts/activate-release.py")
        activate = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(activate)
        cls.serve = temp / "sites"
        home = temp / "home"
        (home / "assets").mkdir(parents=True)
        (home / "index.html").write_text("home")
        (home / "assets/home.js").write_text("old-home-chunk")
        (home / "history-content/generated").mkdir(parents=True)
        (home / "history-content/generated/manifest.json").write_text("{}")
        history = temp / "history"
        (history / "assets").mkdir(parents=True)
        (history / "history.html").write_text("history")
        (history / "assets/history.js").write_text("history")
        lol = temp / "lol"
        (lol / "assets").mkdir(parents=True)
        (lol / "index.html").write_text("lol")
        (lol / "assets/lol.js").write_text("lol")
        activate.activate_release(cls.serve, "home", "v1", home)
        activate.activate_release(cls.serve, "history", "v1", history)
        activate.activate_release(cls.serve, "lol-rag", "v1", lol)
        next_home = temp / "home-v2"
        (next_home / "assets").mkdir(parents=True)
        (next_home / "index.html").write_text("home-v2")
        (next_home / "assets/new.js").write_text("new")
        activate.activate_release(cls.serve, "home", "v2", next_home)
        routes = (ROOT / "deploy/nginx/routes.conf").read_text()
        routes = routes.replace("/srv/portfolio", str(cls.serve)).replace("127.0.0.1:8001", f"127.0.0.1:{cls.ai_port}").replace("127.0.0.1:8002", f"127.0.0.1:{cls.lol_port}")
        (temp / "routes.conf").write_text(routes)
        (temp / "nginx.conf").write_text(f"""pid {temp}/nginx.pid;
events {{}}
http {{
  access_log off;
  include {temp}/mime.types;
  server {{
    listen 127.0.0.1:{cls.nginx_port};
    server_name portfolio.test;
    client_max_body_size 1m;
    include {temp}/routes.conf;
  }}
}}
""")
        (temp / "mime.types").write_text("types { text/html html; application/javascript js; application/json json; }\n")
        cls.temp = temp
        subprocess.run([str(NGINX), "-p", str(temp), "-c", str(temp / "nginx.conf"), "-t"], check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        subprocess.run([str(NGINX), "-p", str(temp), "-c", str(temp / "nginx.conf")], check=True)
        cls.base = f"http://127.0.0.1:{cls.nginx_port}"

    @classmethod
    def tearDownClass(cls):
        if NGINX.is_file() and hasattr(cls, "temp"):
            subprocess.run([str(NGINX), "-p", str(cls.temp), "-c", str(cls.temp / "nginx.conf"), "-s", "stop"], check=False,
                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for backend in getattr(cls, "backends", []):
            backend.shutdown()
            backend.server_close()
        if hasattr(cls, "temporary"):
            cls.temporary.cleanup()

    def request(self, path):
        try:
            response = urllib.request.build_opener(NoRedirect).open(self.base + path)
            return response.status, response.headers, response.read().decode()
        except urllib.error.HTTPError as error:
            return error.code, error.headers, error.read().decode()

    def test_separate_html_assets_and_lazy_chunks(self):
        self.assertEqual(self.request("/")[2], "home-v2")
        self.assertEqual(self.request("/playground/")[2], "home-v2")
        self.assertIn("immutable", self.request("/assets/new.js")[1]["Cache-Control"])
        self.assertEqual(self.request("/assets/home.js")[2], "old-home-chunk")
        self.assertEqual(self.request("/apps/history-galaxy/")[2], "history")
        self.assertEqual(self.request("/apps/history-galaxy/assets/history.js")[2], "history")
        self.assertEqual(self.request("/apps/lol-rag/")[2], "lol")
        self.assertEqual(self.request("/apps/lol-rag/assets/lol.js")[2], "lol")
        self.assertIn("no-cache", self.request("/apps/history-galaxy/history-content/generated/manifest.json")[1]["Cache-Control"])

    def test_api_prefixes_are_isolated_and_unknown_paths_do_not_fall_back_to_home(self):
        self.assertEqual(json.loads(self.request("/api/ai-chat/api/health")[2]), {"path": "/api/health"})
        self.assertEqual(json.loads(self.request("/apps/lol-rag/api/chat")[2]), {"path": "/api/chat"})
        for path in ["/apps/unknown/", "/api/unknown", "/apps/history-galaxy/../escape", "/missing.js"]:
            self.assertEqual(self.request(path)[0], 404, path)
        for path, target in [("/apps/lol-rag", "/apps/lol-rag/"), ("/apps/history-galaxy", "/apps/history-galaxy/"), ("/playground", "/playground/")]:
            status, headers, _ = self.request(path)
            self.assertEqual(status, 308)
            self.assertEqual(headers["Location"], self.base + target)


if __name__ == "__main__":
    unittest.main()
