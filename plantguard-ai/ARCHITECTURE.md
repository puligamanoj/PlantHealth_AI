# Architecture Decision Record

## Decision
A monorepo with a React + TypeScript + Vite SPA, FastAPI API, SQLAlchemy 2, Alembic, PostgreSQL, and PyTorch/Torchvision.

## Boundaries
- `frontend/`: accessible dashboard, image selection, API calls, localized UI, WebGL leaf scene, history and report download.
- `backend/app/api/`: versioned HTTP endpoints and validation.
- `backend/app/services/`: inference and advice separated from HTTP concerns.
- `backend/app/models.py` / `schemas.py`: persistence and response contracts.
- `ml/`: reproducible training, evaluation and inference. Weights are not bundled and must be trained by the project owner.
- `source/`: unchanged legacy HTML.
- `tests/`: API tests for health, upload validation, and missing-model behavior.

## Prediction policy
The inference service loads `MODEL_PATH` only when a valid model checkpoint exists. Until then, `/api/v1/predict` responds with HTTP 503 and a clear `model_not_trained` error. Confidence is emitted only from actual model logits. The included training script expects a folder-per-class dataset and writes class names with the checkpoint.

## Persistence
PostgreSQL is the Docker default. For local API-only development, SQLite can be selected using `DATABASE_URL`. SQLAlchemy creates core tables at startup for convenience; Alembic migration files are included for explicit schema management. Seed crop guidance is general reference content, not model-derived diagnosis.

## Deployment assumptions
Docker Compose starts PostgreSQL, API, and frontend. Model training is a separate offline step and requires a dataset supplied by the user. No credentials, API keys, trained weights, or dataset are fabricated or committed.
