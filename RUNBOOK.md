# Hackathon day runbook

Everything code-side is done (mobile app, server, model training). What's left is
account/device/deploy work that needs live credentials or physical hardware I
don't have here. In dependency order:

## 1. Model - DONE
`auto-layout/assets/model/detector.tflite` is trained and in the repo (EfficientDet-Lite0,
20 epochs, 342 train / 10 eval images). Eval: AP50=1.0, overall AP=0.73. Verified with
`model/verify_tflite.py` - input is `uint8 [1,320,320,3]` (matches `decodeImage.js`, no
normalization needed), and visually sane detections across all 5 sample test images.

Output tensor order was **not** the standard SSD convention - Model Maker's export order
turned out to be `[scores, boxes, count, classes]`, not `[boxes, classes, scores, count]`.
Confirmed by inspecting raw tensor values (not guessed) and already fixed in
`auto-layout/lib/detect.js`. The one link in that chain still unverified: whether
`react-native-fast-tflite`'s `runSync()` returns outputs in the same index order as
Python's `interpreter.get_output_details()` - near-certain (both just expose the model's
native tensor order) but confirm with a `console.log(outputs.map(o => o.length))` on first
real device run: expect shapes `[25], [100], [1], [25]` for scores/boxes(25*4=100)/count/classes.

If you retrain: rerun `verify_tflite.py` after - it auto-detects the output order/shapes
(no more hardcoded indices), so it'll tell you immediately if a new export shuffles things.

## 2. Mobile: expo-dev-client build (~30-60 min, needs Expo account)
```
cd auto-layout
npm install
npx expo install --check
eas login                    # needs a free Expo account
eas build --profile development --platform android
```
Installing the resulting APK on your device needs no paid account (Android side-load,
unlike iOS). Once installed:
```
npx expo start --dev-client
```
Scan the QR / connect to the dev client. Test **offline** (airplane mode): draw a
sketch per `auto-layout/assets/guidelines.png`'s conventions, photograph it, confirm
detection + generated code shows up with no network.

**If `react-native-fast-tflite` fails to load the model or errors on `runSync`**:
see the output-order note in section 1 above - that's the most likely mismatch.

## 3. Backend (needs your accounts/keys, ~20-30 min)
- **MongoDB Atlas**: free cluster, grab the connection string.
- **Cloudflare R2**: create a bucket, generate an access key, enable public access
  (or set up a custom domain) for `R2_PUBLIC_BASE_URL`.
- **Gemini API key**: https://aistudio.google.com (free tier).
- **Actian Vector AI DB**: hackathon sponsor should provide access/docs - this is
  the one genuinely unverified piece. `server/src/lib/actian.js` is a speculative REST wrapper,
  written without real API docs. Check its actual wire protocol/SDK first; the
  wrapper's shape (`upsertPattern`/`findClosestPattern`) is what `server/src/routes/enhance.js`
  calls, so keep that function signature even if you rewrite the internals.
  If Actian doesn't pan out in time, `server/src/lib/cosineFallback.js` is a
  drop-in fallback (same signature, in-Mongo cosine similarity) - swap the
  `require` in `enhance.js` and you keep the demo working, just without the
  Actian sponsor-tech credit.

```
cd server
cp .env.example .env    # fill in the above
npm install
npm run selfcheck        # routing/middleware only, no live services needed
node scripts/seedPatterns.js   # seeds the RAG pattern library (needs Mongo + Gemini key)
npm start
```

Then either run it locally (point `auto-layout/.env`'s `EXPO_PUBLIC_API_URL` at your
laptop's LAN IP for on-device testing) or deploy to the Oracle VM:
```
cd server
docker compose up -d --build
```
(`docker-compose.yml` builds from the repo root since it needs `../auto-layout/lib`
- run `docker compose` from inside `server/`, don't move the Dockerfile.)

## 4. Wire the app to the backend
```
cd auto-layout
cp .env.example .env    # set EXPO_PUBLIC_API_URL to your server's URL
```
Rebuild/restart the dev client after changing this (Expo inlines `EXPO_PUBLIC_*`
at build time, not runtime).

## 5. End-to-end checks
- Signup -> login -> create sketch -> capture -> offline detection+code (airplane mode).
- Turn network on, reopen the sketch, confirm the Enhance banner appears and caches
  (reopen again, confirm no second network call - check server logs).
- Delete a sketch, delete all sketches, confirm R2 objects are actually gone.

## Known gaps / things nobody has verified on real hardware yet
- `auto-layout/lib/decodeImage.js`'s JPEG decode (jpeg-js, pure JS) has only been
  tested against a training image under plain Node - never inside the actual RN/Hermes
  runtime. Should work (jpeg-js is a pure-JS library, no native deps) but confirm early.
- `react-native-fast-tflite`'s output order matching Python's - see point 1 above.
- Actian's actual API - see point 3 above.
- No CUDA/GPU was used for training (this dev machine's TF install is CPU-only,
  native Windows GPU needs CUDA 11.2/cuDNN 8.1 which weren't installed to save
  time) - purely a training-speed note, doesn't affect the shipped `.tflite`, which
  is already done.

## Tap-to-correct / corrections / style-instruction (added after initial build)
- `pages/reviewDetections.js` sits between capture and results - tap a box to cycle
  its class before code generates. Corrections get logged via `POST /corrections`
  (`server/src/models/Correction.js`) for a future retrain - nothing consumes them yet.
- `sketchProfile.js` has a text field for style direction ("dark mode") that re-runs
  Enhance with that instruction folded into the Gemini prompt (bypasses the normal
  enhance cache/idempotency, since a new instruction means a genuinely new request).
