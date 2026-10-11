from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import time

from ai_service import AIServiceError, GeminiService

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
MAX_BODY = 32 * 1024
RATE_LIMIT = 10
RATE_WINDOW = 60
_requests = defaultdict(deque)


def load_dotenv(path=None):
    path = path or os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key, value = key.strip(), value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv()
_ai = GeminiService()


def json_error(error):
    return {"error": {"code": error.code, "message": error.message, "retryable": error.retryable}}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def log_message(self, format, *args):
        if self.path.startswith("/api/"):
            print("[api]", self.command, self.path.split("?", 1)[0], args[1] if len(args) > 1 else "")
        else:
            super().log_message(format, *args)

    def do_GET(self):
        clean = self.path.split("?", 1)[0]
        if clean == "/api/ai/status":
            try:
                from google import genai  # noqa: F401
                sdk_available = True
            except ImportError:
                sdk_available = False
            self.send_json(200, {"configured": bool(_ai.api_key), "sdkAvailable": sdk_available,
                                 "ready": bool(_ai.api_key) and sdk_available, "model": _ai.model})
            return
        if not os.path.isfile(os.path.join(DIST, clean.lstrip("/"))) and "." not in clean.rsplit("/", 1)[-1]:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        routes = {"/api/ai/mission/analyze": self.handle_analyze,
                  "/api/ai/mission/explain": self.handle_explain,
                  "/api/ai/mission/refine": self.handle_refine}
        route = self.path.split("?", 1)[0]
        if route not in routes:
            self.send_json(404, {"error": {"code": "NOT_FOUND", "message": "API endpoint not found.", "retryable": False}})
            return
        if not self.rate_allowed():
            self.send_json(429, {"error": {"code": "RATE_LIMITED", "message": "Too many AI requests. Please wait a minute.", "retryable": True}})
            return
        try:
            result = routes[route](self.read_json())
            self.send_json(200, result)
        except AIServiceError as error:
            self.send_json(error.status, json_error(error))
        except (ValueError, TypeError, KeyError):
            self.send_json(400, {"error": {"code": "INVALID_REQUEST", "message": "The request could not be validated.", "retryable": False}})
        except Exception:
            self.send_json(500, {"error": {"code": "SERVER_ERROR", "message": "The local AI service encountered an unexpected error.", "retryable": True}})

    def rate_allowed(self):
        now = time.monotonic()
        bucket = _requests[self.client_address[0]]
        while bucket and now - bucket[0] > RATE_WINDOW:
            bucket.popleft()
        if len(bucket) >= RATE_LIMIT:
            return False
        bucket.append(now)
        return True

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as exc:
            raise AIServiceError("INVALID_REQUEST", "Invalid request size.", 400) from exc
        if length <= 0 or length > MAX_BODY:
            raise AIServiceError("REQUEST_TOO_LARGE", "Request must be a non-empty JSON body under 32 KB.", 413)
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AIServiceError("INVALID_REQUEST", "Request body must be valid JSON.", 400) from exc
        if not isinstance(value, dict):
            raise AIServiceError("INVALID_REQUEST", "Request body must be a JSON object.", 400)
        return value

    def handle_analyze(self, payload):
        return {"analysis": _ai.analyze(payload.get("description", ""), payload.get("context"))}

    def handle_explain(self, payload):
        for key in ("mission", "matches", "shortages"):
            if key not in payload:
                raise AIServiceError("INVALID_REQUEST", f"Missing request field: {key}.", 400)
        return {"explanation": _ai.explain(payload["mission"], payload["matches"], payload["shortages"], payload.get("volunteer"))}

    def handle_refine(self, payload):
        if not isinstance(payload.get("mission"), dict):
            raise AIServiceError("INVALID_REQUEST", "A mission object is required.", 400)
        return _ai.refine(payload["mission"], payload.get("instruction", ""))

    def send_json(self, status, payload):
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == "__main__":
    print("MissionMesh running at http://localhost:3000")
    ThreadingHTTPServer(("127.0.0.1", 3000), Handler).serve_forever()
