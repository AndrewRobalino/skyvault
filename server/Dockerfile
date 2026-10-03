# server/Dockerfile — SkyVault API (Cloud Run). Build from server/:
#   docker build -t skyvault-api .
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/app \
    PORT=8080

WORKDIR /app

COPY requirements.txt constraints.txt ./
# astropy-iers-data is upgraded on purpose: it carries the Earth-orientation
# predictions, and the monthly rebuild must pick up a fresh table (Phase 5
# plan amendment 1). Everything else installs at its pinned version.
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt \
 && pip install --no-cache-dir --upgrade astropy-iers-data

COPY app ./app
COPY data ./data
COPY scripts/__init__.py scripts/download_ephemeris.py ./scripts/

# JPL DE421 from NASA NAIF (public domain), fetched at build time.
RUN python scripts/download_ephemeris.py

RUN useradd --create-home --home-dir /home/skyvault --uid 10001 skyvault \
 && chown -R skyvault /app
USER skyvault

# One worker: one copy of the catalogs in memory, one rate-limit table.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --workers 1"]
