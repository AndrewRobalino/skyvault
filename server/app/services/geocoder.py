"""Photon (OSM) geocoder client with in-memory TTL cache.

Why Photon:
    - Free and public (no API key required for reasonable use).
    - Designed for autocomplete — fast responses, no rate-limit traps for
      interactive use.
    - Backed by OpenStreetMap data: global coverage, decent accuracy for
      cities/towns/villages anywhere on Earth.
    - Returns GeoJSON FeatureCollection which is straightforward to parse.

Caching strategy:
    In-memory dict keyed on (query.lower().strip(), limit, lang). Entries
    have a 1-hour TTL. When the cache grows past CACHE_MAX_ENTRIES, we sort
    by insertion time and drop the oldest CACHE_EVICT_BATCH entries. This
    is deliberately simple — async-lru and cachetools would both work but
    add a dep for what's ~30 lines of code.
"""

from __future__ import annotations

import time

import httpx

from app.schemas.geocode import GeocodeCandidate, GeocodeResponse


PHOTON_BASE_URL = "https://photon.komoot.io/api"
USER_AGENT = "SkyVault/0.1 (https://github.com/AndrewRobalino/skyvault)"
REQUEST_TIMEOUT_SECONDS = 10.0
CACHE_TTL_SECONDS = 3600
CACHE_MAX_ENTRIES = 256
CACHE_EVICT_BATCH = 32

# Module-level cache: {cache_key: (cached_at_epoch, GeocodeResponse)}
_CACHE: dict[tuple[str, int, str], tuple[float, GeocodeResponse]] = {}


class GeocoderUnavailableError(RuntimeError):
    """Raised when Photon is unreachable or times out."""


class GeocoderUpstreamError(RuntimeError):
    """Raised when Photon returns a non-2xx status code."""


def _make_cache_key(query: str, limit: int, lang: str) -> tuple[str, int, str]:
    return (query.strip().lower(), limit, lang)


def _cache_get(key: tuple[str, int, str]) -> GeocodeResponse | None:
    entry = _CACHE.get(key)
    if entry is None:
        return None
    cached_at, response = entry
    if time.time() - cached_at > CACHE_TTL_SECONDS:
        _CACHE.pop(key, None)
        return None
    return response


def _cache_put(key: tuple[str, int, str], response: GeocodeResponse) -> None:
    _CACHE[key] = (time.time(), response)
    if len(_CACHE) > CACHE_MAX_ENTRIES:
        _evict_oldest()


def _evict_oldest() -> None:
    """Drop the CACHE_EVICT_BATCH oldest entries by insertion time."""
    if not _CACHE:
        return
    sorted_keys = sorted(_CACHE.items(), key=lambda kv: kv[1][0])
    for stale_key, _ in sorted_keys[:CACHE_EVICT_BATCH]:
        _CACHE.pop(stale_key, None)


def _build_display_name(name: str, state: str | None, country: str | None) -> str:
    parts = [name]
    if state:
        parts.append(state)
    if country:
        parts.append(country)
    return ", ".join(parts)


def _parse_feature(feature: dict) -> GeocodeCandidate | None:
    """Map one Photon GeoJSON feature into a GeocodeCandidate.

    Returns None if the feature is malformed (missing coordinates, etc.) —
    we'd rather silently skip a bad row than crash the whole response.
    """
    try:
        geom = feature["geometry"]
        coords = geom["coordinates"]
        lon = float(coords[0])
        lat = float(coords[1])
    except (KeyError, IndexError, TypeError, ValueError):
        return None

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None

    props = feature.get("properties") or {}
    name = props.get("name") or ""
    if not name:
        return None

    country = props.get("country")
    state = props.get("state")
    osm_type = props.get("osm_type")
    osm_id_raw = props.get("osm_id")
    osm_id = str(osm_id_raw) if osm_id_raw is not None else None
    place_type = props.get("type")

    return GeocodeCandidate(
        display_name=_build_display_name(name, state, country),
        name=name,
        country=country,
        state=state,
        lat=lat,
        lon=lon,
        osm_type=osm_type,
        osm_id=osm_id,
        place_type=place_type,
    )


async def geocode(query: str, *, limit: int = 5, lang: str = "en") -> GeocodeResponse:
    """Fetch place candidates from Photon, with caching and error mapping.

    Raises:
        GeocoderUnavailableError: network failure, timeout, or connection error.
        GeocoderUpstreamError: non-2xx HTTP status from Photon.
    """
    cache_key = _make_cache_key(query, limit, lang)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    params = {"q": query, "limit": limit, "lang": lang}
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.get(PHOTON_BASE_URL, params=params, headers=headers)
    except httpx.TimeoutException as exc:
        raise GeocoderUnavailableError(f"Photon request timed out: {exc}") from exc
    except httpx.RequestError as exc:
        raise GeocoderUnavailableError(f"Photon request failed: {exc}") from exc

    if resp.status_code >= 500:
        raise GeocoderUpstreamError(
            f"Photon returned HTTP {resp.status_code}"
        )
    if resp.status_code >= 400:
        # 4xx from Photon usually means a malformed query — treat as empty.
        response = GeocodeResponse(query=query, candidates=[], count=0)
        _cache_put(cache_key, response)
        return response

    payload = resp.json()
    features = payload.get("features") or []

    candidates: list[GeocodeCandidate] = []
    for feature in features:
        parsed = _parse_feature(feature)
        if parsed is not None:
            candidates.append(parsed)

    response = GeocodeResponse(
        query=query,
        candidates=candidates,
        count=len(candidates),
    )
    _cache_put(cache_key, response)
    return response
