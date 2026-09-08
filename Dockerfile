# ---------- Stage 1: build the React app ----------
FROM node:22-alpine AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python API that also serves the SPA ----------
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PRODUCTION=true

WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY --from=frontend /build/dist ./static
ENV STATIC_DIR=/app/static UPLOAD_FOLDER=/app/uploads
RUN mkdir -p /app/uploads

EXPOSE 8000
# Prepare the database first, so the app is never briefly up-but-empty after a
# cold start. Threads (not extra workers) keep memory low on free-tier instances.
CMD python bootstrap.py && gunicorn wsgi:app --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 60
