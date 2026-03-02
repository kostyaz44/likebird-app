import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get, onDisconnect, serverTimestamp } from 'firebase/database';

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

// Сохранить данные в Firebase
export const fbSave = (key, data) => {
  if (!isAllowedKey(key)) return;
  set(ref(db, toFbPath(key)), data).catch((e) => {
    console.warn('[Firebase] Ошибка записи', key, e.message);
  });
};

// Получить данные из Firebase один раз (Promise)
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

// Подписаться на изменения ключа в Firebase
export const fbSubscribe = (key, callback) => {
  if (!isAllowedKey(key)) return () => {};
  const unsubscribe = onValue(ref(db, toFbPath(key)), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  }, (error) => {
    console.warn('[Firebase] Ошибка подписки', key, error.message);
  });
  return unsubscribe;
};

// === Presence (онлайн-статус сотрудников) ===

export const fbSetPresence = (login, name) => {
  if (!login) return;
  const presenceRef = ref(db, `presence/${login}`);
  set(presenceRef, {
    name: name || login,
    online: true,
    lastSeen: Date.now()
  }).catch(() => {});
  // При отключении — помечаем offline
  onDisconnect(presenceRef).set({
    name: name || login,
    online: false,
    lastSeen: Date.now()
  }).catch(() => {});
};

export const fbSubscribePresence = (callback) => {
  const presenceRef = ref(db, 'presence');
  return onValue(presenceRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  }, () => {});
};
