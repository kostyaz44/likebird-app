import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/**
 * ScheduleManager — редактор графика работы (только для админа).
 * Раньше: AdminView → Персонал+ → График (компонент ScheduleEditor).
 * Теперь: рендерится в TeamView → График над просмотром.
 *
 * Использует тот же ключ 'likebird-schedule' и тот же scheduleData state.
 */
export default function ScheduleManager() {
  const {
    scheduleData,
    setScheduleData,
    employees,
    save,
    logAction,
    showNotification,
    showConfirm,
    darkMode,
    currentUser,
  } = useApp();

  const [weekRange, setWeekRange] = useState(scheduleData.week || '');
  const [shifts, setShifts] = useState(scheduleData.shifts || {});
  const [scheduleViewMode, setScheduleViewMode] = useState('list');
  const [expanded, setExpanded] = useState(false);

  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin' || currentUser?.role === 'deputy';

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

  // Активные сотрудники, у которых есть аккаунт (призраков отсеиваем)
  const activeEmployees = employees
    .filter(e => e.active)
    .filter(emp => regUsers.find(u => u.name === emp.name || u.login === emp.name))
    .map(e => e.name);

  // Расчёт часов из времени (учитывает перерыв)
  const calculateHours = (startTime, endTime, breakStart, breakEnd) => {
    if (!startTime || !endTime) return 0;
    const parseTime = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h + (m || 0) / 60;
    };
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    let hours = end - start;
    if (breakStart && breakEnd) {
      const bStart = parseTime(breakStart);
      const bEnd = parseTime(breakEnd);
      const breakHours = bEnd - bStart;
      if (breakHours > 0) hours -= breakHours;
    }
    return Math.max(0, Math.round(hours * 10) / 10);
  };

  const shiftsCount = Object.values(shifts).reduce((sum, emp) => sum + (emp?.length || 0), 0);
  const totalHours = Object.values(shifts).reduce(
    (sum, emp) => sum + (emp?.reduce((s, sh) => s + (sh.hours || 0), 0) || 0),
    0
  );

  const saveSchedule = () => {
    const data = { week: weekRange, shifts };
    setScheduleData(data);
    save('likebird-schedule', data);
    logAction('Обновлён график работы', weekRange);
    showNotification('График сохранён ✓');
  };

  const addShift = (employee) => {
    const newShifts = { ...shifts };
    if (!newShifts[employee]) newShifts[employee] = [];
    newShifts[employee].push({
      date: '',
      startTime: '10:00',
      endTime: '19:00',
      breakStart: '',
      breakEnd: '',
      hours: 9,
    });
    setShifts(newShifts);
  };

  const updateShift = (employee, index, field, value) => {
    const newShifts = { ...shifts };
    newShifts[employee][index][field] = value;
    const shift = newShifts[employee][index];
    shift.hours = calculateHours(shift.startTime, shift.endTime, shift.breakStart, shift.breakEnd);
    setShifts(newShifts);
  };

  const removeShift = (employee, index) => {
    const newShifts = { ...shifts };
    newShifts[employee].splice(index, 1);
    if (newShifts[employee].length === 0) delete newShifts[employee];
    setShifts(newShifts);
  };

  const clearAllShifts = () => {
    showConfirm('Очистить все смены?', () => {
      // Обновляем parent state напрямую: showConfirm может вызвать re-mount компонента
      const data = { week: weekRange, shifts: {} };
      setScheduleData(data);
      setShifts({});
      save('likebird-schedule', data);
      logAction('Очищены все смены', '');
      showNotification('Смены очищены');
    });
  };

  // Шаблоны смен для быстрого добавления
  const TEMPLATES = {
    full: { startTime: '10:00', endTime: '19:00', breakStart: '13:00', breakEnd: '14:00', hours: 8 },
    morning: { startTime: '09:00', endTime: '15:00', breakStart: '', breakEnd: '', hours: 6 },
    evening: { startTime: '15:00', endTime: '21:00', breakStart: '', breakEnd: '', hours: 6 },
    short: { startTime: '10:00', endTime: '14:00', breakStart: '', breakEnd: '', hours: 4 },
  };

  const applyTemplate = (employee, templateKey) => {
    const newShifts = { ...shifts };
    if (!newShifts[employee]) newShifts[employee] = [];
    newShifts[employee].push({ date: '', ...TEMPLATES[templateKey] });
    setShifts(newShifts);
  };

  // Табличный вид: вычисляем дни недели
  const renderTableView = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Понедельник
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
    const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const todayDateStr = now.toISOString().split('T')[0];

    const getShiftForDay = (emp, day) => {
      const dayStr = day.toISOString().split('T')[0];
      const empShifts = shifts[emp] || [];
      return empShifts.find(s => s.date === dayStr);
    };

    const toggleShiftType = (emp, day, type) => {
      const dayStr = day.toISOString().split('T')[0];
      const newShifts = { ...shifts };
      if (!newShifts[emp]) newShifts[emp] = [];
      const existingIdx = newShifts[emp].findIndex(s => s.date === dayStr);

      if (existingIdx >= 0) {
        const existing = newShifts[emp][existingIdx];
        if (
          existing.startTime === TEMPLATES[type].startTime &&
          existing.endTime === TEMPLATES[type].endTime
        ) {
          newShifts[emp].splice(existingIdx, 1);
          if (newShifts[emp].length === 0) delete newShifts[emp];
        } else {
          newShifts[emp][existingIdx] = { date: dayStr, ...TEMPLATES[type] };
        }
      } else {
        newShifts[emp].push({ date: dayStr, ...TEMPLATES[type] });
      }
      setShifts(newShifts);
    };

    return (
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-bold text-gray-700 min-w-[80px]">Сотрудник</th>
              {days.map((d, i) => {
                const isToday = d.toISOString().split('T')[0] === todayDateStr;
                return (
                  <th
                    key={i}
                    className={`p-2 text-center min-w-[60px] ${
                      isToday ? 'bg-blue-50 text-blue-700 font-black' : 'text-gray-500'
                    }`}
                  >
                    <div>{dayLabels[i]}</div>
                    <div className="text-[10px]">
                      {d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(emp => (
              <tr key={emp} className="border-b last:border-0">
                <td className="p-2 font-semibold text-gray-700">{emp}</td>
                {days.map((d, i) => {
                  const isToday = d.toISOString().split('T')[0] === todayDateStr;
                  const shift = getShiftForDay(emp, d);
                  const shiftType = shift
                    ? shift.startTime === '09:00'
                      ? 'morning'
                      : shift.startTime === '15:00'
                      ? 'evening'
                      : 'full'
                    : null;
                  return (
                    <td key={i} className={`p-1 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => toggleShiftType(emp, d, 'morning')}
                          className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${
                            shiftType === 'morning'
                              ? 'bg-yellow-400 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'
                          }`}
                        >
                          ☀
                        </button>
                        <button
                          onClick={() => toggleShiftType(emp, d, 'evening')}
                          className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${
                            shiftType === 'evening'
                              ? 'bg-indigo-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-indigo-100'
                          }`}
                        >
                          🌙
                        </button>
                        <button
                          onClick={() => toggleShiftType(emp, d, 'full')}
                          className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${
                            shiftType === 'full'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-400 hover:bg-green-100'
                          }`}
                        >
                          ∎
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-2 flex gap-3 text-[10px] text-gray-500 border-t flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-400 rounded"></span> Утро (09-15)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-indigo-500 rounded"></span> Вечер (15-21)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-green-500 rounded"></span> Полная (10-19)
          </span>
        </div>
      </div>
    );
  };

  // Не админ — не рендерим
  if (!isAdmin) return null;

  return (
    <div className={`rounded-2xl shadow border-2 border-blue-200 mb-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Заголовок-аккордеон */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-blue-50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-700">Редактор графика</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            {shiftsCount} смен · {totalHours}ч
          </span>
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Период + Переключатель вида */}
          <div className={`rounded-xl p-4 shadow-inner ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                Период графика
              </h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setScheduleViewMode('list')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    scheduleViewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                  }`}
                >
                  Список
                </button>
                <button
                  onClick={() => setScheduleViewMode('table')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    scheduleViewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
                  }`}
                >
                  Таблица
                </button>
              </div>
            </div>
            <input
              type="text"
              value={weekRange}
              onChange={(e) => setWeekRange(e.target.value)}
              placeholder="27.01.26 - 02.02.26"
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Статистика + Очистить */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4 border-2 border-blue-300">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-blue-700">📊 Статистика</p>
                <p className="text-sm text-blue-600">
                  {shiftsCount} смен • {totalHours} часов
                </p>
              </div>
              <button onClick={clearAllShifts} className="text-red-500 hover:text-red-700 text-sm">
                Очистить всё
              </button>
            </div>
          </div>

          {/* Табличный вид */}
          {scheduleViewMode === 'table' && renderTableView()}

          {/* Список смен */}
          {scheduleViewMode === 'list' &&
            activeEmployees.map(emp => (
              <div key={emp} className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <h3 className="font-bold text-lg">{emp}</h3>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => applyTemplate(emp, 'full')}
                      className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200"
                      title="Полный день 10-19"
                    >
                      Полный
                    </button>
                    <button
                      onClick={() => applyTemplate(emp, 'morning')}
                      className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200"
                      title="Утро 9-15"
                    >
                      Утро
                    </button>
                    <button
                      onClick={() => applyTemplate(emp, 'evening')}
                      className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs hover:bg-purple-200"
                      title="Вечер 15-21"
                    >
                      Вечер
                    </button>
                    <button
                      onClick={() => addShift(emp)}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                    >
                      + Своя
                    </button>
                  </div>
                </div>

                {shifts[emp]?.length > 0 ? (
                  <div className="space-y-3">
                    {shifts[emp].map((shift, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-gray-200">
                        {/* Дата */}
                        <div className="flex gap-2 items-center mb-2">
                          <label className="text-xs text-gray-500 w-12">Дата:</label>
                          <input
                            type="text"
                            placeholder="30.01.26"
                            value={shift.date}
                            onChange={(e) => updateShift(emp, idx, 'date', e.target.value)}
                            className="flex-1 p-2 border rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            onClick={() => removeShift(emp, idx)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Время работы */}
                        <div className="flex gap-2 items-center mb-2 flex-wrap">
                          <label className="text-xs text-gray-500 w-12">Работа:</label>
                          <input
                            type="time"
                            value={shift.startTime || ''}
                            onChange={(e) => updateShift(emp, idx, 'startTime', e.target.value)}
                            className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                          <span className="text-gray-400">—</span>
                          <input
                            type="time"
                            value={shift.endTime || ''}
                            onChange={(e) => updateShift(emp, idx, 'endTime', e.target.value)}
                            className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>

                        {/* Перерыв */}
                        <div className="flex gap-2 items-center mb-2 flex-wrap">
                          <label className="text-xs text-gray-500 w-12">Обед:</label>
                          <input
                            type="time"
                            value={shift.breakStart || ''}
                            onChange={(e) => updateShift(emp, idx, 'breakStart', e.target.value)}
                            className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="13:00"
                          />
                          <span className="text-gray-400">—</span>
                          <input
                            type="time"
                            value={shift.breakEnd || ''}
                            onChange={(e) => updateShift(emp, idx, 'breakEnd', e.target.value)}
                            className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="14:00"
                          />
                          <span className="text-xs text-gray-400">(опционально)</span>
                        </div>

                        {/* Итого часов */}
                        <div className="flex justify-end items-center pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600">Итого: </span>
                          <span className="text-lg font-bold text-blue-600 ml-2">
                            {shift.hours || 0} ч
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-2 px-2">
                      <span className="text-sm text-gray-500">Всего у {emp}:</span>
                      <span className="font-bold text-blue-700">
                        {shifts[emp].reduce((s, sh) => s + (sh.hours || 0), 0)} часов
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm py-4 text-center">Нет запланированных смен</p>
                )}
              </div>
            ))}

          {activeEmployees.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center">
              <p className="text-yellow-700">Нет активных сотрудников</p>
              <p className="text-sm text-yellow-600 mt-1">
                Добавьте сотрудников во вкладке "Онлайн → Управление сотрудниками"
              </p>
            </div>
          )}

          {/* Кнопка сохранения */}
          <button
            onClick={saveSchedule}
            className="w-full bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg"
          >
            <CheckCircle className="w-6 h-6" />
            Сохранить график
          </button>
        </div>
      )}
    </div>
  );
}
