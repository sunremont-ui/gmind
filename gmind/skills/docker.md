# Skill: Docker — Gmind

## Цель
Одно-командный запуск через docker-compose.

## План

1. **Backend Dockerfile**
   - `backend/Dockerfile`
   - Multi-stage: `golang:1.22-alpine` build → `alpine:3.19` runtime
   - PORT=8080, SQLite в `/data/gmind.db`

2. **Frontend Dockerfile**
   - `frontend/Dockerfile`
   - Multi-stage: `node:20-alpine` build → `nginx:alpine` static serve
   - Nginx конфиг с proxy `/api/` → backend

3. **docker-compose.yml**
   ```yaml
   services:
     backend:
       build: ./backend
       ports: ["8080:8080"]
       volumes: ["gmind-data:/data"]
       environment:
         - AI_API_KEY=${AI_API_KEY:-}
     frontend:
       build: ./frontend
       ports: ["5173:80"]
       depends_on: [backend]
   volumes:
     gmind-data:
   ```

4. **Nginx config** для frontend
   - `frontend/nginx.conf`
   - Serve static files
   - Proxy `/api/` и `/ws/` → backend
   - SPA fallback

5. **.dockerignore** для обоих проектов
   - `node_modules`, `target`, `.git`

## Файлы
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`
- `backend/.dockerignore`
- `frontend/.dockerignore`
