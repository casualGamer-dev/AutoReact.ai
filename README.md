# AutoLayout.ai

Photograph a hand-drawn UI wireframe, get working React Native code. Detection
and code generation run entirely on-device — no network required. An optional
online "Enhance" step can turn placeholder text into real copy and pick a
theme.

## How it works

1. **Sketch** a UI on paper following the app's element conventions (text,
   text field, button, image, switch).
2. **Capture** a photo in the app. An on-device TFLite model
   (EfficientDet-Lite0, trained on ~350 labeled sketches) detects the
   elements — offline, no upload needed.
3. **Review & correct** — tap a box to fix its type, or delete a spurious
   detection, before code gets generated.
4. **Generate** — the corrected layout is sorted into rows/columns and
   turned into a real React Native component, offline.
5. **Enhance** (optional, needs a connection) — Gemini (or an OpenRouter
   fallback) reads any handwritten labels and suggests a theme; a vector-DB
   pattern lookup picks a matching design style.

See [`token.md`](token.md) for the full technical walkthrough and
[`RUNBOOK.md`](RUNBOOK.md) for setup/deploy steps.

## Stack

- **Mobile** (`auto-layout/`): Expo / React Native, `react-native-fast-tflite`
  for on-device detection, no UI component library — a small shared design
  system (`theme/tokens.js` + `components/`) instead.
- **Server** (`server/`): Express + MongoDB (Atlas), Cloudflare R2 for image
  storage, JWT auth.
- **Enhance**: Gemini with an OpenRouter fallback (Claude 3 Haiku for
  vision, an OpenAI embedding model for the RAG lookup). The design-pattern
  lookup runs on **Actian VectorAI** (`server/src/lib/actian.js`) using
  **hybrid fusion**: a semantic vector search over the layout's free-text
  description, fused via Reciprocal Rank Fusion with a second search
  filtered on the actual detected element types (structured tags) — so a
  pattern that's both semantically close *and* built from the same kinds of
  elements outranks one that only matches on text. Falls back to in-Mongo
  cosine similarity if Actian is unreachable.
- **Model** (`model/`): the training pipeline (TF Object Detection API ->
  TFLite export) that produced the shipped `detector.tflite`.

## Getting started

```bash
# Mobile app
cd auto-layout
npm install
cp .env.example .env    # point EXPO_PUBLIC_API_URL at your server
npx expo start

# Server
cd server
npm install
cp .env.example .env    # Mongo/R2/Gemini/OpenRouter credentials
npm start
# or, with Docker (also brings up the Actian vector DB):
docker compose up -d --build
```

Full setup/deploy details, known gaps, and what's been verified on real
hardware are in [`RUNBOOK.md`](RUNBOOK.md).

## Contributing

Contributions are welcome — open an issue first for anything nontrivial so
we can talk through the approach before you put time into a PR.
