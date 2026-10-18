.PHONY: help setup dev doctor lint test seed migrate db-up db-down clean docker-config

help:
	@echo "RescueRank Development Commands:"
	@echo "  make setup         - Install backend and frontend dependencies"
	@echo "  make db-up         - Start local PostGIS container"
	@echo "  make migrate       - Run Alembic database migrations"
	@echo "  make seed          - Seed synthetic data and cached OSM points"
	@echo "  make dev           - Run backend and frontend concurrently"
	@echo "  make doctor        - Verify dependencies and environment health"
	@echo "  make lint          - Lint backend (ruff) and frontend (eslint)"
	@echo "  make test          - Run backend tests, frontend lint and frontend build in Docker"
	@echo "  make docker-config - Validate Docker Compose configurations"

setup:
	@cd backend && uv sync --extra dev
	@cd frontend && npm ci

up:
	docker compose up --build

down:
	docker compose down

db-up:
	docker compose up -d db

db-down:
	docker compose down

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python scripts/generate_synthetic_data.py
	cd backend && uv run python scripts/load_osm.py

doctor:
	uv run python scripts/verify_env.py

lint:
	cd backend && uv run ruff check .
	cd frontend && npm run lint

test:
	docker compose --profile test build backend-test frontend-test
	docker compose --profile test run --rm backend-test
	docker compose --profile test run --rm frontend-test

docker-config:
	docker compose config
	docker compose -f docker-compose.prod.yml config

dev:
	@echo "Starting backend and frontend..."
	@echo "Backend at http://localhost:8000/docs"
	@echo "Frontend at http://localhost:3000"
