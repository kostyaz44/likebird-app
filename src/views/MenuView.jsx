import React from 'react';
import { ShoppingBag, FileText, BarChart3, AlertTriangle, Clock, Bell, Settings, Shield, Users, TrendingUp, WifiOff } from 'lucide-react';
import { APP_VERSION } from '../utils/constants.js';
import { formatDate, parseYear } from '../utils/dates.js';
import { useApp } from '../context/AppContext';

export default function MenuView() {
  const { currentUser, employeeName, eventsCalendar, getLowStockItems, getReportsByDate, hasAccess, isOnline, profilesData, reports, setCurrentView, setSelectedDate, shiftsData, userNotifications } = useApp();

  const todayAllReports = getReportsByDate(formatDate(new Date()));
  // Показываем только МОИ продажи
  const todayReports = todayAllReports.filter(r => r.employee === employeeName);
  const todayTotal = todayReports.reduce((s, r) => s + r.total, 0);
  const todayTips = todayReports.reduce((s, r) => s + (r.tips || 0), 0);
  const todayCash = todayReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
  const todayCashless = todayReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
  const hasUnrecognized = todayReports.some(r => r.isUnrecognized);
  const lowStock = getLowStockItems();
  const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin';
  
  // Подсчёт предстоящих событий
  const today = new Date();
  const upcomingEventsCount = Object.entries(eventsCalendar).reduce((count, [date, evArr]) => {
    const [d, m, y] = date.split('.');
    const eventDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
    const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil <= 7) return count + (Array.isArray(evArr) ? evArr.length : 1);
    return count;
  }, 0);

  // Мои непрочитанные уведомления
  const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
  const myUnreadCount = userNotifications.filter(n => n.targetLogin === myLogin && !n.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6 relative">
          {/* Кнопка уведомлений — правый верхний угол */}
          <button onClick={() => setCurrentView('notifications')} className="absolute top-0 right-0 w-10 h-10 bg-white rounded-xl shadow flex items-center justify-center hover:shadow-md relative">
            <Bell className="w-5 h-5 text-amber-600" />
            {myUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">{myUnreadCount > 9 ? '9+' : myUnreadCount}</span>
            )}
          </button>
          <h1 className="text-3xl font-bold text-amber-600 mb-1">🐦 LikeBird</h1>
          <p className="text-gray-500 text-sm">Учёт продаж v{APP_VERSION}</p>
          {!isOnline && <p className="text-xs text-orange-500 mt-1 flex items-center justify-center gap-1"><WifiOff className="w-3 h-3" /> Оффлайн режим</p>}
          {todayReports.length > 0 && (
              <div className="mt-3 bg-white rounded-xl p-3 shadow">
                <p className="text-xs text-gray-500 mb-1">Мои продажи сегодня: {todayReports.length}</p>
                <p className="text-2xl font-bold text-green-600">{todayTotal.toLocaleString()} ₽{todayTips > 0 && <span className="text-amber-500 text-base"> +{todayTips}₽ ⭐</span>}</p>
                <div className="flex gap-3 mt-1 text-sm font-semibold">
                  {todayCash > 0 && <span className="text-gray-700">💵 {todayCash.toLocaleString()}₽</span>}
                  {todayCashless > 0 && <span className="text-gray-700">💳 {todayCashless.toLocaleString()}₽</span>}
                </div>
                {hasUnrecognized && <p className="text-red-500 text-xs mt-1"><AlertTriangle className="w-3 h-3 inline" /> Есть нераспознанные</p>}
              </div>
            )}
          {isAdmin && lowStock.length > 0 && (<div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2"><p className="text-orange-600 text-xs font-semibold"><Bell className="w-3 h-3 inline" /> Дозаказать: {lowStock.length} позиций</p></div>)}
        </div>
        <div className="space-y-3">
          <button onClick={() => setCurrentView('catalog')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-amber-100 p-3 rounded-lg"><ShoppingBag className="w-6 h-6 text-amber-600" /></div><div className="text-left"><h3 className="font-bold">Каталог</h3><p className="text-xs text-gray-400">Просмотр товаров и цен</p></div></button>
          <button onClick={() => setCurrentView('shift')} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Clock className="w-6 h-6" /></div><div className="text-left flex-1"><h3 className="font-bold">Смена</h3><p className="text-xs text-white/80">Продажи, импорт, отчёт</p></div>{(() => { try { const login = JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; const key = login + '_' + formatDate(new Date()); const sh = shiftsData[key]; return sh?.status === 'open' ? <span className="bg-green-400 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">● Открыта</span> : null; } catch { return null; } })()}</button>
          {hasAccess('reports') && <button onClick={() => setCurrentView('reports')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-amber-100 p-3 rounded-lg"><FileText className="w-6 h-6 text-amber-600" /></div><div className="text-left"><h3 className="font-bold">История</h3><p className="text-xs text-gray-400">Все продажи по дням</p></div></button>}
          {hasAccess('day-report') && <button onClick={() => { setSelectedDate(formatDate(new Date())); setCurrentView('day-report'); }} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-orange-100 p-3 rounded-lg"><BarChart3 className="w-6 h-6 text-orange-600" /></div><div className="text-left flex-1"><h3 className="font-bold">Итог дня</h3><p className="text-xs text-gray-400">Сводка по сотрудникам</p></div>{(() => { const cnt = reports.filter(r => r.reviewStatus === 'submitted').length; return cnt > 0 ? <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">{cnt > 99 ? '99+' : cnt}</span> : null; })()}</button>}
          <button onClick={() => setCurrentView('analytics')} className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><TrendingUp className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Аналитика</h3><p className="text-xs text-white/80">Графики и тренды</p></div></button>
          {hasAccess('team') && <button onClick={() => setCurrentView('team')} className="w-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Users className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Команда</h3><p className="text-xs text-white/80">График, результаты, события</p></div>{upcomingEventsCount > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{upcomingEventsCount}</span>}</button>}
          {hasAccess('admin') && <button onClick={() => setCurrentView('admin')} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Shield className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Админ-панель</h3><p className="text-xs text-white/80">Управление и аналитика</p></div>{lowStock.length > 0 && <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{lowStock.length}</span>}</button>}
          <button onClick={() => setCurrentView('settings')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-gray-100 p-3 rounded-lg"><Settings className="w-6 h-6 text-gray-600" /></div><div className="text-left"><h3 className="font-bold">Настройки</h3><p className="text-xs text-gray-400">Экспорт, бэкап, аккаунт</p></div></button>
          <button onClick={() => setCurrentView('profile')} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><span className="text-xl">{(profilesData[(() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })()]?.avatar) ? '🖼️' : '👤'}</span></div><div className="text-left flex-1"><h3 className="font-bold">Мой профиль</h3><p className="text-xs text-white/80">Зарплата, достижения, аккаунт</p></div><div className="text-right"><p className="text-white/80 text-sm font-semibold">{employeeName}</p></div></button>
          <button onClick={() => setCurrentView('game')} className="w-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><span className="text-xl">🌊</span></div><div className="text-left flex-1"><h3 className="font-bold">Ветер на набережной</h3><p className="text-xs text-white/80">Мини-игра: лови товар!</p></div><div className="text-right"><p className="text-white/80 text-xs font-semibold">🏆 {(() => { try { return localStorage.getItem('likebird-game-highscore') || '0'; } catch { return '0'; } })()}</p></div></button>
        </div>
      </div>
    </div>
}
