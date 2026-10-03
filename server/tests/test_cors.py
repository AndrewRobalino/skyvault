"""CORS in the production configuration, read from render.yaml.

Reading the deployed env values (instead of copying them here) means the
test fails if render.yaml ever drifts. The app runs in a subprocess: it reads
its settings at import time, and reloading app.main inside this process would
swap module globals (e.g. the rate limiters) out from under other tests.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import yaml

SERVER = Path(__file__).resolve().parent.parent
RENDER_YAML = SERVER.parent / "render.yaml"


def _prod_env() -> dict[str, str]:
    service = yaml.safe_load(RENDER_YAML.read_text(encoding="utf-8"))["services"][0]
    return {v["key"]: v["value"] for v in service["envVars"]}


PROBE = """
import json, sys
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
out = {o: c.get("/health", headers={"Origin": o}).headers.get("access-control-allow-origin") == o
       for o in json.loads(sys.argv[1])}
print(json.dumps(out))
"""


def test_cors_allows_only_our_pages_origins():
    env = _prod_env()
    prod = json.loads(env["CORS_ORIGINS"])[0]  # e.g. https://skyvault-25r.pages.dev
    host = prod.removeprefix("https://")
    origins = {
        **{o: True for o in json.loads(env["CORS_ORIGINS"])},  # every listed origin
        "https://skyvault.is-a.dev": True,  # the short public URL
        prod: True,
        f"https://4f2a9c1e.{host}": True,  # PR preview deploy
        "https://evil.example": False,
        f"https://{host}.evil.example": False,  # look-alike suffix
        f"https://x.{host.replace('.', '-')}": False,  # unescaped-dot regex would match
        f"http://{host}": False,  # not https
    }
    result = subprocess.run(
        [sys.executable, "-c", PROBE, json.dumps(list(origins))],
        cwd=SERVER,
        env={**os.environ, **env},
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    assert json.loads(result.stdout.strip().splitlines()[-1]) == origins
