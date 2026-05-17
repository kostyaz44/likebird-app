import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, onDisconnect } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAoZOo5LYtUKYiFhntbr0O5LfCKQEHn3jo",
  authDomain: "likebird-928e2.firebaseapp.com",
  databaseURL: "https://likebird-928e2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "likebird-928e2",
  storageBucket: "likebird-928e2.firebasestorage.app",
  messagingSenderId: "438710809259",
  appId: "1:438710809259:web:f944a3340e3452f318bdee"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Ключи, которые синхронизируются между всеми устройствами
export const SYNC_KEYS = new Set([
  'likebird-reports',
  'likebird-expenses',
  'likebird-stock',
  'likebird-given',
  'likebird-salary-decisions',
  'likebird-owncard',
  'likebird-partners',
  'likebird-totalbirds',
  'likebird-schedule',
  'likebird-events',
  'likebird-manuals',
  'likebird-salary-settings',
  'likebird-admin-password',
  'likebird-employees',
  'likebird-sales-plan',
  'likebird-audit-log',
  'likebird-custom-products',
  'likebird-locations',
  'likebird-cost-prices',
  'likebird-penalties',
  'likebird-bonuses',
  'likebird-timeoff',
  'likebird-ratings',
  'likebird-chat',
  'likebird-stock-history',
  'likebird-writeoffs',
  'likebird-autoorder',
  'likebird-kpi',
  'likebird-profiles',
  'likebird-users',
  'likebird-invite-codes',
  'likebird-custom-achievements',
  'likebird-achievements-granted',
  'likebird-shifts',
  // Новые ключи v3.0
  'likebird-notifications',
  'likebird-system-notifications',
  'likebird-notif-settings',
  'likebird-challenges',
  'likebird-product-photos-data',
  'likebird-media-index',
]);

// Динамические ключи: фото товаров (likebird-mp-*) и фото смен (likebird-ms-*)
const isDynamicKey = (key) =>
  key.startsWith('likebird-mp-') ||
  key.startsWith('likebird-ms-') ||
  key.startsWith('likebird-game-leaderboard/');

// Проверка: разрешён ли ключ для синхронизации
const isAllowedKey = (key) => SYNC_KEYS.has(key) || isDynamicKey(key);

// likebird-reports → data/likebird-reports
const toFbPath = (key) => `data/${key}`;

// === Очистка undefined (Firebase не принимает undefined) ===
// Рекурсивно удаляет undefined поля из объектов и массивов.
const cleanUndefined = (value) => {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(cleanUndefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      const v = value[k];
      if (v === undefined) continue;
      out[k] = cleanUndefined(v);
    }
    return out;
  }
  return value;
};

// === Контроль размера payload ===
// Realtime Database ограничивает запись 10MB, но рекомендуется <1MB.
// Предупреждаем в консоль если payload подозрительно большой.
const PAYLOAD_WARNING_BYTES = 1_000_000; // 1MB
const PAYLOAD_HARD_LIMIT_BYTES = 9_000_000; // 9MB (ограничение FB ~10MB)
const checkPayloadSize = (key, data) => {
  try {
    const sizeBytes = JSON.stringify(data).length;
    if (sizeBytes > PAYLOAD_HARD_LIMIT_BYTES) {
      console.error(`[Firebase] Слишком большой payload для "${key}": ${(sizeBytes / 1_000_000).toFixed(1)}MB. Запись отклонена.`);
      return false;
    }
    if (sizeBytes > PAYLOAD_WARNING_BYTES) {
      console.warn(`[Firebase] Большой payload для "${key}": ${(sizeBytes / 1_000_000).toFixed(2)}MB. Рекомендуется <1MB.`);
    }
    return true;
  } catch {
    return true; // если не смогли посчитать, разрешаем запись
  }
};

// === Debounce для частых записей ===
// Если в течение N мс приходит несколько вызовов с одним ключом — отправится только последний.
// Это снижает нагрузку на Firebase при быстром вводе (5 продаж за 2 сек ≠ 5 записей).
const DEBOUNCE_MS = 300;
const pendingWrites = new Map(); // key → { timer, data }

const flushWrite = (key) => {
  const pending = pendingWrites.get(key);
  if (!pending) return;
  pendingWrites.delete(key);
  const safe = cleanUndefined(pending.data);
  if (!checkPayloadSize(key, safe)) return;
  set(ref(db, toFbPath(key)), safe).catch((e) => {
    console.warn('[Firebase] Ошибка записи', key, e.message);
  });
};

// === Сохранить данные в Firebase (с debounce и очисткой undefined) ===
export const fbSave = (key, data) => {
  if (!isAllowedKey(key)) return;
  // Если уже есть pending — обновляем данные и сбрасываем таймер
  const existing = pendingWrites.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => flushWrite(key), DEBOUNCE_MS);
  pendingWrites.set(key, { timer, data });
};

// Принудительный flush всех ожидающих записей (например при unload страницы)
export const fbFlushPending = () => {
  // Копируем ключи в массив, т.к. flushWrite модифицирует Map
  const keys = Array.from(pendingWrites.keys());
  keys.forEach(k => {
    const p = pendingWrites.get(k);
    if (p) clearTimeout(p.timer);
    flushWrite(k);
  });
};

// При закрытии вкладки — сбрасываем pending writes
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', fbFlushPending);
  window.addEventListener('pagehide', fbFlushPending);
}

// === Получить данные из Firebase один раз (Promise) ===
export const fbGet = async (key) => {
  try {
    const snapshot = await get(ref(db, `data/${key}`));
    if (snapshot.exists()) return snapshot.val();
    return null;
  } catch (e) {
    console.warn('[Firebase] Ошибка чтения', key, e.message);
    return null;
  }
};

// === Подписаться на изменения ключа в Firebase ===
// ВАЖНО: коллбек теперь вызывается ВСЕГДА (включая случай когда ключ удалён → null).
// Старая логика if (exists()) пропускала удаления и подписчик мог хранить устаревшие данные.
export const fbSubscribe = (key, callback) => {
  if (!isAllowedKey(key)) return () => {};
  const unsubscribe = onValue(ref(db, toFbPath(key)), (snapshot) => {
    const val = snapshot.exists() ? snapshot.val() : null;
    try { callback(val); } catch (e) { console.warn('[Firebase] Ошибка в callback', key, e); }
  }, (error) => {
    console.warn('[Firebase] Ошибка подписки', key, error.message);
  });
  return unsubscribe;
};

// === Presence (онлайн-статус сотрудников) ===

let presenceHeartbeatTimer = null;

export const fbSetPresence = (login, name) => {
  if (!login) return;
  const presenceRef = ref(db, `presence/${login}`);

  // ВАЖНО: onDisconnect регистрируем СНАЧАЛА, ДО set —
  // чтобы при обрыве в момент set мы успели поставить offline.
  onDisconnect(presenceRef).set({
    name: name || login,
    online: false,
    lastSeen: Date.now()
  }).catch(() => {});

  const writeOnline = () => {
    set(presenceRef, {
      name: name || login,
      online: true,
      lastSeen: Date.now()
    }).catch(() => {});
  };

  writeOnline();

  // Heartbeat: обновляем lastSeen каждую минуту,
  // чтобы другие клиенты могли определить "зависшие" вкладки.
  if (presenceHeartbeatTimer) clearInterval(presenceHeartbeatTimer);
  presenceHeartbeatTimer = setInterval(writeOnline, 60_000); // раз в минуту
};

// Очистка heartbeat (например при logout)
export const fbClearPresenceHeartbeat = () => {
  if (presenceHeartbeatTimer) {
    clearInterval(presenceHeartbeatTimer);
    presenceHeartbeatTimer = null;
  }
};

export const fbSubscribePresence = (callback) => {
  const presenceRef = ref(db, 'presence');
  return onValue(presenceRef, (snapshot) => {
    const val = snapshot.exists() ? snapshot.val() : {};
    try { callback(val); } catch (e) { console.warn('[Firebase] presence callback error', e); }
  }, () => {});
};
