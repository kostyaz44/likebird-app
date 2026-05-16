import React, { useState, useEffect } from 'react';
import { FileText, BarChart3, ArrowLeft, Check, ChevronRight, Calendar, CheckCircle, Users, Camera } from 'lucide-react';
import { formatDate, parseRuDate, parseYear } from '../utils/dates.js';
import { useApp } from '../context/AppContext';
import EmployeeManager from '../components/team/EmployeeManager';
import ScheduleManager from '../components/team/ScheduleManager';
import SalaryPanel from '../components/team/SalaryPanel';
import EmployeesAdminTab from '../components/team/EmployeesAdminTab';
import EventsManager from '../components/team/EventsManager';

export default function TeamView() {
  const { chatEndRef, chatLimit, chatMessages, chatText, compressImage, currentUser, darkMode, employeeName, employees, eventsCalendar, isOnline, lbPeriod, manuals, presenceData, profilesData, reactionMsgId, reports, save, scheduleData, setChatLimit, setChatText, setCurrentView, setLbPeriod, setReactionMsgId, setShowMentions, setTeamTab, setUserNotifications, shiftsData, showMentions, showNotification, teamTab, updateChatMessages, userNotifications } = useApp();

  // Флаг админа — для отображения админ-вкладок и блоков управления
  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin' || currentUser?.role === 'deputy' || currentUser?.role === 'director';

  // Подписка на regUsers — нужна для отсева "призраков" (employees без user-аккаунта)
  const [regUsers, setRegUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    const refresh = () => {
      try { setRegUsers(JSON.parse(localStorage.getItem('likebird-users') || '[]')); } catch { /* silent */ }
    };
    window.addEventListener('storage', refresh);
    const interval = setInterval(refresh, 3000);
    return () => { window.removeEventListener('storage', refresh); clearInterval(interval); };
  }, []);

  // Активные сотрудники с аккаунтом (исключаем призраков)
  const activeEmployees = employees
    .filter(e => e.active)
    .filter(emp => regUsers.find(u => u.name === emp.name || u.login === emp.name))
    .map(e => e.name);
  const shiftsCount = Object.values(scheduleData.shifts || {}).reduce((sum, emp) => sum + (emp?.length || 0), 0);
  const [manualFilter, setManualFilter] = useState('all');
  const [manualSearch, setManualSearch] = useState('');

  // Онлайн-статус: онлайн если lastSeen < 5 минут назад
  const ONLINE_THRESHOLD = 5 * 60 * 1000;
  const now = Date.now();
  const getOnlineStatus = (login) => {
    const p = presenceData[login];
    if (!p) return 'offline';
    return (now - p.lastSeen) < ONLINE_THRESHOLD ? 'online' : 'offline';
  };
  // (regUsers объявлен выше через useState с подпиской на изменения)

  // Данные для результатов недели
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const weekReports = reports.filter(r => {
    const [datePart] = (r.date||'').split(',');
    const [d, m, y] = datePart.split('.');
    const reportDate = new Date(parseYear(y), m - 1, d);
    return reportDate >= weekAgo && !r.isUnrecognized;
  });

  const byEmployee = {};
  weekReports.forEach(r => {
    if (!byEmployee[r.employee]) {
      byEmployee[r.employee] = { name: r.employee, shifts: 0, totalHours: 0, sales: 0, workDays: new Set() };
    }
    byEmployee[r.employee].sales += 1;
    const [datePart] = (r.date||'').split(',');
    byEmployee[r.employee].workDays.add(datePart);
    if (r.workTime?.workHours) byEmployee[r.employee].totalHours += r.workTime.workHours;
  });

  const weekResults = Object.values(byEmployee).map(emp => {
    emp.shifts = emp.workDays.size;
    emp.speed = emp.totalHours > 0 ? (emp.sales / emp.totalHours) : 0;
    emp.totalHours = Math.round(emp.totalHours * 10) / 10;
    emp.speed = Math.round(emp.speed * 10) / 10;
    return emp;
  }).sort((a, b) => b.shifts - a.shifts);

  // Данные для событий — flatten array-based eventsCalendar
  const today = new Date();
  const sortedEvents = Object.entries(eventsCalendar)
    .flatMap(([date, evArr]) => (Array.isArray(evArr) ? evArr : [evArr]).map((ev, i) => ({ date, ev, index: i })))
    .sort((a, b) => {
      const parse = (d) => { const [dd, mm, yy] = d.split('.'); return new Date(parseYear(yy), parseInt(mm) - 1, parseInt(dd)); };
      return parse(a.date) - parse(b.date);
    });

  const upcomingEvents = sortedEvents.filter(({ date }) => {
    const [d, m, y] = date.split('.');
    return new Date(parseYear(y), parseInt(m) - 1, parseInt(d)) >= today;
  });

  const pastEvents = sortedEvents.filter(({ date }) => {
    const [d, m, y] = date.split('.');
    return new Date(parseYear(y), parseInt(m) - 1, parseInt(d)) < today;
  });

  const tabs = [
    { id: 'online', label: '🟢 Онлайн', color: 'green' },
    { id: 'schedule', label: '📅 График', color: 'blue' },
    ...(isAdmin ? [
      { id: 'salary', label: '💰 Зарплата', color: 'emerald', adminOnly: true },
      { id: 'employees', label: '👥 Сотрудники', color: 'rose', adminOnly: true },
    ] : []),
    { id: 'results', label: '📊 Результаты', color: 'yellow' },
    { id: 'events', label: '🎉 События', color: 'red' },
    { id: 'manuals', label: '📚 Мануалы', color: 'purple' },
    { id: 'leaderboard', label: '🏅 Рейтинг', color: 'amber' },
    { id: 'chat', label: '💬 Чат', color: 'cyan' },
  ];

  // Защита: если не-админ оказался на admin-only вкладке (например, после смены роли),
  // переключаем его на 'online'
  if (!isAdmin && (teamTab === 'salary' || teamTab === 'employees')) {
    setTimeout(() => setTeamTab('online'), 0);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 pb-6">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-6 h-6" />Команда</h2>
      </div>

      {/* Вкладки команды */}
      <div className="bg-white shadow-sm sticky top-16 z-10">
        <div className="flex px-2 py-2 gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setTeamTab(tab.id)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${teamTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        {/* ВКЛАДКА: Онлайн — список сотрудников с присутствием */}
        {teamTab === 'online' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  Сотрудники
                </h3>
                <span className="text-xs text-gray-400">
                  онлайн: {regUsers.filter(u => getOnlineStatus(u.login) === 'online').length} / {regUsers.length}
                </span>
              </div>
              {regUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">👥</p>
                  <p className="text-gray-400">Нет зарегистрированных пользователей</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...regUsers].sort((a, b) => {
                    const aOnline = getOnlineStatus(a.login) === 'online';
                    const bOnline = getOnlineStatus(b.login) === 'online';
                    return bOnline - aOnline;
                  }).map(u => {
                    const isOnline = getOnlineStatus(u.login) === 'online';
                    const p = presenceData[u.login];
                    const lastSeenMin = p ? Math.round((now - p.lastSeen) / 60000) : null;
                    const userProfile = profilesData[u.login] || {};
                    const displayName = userProfile.displayName || u.name || u.login;
                    const isMe = u.login === currentUser?.login;
                    const roleLabel = u.role === 'admin' ? '🛡️ Администратор' : u.role === 'senior' ? '⭐ Старший' : '🐦 Продавец';
                    // Продажи сегодня
                    const todayStr = formatDate(new Date());
                    const todaySales = reports.filter(r =>
                      (r.employee === u.name || r.employee === u.login || r.employee === userProfile.displayName) &&
                      (r.date||'').split(',')[0].trim() === todayStr
                    ).length;

                    return (
                      <div key={u.login} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isOnline ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                        {/* Аватар + индикатор */}
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                            {userProfile.avatar
                              ? <img src={userProfile.avatar} alt="" className="w-full h-full object-cover" />
                              : displayName[0]?.toUpperCase()
                            }
                          </div>
                          <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                        </div>
                        {/* Имя и статус */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 truncate">{displayName}</p>
                            {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">вы</span>}
                          </div>
                          <p className="text-xs text-gray-400">{roleLabel}</p>
                          <p className={`text-xs font-semibold mt-0.5 ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                            {isOnline
                              ? '● онлайн сейчас'
                              : lastSeenMin !== null
                                ? lastSeenMin < 60 ? `был(а) ${lastSeenMin} мин назад` : `был(а) ${Math.round(lastSeenMin/60)} ч назад`
                                : '● не в сети'}
                          </p>
                        </div>
                        {/* Продажи сегодня */}
                        {todaySales > 0 && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-lg font-black text-amber-500">{todaySales}</p>
                            <p className="text-xs text-gray-400">сегодня</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Управление сотрудниками (только админ) */}
            {isAdmin && <EmployeeManager />}
          </div>
        )}

        {/* ВКЛАДКА: График работы (для всех — просмотр, для админа сверху редактор) */}
        {teamTab === 'schedule' && (
          <div className="space-y-4">
            {/* Редактор графика (только админ) */}
            {isAdmin && <ScheduleManager />}

            <div className="bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 rounded-xl p-4">
              <h3 className="font-bold text-lg mb-1">📅 {scheduleData.week || 'График не установлен'}</h3>
              <p className="text-sm text-gray-600">{shiftsCount} смен запланировано</p>
            </div>
            
            {activeEmployees.map(emp => scheduleData.shifts?.[emp] && (
              <div key={emp} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3">{emp}</h3>
                <div className="space-y-2">
                  {scheduleData.shifts[emp].map((shift, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-800">{shift.date || 'Дата не указана'}</span>
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold">{shift.hours || 0}ч</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>🕐</span>
                          <span>{shift.startTime || '—'} — {shift.endTime || '—'}</span>
                        </div>
                        {shift.breakStart && shift.breakEnd && (
                          <div className="flex items-center gap-2 mt-1 text-orange-600">
                            <span>☕</span>
                            <span>Обед: {shift.breakStart} — {shift.breakEnd}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm text-gray-500 pt-2 border-t">
                    Всего: <span className="font-bold text-blue-700">{scheduleData.shifts[emp].reduce((s, sh) => s + (sh.hours || 0), 0)} ч</span>
                  </div>
                </div>
              </div>
            ))}
            
            {!scheduleData.week && (
              <div className="text-center py-10 bg-white rounded-xl shadow">
                <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">График ещё не создан</p>
                <p className="text-sm text-gray-400 mt-2">Администратор может создать график в админ-панели</p>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: Зарплата (только админ) */}
        {teamTab === 'salary' && isAdmin && <SalaryPanel />}

        {/* ВКЛАДКА: Сотрудники — штрафы/бонусы/отпуска (только админ) */}
        {teamTab === 'employees' && isAdmin && <EmployeesAdminTab />}

        {/* ВКЛАДКА: Результаты недели */}
        {teamTab === 'results' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl p-4">
              <div className="grid grid-cols-4 gap-2 text-center font-bold text-sm">
                <div className="flex items-center justify-center gap-1"><span>🦩</span><span>Участник</span></div>
                <div className="flex items-center justify-center gap-1"><span>⏱️</span><span>Время</span></div>
                <div className="flex items-center justify-center gap-1"><span>🎨</span><span>Продажи</span></div>
                <div className="flex items-center justify-center gap-1"><span>🚀</span><span>Скорость</span></div>
              </div>
            </div>

            {weekResults.map((emp, idx) => {
              // Суммируем реальные часы из shiftsData за неделю
              const regUser = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]').find(u => (u.name || u.login) === emp.name); } catch { return null; } })();
              const login = regUser?.login || emp.name;
              const weekAgoTs = weekAgo.getTime();
              let totalMinutes = 0;
              let isCurrentlyOpen = false;
              Object.entries(shiftsData).forEach(([key, shift]) => {
                if (!key.startsWith(login + '_')) return;
                if (!shift.openTime) return;
                // Проверяем что смена за последнюю неделю
                const dateStr = key.replace(login + '_', ''); // DD.MM.YYYY
                const [d, m, y] = dateStr.split('.');
                const shiftDate = y ? new Date(parseInt(parseYear(y)), parseInt(m)-1, parseInt(d)) : new Date(0);
                if (shiftDate.getTime() < weekAgoTs) return;
                // Считаем минуты
                if (shift.openTime && shift.closeTime) {
                  const [oh, om] = shift.openTime.split(':').map(Number);
                  const [ch, cm] = shift.closeTime.split(':').map(Number);
                  let mins = (ch * 60 + cm) - (oh * 60 + om);
                  if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
                  totalMinutes += mins;
                } else if (shift.status === 'open') {
                  isCurrentlyOpen = true;
                }
              });
              // Округление времени до четверти часа (0.25 = 15 мин):
              // floor(минуты / 15) * 0.25 — 14м→0, 15м→0.25, 25м→0.25, 30м→0.5, 45м→0.75
              const fullHours = Math.floor(totalMinutes / 60);
              const remainMinutes = totalMinutes % 60;
              const quarterFraction = Math.floor(remainMinutes / 15) * 0.25;
              const roundedHours = fullHours + quarterFraction;
              // Скорость продаж = продажи / округлённые часы (до сотых)
              const speed = roundedHours > 0 ? emp.sales / roundedHours : 0;
              const speedDisplay = parseFloat(speed.toFixed(2));
              // Формат отображения часов: "5.25 ч", "8 ч", "0.5 ч"
              const hoursDisplay = roundedHours > 0
                ? (Number.isInteger(roundedHours) ? `${roundedHours} ч` : `${roundedHours.toFixed(2).replace(/0$/, '')} ч`)
                : null;
              const timeLabel = hoursDisplay
                ? hoursDisplay
                : isCurrentlyOpen ? null
                : `${emp.shifts} дн.`;

              return (
                <div key={emp.name} className={`${idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} border-2 border-yellow-300 rounded-xl p-4`}>
                  <div className="grid grid-cols-4 gap-2 text-center items-center">
                    <div>
                      <p className="font-bold">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.sales} прод.</p>
                    </div>
                    <div className="font-bold text-lg flex flex-col items-center gap-0.5">
                      {isCurrentlyOpen
                        ? <span className="text-green-500 animate-pulse text-sm font-semibold">● работает</span>
                        : <span>{timeLabel}</span>
                      }
                      {totalMinutes > 0 && isCurrentlyOpen && <span className="text-xs text-green-400">{hoursDisplay || `${fullHours}ч`}</span>}
                    </div>
                    <div className="font-bold text-lg">{emp.sales}</div>
                    <div className="font-bold text-lg flex items-center justify-center gap-1">
                      {speedDisplay > 2 && <span className="text-yellow-500">⚡</span>}
                      {speedDisplay > 0 ? speedDisplay : <span className="text-gray-300">—</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {weekResults.length === 0 && (
              <div className="bg-white rounded-xl p-10 text-center shadow">
                <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Нет данных за последнюю неделю</p>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: События */}
        {teamTab === 'events' && (
          <div className="space-y-4">
            {/* Управление событиями (только админ) */}
            {isAdmin && <EventsManager />}

            {upcomingEvents.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">📅 Предстоящие события</h3>
                <div className="space-y-3">
                  {upcomingEvents.map(({ date, ev, index }) => {
                    const [d, m, y] = date.split('.');
                    const eventDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
                    const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={`${date}_${index}`} className="bg-white rounded-xl p-4 shadow border-l-4 border-red-500">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xl font-bold text-red-600">{date}</p>
                            {daysUntil <= 7 && (
                              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${daysUntil === 0 ? 'bg-red-500 text-white' : daysUntil <= 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {daysUntil === 0 ? '🔥 Сегодня!' : daysUntil === 1 ? 'Завтра' : `Через ${daysUntil} дн.`}
                              </span>
                            )}
                          </div>
                          <span className="text-2xl">{ev.emoji || '🎉'}</span>
                        </div>
                        <p className="text-lg font-medium text-gray-800 mt-2">{ev.title}</p>
                        {ev.description && <p className="text-sm text-gray-500 mt-1">{ev.description}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {pastEvents.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-gray-500 mb-3">📋 Прошедшие события</h3>
                <div className="space-y-2">
                  {pastEvents.slice(0, 5).map(({ date, ev, index }) => (
                    <div key={`${date}_${index}`} className="bg-gray-50 rounded-lg p-3 opacity-60">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-600">{date}</p>
                          <p className="text-sm text-gray-500">{ev.title}</p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sortedEvents.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl shadow">
                <Calendar className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">Нет событий</p>
                <p className="text-gray-400 text-sm mt-2">Администратор может добавить события</p>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: Мануалы */}

        {/* BLOCK 7: Leaderboard */}
        {teamTab === 'leaderboard' && (() => {
          const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
          const weekAgo2 = new Date(); weekAgo2.setDate(weekAgo2.getDate() - 7);
          const cutoff = lbPeriod === 'week' ? weekAgo2 : monthAgo;
          const periodReports = reports.filter(r => {
            try { const d = parseRuDate(r.date || r.timestamp); return d >= cutoff && !r.isUnrecognized; } catch { return false; }
          });
          const byEmp = {};
          periodReports.forEach(r => {
            const emp = r.employee || 'Неизвестно';
            if (!byEmp[emp]) byEmp[emp] = { name: emp, revenue: 0, count: 0 };
            byEmp[emp].revenue += r.total || 0;
            byEmp[emp].count += 1;
          });
          const ranking = Object.values(byEmp).sort((a, b) => b.revenue - a.revenue);
          const medals = ['🥇', '🥈', '🥉'];
          
          return (
            <div className="space-y-4">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setLbPeriod('week')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${lbPeriod === 'week' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Неделя</button>
                <button onClick={() => setLbPeriod('month')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${lbPeriod === 'month' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Месяц</button>
              </div>
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                {ranking.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Нет данных за период</p>
                ) : ranking.map((e, i) => (
                  <div key={e.name} className={`flex items-center gap-3 p-4 ${i === 0 ? 'bg-amber-50' : ''} ${i < ranking.length - 1 ? 'border-b' : ''}`}>
                    <span className="text-2xl w-8 text-center">{i < 3 ? medals[i] : (i + 1)}</span>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                      {e.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{e.name}</p>
                      <p className="text-xs text-gray-400">{e.count} продаж</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{e.revenue.toLocaleString()} ₽</p>
                      <p className="text-xs text-gray-400">ср. {e.count > 0 ? Math.round(e.revenue / e.count) : 0} ₽</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* BLOCK 3: Enhanced Chat */}
        {teamTab === 'chat' && (() => {
          const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👎'];
          const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
          const isAdminUser = currentUser?.isAdmin || currentUser?.role === 'admin';

          const handleSendChat = () => {
            if (!chatText.trim()) return;
            const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Аноним', text: chatText.trim(), date: new Date().toISOString(), read: false, reactions: {}, pinned: false };
            // Check for @mentions
            const mentionRegex = /@(\S+)/g;
            let match;
            while ((match = mentionRegex.exec(chatText)) !== null) {
              const mentioned = match[1];
              try {
                const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
                const user = users.find(u => u.login === mentioned || u.name === mentioned);
                if (user) {
                  const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'mention', targetLogin: user.login, title: '💬 Вас упомянули в чате', body: employeeName + ': ' + chatText.trim().substring(0, 80), icon: '💬', timestamp: Date.now(), read: false };
                  const updatedNotifs = [...userNotifications, notif];
                  setUserNotifications(updatedNotifs);
                  save('likebird-notifications', updatedNotifs);
                }
              } catch { /* silent */ }
            }
            updateChatMessages([...chatMessages, msg]);
            setChatText('');
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          };

          const addReaction = (msgId, emoji) => {
            const updated = chatMessages.map(m => {
              if (m.id !== msgId) return m;
              const reactions = { ...(m.reactions || {}) };
              if (!reactions[emoji]) reactions[emoji] = [];
              if (reactions[emoji].includes(myLogin)) {
                reactions[emoji] = reactions[emoji].filter(l => l !== myLogin);
                if (reactions[emoji].length === 0) delete reactions[emoji];
              } else {
                reactions[emoji] = [...reactions[emoji], myLogin];
              }
              return { ...m, reactions };
            });
            updateChatMessages(updated);
            setReactionMsgId(null);
          };

          const togglePin = (msgId) => {
            const updated = chatMessages.map(m => m.id === msgId ? { ...m, pinned: !m.pinned } : m);
            updateChatMessages(updated);
          };

          const pinnedMessages = chatMessages.filter(m => m.pinned);
          const recentMessages = chatMessages.slice(-(chatLimit || 50));

          const handleChatPhoto = async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { showNotification('Фото слишком большое (макс 10MB)', 'error'); return; }
            try {
              const compressed = await compressImage(file, 800, 0.7);
              const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Аноним', text: '', image: compressed, date: new Date().toISOString(), read: false, reactions: {}, pinned: false };
              updateChatMessages([...chatMessages, msg]);
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            } catch { showNotification('Ошибка загрузки фото', 'error'); }
          };

          return (
            <div className="space-y-3">
              {/* Pinned messages */}
              {pinnedMessages.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-600 mb-2">📌 Закреплённые</p>
                  {pinnedMessages.map(m => (
                    <div key={m.id} className="text-sm py-1 border-b border-amber-100 last:border-0">
                      <span className="font-semibold">{m.from}:</span> {m.text}
                    </div>
                  ))}
                </div>
              )}
              {/* Messages */}
              <div className="bg-white rounded-2xl shadow max-h-96 overflow-y-auto p-3 space-y-2">
                {recentMessages.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">Начните общение! 💬</p>
                ) : <>{chatMessages.length > (chatLimit || 50) && <button onClick={() => setChatLimit(prev => prev + 50)} className="w-full text-center py-2 text-purple-500 text-sm hover:text-purple-700 border-b">↑ Загрузить ещё ({chatMessages.length - (chatLimit || 50)} сообщений)</button>}{recentMessages.map(m => (
                  <div key={m.id} className={`relative ${m.from === employeeName ? 'ml-8' : 'mr-8'}`}
                    onContextMenu={(e) => { e.preventDefault(); setReactionMsgId(m.id); }}>
                    <div className={`p-3 rounded-xl ${m.from === employeeName ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                      {m.from !== employeeName && <p className="text-xs font-bold mb-1 text-blue-600">{(() => { const pr = Object.values(profilesData || {}).find(p => p.name === m.from); return pr?.avatar ? <img src={pr.avatar} alt="" className="w-4 h-4 rounded-full inline mr-1" /> : null; })()}{m.from}</p>}
                      {m.image && (
                        <img src={m.image} alt="" className="max-w-48 rounded-lg mb-1 cursor-pointer" onClick={() => window.open(m.image)} />
                      )}
                      {m.text && <p className="text-sm">{m.text.split(/(@\S+)/g).map((part, idx) => 
                        part.startsWith('@') ? <span key={idx} className="text-blue-500 font-semibold">{part}</span> : part
                      )}</p>}
                      <p className={`text-xs mt-1 ${m.from === employeeName ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(m.date).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    {/* Reactions display */}
                    {m.reactions && Object.keys(m.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(m.reactions).map(([emoji, users]) => (
                          <button key={emoji} onClick={() => addReaction(m.id, emoji)}
                            className={`text-xs px-1.5 py-0.5 rounded-full border ${users.includes(myLogin) ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Reaction picker */}
                    {reactionMsgId === m.id && (
                      <div className="absolute bottom-full left-0 bg-white shadow-lg rounded-xl p-2 flex gap-1 z-20 border">
                        {REACTION_EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => addReaction(m.id, emoji)} className="text-lg hover:scale-125 transition-transform p-1">{emoji}</button>
                        ))}
                        {isAdminUser && (
                          <button onClick={() => { togglePin(m.id); setReactionMsgId(null); }} className="text-sm px-2 hover:bg-gray-100 rounded">📌</button>
                        )}
                        <button onClick={() => setReactionMsgId(null)} className="text-sm px-2 hover:bg-gray-100 rounded">✕</button>
                      </div>
                    )}
                  </div>
                ))}</>}
                <div ref={chatEndRef} />
              </div>
              {/* Input */}
              <div className="flex gap-2">
                <label className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200">
                  <Camera className="w-5 h-5 text-gray-500" />
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChatPhoto} />
                </label>
                <input type="text" value={chatText} onChange={(e) => { setChatText(e.target.value); if (e.target.value.endsWith('@')) setShowMentions(true); else setShowMentions(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  placeholder="Сообщение..."
                  className="flex-1 p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none" />
                <button onClick={handleSendChat} className="px-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600">→</button>
              </div>
              {/* Mention autocomplete */}
              {showMentions && (
                <div className="bg-white rounded-xl shadow border p-2 space-y-1">
                  {employees.filter(e => e.active && activeEmployees.includes(e.name)).map(e => (
                    <button key={e.id} onClick={() => { setChatText(chatText + e.name + ' '); setShowMentions(false); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm">{e.name}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {teamTab === 'manuals' && (() => {
          const categories = [
            { id: 'all', label: '📚 Все', color: 'purple' },
            { id: 'sales', label: '🎯 Продажи', color: 'blue' },
            { id: 'info', label: '💰 Финансы', color: 'green' },
            { id: 'faq', label: '❓ FAQ', color: 'orange' },
          ];
          const filteredManuals = manuals.filter(m => {
            const matchCat = manualFilter === 'all' || m.category === manualFilter;
            const matchSearch = !manualSearch.trim() || m.title.toLowerCase().includes(manualSearch.toLowerCase()) || (m.content && m.content.toLowerCase().includes(manualSearch.toLowerCase()));
            return matchCat && matchSearch;
          });
          
          return (
            <div className="space-y-4">
              {/* Поиск */}
              <div className="relative">
                <input
                  type="text"
                  value={manualSearch}
                  onChange={e => setManualSearch(e.target.value)}
                  placeholder="🔍 Поиск по названию или содержанию..."
                  className="w-full p-3 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none"
                />
                {manualSearch && (
                  <button onClick={() => setManualSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>

              {/* Категории */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setManualFilter(cat.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      manualFilter === cat.id 
                        ? 'bg-purple-500 text-white shadow-md' 
                        : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Закреплённые мануалы */}
              {filteredManuals.filter(m => m.isPinned).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                    📌 Важное
                  </h3>
                  {filteredManuals.filter(m => m.isPinned).map(manual => (
                    <details key={manual.id} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-md border-2 border-purple-200 mb-3 overflow-hidden group">
                      <summary className="p-4 cursor-pointer hover:bg-purple-100/50 flex items-center justify-between list-none">
                        <span className="font-bold text-purple-800">{manual.title}</span>
                        <ChevronRight className="w-5 h-5 text-purple-500 transition-transform duration-200 group-open:rotate-90" />
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t border-purple-200 bg-white">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{manual.content}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {/* Остальные мануалы */}
              <div className="space-y-3">
                {filteredManuals.filter(m => !m.isPinned).map(manual => (
                  <details key={manual.id} className="bg-white rounded-xl shadow-md overflow-hidden group">
                    <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between list-none">
                      <div>
                        <span className="font-bold text-gray-800">{manual.title}</span>
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                          {manual.category === 'sales' ? '🎯 Продажи' : manual.category === 'faq' ? '❓ FAQ' : '💰 Инфо'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-90" />
                    </summary>
                    <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{manual.content}</pre>
                    </div>
                  </details>
                ))}
              </div>

              {filteredManuals.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl shadow">
                  <FileText className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">
                    {manualFilter === 'all' ? 'Нет мануалов' : 'Нет мануалов в этой категории'}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">Администратор может добавить обучающие материалы</p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
