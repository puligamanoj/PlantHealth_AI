from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from .config import settings
from .db import Base, engine, get_db
from .models import Diagnosis
from .schemas import DiagnosisOut
from .services.inference import load_model, predict_image

app = FastAPI(title="PlantGuard AI API", version="1.0.0", description="Plant health inference API. No trained weights are bundled.")
origins = [x.strip() for x in settings.cors_origins.split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET","POST"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health():
    return {"status": "ok", "database": "configured"}

@app.get("/api/v1/model")
def model_status():
    try:
        loaded = load_model()
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code":"model_load_error","message":"Model checkpoint could not be loaded."}) from exc
    return {"available": loaded is not None, "architecture": "MobileNetV2", "weights_bundled": False,
            "message": "Model ready." if loaded else "No trained model weights found. Train a model before requesting predictions."}

@app.get("/api/v1/crops")
def crops():
    return [
      {"name":"Tomato","summary":"Monitor foliage and fruit regularly.","guidance":["Avoid prolonged leaf wetness where practical.","Use crop-specific, locally approved integrated pest management.","Confirm suspected disease with local extension services."]},
      {"name":"Potato","summary":"Inspect leaves and stems frequently.","guidance":["Use healthy seed tubers and rotate crops where feasible.","Remove volunteer plants where recommended locally.","Follow local disease alerts and registered product labels."]},
      {"name":"Rice","summary":"Monitor crop stage and field conditions.","guidance":["Use locally recommended varieties and planting practices.","Avoid imbalanced nutrient application.","Seek local extension advice for suspected outbreaks."]},
      {"name":"Chili pepper","summary":"Inspect both sides of leaves and new growth.","guidance":["Monitor for pests and symptoms early.","Use clean planting material and appropriate sanitation.","Confirm diagnosis before applying any treatment."]}
    ]

@app.post("/api/v1/predict")
async def predict(file: UploadFile = File(...), db: Session = Depends(get_db)):
    allowed = {"image/jpeg", "image/png"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=415, detail={"code":"unsupported_media_type","message":"Upload a JPEG or PNG image."})
    max_bytes = settings.max_upload_mb * 1024 * 1024
    raw = await file.read(max_bytes + 1)
    if not raw:
        raise HTTPException(status_code=400, detail={"code":"empty_file","message":"Uploaded image is empty."})
    if len(raw) > max_bytes:
        raise HTTPException(status_code=413, detail={"code":"file_too_large","message":f"Image must be {settings.max_upload_mb} MB or smaller."})
    try:
        result = predict_image(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code":"invalid_image","message":str(exc)}) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code":"inference_error","message":"Inference failed. Check model checkpoint and server logs."}) from exc
    if result is None:
        raise HTTPException(status_code=503, detail={"code":"model_not_trained","message":"No trained model is installed. Train a checkpoint and configure MODEL_PATH; no diagnosis was fabricated."})
    record = Diagnosis(filename=(file.filename or "upload")[:255], predicted_class=result["predicted_class"],
                       confidence=result["confidence"], model_version=result["model_version"],
                       advice_note=result["advice"]["message"])
    db.add(record); db.commit(); db.refresh(record)
    return {"diagnosis": DiagnosisOut.model_validate(record).model_dump(mode="json"),
            "advice": result["advice"], "disclaimer":"AI decision support only; confirm in the field."}

@app.get("/api/v1/diagnoses", response_model=list[DiagnosisOut])
def list_diagnoses(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return db.query(Diagnosis).order_by(desc(Diagnosis.created_at)).offset((page-1)*page_size).limit(page_size).all()

@app.get("/api/v1/diagnoses/{diagnosis_id}", response_model=DiagnosisOut)
def get_diagnosis(diagnosis_id: int, db: Session = Depends(get_db)):
    item = db.get(Diagnosis, diagnosis_id)
    if item is None:
        raise HTTPException(status_code=404, detail={"code":"not_found","message":"Diagnosis not found."})
    return item

@app.post("/api/v1/reports", response_class=HTMLResponse)
def report(payload: dict):
    label = str(payload.get("predicted_class", "Unknown"))[:200]
    confidence = payload.get("confidence", None)
    confidence_text = f"{max(0,min(1,float(confidence)))*100:.1f}%" if isinstance(confidence,(int,float)) else "Not supplied"
    # Escape user-controlled strings before inserting into HTML.
    import html
    label = html.escape(label)
    return HTMLResponse(f"<!doctype html><html><meta charset='utf-8'><title>PlantGuard AI report</title><body style='font:16px system-ui;max-width:760px;margin:3rem auto'><h1>PlantGuard AI — Diagnosis Report</h1><p><b>Classification:</b> {label}</p><p><b>Model confidence:</b> {confidence_text}</p><p>Confirm findings with a local agricultural extension service. Follow product labels and local regulations.</p><button onclick='window.print()'>Print / Save as PDF</button></body></html>")
