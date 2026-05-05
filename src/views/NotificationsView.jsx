import React from 'react';
import { ArrowLeft, Bell } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function NotificationsView() {
  const { save, setCurrentView, setUserNotifications, userNotifications } = useApp();

  const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
  const myNotifs = userNotifications.filter(n => n.targetLogin === myLogin).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const unread = myNotifs.filter(n => !n.read);
  const read = myNotifs.filter(n => n.read);

  const markAsRead = (notifId) => {
    const updated = userNotifications.map(n => n.id === notifId ? { ...n, read: true } : n);
    setUserNotifications(updated);
    save('likebird-notifications', updated);
  };

  const markAllAsRead = () => {
    const updated = userNotifications.map(n => n.targetLogin === myLogin ? { ...n, read: true } : n);
    setUserNotifications(updated);
    save('likebird-notifications', updated);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return `${Math.floor(diff/60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)} ч. назад`;
    return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const NotifCard = ({ n, isUnread }) => (
    <div className={`rounded-xl p-3 shadow-sm border-l-4 ${isUnread ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{n.type === 'achievement' ? '🏆' : n.type === 'stock' ? '📦' : n.type === 'chat' ? '💬' : '🔔'}</span>
            <span className="font-bold text-sm truncate">{n.title || 'Уведомление'}</span>
          </div>
          <p className="text-sm text-gray-700">{n.body}</p>
          <p className="text-xs text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
        </div>
        {isUnread && (
          <button onClick={() => markAsRead(n.id)} className="shrink-0 bg-amber-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-600">
            ✓ Прочитано
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 pt-safe sticky top-0 z-10" style={{paddingTop: "max(1rem, env(safe-area-inset-top))"}}>
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentView('menu')} className="mr-3" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold flex-1">🔔 Уведомления</h2>
          {unread.length > 0 && (
            <button onClick={markAllAsRead} className="text-xs bg-white/20 px-3 py-1.5 rounded-lg font-semibold">
              Прочитать все
            </button>
          )}
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 space-y-3">
        {unread.length > 0 && (
          <div>
            <p className="text-xs font-bold text-amber-600 mb-2 uppercase tracking-wider">Новые ({unread.length})</p>
            <div className="space-y-2">
              {unread.map(n => <NotifCard key={n.id} n={n} isUnread={true} />)}
            </div>
          </div>
        )}
        {read.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider mt-4">Прочитанные</p>
            <div className="space-y-2">
              {read.slice(0, 30).map(n => <NotifCard key={n.id} n={n} isUnread={false} />)}
            </div>
          </div>
        )}
        {myNotifs.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400 text-lg">Нет уведомлений</p>
            <p className="text-gray-300 text-sm mt-1">Здесь будут достижения и важные события</p>
          </div>
        )}
      </div>
    </div>
}
