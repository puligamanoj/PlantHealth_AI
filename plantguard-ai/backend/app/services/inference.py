from pathlib import Path
from functools import lru_cache
import torch
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms
from . import advice
from ..config import settings

@lru_cache(maxsize=1)
def load_model():
    path = Path(settings.model_path)
    if not path.is_file():
        return None
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    classes = checkpoint.get("classes")
    if not isinstance(classes, list) or not classes:
        raise ValueError("Model checkpoint must contain a non-empty 'classes' list")
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = torch.nn.Linear(model.last_channel, len(classes))
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    return model, classes, str(checkpoint.get("version", "mobilenetv2-custom"))

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def predict_image(raw: bytes):
    try:
        import io
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError("Uploaded file is not a valid decodable image") from exc
    loaded = load_model()
    if loaded is None:
        return None
    model, classes, version = loaded
    tensor = transform(image).unsqueeze(0)
    with torch.inference_mode():
        probabilities = torch.softmax(model(tensor), dim=1)[0]
        confidence, index = torch.max(probabilities, dim=0)
    score = float(confidence.item())
    label = classes[int(index.item())]
    return {"predicted_class": label, "confidence": score, "model_version": version,
            "advice": advice.general_advice(label, score)}
