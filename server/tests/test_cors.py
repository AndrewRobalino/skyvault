"""CORS in the production configuration (deploy/cloudrun.env.yaml values).

Runs in a subprocess: the app reads its settings at import time, and
reloading app.main inside this process would swap module globals (e.g. the
rate limiters) out from under other tests.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

PROD = "https://skyvault.pages.dev"
REGEX = r"https://[a-z0-9-]+\.skyvault\.pages\.dev"

ORIGINS = {
    PROD: True,
    "https://4f2a9c1e.skyvault.pages.dev": True,  # PR preview deploy
    "https://evil.example": False,
    "https://skyvault.pages.dev.evil.example": False,  # look-alike
    "http://skyvault.pages.dev": False,  # not https
}

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
    env = {**os.environ, "CORS_ORIGINS": f'["{PROD}"]', "CORS_ORIGIN_REGEX": REGEX}
    result = subprocess.run(
        [sys.executable, "-c", PROBE, json.dumps(list(ORIGINS))],
        cwd=Path(__file__).resolve().parent.parent,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=True,
    )
    assert json.loads(result.stdout.strip().splitlines()[-1]) == ORIGINS
