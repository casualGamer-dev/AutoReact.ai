// Enhance step, part 2: RAG lookup of a well-designed RN component pattern to
// restyle the raw detection into. Uses Gemini's text-embedding-004 for vectors
// (768-dim) since Actian's own embedding story is unconfirmed.
//
// Talks to a real Actian VectorAI DB (https://docs.vectoraidb.actian.com,
// docker image actian/vectorai:latest) via the official @actian/vectorai-client
// SDK - gRPC under the hood (ACTIAN_CONNECTION_STRING is a host:port like
// localhost:6574, not a URL), no auth required for local dev. This replaces an
// earlier hand-guessed REST wrapper that was written without real docs (see
// git history) - verified against the actual JS SDK reference this time.
// If Actian is unreachable/misconfigured, lib/cosineFallback.js is the
// documented fallback (same interface, in-process, no sponsor-tech credit but
// keeps the Gemini-restyling demo intact).
const { embedText } = require('./gemini');

const COLLECTION = 'layout_patterns';
const VECTOR_DIM = 768; // Gemini text-embedding-004 output size

let clientPromise = null;
let sdkPromise = null;
function getClient() {
  if (!process.env.ACTIAN_CONNECTION_STRING) {
    throw new Error('ACTIAN_CONNECTION_STRING not set');
  }
  if (!clientPromise) {
    // @actian/vectorai-client ships ESM-only (no require()) - dynamic import
    // works fine from this CJS module and only pays the import cost once.
    sdkPromise = import('@actian/vectorai-client');
    clientPromise = sdkPromise.then(
      ({ VectorAIClient }) => new VectorAIClient(process.env.ACTIAN_CONNECTION_STRING)
    );
  }
  return clientPromise;
}

// Memoized for the process lifetime - swallows the error either way (already
// exists, or a real problem that'll surface clearly on the next upsert/search
// call anyway), so this never needs to know the SDK's exact "exists" signal.
let collectionReady = null;
function ensureCollection(client) {
  if (!collectionReady) {
    collectionReady = client.collections
      .create(COLLECTION, { dimension: VECTOR_DIM, distanceMetric: 'COSINE' })
      .catch(() => {});
  }
  return collectionReady;
}

// id must be an integer or UUID string per Actian's point schema - callers
// can't pass arbitrary text (see scripts/seedPatterns.js).
async function upsertPattern({ id, description, style, tags = [] }) {
  const client = await getClient();
  await ensureCollection(client);
  const vector = await embedText(description);
  await client.points.upsert(COLLECTION, [{ id, vector, payload: { description, style, tags } }]);
}

// Hybrid fusion: two independently-ranked searches over the same collection -
// (1) pure semantic similarity of the free-text layout description, and
// (2) that same vector search restricted by a structured filter on `tags`
// (the actual ELEMENT_TYPES detected in this sketch, e.g. ['Button','Image'])
// - merged into one ranking via the SDK's reciprocalRankFusion, so a pattern
// that's both semantically close *and* built from the same kinds of elements
// outranks one that only matches on text. Falls back to the pure semantic
// result if the tag filter has no matches (RRF over an empty list is a no-op).
async function findClosestPattern(layoutDescription, tags = []) {
  const client = await getClient();
  const { Field, reciprocalRankFusion } = await sdkPromise;
  await ensureCollection(client);
  const vector = await embedText(layoutDescription);

  const searches = [client.points.search(COLLECTION, vector, { limit: 5 })];
  if (tags.length > 0) {
    searches.push(
      client.points.search(COLLECTION, vector, { limit: 5, filter: new Field('tags').in(tags) }).catch(() => [])
    );
  }
  const [semantic, structured] = await Promise.all(searches);

  const fused = reciprocalRankFusion(structured ? [semantic, structured] : [semantic]);
  return fused?.[0]?.payload?.style || null;
}

module.exports = { upsertPattern, findClosestPattern };
