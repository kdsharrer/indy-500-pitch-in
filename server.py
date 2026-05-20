from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from time import time
from urllib.parse import parse_qs, urlparse
from uuid import uuid4


ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data" if Path("/data").exists() else ROOT))
DATA_FILE = DATA_DIR / "pitch_in_data.json"


def read_data():
    if not DATA_FILE.exists():
        return {}
    try:
        return json.loads(DATA_FILE.read_text())
    except json.JSONDecodeError:
        return {}


def write_data(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2, sort_keys=True))


def clean_text(value, limit=120):
    return str(value or "").strip()[:limit]


class PitchInHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/items":
            party_id = self.party_id(parsed)
            data = read_data()
            items = list(data.get(party_id, {}).values())
            items.sort(key=lambda item: item.get("createdAt", 0))
            self.send_json({"items": items})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/items":
            self.send_error(404)
            return

        party_id = self.party_id(parsed)
        payload = self.read_json()
        name = clean_text(payload.get("name"))
        item = clean_text(payload.get("item"))

        if not name or not item:
            self.send_json({"error": "Name and item are required."}, status=400)
            return

        entry = {
            "id": uuid4().hex,
            "name": name,
            "item": item,
            "checked": False,
            "taken": False,
            "createdAt": int(time() * 1000),
        }

        data = read_data()
        data.setdefault(party_id, {})[entry["id"]] = entry
        write_data(data)
        self.send_json(entry, status=201)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        item_id = self.item_id(parsed.path)
        if not item_id:
            self.send_error(404)
            return

        party_id = self.party_id(parsed)
        payload = self.read_json()
        updates = {}
        for key in ("checked", "taken"):
            if key in payload:
                updates[key] = bool(payload[key])

        data = read_data()
        entry = data.get(party_id, {}).get(item_id)
        if not entry:
            self.send_error(404)
            return

        entry.update(updates)
        write_data(data)
        self.send_json(entry)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        item_id = self.item_id(parsed.path)
        if not item_id:
            self.send_error(404)
            return

        party_id = self.party_id(parsed)
        data = read_data()
        party_items = data.get(party_id, {})
        party_items.pop(item_id, None)
        write_data(data)
        self.send_json({"ok": True})

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return {}

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def party_id(self, parsed):
        query = parse_qs(parsed.query)
        return clean_text(query.get("party", ["default"])[0], limit=64) or "default"

    def item_id(self, path):
        prefix = "/api/items/"
        if not path.startswith(prefix):
            return ""
        return clean_text(path.removeprefix(prefix), limit=64)


def main():
    port = int(os.environ.get("PORT", "4173"))
    server = ThreadingHTTPServer(("0.0.0.0", port), PitchInHandler)
    print(f"Indy 500 Pitch-In running on port {port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
