"""FastAPI application entry point."""

import logging
import math
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.services.iers_config import configure_offline_iers
from app.services.rate_limit import FixedWindowLimiter, client_ip

# Before anything can run a coordinate transform.
configure_offline_iers()

from app.routers import constellations, dso, geocode, objects, planets, sky  # noqa: E402
from app.services import (  # noqa: E402
    constellation_catalog,
    dso_catalog,
    ephemeris,
    geocoder,
    star_catalog,
    star_enrichment,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load every catalog once at boot so the first visitor after a cold start
    # doesn't also pay the parquet/JSON parse. A missing file fails the boot,
    # which makes Cloud Run keep the previous healthy revision.
    star_catalog.get_catalog()
    dso_catalog.load_catalog()
    constellation_catalog.load_catalog()
    star_enrichment.load_catalog()
    ephemeris._resolve_kernel()
    yield
    # Release the geocoder's pooled HTTP connections on shutdown.
    await geocoder.close_client()


app = FastAPI(
    title="SkyVault API",
    description="Accurate night sky rendering from real astronomical data.",
    version="0.1.0",
    lifespan=lifespan,
)

# /sky is ~2 MB of JSON raw, ~0.6 MB gzipped: egress is the main running cost.
app.add_middleware(GZipMiddleware, minimum_size=1000)

logger = logging.getLogger("skyvault")

data_limiter = FixedWindowLimiter(settings.rate_limit_data_per_min)
geocode_limiter = FixedWindowLimiter(settings.rate_limit_geocode_per_min)


# Defined BEFORE CORSMiddleware is added: Starlette makes the last-added
# middleware the outermost, so CORS wraps this and a 429 still carries
# Access-Control-Allow-Origin (otherwise the browser hides it as an opaque
# network error).
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if not path.startswith(settings.api_v1_prefix):
        return await call_next(request)  # /health and docs are never limited
    if settings.log_forwarded_for:
        logger.warning(
            "x-forwarded-for=%r peer=%r", request.headers.get("x-forwarded-for"), request.client
        )
    ip = client_ip(
        request.headers,
        request.client.host if request.client else None,
        trust_forwarded_for=settings.trust_forwarded_for,
        forwarded_for_index=settings.forwarded_for_index,
    )
    limiter = (
        geocode_limiter
        if path.startswith(f"{settings.api_v1_prefix}/geocode")
        else data_limiter
    )
    retry_after = limiter.hit(ip)
    if retry_after is not None:
        return JSONResponse(
            {"detail": "Too many requests — give it a minute."},
            status_code=429,
            headers={"Retry-After": str(math.ceil(retry_after))},
        )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Cloudflare Pages preview deploys. Starlette full-matches this regex, so
    # look-alikes such as skyvault.pages.dev.evil.example are rejected.
    allow_origin_regex=settings.cors_origin_regex,
    # Read-only public API: no cookies or auth headers cross origins.
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "skyvault-api", "version": app.version}


app.include_router(sky.router, prefix=settings.api_v1_prefix)
app.include_router(planets.router, prefix=settings.api_v1_prefix)
app.include_router(constellations.router, prefix=settings.api_v1_prefix)
app.include_router(dso.router, prefix=settings.api_v1_prefix)
app.include_router(objects.router, prefix=settings.api_v1_prefix)
app.include_router(geocode.router, prefix=settings.api_v1_prefix)
