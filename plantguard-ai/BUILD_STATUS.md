# Build and Verification Status

Verified in the provided execution environment on 2026-10-10:
- Complete original HTML read and preserved without modification.
- Python syntax parsing: all 14 Python source/test files passed.
- Backend pytest: **5 passed** (health, crops, unsupported upload type, missing model honesty, not-found diagnosis).
- Frontend dependency installation/build: **not verified**; `npm install --ignore-scripts` exceeded the available command timeout. Run `npm install && npm run build` in `frontend/` on a machine with npm registry access.
- Docker Compose image build and browser-level visual/accessibility tests: not run in this environment.
- Model training/inference success: not run because no dataset or trained checkpoint was supplied.

Warnings observed from current installed dependencies: Pydantic v2 deprecates class-based schema config, and FastAPI deprecates `on_event` startup hooks. These are warnings, not failures, and should be modernized before long-term production deployment.

The included backend tests use a local SQLite database in this test environment. Docker deployment uses PostgreSQL by default.

## Cinematic diagnosis experience (added 2026-10-12)
- New module: `frontend/src/diagnosis/` (React Three Fiber 8 + Framer Motion). Wired into `App.tsx`: the stage opens when "Analyze" is pressed, the leaf assembles and waits as a glass shell during the API call, then fills green/red from the real `/api/v1/predict` result.
- Fixed a build-breaking bug in `App.tsx` (a literal `\n` between two imports) and added the missing `vite.config.ts` / `vite-env.d.ts`; `@vitejs/plugin-react` pinned instead of `latest`.
- Verified: TypeScript/TSX syntax transpiles for all frontend files.
- NOT verified (no npm registry or GPU/browser in the build environment): `npm install`, `tsc` type-check, GLSL shader compilation, visual result, 60 fps on real devices. Run `cd frontend && npm install && npm run build && npm run dev`, then open `/?preview=1` for the healthy/diseased preview buttons.
- Severity is shown only if the API returns a `severity` field; the classifier does not estimate it. Disease reference notes are general English guidance (no product names or dosages); panel labels are EN/HI/TE.
