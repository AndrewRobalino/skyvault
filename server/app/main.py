"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import constellations, dso, geocode, objects, planets, sky
from app.services import geocoder


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    # Release the geocoder's pooled HTTP connections on shutdown.
    await geocoder.close_client()


app = FastAPI(
    title="SkyVault API",
    description="Accurate night sky rendering from real astronomical data.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
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
