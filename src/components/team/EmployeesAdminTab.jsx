import React, { useState } from 'react';
import { AlertTriangle, Gift, Palmtree, Edit3, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseYear } from '../../utils/dates.js';

/**
 * EmployeesAdminTab — обёртка для админских действий со штрафами/бонусами/отпусками.
 * Раньше: AdminView → Персонал+ → Штрафы / Бонусы / Отпуска.
 * Теперь: вкладка "Сотрудники" в TeamView (только для админа).
 *
 * Использует localStorage ключи: 'likebird-penalties', 'likebird-bonuses', 'likebird-timeoff'.
 */
export default function EmployeesAdminTab() {
  const {
    currentUser,
    employees,
    penalties,
    bonuses,
    timeOff,
    setPenalties,
    setBonuses,
    setTimeOff,
    addPenalty,
    addBonus,
    addTimeOff,
    save,
    showNotification,
    showConfirm,
    logAction,
    darkMode,
  } = useApp();

  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin';

  const [activeSubTab, setActiveSubTab] = useState('penalties');

  // Формы
  const [newPenalty, setNewPenalty] = useState({ employeeId: '', amount: '', reason: '' });
  const [newBonus, setNewBonus] = useState({ employeeId: '', amount: '', reason: '' });
  const [newTimeOff, setNewTimeOff] = useState({
    employeeId: '',
    type: 'vacation',
    startDate: '',
    endDate: '',
    note: '',
  });

  // Редактирование бонуса (как в оригинале)
  const [editBonusId, setEditBonusId] = useState(null);
  const [editBonusForm, setEditBonusForm] = useState({ amount: '', reason: '' });

  // === Обёртки для save в localStorage + Firebase ===
  const updatePenalties = (p) => {
    setPenalties(p);
    save('likebird-penalties', p);
  };
  const updateBonuses = (b) => {
    setBonuses(b);
    save('likebird-bonuses', b);
  };
  const updateTimeOff = (t) => {
    setTimeOff(t);
    save('likebird-timeoff', t);
  };

  // === Активные отпуска/больничные (как getActiveTimeOff в оригинале) ===
  const getActiveTimeOff = () => {
    const today = new Date().toISOString().split('T')[0];
    return (timeOff || []).filter(t => t.startDate <= today && t.endDate >= today);
  };

  // === Удаление штрафа ===
  const deletePenalty = (id) => {
    showConfirm('Удалить этот штраф?', () => {
      updatePenalties(penalties.filter(p => p.id !== id));
      logAction('Штраф удалён', String(id));
      showNotification('Штраф удалён');
    });
  };

  // === Удаление/редактирование бонуса ===
  const deleteBonus = (id) => {
    showConfirm('Удалить этот бонус?', () => {
      updateBonuses(bonuses.filter(b => b.id !== id));
      logAction('Бонус удалён', String(id));
      showNotification('Бонус удалён');
    });
  };

  const startEditBonus = (b) => {
    setEditBonusId(b.id);
    setEditBonusForm({ amount: String(b.amount), reason: b.reason });
  };

  const saveEditBonus = () => {
    const amt = parseInt(editBonusForm.amount);
    if (!amt || !editBonusForm.reason) {
      showNotification('Заполните поля', 'error');
      return;
    }
    updateBonuses(
      bonuses.map(b =>
        b.id === editBonusId ? { ...b, amount: amt, reason: editBonusForm.reason } : b
      )
    );
    setEditBonusId(null);
    showNotification('Бонус обновлён');
  };

  // === Удаление отпуска/больничного ===
  const deleteTimeOff = (id) => {
    showConfirm('Удалить эту запись отсутствия?', () => {
      updateTimeOff(timeOff.filter(t => t.id !== id));
      logAction('Отсутствие удалено', String(id));
      showNotification('Запись удалена');
    });
  };

  // === Безопасный парсинг даты для отображения ===
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    // ISO?
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('ru-RU');
    // DD.MM.YYYY?
    const parts = String(dateStr).split('.');
    if (parts.length === 3) {
      const parsed = new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      if (!isNaN(parsed.getTime())) return parsed.toLocaleDateString('ru-RU');
    }
    return String(dateStr);
  };

  // Защита: не админ — заглушка
  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
        <p className="text-yellow-700 font-bold">🔒 Раздел доступен только администратору</p>
      </div>
    );
  }

  // Хендлер добавления штрафа
  const handleAddPenalty = () => {
    if (!newPenalty.employeeId || !newPenalty.amount || !newPenalty.reason) {
      showNotification('Заполните все поля', 'error');
      return;
    }
    addPenalty(parseInt(newPenalty.employeeId), parseInt(newPenalty.amount) || 0, newPenalty.reason);
    setNewPenalty({ employeeId: '', amount: '', reason: '' });
    showNotification('Штраф добавлен');
  };

  // Хендлер добавления бонуса
  const handleAddBonus = () => {
    if (!newBonus.employeeId || !newBonus.amount || !newBonus.reason) {
      showNotification('Заполните все поля', 'error');
      return;
    }
    addBonus(parseInt(newBonus.employeeId), parseInt(newBonus.amount) || 0, newBonus.reason);
    setNewBonus({ employeeId: '', amount: '', reason: '' });
    showNotification('Бонус добавлен');
  };

  // Хендлер добавления отпуска
  const handleAddTimeOff = () => {
    if (!newTimeOff.employeeId || !newTimeOff.startDate || !newTimeOff.endDate) {
      showNotification('Заполните все поля', 'error');
      return;
    }
    addTimeOff(
      parseInt(newTimeOff.employeeId),
      newTimeOff.type,
      newTimeOff.startDate,
      newTimeOff.endDate,
      newTimeOff.note
    );
    setNewTimeOff({ employeeId: '', type: 'vacation', startDate: '', endDate: '', note: '' });
    showNotification('Добавлено');
  };

  const activeEmployees = employees.filter(e => e.active);

  const subTabs = [
    { id: 'penalties', label: '⚠️ Штрафы', count: penalties.length, color: 'red' },
    { id: 'bonuses', label: '🎁 Бонусы', count: bonuses.length, color: 'green' },
    { id: 'timeoff', label: '🏖️ Отпуска', count: timeOff.length, color: 'blue' },
  ];

  return (
    <div className="space-y-4">
      {/* Под-табы */}
      <div className="flex gap-2 bg-white rounded-xl p-1 shadow overflow-x-auto">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              activeSubTab === t.id
                ? `bg-${t.color}-500 text-white shadow`
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            style={
              activeSubTab === t.id
                ? {
                    backgroundColor:
                      t.color === 'red' ? '#ef4444' : t.color === 'green' ? '#22c55e' : '#3b82f6',
                    color: 'white',
                  }
                : {}
            }
          >
            {t.label}
            <span className="ml-1 text-xs opacity-75">({t.count})</span>
          </button>
        ))}
      </div>

      {/* === ВКЛАДКА: ШТРАФЫ === */}
      {activeSubTab === 'penalties' && (
        <div className="space-y-4">
          {/* Форма добавления */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Добавить штраф
            </h3>
            <div className="space-y-2">
              <select
                value={newPenalty.employeeId}
                onChange={(e) => setNewPenalty({ ...newPenalty, employeeId: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-red-500 focus:outline-none"
              >
                <option value="">Выберите сотрудника</option>
                {activeEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Сумма штрафа (₽)"
                value={newPenalty.amount}
                onChange={(e) => setNewPenalty({ ...newPenalty, amount: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-red-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Причина"
                value={newPenalty.reason}
                onChange={(e) => setNewPenalty({ ...newPenalty, reason: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-red-500 focus:outline-none"
              />
              <button
                onClick={handleAddPenalty}
                className="w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600"
              >
                Добавить штраф
              </button>
            </div>
          </div>

          {/* История */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3">📋 История штрафов</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {penalties
                .slice()
                .reverse()
                .slice(0, 40)
                .map(p => {
                  const emp = employees.find(e => e.id === p.employeeId);
                  return (
                    <div
                      key={p.id}
                      className="flex justify-between items-start p-2 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-red-700 text-sm">
                          {emp?.name || 'Удалён'}
                        </p>
                        <p className="text-xs text-gray-600 truncate">{p.reason}</p>
                        <p className="text-[10px] text-gray-400">{formatDate(p.date)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-red-600 font-bold">-{p.amount}₽</span>
                        <button
                          onClick={() => deletePenalty(p.id)}
                          className="text-red-400 hover:text-red-700 p-1"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {penalties.length === 0 && (
                <p className="text-gray-400 text-center py-6">Нет штрафов</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === ВКЛАДКА: БОНУСЫ === */}
      {activeSubTab === 'bonuses' && (
        <div className="space-y-4">
          {/* Форма добавления */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Gift className="w-5 h-5 text-green-500" />
              Добавить бонус
            </h3>
            <div className="space-y-2">
              <select
                value={newBonus.employeeId}
                onChange={(e) => setNewBonus({ ...newBonus, employeeId: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-green-500 focus:outline-none"
              >
                <option value="">Выберите сотрудника</option>
                {activeEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Сумма бонуса (₽)"
                value={newBonus.amount}
                onChange={(e) => setNewBonus({ ...newBonus, amount: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-green-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Причина"
                value={newBonus.reason}
                onChange={(e) => setNewBonus({ ...newBonus, reason: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-green-500 focus:outline-none"
              />
              <button
                onClick={handleAddBonus}
                className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600"
              >
                Добавить бонус
              </button>
            </div>
          </div>

          {/* История */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3">📋 История бонусов</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {bonuses
                .slice()
                .reverse()
                .slice(0, 40)
                .map(b => {
                  const emp = employees.find(e => e.id === b.employeeId);
                  const isAchBonus =
                    !!b.achievementId || (b.reason && b.reason.startsWith('Достижение:'));
                  const isEditing = editBonusId === b.id;

                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-lg border ${
                        isAchBonus
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-green-50 border-green-200'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={editBonusForm.amount}
                            onChange={(e) =>
                              setEditBonusForm({ ...editBonusForm, amount: e.target.value })
                            }
                            className="w-full p-2 border rounded text-sm"
                            placeholder="Сумма"
                          />
                          <input
                            type="text"
                            value={editBonusForm.reason}
                            onChange={(e) =>
                              setEditBonusForm({ ...editBonusForm, reason: e.target.value })
                            }
                            className="w-full p-2 border rounded text-sm"
                            placeholder="Причина"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditBonusId(null)}
                              className="flex-1 py-1.5 bg-gray-200 rounded text-sm font-medium"
                            >
                              Отмена
                            </button>
                            <button
                              onClick={saveEditBonus}
                              className="flex-1 py-1.5 bg-green-500 text-white rounded text-sm font-medium"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-green-700 text-sm">
                                {emp?.name || b.employeeName || 'Удалён'}
                              </p>
                              {isAchBonus && (
                                <span className="text-[10px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                                  🏆
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 truncate">{b.reason}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(b.date)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-green-600 font-bold">+{b.amount}₽</span>
                            <button
                              onClick={() => startEditBonus(b)}
                              className="text-blue-400 hover:text-blue-600 p-1"
                              title="Редактировать"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteBonus(b.id)}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Удалить"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              {bonuses.length === 0 && (
                <p className="text-gray-400 text-center py-6">Нет бонусов</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === ВКЛАДКА: ОТПУСКА / БОЛЬНИЧНЫЕ === */}
      {activeSubTab === 'timeoff' && (
        <div className="space-y-4">
          {/* Форма добавления */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Palmtree className="w-5 h-5 text-blue-500" />
              Добавить отпуск / больничный
            </h3>
            <div className="space-y-2">
              <select
                value={newTimeOff.employeeId}
                onChange={(e) => setNewTimeOff({ ...newTimeOff, employeeId: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="">Выберите сотрудника</option>
                {activeEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <select
                value={newTimeOff.type}
                onChange={(e) => setNewTimeOff({ ...newTimeOff, type: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                <option value="vacation">🏖️ Отпуск</option>
                <option value="sick">🏥 Больничный</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 ml-1">С</label>
                  <input
                    type="date"
                    value={newTimeOff.startDate}
                    onChange={(e) =>
                      setNewTimeOff({ ...newTimeOff, startDate: e.target.value })
                    }
                    className="w-full p-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 ml-1">По</label>
                  <input
                    type="date"
                    value={newTimeOff.endDate}
                    onChange={(e) =>
                      setNewTimeOff({ ...newTimeOff, endDate: e.target.value })
                    }
                    className="w-full p-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Примечание (необязательно)"
                value={newTimeOff.note}
                onChange={(e) => setNewTimeOff({ ...newTimeOff, note: e.target.value })}
                className="w-full p-2 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleAddTimeOff}
                className="w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600"
              >
                Добавить
              </button>
            </div>
          </div>

          {/* Текущие отсутствия */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3">🔴 Сейчас отсутствуют</h3>
            <div className="space-y-2">
              {getActiveTimeOff().map(t => {
                const emp = employees.find(e => e.id === t.employeeId);
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-lg border ${
                      t.type === 'sick'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{emp?.name || 'Удалён'}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {t.type === 'sick' ? '🏥 Больничный' : '🏖️ Отпуск'}
                        </span>
                        <button
                          onClick={() => deleteTimeOff(t.id)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.startDate} — {t.endDate}
                    </p>
                    {t.note && <p className="text-xs text-gray-400">{t.note}</p>}
                  </div>
                );
              })}
              {getActiveTimeOff().length === 0 && (
                <p className="text-gray-400 text-center py-4">Все на работе</p>
              )}
            </div>
          </div>

          {/* Все записи */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="font-bold mb-3">📋 Все записи</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {timeOff
                .slice()
                .reverse()
                .slice(0, 40)
                .map(t => {
                  const emp = employees.find(e => e.id === t.employeeId);
                  const today = new Date().toISOString().split('T')[0];
                  const isActive = t.startDate <= today && t.endDate >= today;
                  const isPast = t.endDate < today;
                  return (
                    <div
                      key={t.id}
                      className={`p-2 rounded-lg border text-sm ${
                        isActive
                          ? t.type === 'sick'
                            ? 'bg-red-50 border-red-200'
                            : 'bg-blue-50 border-blue-200'
                          : isPast
                          ? 'bg-gray-50 border-gray-200 opacity-70'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold">
                            {emp?.name || 'Удалён'}{' '}
                            <span className="text-xs font-normal text-gray-500">
                              {t.type === 'sick' ? '🏥' : '🏖️'}
                              {isActive && ' · сейчас'}
                              {isPast && ' · завершено'}
                              {!isActive && !isPast && ' · запланировано'}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {t.startDate} — {t.endDate}
                          </p>
                          {t.note && <p className="text-[10px] text-gray-400">{t.note}</p>}
                        </div>
                        <button
                          onClick={() => deleteTimeOff(t.id)}
                          className="text-red-400 hover:text-red-600 p-1 shrink-0"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {timeOff.length === 0 && (
                <p className="text-gray-400 text-center py-6">Записей пока нет</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
