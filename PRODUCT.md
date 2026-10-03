# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
Mobile developers and students prototyping UI. They sketch a screen on paper and want starter React Native code quickly, often away from a reliable connection.

## Product Purpose
Photograph a hand-drawn UI wireframe and get working React Native code. Detection and code generation run on-device; an optional online "Enhance" step turns placeholder text into real copy and suggests a theme. Success: a usable component from a paper sketch in a few taps.

## Positioning
Fully offline paper-to-code (on-device TFLite detection plus offline codegen) combined with a human-in-the-loop review step: users tap a detection to fix its type or delete it before code is generated. Online Enhance is optional, never required.

## Operating Context
Sketch on paper using the app's element conventions (text, text field, button, image, switch), capture a photo, review and correct detections, generate code, optionally Enhance (Gemini, OpenRouter fallback; design-pattern lookup via Actian VectorAI).

## Capabilities and Constraints
- Expo / React Native 0.76 with dev-client builds; Android package `com.gamerdas.aicodegen`. iOS is unverified on real hardware.
- On-device detector: EfficientDet-Lite0 TFLite model via `react-native-fast-tflite`.
- Server (Express, MongoDB, Cloudflare R2, JWT) backs Enhance only.
- Existing shared design system: `theme/tokens.js` + `components/`; no UI component library.
- Terminology: elements are text, text field, button, image, switch.

## Product Principles
- Offline first: the core loop never requires a network.
- The user stays in control: detections are reviewed and corrected before code is generated.
- Enhance is an optional upgrade, never a gate.
- Output is real, runnable React Native code.
