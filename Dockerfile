# --- MULTI-STAGE DOCKER BUILD FOR PREPSPHERE ---
# One container serves both the API and the built React app on port 8000.

# 1. FRONTEND BUILDER
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Same origin as the API, so requests use relative URLs.
ENV VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN npm run build

# 2. BACKEND RUNTIME
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    STATIC_DIR=/app/static \
    DATABASE_URL=sqlite:////data/interview_prep.db

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# .dockerignore keeps secrets (.env), local databases and virtualenvs out of the image.
COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist ./static

RUN useradd --create-home appuser && mkdir -p /data && chown appuser /data
USER appuser
VOLUME ["/data"]

EXPOSE 8000
# Behind a reverse proxy, set FORWARDED_ALLOW_IPS to its address so rate limits see real client IPs.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
