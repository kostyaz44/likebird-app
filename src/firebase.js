import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, get } from 'firebase/database';

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
// (личные данные вроде сессии и имени сотрудника — не синхронизируются)
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
]);

// likebird-reports → data/likebird-reports
const toFbPath = (key) => `data/${key}`;

// Сохранить данные в Firebase
export const fbSave = (key, data) => {
  if (!SYNC_KEYS.has(key)) return;
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

// Presence: записать что пользователь онлайн
export const fbSetPresence = (login, displayName) => {
  if (!login) return;
  set(ref(db, `presence/${login}`), {
    login,
    displayName,
    lastSeen: Date.now(),
    online: true,
  }).catch(() => {});
};

// Presence: подписаться на все онлайн-данные
export const fbSubscribePresence = (callback) => {
  const unsubscribe = onValue(ref(db, 'presence'), (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : {});
  });
  return unsubscribe;
};

// Подписаться на изменения ключа в Firebase
// callback(data) вызывается при каждом изменении (включая первую загрузку)
export const fbSubscribe = (key, callback) => {
  if (!SYNC_KEYS.has(key)) return () => {};
  const unsubscribe = onValue(ref(db, toFbPath(key)), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    }
  }, (error) => {
    console.warn('[Firebase] Ошибка подписки', key, error.message);
  });
  return unsubscribe;
};
