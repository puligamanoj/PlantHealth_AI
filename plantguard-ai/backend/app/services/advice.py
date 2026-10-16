def general_advice(label: str, confidence: float) -> dict:
    # Advice is deliberately separate from the classifier and does not infer chemical dosage.
    if confidence < 0.65:
        status = "uncertain"
        message = "The prediction is uncertain. Photograph several clear leaves and consult a local agricultural extension service before treatment."
    elif "healthy" in label.lower():
        status = "model_supported"
        message = "The model classified this image as healthy. Continue monitoring; one image cannot rule out all pests or disease."
    else:
        status = "general_guidance"
        message = "Inspect additional leaves and confirm the diagnosis locally. Remove severely affected material when appropriate, avoid wetting foliage, and improve airflow. Follow registered product labels and local regulations."
    return {"status": status, "message": message, "chemical_dosage": None}
