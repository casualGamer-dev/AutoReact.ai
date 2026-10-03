# What AutoLayout.ai does, and how

One paragraph: photograph a hand-drawn UI wireframe, the phone detects the
elements in it on-device, you tap to fix anything the model got wrong, and it
generates React Native source code for that layout — no network required for
any of that. If you're online, a separate "Enhance" pass can ask Gemini to
turn placeholder text into real copy and pick a theme, backed by a
RAG pattern lookup.

## The pipeline, step by step

1. **Create a sketch** — `pages/Sketch.js` calls `POST /sketches` to get a
   Mongo `_id`, then navigates to the capture screen with that id.

2. **Capture** — `pages/landing.js`. Camera or gallery photo via
   `expo-image-picker`, resized to 320×320 and JPEG-encoded via
   `expo-image-manipulator`. The base64 JPEG is decoded to raw RGB pixels by
   `lib/decodeImage.js` (pure-JS `jpeg-js`, no native dependency — needed
   because the TFLite model wants raw pixels, not a JPEG blob).

3. **Detect (on-device, offline)** — `lib/detect.js`. Runs
   `assets/model/detector.tflite` (EfficientDet-Lite0, trained via TFLite
   Model Maker — see `model/`) through `react-native-fast-tflite`'s
   `runSync()`. Output tensor order was verified by hand against the actual
   export (`[scores, boxes, count, classes]` — Model Maker does *not* use the
   classic SSD `[boxes, classes, scores, count]` order). Predictions below
   `SCORE_THRESHOLD` (0.7) are dropped; surviving boxes are scaled from
   normalized model-space coordinates back to the original photo's pixel
   dimensions.

4. **Review / correct** — `pages/reviewDetections.js`. Detected boxes are
   drawn over the photo; tapping one cycles its class through
   `lib/elementTypes.js`'s five types (`Text`, `Textfield`, `Button`, `Image`,
   `Switch`). A small × badge on each box removes it entirely as a spurious
   detection (kept as a set of deleted indices rather than splicing the
   array, so it doesn't renumber the class-correction bookkeeping); deleted
   boxes are filtered out before layout/codegen/save, with an "N removed ·
   Undo" link to restore them. Any correction is recorded and later posted to
   `POST /corrections` — logged for a future retrain, nothing consumes them
   yet (a box that's corrected and then deleted drops its correction too,
   since there's nothing left to retrain on).

5. **Layout + code generation (offline)** — `lib/layoutSort.js` groups the
   (corrected) boxes into rows top-to-bottom then left-to-right by comparing
   `y0`/`x0`; `lib/codeGen.js` walks that row/column structure and emits a
   literal React Native component as a string (imports, a class component,
   one `<View>` row per detected row, a matching `StyleSheet`). This is pure
   string templating, not an AST or a real code-gen framework — deliberately,
   since it only has to run once per sketch and needs zero dependencies.

6. **Save** — confirming in `reviewDetections.js` writes the sketch to
   `lib/localStore.js` (source of truth, works offline) and hands it to
   `lib/sync.js`'s retry queue rather than uploading inline. The queue
   persists to `AsyncStorage` and flushes whenever a connection is up
   (`NetInfo` listener + on every enqueue); a flush pushes predictions/code
   via `PATCH`, then PUTs the photo straight to Cloudflare R2 via a presigned
   URL from `POST /sketches/:id/upload-url` (server never proxies image
   bytes). Every queue mutation (`enqueue`, `enqueueDelete`, and a flush's
   own read-process-write) runs through a single in-process mutex — without
   it, two overlapping mutations (e.g. deleting several sketches back-to-back,
   or deleting one while a flush's network calls are still in flight) could
   silently clobber each other's write, which is exactly how deletes used to
   vanish from the server/R2 while still disappearing from the local list.

7. **Enhance (optional, online-only)** — `pages/sketchProfile.js` triggers
   `POST /enhance` in the background with an 8s timeout, gated on `NetInfo`;
   silently skipped offline. Server-side (`server/src/routes/enhance.js`):
   fetches the saved image, asks Gemini for real copy for the `Text`/`Button`
   boxes plus a style instruction (`lib/gemini.js`, falls back to OpenRouter —
   Claude 3 Haiku for the vision call, `text-embedding-3-small` for
   embeddings — on any Gemini failure, missing key, rate limit, or outage);
   in parallel looks up the closest matching layout pattern via **Actian
   VectorAI** (`lib/actian.js`), falling back to in-Mongo cosine similarity
   (`lib/cosineFallback.js`) if Actian isn't reachable. The Actian lookup is
   **hybrid fusion**, not a plain nearest-neighbor search: one search ranks
   patterns by semantic similarity of the layout's free-text description
   (`describeLayout`), a second ranks the same vector search filtered to
   patterns tagged with the sketch's actual detected element types
   (`tagsFromPredictions` — structured signal), and the SDK's
   `reciprocalRankFusion` merges the two ranked lists into one. A pattern
   that's both semantically close *and* built from the same kinds of
   elements outranks one that only matches on text. If the user typed a
   style instruction, it wins over the RAG pattern match for the *theme*
   (Gemini's instruction-aware suggestion was previously getting silently
   discarded in favor of whatever pattern matched on element counts alone —
   fixed). Both results feed back into the *same* `codeGen.generateCode()`
   from step 5 (via a `theme` + `labels` option), so enhanced and offline
   code generation share one code path. Result is cached on the sketch doc
   and in `AsyncStorage` client-side, so re-opening a sketch doesn't re-call
   Gemini.

## System components

| Component | Role |
|---|---|
| `auto-layout/` | Expo/React Native app. Owns capture, on-device detection, review, offline codegen. No UI component library — a small shared design system (`theme/tokens.js` + `components/{Button,TextField,Screen,StatusView,Typography}.js`) instead. |
| `server/` | Express + MongoDB. Auth, sketch CRUD, R2 upload URLs, the Enhance endpoint. Deployed via `docker-compose.yml` (`api` + `actian` + optional `caddy`) — currently live at `152.67.7.144:3000`. |
| `model/` | Training data (~350 labeled sketch photos) and the EfficientDet-Lite0 training/export scripts that produced `detector.tflite`. |

Note on `docker-compose.yml`: `ACTIAN_CONNECTION_STRING` must be the compose
service name (`actian:6574`), not `localhost:6574` — `api` and `actian` are
separate containers on their own network namespaces, so `localhost` from
inside `api` only ever resolves to `api` itself. This was broken for a while
(Actian was silently unreachable, always falling back to the Mongo cosine
path) before being fixed. Actian's gRPC/REST ports also aren't published to
the host/internet — it has no auth enabled by default, and `api` only ever
needs to reach it over the internal compose network.

## Auth

Email/password, `bcryptjs` hash stored in `User`, a JWT (`jsonwebtoken`,
30-day expiry, signed with `JWT_SECRET`) issued on signup/login
(`server/src/routes/auth.js`) and required as a `Bearer` header on every other
route (`server/src/middleware/auth.js`). The client stores the token in
`AsyncStorage` (`api/client.js`) and attaches it to every request.

## Design choices worth knowing

- **Detection and code generation are fully offline by construction** — the
  only things that ever need a network call are auth, sketch sync to the
  server, and Enhance. (See the earlier discussion in this conversation about
  the sketch-library/reopen flow *not yet* honoring that for already-saved
  sketches — that's the gap the local-first storage plan addresses.)
- **Enhance degrades gracefully everywhere**: short client timeout, `NetInfo`
  pre-check, cached result, a Gemini→OpenRouter fallback, and a non-Actian
  fallback for the RAG lookup — so a sponsor-tech outage or no signal never
  blocks the core flow.
- **Corrections are captured but not yet used** — `POST /corrections` exists
  and is called, but nothing retrains on that data yet; it's future work.
- **The sync queue is a single point of truth, mutex-guarded** — every
  enqueue and every flush pass goes through the same lock, so nothing about
  "did this sketch actually get deleted/pushed server-side" depends on
  request ordering or timing luck.
