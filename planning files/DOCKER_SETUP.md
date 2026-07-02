# Docker Setup for GeeksHub

## Quick Start

### Development with Docker Compose
```bash

# 1. Start all services
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost
# - Backend: http://localhost:8000
# - API endpoints: http://localhost/api/*
```

### Individual Services

**Start backend only:**
```bash
docker-compose up backend
# Backend runs at http://localhost:8000
```

**Start frontend only:**
```bash
docker-compose up frontend
# Frontend runs at http://localhost
```

## What's Included

### Backend (server/Dockerfile)
- Python 3.11 slim image
- FastAPI + Uvicorn
- All dependencies from requirements.txt
- Automatic hot-reload with volume mount
- Health check endpoint at `/api/v1/health`

### Frontend (Dockerfile)
- Node.js 20 build stage
- Nginx serving compiled assets
- SPA routing support
- API proxy to backend at `/api/*`

### Docker Compose (docker-compose.yml)
- Shared network between services
- Environment variable management
- Volume mounts for development
- Health checks
- Service dependencies

## Environment Variables

Create a `.env` file from `.env.example` with:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH0_*` | Auth0 credentials |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCS credentials path |
| `BUCKET_NAME` | Google Cloud Storage bucket |
| `FRONTEND_URL` | Frontend URL for CORS |

## Development Workflow

### Code Changes
- **Frontend**: Changes auto-reload (Vite via npm)
- **Backend**: Changes auto-reload (Uvicorn --reload)
- Both run in containers with volume mounts

### Running Commands
```bash
# Backend shell
docker-compose exec backend bash

# Install new Python package
docker-compose exec backend pip install package-name

# Rebuild images
docker-compose build

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down
```

## Production Deployment

### Build Images
```bash
docker build -t geekshub-backend:latest -f server/Dockerfile .
docker build -t geekshub-frontend:latest -f Dockerfile .
```

### Push to Registry
```bash
docker tag geekshub-backend:latest your-registry/geekshub-backend:latest
docker push your-registry/geekshub-backend:latest

docker tag geekshub-frontend:latest your-registry/geekshub-frontend:latest
docker push your-registry/geekshub-frontend:latest
```

### Deploy
Change the image references in `docker-compose.yml` and deploy to your server.

## Troubleshooting

**Backend health check failing**
- Check logs: `docker-compose logs backend`
- Ensure `DATABASE_URL` is correct
- Verify GCP credentials file exists

**Frontend can't reach API**
- Check nginx logs: `docker-compose logs frontend`
- Verify CORS is configured correctly in backend
- Ensure backend service is running

**Port already in use**
```bash
# Change ports in docker-compose.yml
# Or kill the existing process
# Linux/Mac: lsof -i :8000
# Windows: netstat -ano | findstr :8000
```

**Rebuild after dependency changes**
```bash
docker-compose down
docker-compose up --build
```
