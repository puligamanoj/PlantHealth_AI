# Test coverage
Run `cd backend && pip install -r requirements.txt && pytest`.
The tests cover API health, image media-type validation, the honest missing-model response, and crop endpoint shape. A trained-model success test requires a real trained checkpoint and is intentionally not faked.
