"""OSM-backed geocoder client with Photon (primary) + Nominatim (fallback).

Why two providers:
    Photon is designed for autocomplete — fast, generous rate limits, fuzzy
    matching, GeoJSON output. It's our primary. When Photon is unreachable
    or returns 5xx (e.g. their service is down), we transparently fall back
    to Nominatim — the older OSM geocoder. Both are backed by the same
    OpenStreetMap data, so result quality is comparable; the response
    shapes differ and each has its own parser.

Why Nominatim only as fallback (not primary):
    Nominatim's public instance enforces ~1 req/sec and bans abuse. It
    works for occasional fallback usage but would die under autocomplete
    load. Photon was built for the interactive case.

Caching strategy:
    In-memory dict keyed on (query.lower().strip(), limit, lang). Entries
    have a 1-hour TTL. Cached results don't track which provider answered
    — both are OSM-backed. When the cache grows past CACHE_MAX_ENTRIES we
    sort by insertion time and drop the oldest CACHE_EVICT_BATCH entries.
"""

from __future__ import annotations

import time

import httpx

from app.schemas.geocode import GeocodeCandidate, GeocodeResponse


PHOTON_BASE_URL = "https://photon.komoot.io/api"
NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_SOURCE = "Photon (photon.komoot.io) / OpenStreetMap"
NOMINATIM_SOURCE = "Nominatim (nominatim.openstreetmap.org) / OpenStreetMap"
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


def _parse_nominatim_result(result: dict) -> GeocodeCandidate | None:
    """Map one Nominatim search-result row into a GeocodeCandidate.

    Nominatim returns a flat object per result with `lat`/`lon` as strings
    and structured address fields under `address` (when addressdetails=1).
    """
    try:
        lat = float(result["lat"])
        lon = float(result["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
        return None

    name = result.get("name") or ""
    if not name:
        # Fall back to first segment of display_name if `name` is missing.
        display = result.get("display_name") or ""
        name = display.split(",", 1)[0].strip()
        if not name:
            return None

    address = result.get("address") or {}
    state = address.get("state")
    country = address.get("country")

    osm_type = result.get("osm_type")
    osm_id_raw = result.get("osm_id")
    osm_id = str(osm_id_raw) if osm_id_raw is not None else None
    place_type = result.get("type")

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


async def _call_photon(query: str, limit: int, lang: str) -> GeocodeResponse:
    """Query Photon and return a parsed response. Raises on failure."""
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
        raise GeocoderUpstreamError(f"Photon returned HTTP {resp.status_code}")
    if resp.status_code >= 400:
        # 4xx from Photon usually means a malformed query — treat as empty.
        return GeocodeResponse(query=query, candidates=[], count=0, source=PHOTON_SOURCE)

    features = (resp.json() or {}).get("features") or []
    candidates = [c for c in (_parse_feature(f) for f in features) if c is not None]
    return GeocodeResponse(
        query=query,
        candidates=candidates,
        count=len(candidates),
        source=PHOTON_SOURCE,
    )


async def _call_nominatim(query: str, limit: int, lang: str) -> GeocodeResponse:
    """Query Nominatim and return a parsed response. Raises on failure."""
    params = {
        "q": query,
        "limit": limit,
        "format": "json",
        "addressdetails": 1,
        "accept-language": lang,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            resp = await client.get(NOMINATIM_BASE_URL, params=params, headers=headers)
    except httpx.TimeoutException as exc:
        raise GeocoderUnavailableError(f"Nominatim request timed out: {exc}") from exc
    except httpx.RequestError as exc:
        raise GeocoderUnavailableError(f"Nominatim request failed: {exc}") from exc

    if resp.status_code >= 500:
        raise GeocoderUpstreamError(f"Nominatim returned HTTP {resp.status_code}")
    if resp.status_code >= 400:
        return GeocodeResponse(query=query, candidates=[], count=0, source=NOMINATIM_SOURCE)

    rows = resp.json() or []
    candidates = [c for c in (_parse_nominatim_result(r) for r in rows) if c is not None]
    return GeocodeResponse(
        query=query,
        candidates=candidates,
        count=len(candidates),
        source=NOMINATIM_SOURCE,
    )


async def geocode(query: str, *, limit: int = 5, lang: str = "en") -> GeocodeResponse:
    """Fetch place candidates with Photon primary + Nominatim fallback.

    Raises:
        GeocoderUnavailableError: both providers had network/timeout failures.
        GeocoderUpstreamError: both providers returned 5xx (or one had each).
    """
    cache_key = _make_cache_key(query, limit, lang)
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        response = await _call_photon(query, limit, lang)
    except (GeocoderUnavailableError, GeocoderUpstreamError):
        response = await _call_nominatim(query, limit, lang)

    _cache_put(cache_key, response)
    return response
