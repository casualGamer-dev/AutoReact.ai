// Enhance step, part 1: read handwritten annotations near detected elements and
// suggest real copy/theme instead of the generic "Button"/"Text" placeholders.
//
// Both calls try Gemini first and fall back to OpenRouter (Claude 3 Haiku for
// the vision call, an OpenAI embedding model for the embed call) on any
// failure - missing/invalid key, rate limit, or an outage. Keeps the Enhance
// path (and the RAG pattern lookup that depends on embedText) working even
// when Gemini itself is down, at the cost of a different model's output on
// the fallback path.
const GEMINI_MODEL = 'gemini-2.0-flash';
const OPENROUTER_VISION_MODEL = 'anthropic/claude-3-haiku';
const OPENROUTER_EMBED_MODEL = 'openai/text-embedding-3-small';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

function buildPrompt(predictions, instruction) {
  return (
    'This photo is a hand-drawn UI wireframe. Detected elements (with bounding boxes): ' +
    JSON.stringify(predictions.map((p) => ({ type: p.object, x0: p.x0, y0: p.y0 }))) +
    '. Read any handwritten text/labels near each element. Reply ONLY with JSON: ' +
    '{ "labels": [{"index": <element index in the array above>, "text": "<label>"}], ' +
    '"theme": {"primaryColor": "#hex", "borderRadius": <number>} }. ' +
    'If no handwriting is visible for an element, omit it from "labels". Keep it concise.' +
    (instruction ? ` Additionally, the user asked for this styling direction: "${instruction}" - reflect it in the theme choice.` : '')
  );
}

function parseJsonReply(text) {
  const cleaned = (text || '{}').replace(/^```json\s*|```$/g, '').trim();
  return JSON.parse(cleaned);
}

async function suggestContentGemini({ imageBase64, mimeType, predictions, instruction }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(predictions, instruction) },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonReply(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

// Claude 3 Haiku over OpenRouter's OpenAI-compatible chat/completions - vision
// input as a data: URL, same JSON-only prompt as the Gemini path.
async function suggestContentOpenRouter({ imageBase64, mimeType, predictions, instruction }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const res = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(predictions, instruction) },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return parseJsonReply(data.choices?.[0]?.message?.content);
}

async function suggestContent(args) {
  try {
    return await suggestContentGemini(args);
  } catch (err) {
    console.warn('gemini: suggestContent failed, falling back to OpenRouter:', err.message);
    return suggestContentOpenRouter(args);
  }
}

// text-embedding-004 was retired - gemini-embedding-001 is the current model.
// It defaults to a 3072-dim vector but supports truncating via
// outputDimensionality; pinned to 768 to match what actian.js's collection
// and any already-stored Pattern.vector docs in Mongo assume. The OpenRouter
// fallback below asks text-embedding-3-small for the same 768 via its
// `dimensions` param so both paths produce vectors the same Actian
// collection/cosine fallback can compare - unverified against a live
// OpenRouter embeddings call, confirm dimensionality on first real use.
const EMBED_DIM = 768;

async function embedTextGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: EMBED_DIM }),
    }
  );
  if (!res.ok) throw new Error(`Gemini embed request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.embedding.values;
}

async function embedTextOpenRouter(text) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const res = await fetch(`${OPENROUTER_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: OPENROUTER_EMBED_MODEL, input: text, dimensions: EMBED_DIM }),
  });
  if (!res.ok) throw new Error(`OpenRouter embed request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function embedText(text) {
  try {
    return await embedTextGemini(text);
  } catch (err) {
    console.warn('gemini: embedText failed, falling back to OpenRouter:', err.message);
    return embedTextOpenRouter(text);
  }
}

module.exports = { suggestContent, embedText };
