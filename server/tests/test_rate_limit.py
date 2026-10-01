"""Per-IP limits (spec §4.2). One process (max-instances=1) => one table."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app, data_limiter, geocode_limiter
from app.services.rate_limit import FixedWindowLimiter, client_ip


class FakeClock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def test_limiter_allows_up_to_the_limit_then_reports_retry_after():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=3, window_s=60, clock=clock)
    assert [lim.hit("a") for _ in range(3)] == [None, None, None]
    retry = lim.hit("a")
    assert retry is not None and 0 < retry <= 60
    assert lim.hit("b") is None  # other keys unaffected


def test_limiter_window_resets():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=1, window_s=60, clock=clock)
    assert lim.hit("a") is None
    assert lim.hit("a") is not None
    clock.t += 61
    assert lim.hit("a") is None


def test_limiter_table_is_bounded():
    clock = FakeClock()
    lim = FixedWindowLimiter(limit=5, window_s=60, max_keys=100, clock=clock)
    for i in range(1000):
        lim.hit(f"ip{i}")
    assert len(lim._windows) <= 100


def test_client_ip_ignores_forwarded_for_unless_trusted():
    headers = {"x-forwarded-for": "6.6.6.6, 1.2.3.4"}
    assert client_ip(headers, "9.9.9.9", trust_forwarded_for=False, forwarded_for_index=-1) == "9.9.9.9"


def test_client_ip_takes_the_configured_entry_from_the_right():
    # Clients can prepend anything; only entries appended by Google's front
    # end are trustworthy, so we count from the right.
    headers = {"x-forwarded-for": "6.6.6.6, 1.2.3.4, 35.191.0.1"}
    kw = {"trust_forwarded_for": True}
    assert client_ip(headers, "9.9.9.9", forwarded_for_index=-1, **kw) == "35.191.0.1"
    assert client_ip(headers, "9.9.9.9", forwarded_for_index=-2, **kw) == "1.2.3.4"
    assert client_ip({}, "9.9.9.9", forwarded_for_index=-1, **kw) == "9.9.9.9"


def test_data_routes_return_429_with_retry_after(monkeypatch):
    monkeypatch.setattr(data_limiter, "limit", 2)
    data_limiter._windows.clear()
    c = TestClient(app)
    for _ in range(2):
        assert c.get("/api/v1/objects/hip:32349").status_code == 200
    r = c.get("/api/v1/objects/hip:32349")
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) >= 1
    assert "give it a minute" in r.json()["detail"]
    data_limiter._windows.clear()


def test_429_still_carries_cors_headers(monkeypatch):
    # If the limiter sat outside CORS, the browser would see an opaque network
    # error instead of a readable 429 and could never show "give it a minute".
    monkeypatch.setattr(data_limiter, "limit", 0)
    data_limiter._windows.clear()
    origin = settings.cors_origins[0]
    r = TestClient(app).get("/api/v1/objects/hip:32349", headers={"Origin": origin})
    assert r.status_code == 429
    assert r.headers.get("access-control-allow-origin") == origin
    data_limiter._windows.clear()


def test_health_is_never_limited(monkeypatch):
    monkeypatch.setattr(data_limiter, "limit", 0)
    c = TestClient(app)
    assert c.get("/health").status_code == 200
    data_limiter._windows.clear()


def test_geocode_has_its_own_tighter_bucket(monkeypatch):
    monkeypatch.setattr(geocode_limiter, "limit", 0)
    geocode_limiter._windows.clear()
    r = TestClient(app).get("/api/v1/geocode", params={"q": "Paris"})
    assert r.status_code == 429
    geocode_limiter._windows.clear()


def test_default_limits_match_the_spec():
    assert settings.rate_limit_data_per_min == 120
    assert settings.rate_limit_geocode_per_min == 20
