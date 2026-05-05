import React, { useState } from 'react';
import { ArrowLeft, AlertCircle, Edit3, Clock, CheckCircle, Star, Camera, LogOut, Key, Eye, EyeOff } from 'lucide-react';
import { fbSave } from '../firebase.js';
import { hashPassword } from '../utils/auth.js';
import { parseYear } from '../utils/dates.js';
import { useApp } from '../context/AppContext';

export default function ProfileView() {
  const { DYNAMIC_ALL_PRODUCTS, achievementsGranted, bonuses, compressImage, customAchievements, darkMode, employeeKPI, employeeName, employeeRatings, employees, getEffectiveSalary, getEmployeeAverageRating, getEmployeeProgress, penalties, profilesData, reports, setAuthName, setCurrentView, setEmployeeName, setIsAuthenticated, shiftsData, showConfirm, showNotification, updateProfilesData } = useApp();

  const [tab, setTab] = useState('salary'); // salary | goals | achievements | bonuses | account
  const [period, setPeriod] = useState('week'); // week | month
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSaved, setPassSaved] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [displayNameEdit, setDisplayNameEdit] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Текущий залогиненный пользователь
  const authData = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}'); } catch { return {}; } })();
  const currentLogin = authData.login || employeeName;
  const myProfile = profilesData[currentLogin] || {};
  const avatar = myProfile.avatar || null;
  const displayName = myProfile.displayName || employeeName;

  // Найти сотрудника по имени
  const myEmployee = employees.find(e => e.name === employeeName || e.name === displayName);

  // Период для фильтрации отчётов
  const now = new Date();
  const periodStart = new Date();
  if (period === 'week') periodStart.setDate(now.getDate() - 7);
  // FIX: «месяц» = 30 дней назад (единообразно с getEmployeeProgress)
  else periodStart.setDate(now.getDate() - 30);

  const parseReportDate = (dateStr) => {
    try {
      const [datePart] = dateStr.split(',');
      const [d, m, y] = datePart.trim().split('.');
      return new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
    } catch { return new Date(0); }
  };

  // Мои отчёты за период
  const myReports = reports.filter(r => {
    const isMe = r.employee === employeeName || r.employee === displayName;
    const date = parseReportDate(r.date);
    return isMe && date >= periodStart && date <= now;
  });

  // Зарплата
  const mySalary = myReports.reduce((sum, r) => sum + (getEffectiveSalary(r) || 0), 0);
  const myRevenue = myReports.reduce((sum, r) => sum + (r.total || 0), 0);
  const myTips = myReports.reduce((sum, r) => sum + (r.tips || 0), 0);

  // Все мои отчёты (всё время) для достижений
  const allMyReports = reports.filter(r => r.employee === employeeName || r.employee === displayName);
  const totalRevenue = allMyReports.reduce((sum, r) => sum + (r.total || 0), 0);

  // Штрафы и бонусы за период
  const myEmpId = myEmployee?.id;
  // FIX: Безопасный парсинг дат бонусов/штрафов (поддержка ISO и DD.MM.YYYY)
  const parseBonusDate = (dateStr) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    // Пробуем DD.MM.YYYY
    const parts = dateStr.split('.');
    if (parts.length === 3) return new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(0);
  };

  const myPenalties = myEmpId ? penalties.filter(p => {
    const d = parseBonusDate(p.date);
    return p.employeeId === myEmpId && d >= periodStart && d <= now;
  }) : [];
  const myBonuses = myEmpId ? bonuses.filter(b => {
    const d = parseBonusDate(b.date);
    return b.employeeId === myEmpId && d >= periodStart && d <= now;
  }) : [];
  const totalPenalties = myPenalties.reduce((s, p) => s + p.amount, 0);
  const totalBonuses = myBonuses.reduce((s, b) => s + b.amount, 0);
  const netSalary = mySalary + totalBonuses - totalPenalties;

  // Мой рейтинг
  const myRating = myEmpId ? getEmployeeAverageRating(myEmpId) : 0;
  const myRatingCount = myEmpId ? Object.values(employeeRatings).filter(r => r.employeeId === myEmpId).length : 0;

  // Цели KPI
  const myGoals = myEmpId ? Object.values(employeeKPI).filter(g => g.employeeId === myEmpId) : [];

  // Достижения
  // Встроенные достижения
  const builtinAchievements = [
    { id: 'first_sale', icon: '🐣', title: 'Первая продажа', desc: 'Совершить первую продажу', done: allMyReports.length >= 1 },
    { id: 'sales_10', icon: '🌱', title: 'Начинающий', desc: '10 продаж', done: allMyReports.length >= 10 },
    { id: 'sales_50', icon: '🐦', title: 'Продавец птиц', desc: '50 продаж', done: allMyReports.length >= 50 },
    { id: 'sales_100', icon: '🦅', title: 'Охотник', desc: '100 продаж', done: allMyReports.length >= 100 },
    { id: 'sales_500', icon: '🏆', title: 'Легенда', desc: '500 продаж', done: allMyReports.length >= 500 },
    { id: 'revenue_10k', icon: '💵', title: '10 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 10000 },
    { id: 'revenue_50k', icon: '💰', title: '50 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 50000 },
    { id: 'revenue_200k', icon: '💎', title: '200 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 200000 },
    { id: 'tips', icon: '⭐', title: 'Любимчик', desc: 'Получить чаевые', done: allMyReports.some(r => r.tips > 0) },
    { id: 'streak_week', icon: '🔥', title: 'Активная неделя', desc: '5+ продаж за 7 дней', done: (() => {
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      return allMyReports.filter(r => parseReportDate(r.date) >= weekAgo).length >= 5;
    })() },
    { id: 'big_sale', icon: '🎯', title: 'Большая продажа', desc: 'Продажа от 1500 ₽', done: allMyReports.some(r => r.salePrice >= 1500) },
    { id: 'no_penalty', icon: '😇', title: 'Чистая репутация', desc: 'Ни одного штрафа', done: myEmpId ? penalties.filter(p => p.employeeId === myEmpId).length === 0 : true },
  ];

  // Кастомные достижения от администратора
  const customAchievementsEvaluated = customAchievements.map(ach => {
    let done = false;
    const val = Number(ach.condValue) || 0;
    if (ach.condType === 'manual') {
      done = (achievementsGranted[ach.id] || []).includes(currentLogin);
    } else if (ach.condType === 'sales_count') {
      done = allMyReports.length >= val;
    } else if (ach.condType === 'revenue') {
      done = totalRevenue >= val;
    } else if (ach.condType === 'big_sale') {
      done = allMyReports.some(r => r.salePrice >= val);
    } else if (ach.condType === 'tips_count') {
      done = allMyReports.filter(r => r.tips > 0).length >= val;
    }
    return { ...ach, done, isCustom: true };
  });

  const achievements = [...builtinAchievements, ...customAchievementsEvaluated];
  const doneCount = achievements.filter(a => a.done).length;

  const handleSavePassword = async () => {
    setPassError('');
    setPassSaved(false);
    if (!newPassword) { setPassError('Введите новый пароль'); return; }
    if (newPassword.length < 4) { setPassError('Минимум 4 символа'); return; }
    if (newPassword !== confirmNewPassword) { setPassError('Пароли не совпадают'); return; }
    let users = [];
    try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
    const idx = users.findIndex(u => u.login === currentLogin);
    if (idx === -1) { setPassError('Пользователь не найден'); return; }
    const hashed = await hashPassword(newPassword);
    users[idx].passwordHash = hashed;
    localStorage.setItem('likebird-users', JSON.stringify(users));
    // FIX: Синхронизируем с Firebase (ранее пароль не сохранялся — терялся при sync/на другом устройстве)
    fbSave('likebird-users', users);
    setNewPassword(''); setConfirmNewPassword('');
    setPassSaved(true);
    setTimeout(() => setPassSaved(false), 3000);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { showNotification('Максимум 1.5 МБ', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const newData = { ...profilesData, [currentLogin]: { ...myProfile, avatar: ev.target.result } };
      updateProfilesData(newData);
      showNotification('Аватар обновлён');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    const newData = { ...profilesData, [currentLogin]: { ...myProfile, avatar: null } };
    updateProfilesData(newData);
    showNotification('Аватар удалён');
  };

  const handleSaveDisplayName = () => {
    if (!newDisplayName.trim()) return;
    const newData = { ...profilesData, [currentLogin]: { ...myProfile, displayName: newDisplayName.trim() } };
    updateProfilesData(newData);
    setDisplayNameEdit(false);
    showNotification('Имя обновлено');
  };

  const TABS = [
    { id: 'salary', label: '💰 Зарплата' },
    { id: 'bonuses', label: '📊 Бонусы' },
    { id: 'goals', label: '🎯 Цели' },
    { id: 'achievements', label: '🏆 Достижения' },
    { id: 'account', label: '⚙️ Аккаунт' },
  ];

  const roleLabel = myEmployee?.role === 'admin' ? '👑 Администратор' : myEmployee?.role === 'senior' ? '⭐ Старший продавец' : '🐦 Продавец';

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 pb-8">
      {/* Шапка профиля */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
        <div className="p-4 flex items-center gap-3">
          <button onClick={() => setCurrentView('menu')} className="p-1 rounded-lg hover:bg-white/20">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Мой профиль</h2>
        </div>
        <div className="px-4 pb-6 flex items-center gap-4">
          {/* Аватар */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-white/20 overflow-hidden flex items-center justify-center shadow-lg">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <span className="text-4xl">{(displayName || '?')[0].toUpperCase()}</span>
              }
            </div>
          </div>
          {/* Имя и роль */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black truncate">{displayName}</h3>
            </div>
            <p className="text-white/70 text-sm">{roleLabel}</p>
            {myRating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(myRating) ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`} />
                ))}
                <span className="text-white/70 text-xs ml-1">{myRating.toFixed(1)} ({myRatingCount})</span>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{doneCount}/{achievements.length} достижений</span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{allMyReports.length} продаж</span>
            </div>
          </div>
        </div>
      </div>

      {/* Табы */}
      <div className="flex overflow-x-auto bg-white shadow-sm sticky top-0 z-10 gap-0 no-scrollbar">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-3 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
              tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-md mx-auto px-4 pt-4">

        {/* ===== ЗАРПЛАТА ===== */}
        {tab === 'salary' && (
          <div className="space-y-4">

            {/* BLOCK 6: Working Hours */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" />Рабочее время за месяц</h3>
              {(() => {
                const myLoginPV = authData.login || '';
                const now2 = new Date();
                const monthStart2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
                let totalHours = 0; let daysWorked = 0; let overtimeDays = 0;
                Object.entries(shiftsData).forEach(([key, shift]) => {
                  if (!key.startsWith(myLoginPV + '_')) return;
                  if (!shift.openTime || !shift.closeTime) return;
                  try {
                    // Use openedAt/closedAt timestamps if available, otherwise parse from key date + time string
                    let hours = 0;
                    if (shift.openedAt && shift.closedAt) {
                      const openTs = new Date(shift.openedAt);
                      if (openTs < monthStart2) return;
                      hours = (shift.closedAt - shift.openedAt) / (1000 * 60 * 60);
                    } else {
                      // Parse date from key (login_DD.MM.YY) and time from openTime/closeTime (HH:MM)
                      const datePart = key.split('_').slice(1).join('_'); // DD.MM.YY
                      const [dd, mm, yy] = datePart.split('.');
                      if (!dd || !mm) return;
                      const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
                      const shiftDate = new Date(year, parseInt(mm) - 1, parseInt(dd));
                      if (shiftDate < monthStart2) return;
                      const [oh, om] = shift.openTime.split(':').map(Number);
                      const [ch, cm] = shift.closeTime.split(':').map(Number);
                      hours = (ch * 60 + cm - oh * 60 - om) / 60;
                    }
                    if (hours > 0 && hours < 24) { totalHours += hours; daysWorked++; if (hours > 8) overtimeDays++; }
                  } catch { /* silent */ }
                });
                totalHours = Math.round(totalHours * 10) / 10;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Дней отработано:</span><span className="font-bold">{daysWorked}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Часов всего:</span><span className="font-bold">{totalHours} ч</span></div>
                    {overtimeDays > 0 && <div className="flex justify-between"><span className="text-gray-500">Переработки (&gt;8ч):</span><span className="font-bold text-red-500">{overtimeDays} дн</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Ср. часов/день:</span><span className="font-bold">{daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : 0} ч</span></div>
                  </div>
                );
              })()}
            </div>

            {/* BLOCK 7: Streaks */}
            <div className="bg-white rounded-2xl p-4 shadow">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">🔥 Серия хороших дней</h3>
              {(() => {
                const byDay = {};
                allMyReports.forEach(r => {
                  const d = r.date?.split(',')[0] || '';
                  byDay[d] = (byDay[d] || 0) + (r.total || 0);
                });
                const dailyVals = Object.values(byDay);
                const avg = dailyVals.length > 0 ? dailyVals.reduce((s, v) => s + v, 0) / dailyVals.length : 0;
                const dates = Object.keys(byDay).sort((a, b) => {
                  const [ad, am, ay] = a.split('.'); const [bd, bm, by_] = b.split('.');
                  return new Date(2000 + parseInt(by_ || 0), parseInt(bm || 1) - 1, parseInt(bd || 1)) - new Date(2000 + parseInt(ay || 0), parseInt(am || 1) - 1, parseInt(ad || 1));
                });
                let streak = 0;
                for (let i = dates.length - 1; i >= 0; i--) { if (byDay[dates[i]] >= avg) streak++; else break; }
                const icon = streak >= 14 ? '🏆' : streak >= 7 ? '⭐' : streak >= 3 ? '🌟' : '🔥';
                return (
                  <div className="text-center py-2">
                    <p className="text-3xl mb-1">{icon}</p>
                    <p className="text-xl font-black">{streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</p>
                    <p className="text-xs text-gray-500">подряд выше среднего ({Math.round(avg).toLocaleString()} ₽)</p>
                  </div>
                );
              })()}
            </div>

            {/* Переключатель периода */}
            <div className="flex bg-white rounded-xl p-1 shadow">
              {[{id:'week',label:'Эта неделя'},{id:'month',label:'Этот месяц'}].map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${period === p.id ? 'bg-indigo-500 text-white shadow' : 'text-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Итоговая карточка */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
              <p className="text-white/70 text-sm mb-1">К получению</p>
              <p className="text-4xl font-black">{netSalary.toLocaleString()} ₽</p>
              <div className="flex gap-4 mt-3 text-sm">
                <div><p className="text-white/60">Продажи</p><p className="font-bold">{mySalary.toLocaleString()} ₽</p></div>
                {totalBonuses > 0 && <div><p className="text-white/60">Бонусы</p><p className="font-bold text-green-300">+{totalBonuses.toLocaleString()} ₽</p></div>}
                {totalPenalties > 0 && <div><p className="text-white/60">Штрафы</p><p className="font-bold text-red-300">-{totalPenalties.toLocaleString()} ₽</p></div>}
                {myTips > 0 && <div><p className="text-white/60">Чаевые</p><p className="font-bold text-yellow-300">+{myTips.toLocaleString()} ₽</p></div>}
              </div>
            </div>

            {/* Статистика */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 shadow text-center">
                <p className="text-2xl font-black text-indigo-600">{myReports.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">продаж</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow text-center">
                <p className="text-2xl font-black text-green-600">{myRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-0.5">выручка ₽</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow text-center">
                <p className="text-2xl font-black text-amber-600">{myReports.length > 0 ? Math.round(myRevenue / myReports.length) : 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">средний чек</p>
              </div>
            </div>

            {/* Список продаж */}
            <div>
              <h3 className="font-bold text-gray-700 mb-2 text-sm">Детализация ({myReports.length})</h3>
              {myReports.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center shadow">
                  <p className="text-gray-400">Нет продаж за этот период</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...myReports].sort((a, b) => parseReportDate(b.date) - parseReportDate(a.date)).map(r => {
                    const sal = getEffectiveSalary(r);
                    return (
                      <div key={r.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                        <div className="text-2xl">{(() => {
                          const prod = DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product);
                          return prod?.emoji || '🐦';
                        })()}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{r.product}</p>
                          <p className="text-xs text-gray-400">{(r.date||'').split(',')[0]} · {r.total?.toLocaleString()} ₽ · {r.paymentType === 'cashless' ? '💳' : '💵'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-indigo-600">+{sal} ₽</p>
                          {r.tips > 0 && <p className="text-xs text-amber-500">⭐ +{r.tips}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== БОНУСЫ / ШТРАФЫ ===== */}
        {tab === 'bonuses' && (
          <div className="space-y-4">
            <div className="flex bg-white rounded-xl p-1 shadow">
              {[{id:'week',label:'Эта неделя'},{id:'month',label:'Этот месяц'}].map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${period === p.id ? 'bg-indigo-500 text-white shadow' : 'text-gray-500'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Итог */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-green-600">+{totalBonuses.toLocaleString()}</p>
                <p className="text-sm text-green-700 mt-1">₽ Бонусы</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-red-600">-{totalPenalties.toLocaleString()}</p>
                <p className="text-sm text-red-700 mt-1">₽ Штрафы</p>
              </div>
            </div>

            {/* Список бонусов */}
            {myBonuses.length > 0 && (
              <div>
                <h3 className="font-bold text-green-700 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Бонусы</h3>
                <div className="space-y-2">
                  {myBonuses.map(b => (
                    <div key={b.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🎁</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{b.reason}</p>
                        <p className="text-xs text-gray-400">{new Date(b.date).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <p className="font-bold text-green-600">+{b.amount.toLocaleString()} ₽</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Список штрафов */}
            {myPenalties.length > 0 && (
              <div>
                <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Штрафы</h3>
                <div className="space-y-2">
                  {myPenalties.map(p => (
                    <div key={p.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">⚠️</div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{p.reason}</p>
                        <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('ru-RU')}</p>
                      </div>
                      <p className="font-bold text-red-600">-{p.amount.toLocaleString()} ₽</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myBonuses.length === 0 && myPenalties.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center shadow">
                <p className="text-4xl mb-3">😊</p>
                <p className="text-gray-500">За этот период нет бонусов и штрафов</p>
              </div>
            )}
          </div>
        )}

        {/* ===== ЦЕЛИ ===== */}
        {tab === 'goals' && (
          <div className="space-y-4">
            {myGoals.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow">
                <p className="text-5xl mb-3">🎯</p>
                <p className="text-gray-600 font-semibold">Целей пока нет</p>
                <p className="text-gray-400 text-sm mt-2">Администратор может поставить вам цели в разделе «Команда»</p>
              </div>
            ) : (
              myGoals.map(goal => {
                const progress = myEmpId ? getEmployeeProgress(myEmpId, goal.goalType, goal.period) : null;
                const pct = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
                const goalLabels = { sales: '🛒 Количество продаж', sales_count: '🛒 Количество продаж', revenue: '💰 Выручка', avg_check: '📊 Средний чек' };
                return (
                  <div key={`${goal.employeeId}_${goal.goalType}_${goal.period}`} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold">{goalLabels[goal.goalType] || goal.goalType}</p>
                        <p className="text-xs text-gray-400">{goal.period === 'week' ? 'За неделю' : 'За месяц'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-indigo-600">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                    {progress && (
                      <p className="text-xs text-gray-400 mt-1 text-right">
                        {typeof progress.current === 'number' ? progress.current.toLocaleString() : progress.current} / {goal.target.toLocaleString()}
                        {goal.goalType === 'revenue' || goal.goalType === 'avg_check' ? ' ₽' : ''}
                      </p>
                    )}
                    {pct >= 100 && (
                      <p className="text-center text-green-600 font-bold text-sm mt-2">✅ Цель выполнена!</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== ДОСТИЖЕНИЯ ===== */}
        {tab === 'achievements' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center gap-4">
              <div className="text-5xl">🏅</div>
              <div>
                <p className="font-black text-2xl">{doneCount} / {achievements.length}</p>
                <p className="text-white/80 text-sm">достижений получено</p>
                <div className="h-2 bg-white/30 rounded-full mt-2 w-32 overflow-hidden">
                  <div className="h-full bg-white rounded-full" style={{width: `${Math.round(doneCount/achievements.length*100)}%`}} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {achievements.sort((a, b) => b.done - a.done).map(ach => (
                <div key={ach.id} className={`bg-white rounded-xl p-4 shadow flex items-center gap-3 transition-all ${!ach.done ? 'opacity-50 grayscale' : ''}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${ach.done ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    {ach.done ? ach.icon : '🔒'}
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${ach.done ? 'text-gray-800' : 'text-gray-400'}`}>{ach.title}</p>
                    <p className="text-xs text-gray-400">{ach.desc}</p>
                  </div>
                  {ach.done && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== АККАУНТ ===== */}
        {tab === 'account' && (
          <div className="space-y-4">

            {/* Аватар */}
            <div className="bg-white rounded-2xl p-5 shadow">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Camera className="w-4 h-4" /> Аватар</h3>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-indigo-100 overflow-hidden flex items-center justify-center text-4xl shadow">
                  {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span>{(displayName || '?')[0].toUpperCase()}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-all text-center">
                    📷 Загрузить фото
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </label>
                  {avatar && (
                    <button onClick={handleRemoveAvatar} className="text-red-500 text-sm font-semibold hover:text-red-700 text-center">
                      🗑️ Удалить
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Отображаемое имя */}
            <div className="bg-white rounded-2xl p-5 shadow">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Edit3 className="w-4 h-4" /> Отображаемое имя</h3>
              {displayNameEdit ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDisplayName}
                    onChange={e => setNewDisplayName(e.target.value)}
                    placeholder={displayName}
                    className="flex-1 p-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 text-sm"
                    autoFocus
                  />
                  <button onClick={handleSaveDisplayName} className="bg-indigo-500 text-white px-4 rounded-xl font-bold hover:bg-indigo-600">✓</button>
                  <button onClick={() => setDisplayNameEdit(false)} className="bg-gray-100 text-gray-600 px-4 rounded-xl hover:bg-gray-200">✕</button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-semibold text-gray-700">{displayName}</span>
                  <button onClick={() => { setDisplayNameEdit(true); setNewDisplayName(displayName); }}
                    className="text-indigo-500 text-sm font-semibold hover:text-indigo-700">Изменить</button>
                </div>
              )}
            </div>

            {/* Смена пароля */}
            <div className="bg-white rounded-2xl p-5 shadow">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Key className="w-4 h-4" /> Сменить пароль</h3>
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPassError(''); }}
                    placeholder="Новый пароль"
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none text-sm pr-12"
                  />
                  <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-3 text-gray-400">
                    {showNewPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => { setConfirmNewPassword(e.target.value); setPassError(''); }}
                  placeholder="Повторите пароль"
                  className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none text-sm"
                />
                {passError && <p className="text-red-500 text-sm">{passError}</p>}
                {passSaved && <p className="text-green-600 text-sm font-semibold">✅ Пароль успешно изменён!</p>}
                <button onClick={handleSavePassword}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                  Сохранить пароль
                </button>
              </div>
            </div>

            {/* Информация */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <p className="text-xs text-gray-400 text-center">Логин: <span className="font-semibold text-gray-600">{currentLogin}</span></p>
              <p className="text-xs text-gray-400 text-center mt-1">Аккаунт создан: {authData.createdAt ? new Date(authData.createdAt).toLocaleDateString('ru-RU') : '—'}</p>
            </div>

            {/* Выход */}
            <button
              onClick={() => {
                showConfirm('Выйти из аккаунта?', () => {
                  localStorage.removeItem('likebird-auth');
                  localStorage.removeItem('likebird-employee');
                  setIsAuthenticated(false);
                  setEmployeeName('');
                  setAuthName('');
                });
              }}
              className="w-full py-3 bg-white border-2 border-red-200 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all shadow">
              <LogOut className="w-5 h-5" /> Выйти из аккаунта
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
