// Express 4 doesn't await async route handlers - a rejected promise inside
// one is an unhandled rejection that crashes the whole process (confirmed:
// this happened for real with a client-generated local sketch id hitting
// Sketch.findOne({_id: ...}) - see git history on routes/enhance.js), not a
// request error the app-level error middleware in index.js ever sees.
// Wrap every async handler with this so a bad request returns a normal error
// response instead of taking the server down for every other user.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
