"""Post-deploy smoke test (Phase 5 spec §8.1). Usage:

    python scripts/smoke_test_live.py https://skyvault-api-xxxx.run.app \
        --origin https://skyvault.pages.dev

Needs only httpx, so CI can run it without the app's dependencies.
Exit 0 when every check passes, 1 otherwise.
"""

from __future__ import annotations

import argparse
import sys

import httpx

MIAMI = {"lat": 25.76, "lon": -80.19}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base_url")
    ap.add_argument("--origin", default=None, help="allowed frontend origin to check CORS for")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    failures: list[str] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        print(f"{'PASS' if ok else 'FAIL'}  {name}{('  -- ' + detail) if detail and not ok else ''}")
        if not ok:
            failures.append(name)

    try:
        with httpx.Client(timeout=60, headers={"Accept-Encoding": "gzip"}) as c:
            r = c.get(f"{base}/health")
            check("health 200", r.status_code == 200, r.text[:200])

            r = c.get(f"{base}/api/v1/sky", params={**MIAMI, "datetime": "2026-01-15T02:00:00Z"})
            check("sky 200", r.status_code == 200, r.text[:200])
            check("sky gzip", r.headers.get("content-encoding") == "gzip", str(dict(r.headers)))
            if r.status_code == 200:
                body = r.json()
                sirius = next((s for s in body["stars"] if s["source_id"] == "hip:32349"), None)
                check(
                    "Sirius served from ESA Hipparcos",
                    bool(sirius) and sirius["source"] == "ESA Hipparcos",
                )
                check("sky count in range", 2000 <= body["count"] <= 8000, str(body["count"]))

            r = c.get(f"{base}/api/v1/objects/hip:32349")
            ok = r.status_code == 200 and (r.json().get("enrichment") or {}).get("proper_name") == "Sirius"
            check("Sirius enrichment", ok, r.text[:200])

            r = c.get(f"{base}/api/v1/sky", params={**MIAMI, "datetime": "2100-12-31T02:00:00Z"})
            check("far-future sky works offline (IERS config)", r.status_code == 200, r.text[:200])

            r = c.get(f"{base}/api/v1/planets", params={**MIAMI, "datetime": "2060-01-01T00:00:00Z"})
            check("out-of-DE421 planets is 422", r.status_code == 422, r.text[:200])

            if args.origin:
                r = c.get(f"{base}/health", headers={"Origin": args.origin})
                check(
                    "CORS allows the frontend",
                    r.headers.get("access-control-allow-origin") == args.origin,
                )
                r = c.get(f"{base}/health", headers={"Origin": "https://evil.example"})
                check("CORS refuses other origins", "access-control-allow-origin" not in r.headers)
    except httpx.HTTPError as exc:
        check("service reachable", False, repr(exc))

    print(f"\n{len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
