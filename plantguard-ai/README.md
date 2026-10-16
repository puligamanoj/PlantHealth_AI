# PlantGuard AI

PlantGuard AI is a full-stack plant-health application scaffold based on the audited legacy HTML. The original file is preserved in `source/`. This repository deliberately does **not** pretend to include trained model weights.

## Quick start (Docker)
1. Copy `.env.example` to `.env` and change credentials for any non-local deployment.
2. Run `docker compose up --build`.
3. Open the frontend at http://localhost:5173 and API docs at http://localhost:8000/docs.

The interface, API health endpoint, crop reference data, database-backed history, and validation are usable immediately. Diagnosis returns a clear `503 model_not_trained` response until you train and install a compatible checkpoint.

## Local development
Backend:
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Frontend:
```bash
cd frontend
npm install
npm run dev
```
Set `DATABASE_URL=sqlite:///./plantguard.db` for a local SQLite database, or use the PostgreSQL URL from `.env.example`.

## Train a model
1. Obtain a dataset you are licensed to use (for example, PlantVillage; review its terms and field-domain limitations).
2. Arrange images as `data/plant_disease/<class-name>/*.(jpg|jpeg|png)`. Each class must be a directory.
3. Install `ml/requirements.txt`.
4. Run `python ml/train.py --data data/plant_disease --output models/plantguard_mobilenetv2.pt --epochs 10`.
5. Set `MODEL_PATH=/app/models/plantguard_mobilenetv2.pt` for Docker (mount the local `models/` directory into `/app/models`), or an appropriate local path for direct API use.
6. Evaluate using `python ml/evaluate.py --data data/plant_disease --weights models/plantguard_mobilenetv2.pt`.

Training is not performed by the app's startup command. No accuracy claims are made until evaluation has been run on a suitable held-out dataset. A folder-based split is provided for reproducibility, but for scientific reporting use a fixed, documented train/validation/test split and avoid leakage between near-duplicate images.

## API
- `GET /health`
- `GET /api/v1/model`
- `GET /api/v1/crops`
- `POST /api/v1/predict` (multipart field `file`)
- `GET /api/v1/diagnoses?page=1&page_size=20`
- `GET /api/v1/diagnoses/{id}`
- `POST /api/v1/reports` (JSON diagnosis payload; returns printable HTML report)

## Safety and privacy
- Uploaded files are size-limited and decoded server-side; files are not retained as image blobs.
- Diagnosis metadata is stored in the database. Use authentication, TLS, managed secrets, backups, and per-user authorization before public deployment.
- Predictions are decision support, not a substitute for local agronomists or extension services. Confirm chemical use, product labels, dosage, local registration and crop-specific restrictions with local authorities.
- Browser speech synthesis depends on installed voices. Reduced-motion preferences are respected by the leaf scene.
- The current scaffold has no login or multi-tenant access control; keep it on trusted local networks until those controls are added.

## Test
```bash
cd backend
pip install -r requirements.txt
pytest
```

## Known limitations
- No trained checkpoint or dataset is bundled.
- Three-language coverage is strongest for the core UI; agricultural reference content and model class labels depend on the chosen dataset and need agronomist review/translation.
- The leaf visualization is a procedural Three.js scene; it is an immersive 3D leaf, not literal 4D.
- PDF generation is provided as a printable HTML report endpoint; use browser Print → Save as PDF. A direct PDF renderer can be added if required.
