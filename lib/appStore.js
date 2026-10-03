// Apps = ordered groups of screens (sketches). Local-first like localStore: an
// app is { _id, name, createdAt, updatedAt }, and a screen is simply a sketch
// whose `appId` points at it (`appOrder` fixes the order). Sketches still sync
// individually; the grouping itself lives on this phone for now.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { appsKey, genId, getLocal, listLocal, saveLocal } from './localStore';
import { sortIntoRows } from './layoutSort';
import { generateAppCode } from './codeGen';

async function owner() {
  return (await api.getEmail()) || 'guest';
}

async function readApps() {
  const o = await owner();
  const raw = await AsyncStorage.getItem(appsKey(o));
  return { o, list: raw ? JSON.parse(raw) : [] };
}

async function writeApps(o, list) {
  await AsyncStorage.setItem(appsKey(o), JSON.stringify(list));
}

export async function listApps() {
  const { list } = await readApps();
  return [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getApp(id) {
  const { list } = await readApps();
  return list.find((a) => a._id === id) || null;
}

export async function createApp(name) {
  const { o, list } = await readApps();
  const now = new Date().toISOString();
  const app = { _id: genId(), name: name.trim() || 'My app', createdAt: now, updatedAt: now };
  await writeApps(o, [...list, app]);
  return app;
}

export async function renameApp(id, name) {
  const { o, list } = await readApps();
  await writeApps(o, list.map((a) => (a._id === id ? { ...a, name: name.trim() || a.name, updatedAt: new Date().toISOString() } : a)));
}

// Deleting an app keeps its screens: they simply become standalone sketches again.
export async function deleteApp(id) {
  const { o, list } = await readApps();
  await writeApps(o, list.filter((a) => a._id !== id));
  const screens = await appScreens(id);
  for (const s of screens) await saveLocal(s._id, { appId: null });
}

export async function appScreens(appId) {
  const all = await listLocal();
  return all
    .filter((s) => s.appId === appId)
    .sort((a, b) => (a.appOrder || 0) - (b.appOrder || 0) || new Date(a.createdAt) - new Date(b.createdAt));
}

export async function addScreenToApp(appId, sketchId) {
  const screens = await appScreens(appId);
  const next = screens.reduce((m, s) => Math.max(m, s.appOrder || 0), 0) + 1;
  await saveLocal(sketchId, { appId, appOrder: next });
  await touch(appId);
}

export async function removeScreenFromApp(sketchId) {
  const s = await getLocal(sketchId);
  await saveLocal(sketchId, { appId: null });
  if (s && s.appId) await touch(s.appId);
}

// dir: -1 up, +1 down. Re-numbers the whole list so orders stay unique.
export async function moveScreen(appId, sketchId, dir) {
  const screens = await appScreens(appId);
  const i = screens.findIndex((s) => s._id === sketchId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= screens.length) return;
  [screens[i], screens[j]] = [screens[j], screens[i]];
  for (let n = 0; n < screens.length; n++) await saveLocal(screens[n]._id, { appOrder: n + 1 });
  await touch(appId);
}

async function touch(appId) {
  const { o, list } = await readApps();
  await writeApps(o, list.map((a) => (a._id === appId ? { ...a, updatedAt: new Date().toISOString() } : a)));
}

// One runnable App.js for the whole app. Screens with no detected elements are skipped.
export function buildAppCode(app, screens) {
  const usable = screens
    .filter((s) => s.predictions && s.predictions.length > 0)
    .map((s) => ({
      id: s._id,
      theme: s.theme || undefined,
      name: s.name,
      rowOrder: sortIntoRows(s.predictions),
      imageWidth: s.width,
    }));
  return usable.length ? generateAppCode(usable, { name: app.name }) : '';
}
