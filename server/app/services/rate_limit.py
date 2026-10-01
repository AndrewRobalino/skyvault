"""In-memory per-key rate limiting.

Valid only because production runs one process (Cloud Run max-instances=1,
one uvicorn worker): one table sees every request. Fixed windows are coarse
but cheap; rejecting an abuser costs a dict lookup.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Mapping


class FixedWindowLimiter:
    def __init__(
        self,
        limit: int,
        window_s: float = 60.0,
        max_keys: int = 10_000,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.limit = limit
        self.window_s = window_s
        self.max_keys = max_keys
        self._clock = clock
        self._windows: dict[str, tuple[float, int]] = {}

    def hit(self, key: str) -> float | None:
        """Count one request. None if allowed, else seconds until the window resets."""
        now = self._clock()
        start, count = self._windows.get(key, (now, 0))
        if now - start >= self.window_s:
            start, count = now, 0
        if count >= self.limit:
            return max(1.0, self.window_s - (now - start))
        self._windows[key] = (start, count + 1)
        if len(self._windows) > self.max_keys:
            self._prune(now)
        return None

    def _prune(self, now: float) -> None:
        live = {k: v for k, v in self._windows.items() if now - v[0] < self.window_s}
        if len(live) > self.max_keys:  # a flood of distinct keys: keep the newest half
            newest = sorted(live.items(), key=lambda kv: kv[1][0])[-(self.max_keys // 2):]
            live = dict(newest)
        self._windows = live


def client_ip(
    headers: Mapping[str, str],
    peer: str | None,
    *,
    trust_forwarded_for: bool,
    forwarded_for_index: int,
) -> str:
    """The caller's IP. Behind Cloud Run the TCP peer is Google's front end,
    so the real client comes from X-Forwarded-For, counted from the RIGHT
    (entries on the left are whatever the client chose to send)."""
    if trust_forwarded_for:
        raw = headers.get("x-forwarded-for", "")
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if parts:
            try:
                return parts[forwarded_for_index]
            except IndexError:
                return parts[0]
    return peer or "unknown"
