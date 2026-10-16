# PlantGuard AI — Source Audit

## Audit scope
Inspected the complete uploaded `plantguard-ai (3).html` (74,351 characters, 728 lines) and the project requirements in `Pasted text.txt`. The original is preserved unchanged at `source/plantguard-ai-original.html`.

## Feature inventory and status

| Feature | Observed implementation | Status |
|---|---|---|
| Brand and visual language | PlantGuard AI, forest/emerald palette, glass cards, Inter and Indic fonts | Working visual foundation |
| Intro animation | Eight DOM leaf fragments enter from eight directions; Skip button; mouse/touch scatter | Partial: SVG fragments, not real 3D mesh; auto-continue timer does not actually finish intro |
| Image upload | JPEG/PNG MIME check and 5 MB limit, preview, file reader | Partial: MIME/size only; no decoded-content validation |
| Disease analysis | `analyze()` selects a record using `Math.random()`, then randomizes confidence after a timeout | **Simulated; not machine-learning inference** |
| Diagnosis data | Local `DB` data drives disease labels and advice | Hardcoded reference content; not evidence from uploaded image |
| History | Browser `localStorage` key `pg_hist`, capped at 20 records | Works locally, but browser-only and stores image data URLs |
| Crop information | Local `CROPS` list and client-rendered guides | Partial; static reference information |
| Language switching | `I18N` translations for English, Hindi, Telugu | Partial; verify every content field and fallback |
| Voice output | Browser `speechSynthesis`, language voice fallback | Works where browser/voices support it; Telugu may fall back |
| Report download | Generates a `.txt` report from current local result | Works as text export; not PDF |
| Modals and toast | DOM-driven modal, escape-key close, toast notifications | Basic behavior implemented |
| Backend / API | No `fetch()` call found in inspected application script | Absent |
| Model lifecycle | No real model loading/inference in HTML | Absent |
| Database | No server database | Absent |
| Authentication | Not present | Absent |

## Design elements to preserve
- `#0a2f24`, `#0d3b2e`, `#1a6b4f`, `#1e8a5e`, `#22a06b`, `#2bb87a` forest/emerald palette.
- Glass cards, rounded 18 px surfaces, soft shadows, high-density dashboard, clear image preview/result hierarchy.
- Eight-direction leaf assembly, skip affordance, ambient particles, EN/HI/TE language choices, voice output, treatment/fertilizer/farming cards, crop guides, history and report actions.

## Risks and gaps
- Randomized diagnosis/confidence can mislead farmers and must be removed.
- Client-only image checks are insufficient; server must inspect file size, MIME and decodability.
- Advice needs uncertainty labels and should not invent pesticide rates. Follow product labels and local extension advice.
- Image data URLs in localStorage can consume significant storage and expose retained photos on shared devices.
- Inline handlers, `innerHTML` templates, and DOM-global state make the legacy UI difficult to test and maintain.
- No documented keyboard focus handling, complete reduced-motion behavior, API errors, offline state, or model provenance.
- External Google Fonts require connectivity; a fallback stack should remain.
- The source's animation uses SVG/CSS transforms rather than Three.js/WebGL.

## Architecture decision
Approve a TypeScript React/Vite frontend, FastAPI backend, SQLAlchemy persistence with Alembic migrations, PostgreSQL for Docker deployment, and a PyTorch/Torchvision MobileNetV2 training/inference pipeline. Keep inference and agricultural advice separate. When model weights are missing, the API returns an explicit unavailable-model error (503), never a fabricated prediction. Keep the original HTML as a reference, not the production app entry point.

## Audit completion
The audit is complete based on static inspection of the full source file. Runtime behavior has not been claimed as browser-tested. Architecture is documented in `ARCHITECTURE.md`.
