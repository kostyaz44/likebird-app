import React, { useState, useMemo } from 'react';
import { X, Star, TrendingUp, Award, Wallet, Lock, Unlock, ShieldCheck, AlertCircle, Plus, Edit3 } from 'lucide-react';
import { fbSave } from '../../firebase.js';
import { parseYear, formatDate } from '../../utils/dates.js';
import { useApp } from '../../context/AppContext';

/**
 * EmployeeProfileModal — полная карточка профиля сотрудника для админа.
 *
 * Открывается из TeamView → Онлайн кликом по карточке сотрудника.
 * Показывает:
 *   • базовую инфу (имя, логин, роль, статус)
 *   • статистику (продажи / выручка / средний чек / рейтинг) за неделю и месяц
 *   • ЗП за период с учётом бонусов/штрафов
 *   • активные бонусы/штрафы/отпуска
 *   • цели KPI (если есть)
 *   • кнопки админских действий (роль, блок, бонус, штраф, удалить)
 *
 * Не дублирует логику EmployeeManager — для глубокой правки аккаунта
 * предлагает кнопку перехода в полный редактор.
 */
export default function EmployeeProfileModal({ login, onClose }) {
  const {
    bonuses, currentUser, employees, employeeKPI, employeeRatings, getEffectiveSalary,
    getEmployeeAverageRating, penalties, presenceData, profilesData,
    reports, timeOff, addBonus, addPenalty, save,
    setEmployees, showConfirm, showNotification,
  } = useApp();

  const [period, setPeriod] = useState('week'); // week | month
  const [bonusForm, setBonusForm] = useState({ amount: '', reason: '' });
  const [penaltyForm, setPenaltyForm] = useState({ amount: '', reason: '' });
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [showPenaltyForm, setShowPenaltyForm] = useState(false);

  // Текущий админ
  const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'deputy' || currentUser?.role === 'director';

  // Получаем юзера из localStorage (regUsers не в context — он живёт в EmployeeManager)
  const user = useMemo(() => {
    try {
      const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      return all.find(u => u.login === login) || null;
    } catch { return null; }
  }, [login]);

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-2" />
          <p className="font-semibold">Пользователь не найден</p>
          <p className="text-sm text-gray-500 mt-1">@{login}</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg font-semibold">Закрыть</button>
        </div>
      </div>
    );
  }

  const profile = profilesData[user.login] || {};
  const displayName = profile.displayName || user.name || user.login;
  const presence = presenceData[user.login];
  const isOnline = presence && (Date.now() - (presence.lastSeen || 0)) < 120000;
  const empRecord = employees.find(e => e.name === user.name || e.name === displayName);

  // ─── Период для аналитики ────────────────────────────────────────
  const now = new Date();
  const periodStart = new Date();
  periodStart.setDate(now.getDate() - (period === 'week' ? 7 : 30));

  const parseReportDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    try {
      const [datePart] = String(dateStr).split(',');
      if (!datePart) return new Date(0);
      const [d, m, y] = datePart.trim().split('.');
      if (!d || !m || !y) return new Date(0);
      return new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
    } catch { return new Date(0); }
  };

  const periodReports = reports.filter(r => {
    const isHis = r.employee === user.name || r.employee === user.login || r.employee === displayName;
    if (!isHis) return false;
    const d = parseReportDate(r.date);
    return d >= periodStart && d <= now;
  });

  // Все продажи за всё время (для total-метрик)
  const allReports = reports.filter(r =>
    r.employee === user.name || r.employee === user.login || r.employee === displayName
  );

  const periodRevenue = periodReports.reduce((s, r) => s + (r.total || 0), 0);
  const periodSalary = periodReports.reduce((s, r) => s + (getEffectiveSalary(r) || 0), 0);
  const periodTips = periodReports.reduce((s, r) => s + (r.tips || 0), 0);
  const periodSales = periodReports.length;
  const avgCheck = periodSales > 0 ? Math.round(periodRevenue / periodSales) : 0;

  // ─── Бонусы / штрафы за период ───────────────────────────────────
  const empId = empRecord?.id;
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = String(dateStr).split('.');
    if (parts.length === 3) return new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(0);
  };
  const myPenalties = empId ? penalties.filter(p => {
    const d = parseDate(p.date);
    return p.employeeId === empId && d >= periodStart && d <= now;
  }) : [];
  const myBonuses = empId ? bonuses.filter(b => {
    const d = parseDate(b.date);
    return b.employeeId === empId && d >= periodStart && d <= now;
  }) : [];
  const totalPenalties = myPenalties.reduce((s, p) => s + (p.amount || 0), 0);
  const totalBonuses = myBonuses.reduce((s, b) => s + (b.amount || 0), 0);
  const netSalary = periodSalary + totalBonuses - totalPenalties;

  // ─── Рейтинг ─────────────────────────────────────────────────────
  const rating = empId ? getEmployeeAverageRating(empId) : 0;
  const ratingCount = empId ? Object.values(employeeRatings).filter(r => r.employeeId === empId).length : 0;

  // ─── KPI цели ────────────────────────────────────────────────────
  const myGoals = empId ? Object.values(employeeKPI).filter(g => g.employeeId === empId) : [];

  // ─── Активные отпуска/больничные ────────────────────────────────
  const today = formatDate(new Date());
  const activeTimeOff = empId ? (timeOff || []).filter(t =>
    t.employeeId === empId &&
    parseDate(t.startDate) <= new Date() &&
    parseDate(t.endDate) >= new Date()
  ) : [];

  // ─── Локация/город ──────────────────────────────────────────────
  const userCity = user.city || empRecord?.city || '—';

  // ─── Роль ───────────────────────────────────────────────────────
  const roleLabel = (r) => ({
    admin: '🛡️ Администратор',
    director: '👔 Директор',
    deputy: '⭐ Замдиректора',
    manager: '📋 Управляющий',
    senior: '⭐ Старший продавец',
    seller: '🐦 Продавец',
  }[r] || '🐦 Продавец');

  // ─── Действия админа ─────────────────────────────────────────────
  const saveUsersFb = async (updated) => {
    try { localStorage.setItem('likebird-users', JSON.stringify(updated)); } catch { /* silent */ }
    try { await fbSave('likebird-users', updated); } catch (e) { console.warn('fbSave users error:', e); }
  };

  const handleChangeRole = async (newRole) => {
    if (newRole === user.role) return;
    if (user.login === currentUser?.login) { showNotification('Нельзя изменить свою роль', 'error'); return; }
    try {
      const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      const updated = all.map(u => {
        if (u.login !== user.login) return u;
        const next = { ...u, role: newRole };
        // isAdmin синхронизируем с ролью
        next.isAdmin = newRole === 'admin' || newRole === 'deputy' || newRole === 'director' || newRole === 'manager';
        return next;
      });
      await saveUsersFb(updated);
      showNotification(`Роль обновлена: ${roleLabel(newRole)}`);
    } catch (e) {
      console.error('Change role error', e);
      showNotification('Ошибка изменения роли', 'error');
    }
  };

  const handleToggleBan = () => {
    if (user.login === currentUser?.login) { showNotification('Нельзя заблокировать себя', 'error'); return; }
    const isBanned = !!user.banned;
    if (isBanned) {
      showConfirm(`Разблокировать «${displayName}»?`, async () => {
        try {
          const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
          const updated = all.map(u => u.login === user.login ? { ...u, banned: false, banReason: '' } : u);
          await saveUsersFb(updated);
          showNotification(`«${displayName}» разблокирован`);
        } catch { showNotification('Ошибка разблокировки', 'error'); }
      });
    } else {
      const reason = window.prompt(`Причина блокировки «${displayName}» (необязательно):`, '');
      if (reason === null) return;
      showConfirm(
        `Заблокировать «${displayName}»?\n\n` +
        `• Пользователь будет разлогинен и не сможет войти.\n` +
        `• Все данные сохраняются (можно разблокировать позже).`,
        async () => {
          try {
            const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
            const updated = all.map(u => u.login === user.login ? { ...u, banned: true, banReason: reason || '' } : u);
            await saveUsersFb(updated);
            showNotification(`«${displayName}» заблокирован`);
          } catch { showNotification('Ошибка блокировки', 'error'); }
        }
      );
    }
  };

  const handleToggleNoSalary = async () => {
    if (user.login === currentUser?.login) { showNotification('Нельзя изменить настройки своего ЗП', 'error'); return; }
    try {
      const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      const newVal = !user.noSalary;
      const updated = all.map(u => u.login === user.login ? { ...u, noSalary: newVal } : u);
      await saveUsersFb(updated);
      showNotification(newVal ? 'ЗП больше не начисляется' : 'ЗП начисляется как обычно');
    } catch { showNotification('Ошибка изменения настройки', 'error'); }
  };

  const handleDelete = () => {
    if (user.login === currentUser?.login) { showNotification('Нельзя удалить себя', 'error'); return; }
    showConfirm(
      `Удалить аккаунт «${displayName}» (@${user.login})?\n\n` +
      `• Пользователь будет разлогинен на всех устройствах.\n` +
      `• Записи в отчётах останутся (имя автора сохранится).\n\n` +
      `Это действие необратимо.`,
      async () => {
        try {
          const all = JSON.parse(localStorage.getItem('likebird-users') || '[]');
          const updated = all.filter(u => u.login !== user.login);
          await saveUsersFb(updated);
          showNotification(`Аккаунт «${displayName}» удалён`);
          onClose();
        } catch { showNotification('Ошибка удаления', 'error'); }
      }
    );
  };

  const handleAddBonus = () => {
    if (!empRecord) { showNotification('Сотрудник не привязан к employees', 'error'); return; }
    const amt = parseInt(bonusForm.amount);
    if (!amt || amt <= 0) { showNotification('Введите сумму больше 0', 'error'); return; }
    if (!bonusForm.reason.trim()) { showNotification('Укажите причину', 'error'); return; }
    addBonus(empRecord.id, amt, bonusForm.reason.trim());
    setBonusForm({ amount: '', reason: '' });
    setShowBonusForm(false);
    showNotification(`Бонус +${amt}₽ начислен`);
  };

  const handleAddPenalty = () => {
    if (!empRecord) { showNotification('Сотрудник не привязан к employees', 'error'); return; }
    const amt = parseInt(penaltyForm.amount);
    if (!amt || amt <= 0) { showNotification('Введите сумму больше 0', 'error'); return; }
    if (!penaltyForm.reason.trim()) { showNotification('Укажите причину', 'error'); return; }
    addPenalty(empRecord.id, amt, penaltyForm.reason.trim());
    setPenaltyForm({ amount: '', reason: '' });
    setShowPenaltyForm(false);
    showNotification(`Штраф -${amt}₽ начислен`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full my-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Шапка */}
        <div className="relative bg-gradient-to-br from-blue-500 to-indigo-600 text-white p-5 rounded-t-2xl">
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold overflow-hidden">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                  : displayName[0]?.toUpperCase()}
              </div>
              <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <p className="text-xs text-white/80">@{user.login}</p>
              <p className="text-xs mt-1">{roleLabel(user.role)}</p>
              {user.banned && (
                <p className="text-xs bg-red-500/30 px-2 py-0.5 rounded-full mt-1 inline-block">🚫 Заблокирован</p>
              )}
              {user.noSalary && (
                <p className="text-xs bg-amber-500/30 px-2 py-0.5 rounded-full mt-1 inline-block ml-1">💸 Без ЗП</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Базовая инфа */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Город:</span><span className="font-semibold">{userCity}</span></div>
            {user.role === 'deputy' && user.deputyCity && (
              <div className="flex justify-between"><span className="text-gray-500">Город замдиректора:</span><span className="font-semibold">{user.deputyCity}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Дата регистрации:</span><span className="font-semibold">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Всего продаж:</span><span className="font-semibold">{allReports.length}</span></div>
          </div>

          {/* Переключатель периода */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setPeriod('week')} className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${period === 'week' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Неделя</button>
            <button onClick={() => setPeriod('month')} className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${period === 'month' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Месяц</button>
          </div>

          {/* KPI сетка */}
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-xs text-green-700">Выручка</p>
              <p className="text-lg font-bold text-green-700">{periodRevenue.toLocaleString()}₽</p>
              <p className="text-xs text-gray-400">{periodSales} продаж</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-700">Зарплата</p>
              <p className="text-lg font-bold text-amber-700">{periodSalary.toLocaleString()}₽</p>
              {periodTips > 0 && <p className="text-xs text-gray-400">+ {periodTips}₽ чаев</p>}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700">Средний чек</p>
              <p className="text-lg font-bold text-blue-700">{avgCheck.toLocaleString()}₽</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
              <p className="text-xs text-purple-700">Рейтинг</p>
              <p className="text-lg font-bold text-purple-700 flex items-center justify-center gap-1">
                {rating > 0 ? <><Star className="w-4 h-4 fill-current" /> {rating.toFixed(1)}</> : '—'}
              </p>
              {ratingCount > 0 && <p className="text-xs text-gray-400">{ratingCount} оценок</p>}
            </div>
          </div>

          {/* Итого ЗП за период */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs opacity-90 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> К выплате за {period === 'week' ? 'неделю' : 'месяц'}</p>
              <p className="text-2xl font-bold">{netSalary.toLocaleString()}₽</p>
            </div>
            <div className="text-right text-xs opacity-90">
              {totalBonuses > 0 && <p>+ бонус: {totalBonuses}₽</p>}
              {totalPenalties > 0 && <p>− штраф: {totalPenalties}₽</p>}
            </div>
          </div>

          {/* Активные отпуска */}
          {activeTimeOff.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
              <p className="font-semibold text-orange-700 mb-1">🌴 Сейчас в отпуске/на больничном</p>
              {activeTimeOff.map(t => (
                <p key={t.id} className="text-xs text-orange-600">{t.type === 'sick' ? '🤒' : '🌴'} {t.startDate} — {t.endDate}{t.note ? `: ${t.note}` : ''}</p>
              ))}
            </div>
          )}

          {/* Цели KPI */}
          {myGoals.length > 0 && (
            <div className="bg-white border rounded-xl p-3">
              <p className="font-semibold text-sm mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-blue-500" /> Цели</p>
              <div className="space-y-2">
                {myGoals.map((g, i) => {
                  const sales = allReports.length;
                  const revenue = allReports.reduce((s, r) => s + (r.total || 0), 0);
                  const current = g.goalType === 'sales' ? sales : g.goalType === 'revenue' ? revenue : 0;
                  const target = Number(g.target) || 0;
                  const pct = target > 0 ? Math.min(100, Math.round(current / target * 100)) : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{g.goalType === 'sales' ? 'Продажи' : g.goalType === 'revenue' ? 'Выручка' : g.goalType} ({g.period})</span>
                        <span className={pct >= 100 ? 'text-green-600 font-bold' : 'text-gray-500'}>{current.toLocaleString()} / {target.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width: `${pct}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Бонусы и штрафы (списки) */}
          {(myBonuses.length > 0 || myPenalties.length > 0) && (
            <div className="bg-white border rounded-xl p-3 space-y-2 text-sm">
              <p className="font-semibold flex items-center gap-1"><Award className="w-4 h-4 text-amber-500" /> История за {period === 'week' ? 'неделю' : 'месяц'}</p>
              {myBonuses.map(b => (
                <div key={b.id} className="flex justify-between items-start bg-green-50 border border-green-100 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-700">+{b.amount}₽</p>
                    <p className="text-xs text-gray-500 truncate">{b.reason}</p>
                  </div>
                  <p className="text-xs text-gray-400">{b.date}</p>
                </div>
              ))}
              {myPenalties.map(p => (
                <div key={p.id} className="flex justify-between items-start bg-red-50 border border-red-100 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700">−{p.amount}₽</p>
                    <p className="text-xs text-gray-500 truncate">{p.reason}</p>
                  </div>
                  <p className="text-xs text-gray-400">{p.date}</p>
                </div>
              ))}
            </div>
          )}

          {/* Админские действия */}
          {isAdmin && user.login !== currentUser?.login && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
              <p className="font-semibold text-sm flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-amber-600" /> Админские действия</p>

              {/* Роль */}
              <div>
                <label className="text-xs text-gray-600 block mb-1">Роль</label>
                <select
                  value={user.role || 'seller'}
                  onChange={(e) => handleChangeRole(e.target.value)}
                  className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-white"
                >
                  <option value="seller">🐦 Продавец</option>
                  <option value="senior">⭐ Старший продавец</option>
                  <option value="admin">🛡️ Администратор</option>
                  <option value="deputy">⭐ Замдиректора</option>
                  <option value="manager">📋 Управляющий</option>
                  <option value="director">👔 Директор</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Для deputy/manager — настройте города в полном редакторе</p>
              </div>

              {/* Toggle no-salary */}
              <button onClick={handleToggleNoSalary} className={`w-full py-2 rounded-lg text-sm font-semibold ${user.noSalary ? 'bg-amber-200 text-amber-800' : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-100'}`}>
                {user.noSalary ? '✓ ЗП не начисляется (нажмите чтобы включить)' : 'Не начислять ЗП'}
              </button>

              {/* Бонус */}
              {!showBonusForm ? (
                <button onClick={() => setShowBonusForm(true)} className="w-full py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Бонус
                </button>
              ) : (
                <div className="bg-white border border-green-200 rounded-lg p-2 space-y-2">
                  <input type="number" value={bonusForm.amount} onChange={(e) => setBonusForm({...bonusForm, amount: e.target.value})} placeholder="Сумма ₽" className="w-full p-2 border rounded text-sm" />
                  <input type="text" value={bonusForm.reason} onChange={(e) => setBonusForm({...bonusForm, reason: e.target.value})} placeholder="Причина" className="w-full p-2 border rounded text-sm" />
                  <div className="flex gap-1">
                    <button onClick={handleAddBonus} className="flex-1 py-1.5 bg-green-500 text-white rounded text-xs font-bold">Начислить</button>
                    <button onClick={() => { setShowBonusForm(false); setBonusForm({ amount: '', reason: '' }); }} className="px-3 py-1.5 bg-gray-200 rounded text-xs">Отмена</button>
                  </div>
                </div>
              )}

              {/* Штраф */}
              {!showPenaltyForm ? (
                <button onClick={() => setShowPenaltyForm(true)} className="w-full py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Штраф
                </button>
              ) : (
                <div className="bg-white border border-red-200 rounded-lg p-2 space-y-2">
                  <input type="number" value={penaltyForm.amount} onChange={(e) => setPenaltyForm({...penaltyForm, amount: e.target.value})} placeholder="Сумма ₽" className="w-full p-2 border rounded text-sm" />
                  <input type="text" value={penaltyForm.reason} onChange={(e) => setPenaltyForm({...penaltyForm, reason: e.target.value})} placeholder="Причина" className="w-full p-2 border rounded text-sm" />
                  <div className="flex gap-1">
                    <button onClick={handleAddPenalty} className="flex-1 py-1.5 bg-red-500 text-white rounded text-xs font-bold">Назначить</button>
                    <button onClick={() => { setShowPenaltyForm(false); setPenaltyForm({ amount: '', reason: '' }); }} className="px-3 py-1.5 bg-gray-200 rounded text-xs">Отмена</button>
                  </div>
                </div>
              )}

              {/* Блокировка */}
              <button onClick={handleToggleBan} className={`w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 ${user.banned ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}>
                {user.banned ? <><Unlock className="w-4 h-4" /> Разблокировать</> : <><Lock className="w-4 h-4" /> Заблокировать</>}
              </button>

              {/* Удаление */}
              <button onClick={handleDelete} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                🗑️ Удалить аккаунт
              </button>

              <p className="text-xs text-gray-500 text-center">Для расширенных настроек (deputyCity, canViewReports, managedCities) — используйте <strong>EmployeeManager</strong> внизу страницы</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
