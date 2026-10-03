// Retryable, persisted sync queue. Replaces the old one-shot
// "try once, warn and give up forever if it fails" pattern (what
// reviewDetections.js's syncInBackground used to do) - ops survive app
// restarts and get retried whenever a connection shows up, instead of
// silently stranding a sketch as local-only forever because the phone
// happened to be offline at the one moment it tried to sync.
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, uploadToR2 } from '../api/client';
import { getLocal, saveLocal, genId, adoptGuestSketches } from './localStore';

function queueKey(email) {
  return `al_syncqueue:${email}`;
}

async function readQueue() {
  const email = await api.getEmail();
  if (!email) return { email: null, queue: [] };
  const raw = await AsyncStorage.getItem(queueKey(email));
  return { email, queue: raw ? JSON.parse(raw) : [] };
}

async function writeQueue(email, queue) {
  await AsyncStorage.setItem(queueKey(email), JSON.stringify(queue));
}

// AsyncStorage has no transactions, and every queue mutation below is a
// read-modify-write against the same key - enqueue(), enqueueDelete(), and
// flush()'s own final write can all interleave (e.g. deleting several
// sketches back-to-back with no await between them, or enqueuing something
// new while a flush's network calls are still in flight). Without this lock,
// a later write reading a stale snapshot silently overwrites an earlier one -
// which is why deletes were disappearing from the queue before ever reaching
// the server: removeLocal() is synchronous/local-only so it always
// "succeeds", but the queued server-side delete op could get clobbered.
let queueLock = Promise.resolve();
function locked(fn) {
  const run = queueLock.then(fn, fn);
  queueLock = run.then(() => {}, () => {});
  return run;
}

// A push op always reads the sketch's *current* local state when it finally
// runs (see executePush), so re-enqueuing on top of an existing pending push
// for the same sketch is a no-op - one push op per sketch is enough to
// eventually carry over whatever the latest edit was.
function enqueue(op) {
  return locked(async () => {
    const { email, queue } = await readQueue();
    if (!email) return;
    if (op.type === 'push' && queue.some((q) => q.type === 'push' && q.localId === op.localId)) {
      triggerFlush();
      return;
    }
    queue.push({ id: genId(), attempts: 0, ...op });
    await writeQueue(email, queue);
    triggerFlush();
  });
}

export function enqueuePush(localId) {
  return enqueue({ type: 'push', localId });
}

// Call right after a successful login/signup: sketches made while signed out
// join the account and are queued to sync like any other.
export async function adoptGuestAndSync() {
  const moved = await adoptGuestSketches();
  for (const sketch of moved) await enqueuePush(sketch._id);
  return moved.length;
}

export function enqueueCorrections(localId, corrections) {
  return enqueue({ type: 'corrections', localId, corrections });
}

// Cancels any not-yet-run push/corrections for this sketch (there's nothing
// left to push once it's deleted) and, only if it had ever reached the
// server, queues the server-side delete.
export function enqueueDelete(localId, serverId) {
  return locked(async () => {
    const { email, queue } = await readQueue();
    if (!email) return;
    const remaining = queue.filter((q) => q.localId !== localId);
    if (serverId) remaining.push({ id: genId(), attempts: 0, type: 'delete', localId, serverId });
    await writeQueue(email, remaining);
    triggerFlush();
  });
}

async function executePush(op) {
  const sketch = await getLocal(op.localId);
  if (!sketch) return; // deleted locally before this op ran - nothing to push

  let serverId = sketch.serverId;
  if (!serverId) {
    const created = await api.createSketch(sketch.name, sketch._id);
    serverId = created._id;
    await saveLocal(sketch._id, { serverId });
  }

  // Predictions/code go up first, independent of the image upload below - a
  // persistent R2 failure shouldn't also block the server from ever seeing
  // the generated code (Enhance's describeLayout/labels need predictions
  // regardless of whether the image itself has made it up yet).
  await api.updateSketch(serverId, {
    predictions: sketch.predictions,
    num_predictions: sketch.num_predictions,
    code: sketch.code,
    width: sketch.width,
    height: sketch.height,
  });

  let image_url = sketch.image_url;
  if (image_url && image_url.startsWith('file://')) {
    const { uploadUrl, publicUrl } = await api.getUploadUrl(serverId, 'image_url', 'image/jpeg');
    const blob = await (await fetch(image_url)).blob();
    await uploadToR2(uploadUrl, blob, 'image/jpeg');
    image_url = publicUrl;
    await saveLocal(sketch._id, { image_url });
    await api.updateSketch(serverId, { image_url });
  }

  await saveLocal(sketch._id, { synced: true });
}

async function executeCorrections(op) {
  const sketch = await getLocal(op.localId);
  const serverId = sketch?.serverId;
  if (!serverId) throw new Error('corrections: sketch not synced yet, retry after its push op');
  await api.submitCorrections(serverId, op.corrections);
}

async function executeDelete(op) {
  await api.deleteSketch(op.serverId);
}

const EXECUTORS = { push: executePush, corrections: executeCorrections, delete: executeDelete };

let flushing = false;
let flushAgain = false;

// FIFO, sequential: a push op for a sketch is always enqueued before any
// corrections op for the same sketch (see reviewDetections.js), so running
// in order guarantees serverId is populated by the time corrections runs,
// within the same flush pass.
export async function flush() {
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    await locked(async () => {
      const { email, queue } = await readQueue();
      if (!email || queue.length === 0) return;

      const remaining = [];
      for (const op of queue) {
        try {
          await EXECUTORS[op.type](op);
        } catch (err) {
          console.warn(`sync: ${op.type} failed for ${op.localId} (will retry):`, err.message);
          remaining.push({ ...op, attempts: op.attempts + 1 });
        }
      }
      await writeQueue(email, remaining);
    });
  } finally {
    flushing = false;
    if (flushAgain) {
      flushAgain = false;
      flush();
    }
  }
}

function triggerFlush() {
  flush().catch((err) => console.warn('sync: flush failed:', err.message));
}

// Call once near app startup (see App.js). Retries whenever connectivity
// comes back, plus an immediate attempt in case there's already a backlog
// from a previous offline session.
export function startSyncListener() {
  triggerFlush();
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) triggerFlush();
  });
}
