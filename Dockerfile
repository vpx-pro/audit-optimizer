# syntax=docker/dockerfile:1

########################################
# Frontend build stage
########################################
FROM node:20-bookworm AS frontend-build
WORKDIR /usr/src/app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Build the Vite app
COPY frontend/ .
RUN npm run build

########################################
# Backend runtime stage
########################################
FROM python:3.11-slim AS backend-runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    FRONTEND_DIST=/app/frontend_dist

WORKDIR /app

# Install system deps required for numpy/pandas
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libopenblas-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --upgrade pip && \
    pip install -r backend/requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend assets
COPY --from=frontend-build /usr/src/app/frontend/dist ./frontend_dist

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

