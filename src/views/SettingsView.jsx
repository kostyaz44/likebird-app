import React from 'react';
import { ArrowLeft, Bell, Download, Upload, Info, LogOut, Wifi, WifiOff, Smartphone } from 'lucide-react';
import { SyncManager } from '../services/sync.js';
import { APP_VERSION } from '../utils/constants.js';
import { dateForFile } from '../utils/dates.js';
import { downloadBlob } from '../utils/helpers.js';
import { useApp } from '../context/AppContext';

export default function SettingsView() {
  const { authName, darkMode, deferredPrompt, employeeName, enrichBackup, expenses, exportData, getAllDates, getEffectiveSalary, getProductName, importData, isOnline, notifSettings, reports, save, setCurrentView, setDarkMode, setDeferredPrompt, setIsAuthenticated, setNotifSettings, setShowInstallBanner, showInstallBanner, showNotification, stock } = useApp();

  return (
  <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
    <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
      <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
      <h2 className="text-xl font-bold">⚙️ Настройки</h2>
    </div>
    <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
      {/* Онлайн-статус */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
        {isOnline ? 'Онлайн' : 'Оффлайн — данные сохраняются локально'}
      </div>

      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Info className="w-5 h-5 text-blue-500" />Статистика</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-600">Всего продаж:</span><span className="font-semibold">{reports.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Всего расходов:</span><span className="font-semibold">{expenses.length}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Дней с записями:</span><span className="font-semibold">{getAllDates().length}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">ID устройства:</span><span className="font-semibold text-xs">{SyncManager.getSyncId()}</span></div>
        </div>
      </div>

      {/* Установка PWA */}
      {(deferredPrompt || showInstallBanner) && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <Smartphone className="w-8 h-8" />
            <div>
              <h3 className="font-bold">Установите приложение</h3>
              <p className="text-xs text-white/80">Работайте оффлайн, быстрый доступ с рабочего стола</p>
            </div>
          </div>
          <button onClick={async () => {
            if (deferredPrompt) {
              deferredPrompt.prompt();
              const choice = await deferredPrompt.userChoice;
              if (choice.outcome === 'accepted') { showNotification('Приложение установлено!'); }
              setDeferredPrompt(null); setShowInstallBanner(false);
            }
          }} className="w-full py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50">
            📲 Установить на устройство
          </button>
        </div>
      )}

      {/* BLOCK 9: Dark Mode Toggle */}
      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2">🎨 Тема оформления</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Тёмная тема</span>
          <button onClick={() => setDarkMode(!darkMode)} className={`relative w-14 h-7 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 ${darkMode ? 'right-0.5' : 'left-0.5'} w-6 h-6 bg-white rounded-full shadow transition-all flex items-center justify-center text-sm`}>
              {darkMode ? '🌙' : '☀️'}
            </span>
          </button>
        </div>
      </div>

      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="w-5 h-5 text-green-500" />Экспорт данных</h3>
        <p className="text-sm text-gray-500 mb-3">Полный бэкап всех данных приложения</p>
        <button onClick={exportData} className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 mb-2">📥 Скачать полный бэкап</button>
        <button onClick={() => { try { downloadBlob(new Blob([JSON.stringify(enrichBackup(SyncManager.exportAll()))], { type: 'application/json' }), `likebird-backup-${dateForFile()}.json`); showNotification('✅ Бэкап сохранён'); } catch (e) { showNotification('❌ ' + e.message, 'error'); } }} className="w-full py-2 bg-gray-100 text-gray-600 rounded-lg text-sm mb-2 hover:bg-gray-200">📦 Быстрый бэкап (без ожидания Firebase)</button>
        <button onClick={() => {
          const BOM = '\uFEFF';
          const reportHeaders = 'Дата;Сотрудник;Товар;Категория;Количество;Цена;Сумма;Чаевые;ЗП;Тип оплаты';
          const reportRows = reports.map(r => [
            r.date?.split(',')[0] || '', r.employee || '', getProductName(r.product), r.category || '',
            r.quantity || 1, r.salePrice || 0, r.total || 0, r.tips || 0,
            getEffectiveSalary(r), r.paymentType === 'cashless' ? 'Безнал' : 'Наличные'
          ].join(';'));
          downloadBlob(new Blob([BOM + reportHeaders + '\n' + reportRows.join('\n')], { type: 'text/csv;charset=utf-8' }), `reports-${dateForFile()}.csv`);
          const stockHeaders = 'Товар;Категория;Количество;Мин. остаток;Цена';
          const stockRows = Object.entries(stock).map(([name, data]) => [
            name, data.category || '', data.count || 0, data.minStock || 3, data.price || 0
          ].join(';'));
          downloadBlob(new Blob([BOM + stockHeaders + '\n' + stockRows.join('\n')], { type: 'text/csv;charset=utf-8' }), `stock-${dateForFile()}.csv`);
          showNotification('📊 CSV файлы скачаны');
        }} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">📊 Экспорт CSV (отчёты + остатки)</button>
      </div>

      <div className="bg-white rounded-xl p-4 shadow border-2 border-blue-100">
        <h3 className="font-bold mb-1 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-500" />Восстановление из бэкапа</h3>
        <p className="text-xs text-gray-500 mb-1">Загрузите файл <code className="bg-gray-100 px-1 rounded">.json</code> — данные запишутся и в Firebase, и в локальное хранилище.</p>
        <p className="text-xs text-amber-600 mb-3">⚠️ Существующие данные в Firebase будут перезаписаны ключами из файла!</p>
        <label className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 flex items-center justify-center gap-2 cursor-pointer shadow">
          📤 Загрузить бэкап (JSON)
          <input type="file" accept=".json" onChange={(e) => { if (e.target.files[0]) importData(e.target.files[0]); }} className="hidden" />
        </label>
        <p className="text-xs text-gray-400 mt-2 text-center">После загрузки страница перезагрузится автоматически</p>
      </div>

      {/* Уведомления */}
      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><Bell className="w-5 h-5 text-purple-500" />🔔 Уведомления</h3>
        {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
          <button onClick={() => Notification.requestPermission().then(p => { if (p === 'granted') showNotification('Уведомления включены!'); })} className="w-full py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 mb-3">
            🔔 Разрешить push-уведомления
          </button>
        )}
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium">⏰ Напоминание об открытии смены (после 10:00)</span>
            <input type="checkbox" checked={notifSettings.shiftReminder} onChange={(e) => {
              const updated = { ...notifSettings, shiftReminder: e.target.checked };
              setNotifSettings(updated);
              save('likebird-notif-settings', updated);
            }} className="w-5 h-5 accent-purple-500" />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium">⚠️ Уведомление о низком остатке товара</span>
            <input type="checkbox" checked={notifSettings.lowStockAlert} onChange={(e) => {
              const updated = { ...notifSettings, lowStockAlert: e.target.checked };
              setNotifSettings(updated);
              save('likebird-notif-settings', updated);
            }} className="w-5 h-5 accent-purple-500" />
          </label>
          {notifSettings.lowStockAlert && (
            <div className="flex items-center gap-2 pl-2">
              <span className="text-xs text-gray-500">Порог остатка:</span>
              <input type="number" value={notifSettings.stockThreshold} onChange={(e) => {
                const updated = { ...notifSettings, stockThreshold: parseInt(e.target.value) || 3 };
                setNotifSettings(updated);
                save('likebird-notif-settings', updated);
              }} className="w-20 p-1.5 border rounded text-sm text-center" min="1" max="50" />
              <span className="text-xs text-gray-500">шт</span>
            </div>
          )}
        </div>
      </div>

      {/* Аккаунт */}
      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><LogOut className="w-5 h-5 text-orange-500" />Аккаунт</h3>
        <p className="text-sm text-gray-500 mb-3">Вы вошли как: <strong>{authName || employeeName || 'Пользователь'}</strong></p>
        <button onClick={() => {
          localStorage.removeItem('likebird-auth');
          setIsAuthenticated(false);
          setCurrentView('menu');
          showNotification('Вы вышли из аккаунта');
        }} className="w-full py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600">🚪 Выйти</button>
      </div>

      <p className="text-center text-gray-400 text-xs pb-4">LikeBird v{APP_VERSION} • PWA Ready</p>
    </div>
  </div>
  );
}
