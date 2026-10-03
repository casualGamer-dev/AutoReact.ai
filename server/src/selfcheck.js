// ponytail: smallest runnable check, not a test suite. Run with `npm run selfcheck`.
// Exercises routing/middleware wiring only - no live Mongo/R2/Gemini/Actian needed.
const assert = require('assert');
const { app } = require('./index');

async function main() {
  const server = app.listen(0);
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`);
  assert.strictEqual(health.status, 200);
  assert.deepStrictEqual(await health.json(), { ok: true });

  const unauthed = await fetch(`${base}/sketches`);
  assert.strictEqual(unauthed.status, 401, 'sketches route should require auth');

  const badToken = await fetch(`${base}/sketches`, { headers: { Authorization: 'Bearer not-a-real-token' } });
  assert.strictEqual(badToken.status, 401, 'invalid token should be rejected');

  server.close();
  console.log('server selfcheck: OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
