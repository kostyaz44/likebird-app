import { APP_VERSION } from '../utils/constants.js';

// ===== УТИЛИТЫ: Синхронизация =====
export const SyncManager = {
  getSyncId: () => {
    let id; try { id = localStorage.getItem('likebird-sync-id'); } catch { return 'lb-fallback-' + Date.now().toString(36); }
    if (!id) { id = 'lb-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6); localStorage.setItem('likebird-sync-id', id); }
    return id;
  },
  getLastSync: () => { try { return localStorage.getItem('likebird-last-sync') || null; } catch { return null; } },
  setLastSync: () => localStorage.setItem('likebird-last-sync', new Date().toISOString()),
  
  // Все ключи localStorage приложения
  ALL_KEYS: [
    'likebird-reports', 'likebird-expenses', 'likebird-stock', 'likebird-given',
    'likebird-salary-decisions', 'likebird-owncard', 'likebird-partners',
    'likebird-totalbirds', 'likebird-schedule', 'likebird-events',
    'likebird-manuals', 'likebird-salary-settings', 'likebird-admin-password',
    'likebird-employees', 'likebird-sales-plan', 'likebird-audit-log',
    'likebird-custom-products', 'likebird-locations', 'likebird-cost-prices',
    'likebird-penalties', 'likebird-bonuses', 'likebird-timeoff',
    'likebird-ratings', 'likebird-chat', 'likebird-stock-history',
    'likebird-writeoffs', 'likebird-autoorder', 'likebird-kpi',
    'likebird-auth', 'likebird-sync-id', 'likebird-last-sync',
    'likebird-sync-url', 'likebird-employee',
    // FIX: Ранее отсутствовали — не экспортировались, не очищались, не синхронизировались
    'likebird-invite-codes', 'likebird-custom-achievements',
    'likebird-achievements-granted', 'likebird-shifts', 'likebird-profiles',
    'likebird-users', 'likebird-notifications', 'likebird-product-photos',
    'likebird-system-notifications',
    'likebird-custom-aliases', 'likebird-notif-settings',
    'likebird-challenges', 'likebird-dark-mode', 'likebird-sync-queue', 'likebird-product-photos-data',
  ],

  // Экспорт всех данных (localStorage only — component state added by caller)
  exportAll: () => {
    const data = { _version: 2, _appVersion: APP_VERSION, _exportDate: new Date().toISOString(), _syncId: SyncManager.getSyncId() };
    SyncManager.ALL_KEYS.forEach(key => {
      try { const v = localStorage.getItem(key); if (v) data[key] = JSON.parse(v); } catch { const v = localStorage.getItem(key); if (v) data[key] = v; }
    });
    return data;
  },

  // Импорт всех данных
  importAll: (data) => {
    if (!data || !data._version) throw new Error('Неверный формат данных');
    let imported = 0;
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('_') || !key.startsWith('likebird-')) return;
      try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); imported++; } catch (e) { console.warn(`Failed to import ${key}:`, e); }
    });
    return imported;
  },

  // Синхронизация с удалённым сервером (если настроен)
  syncWithServer: async (url) => {
    if (!url) return { success: false, error: 'URL не настроен' };
    try {
      const data = SyncManager.exportAll();
      const response = await fetch(url + '/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId: SyncManager.getSyncId(), data, timestamp: Date.now() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.data) { SyncManager.importAll(result.data); }
      SyncManager.setLastSync();
      return { success: true, message: 'Синхронизировано' };
    } catch (e) { return { success: false, error: e.message }; }
  },
};
