"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.services.iers_config import configure_offline_iers

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
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
