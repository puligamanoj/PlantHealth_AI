import os
os.environ.setdefault("DATABASE_URL","sqlite:///./test_plantguard.db")
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine
Base.metadata.create_all(bind=engine)
client=TestClient(app)
def test_health():
    r=client.get('/health')
    assert r.status_code==200 and r.json()['status']=='ok'
def test_crop_reference():
    r=client.get('/api/v1/crops')
    assert r.status_code==200 and any(x['name']=='Tomato' for x in r.json())
def test_rejects_wrong_media_type():
    r=client.post('/api/v1/predict',files={'file':('notes.txt',b'not an image','text/plain')})
    assert r.status_code==415
def test_missing_model_is_explicit(monkeypatch):
    import app.main as main
    monkeypatch.setattr(main,'predict_image',lambda raw:None)
    r=client.post('/api/v1/predict',files={'file':('leaf.jpg',b'valid enough for mocked service','image/jpeg')})
    assert r.status_code==503
    assert r.json()['detail']['code']=='model_not_trained'
def test_missing_diagnosis():
    r=client.get('/api/v1/diagnoses/999999')
    assert r.status_code==404
