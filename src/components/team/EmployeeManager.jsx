import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Edit2, Trash2, Save, Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fbSave } from '../../firebase.js';
import { hashPassword } from '../../utils/auth.js';

/**
 * EmployeeManager — управление аккаунтами и сотрудниками.
 * Раньше: AdminView → Персонал+ → Сотрудники.
 * Теперь: рендерится для админа внутри TeamView → Онлайн.
 *
 * Работает с тем же localStorage-ключом 'likebird-users' и Firebase,
 * синхронизирует name/role в employees через updateEmployees().
 */
export default function EmployeeManager() {
  const {
    currentUser,
    employees,
    updateEmployees,
    addEmployee,
    showConfirm,
    showNotification,
    setCurrentUser,
    darkMode,
    locations,
    salarySettings,
  } = useApp();

  const getCities = () => [...new Set((locations || []).map(l => l.city))];

  // Локальная копия пользователей (читается из localStorage при монтировании
  // и при изменении событием 'storage' от Firebase-подписки)
  const [regUsers, setRegUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; }
  });

  // Подхватываем внешние обновления (Firebase -> localStorage в LikeBirdApp)
  useEffect(() => {
    const refresh = () => {
      try {
        const fresh = JSON.parse(localStorage.getItem('likebird-users') || '[]');
        setRegUsers(fresh);
      } catch { /* silent */ }
    };
    window.addEventListener('storage', refresh);
    // Периодический pull для случая когда событие storage не сработало
    const interval = setInterval(refresh, 3000);
    return () => { window.removeEventListener('storage', refresh); clearInterval(interval); };
  }, []);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', role: 'seller', isAdmin: false,
    deputyCity: '', deputyPerSale: 75, noSalary: false,
  });
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState({
    login: '', name: '', password: '', role: 'seller',
    deputyCity: '', deputyPerSale: 75, noSalary: false,
  });
  const [addError, setAddError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const isMasterAdmin = currentUser?.isAdmin === true;

  const ROLE_LABELS = {
    seller: { label: 'Продавец', color: 'bg-purple-100 text-purple-700', icon: '🐦' },
    senior: { label: 'Старший продавец', color: 'bg-amber-100 text-amber-700', icon: '⭐' },
    admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: '🛡️' },
    deputy: { label: 'Замдиректор', color: 'bg-indigo-100 text-indigo-700', icon: '🎖️' },
  };

  // Текущий назначенный замдиректор (если есть) — для проверки уникальности
  const currentDeputy = regUsers.find(u => u.role === 'deputy');

  const saveUsers = (updated) => {
    setRegUsers(updated);
    localStorage.setItem('likebird-users', JSON.stringify(updated));
    fbSave('likebird-users', updated);
  };

  const handleStartEdit = (user) => {
    setEditingUser(user.login);
    setEditForm({
      name: user.name,
      role: user.role || 'seller',
      isAdmin: !!user.isAdmin,
      deputyCity: user.deputyCity || '',
      deputyPerSale: typeof user.deputyPerSale === 'number' ? user.deputyPerSale : 75,
      noSalary: !!user.noSalary,
    });
  };

  // Проверка уникальности замдиректора. Возвращает true если разрешено сохранять.
  const checkDeputyUniqueness = (login, newRole) => {
    if (newRole !== 'deputy') return Promise.resolve(true);
    if (!currentDeputy || currentDeputy.login === login) return Promise.resolve(true);
    return new Promise((resolve) => {
      showConfirm(
        `Замдиректор уже назначен: ${currentDeputy.name} (${currentDeputy.deputyCity || 'без города'}).\n\nПереназначить на нового сотрудника? Прежний станет администратором.`,
        () => resolve(true),
      );
      // Если showConfirm не вызовет коллбек при отмене — таймаут защита
      setTimeout(() => resolve(false), 30000);
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) { showNotification('Имя не может быть пустым', 'error'); return; }
    if (editForm.role === 'deputy' && !editForm.deputyCity) {
      showNotification('Выберите город для замдиректора', 'error'); return;
    }

    // Уникальность deputy
    const ok = await checkDeputyUniqueness(editingUser, editForm.role);
    if (!ok) return;

    let updated = regUsers.map(u => {
      if (u.login === editingUser) {
        // Очищаем deputy-поля если роль больше не deputy
        const isNewDeputy = editForm.role === 'deputy';
        return {
          ...u,
          name: editForm.name.trim(),
          role: editForm.role,
          isAdmin: editForm.isAdmin || editForm.role === 'admin' || editForm.role === 'deputy',
          noSalary: !!editForm.noSalary,
          ...(isNewDeputy
            ? { deputyCity: editForm.deputyCity, deputyPerSale: Math.max(0, Number(editForm.deputyPerSale) || 0) }
            : { deputyCity: undefined, deputyPerSale: undefined }
          ),
        };
      }
      return u;
    });

    // Если назначаем нового deputy — старого переводим в обычные админы
    if (editForm.role === 'deputy' && currentDeputy && currentDeputy.login !== editingUser) {
      updated = updated.map(u => u.login === currentDeputy.login
        ? { ...u, role: 'admin', isAdmin: true, deputyCity: undefined, deputyPerSale: undefined }
        : u
      );
    }

    saveUsers(updated);

    // Синхронизация name/role в employees
    const edited = updated.find(u => u.login === editingUser);
    if (edited) {
      const empMatch = employees.find(e => e.name === edited.name || e.name === editingUser);
      if (empMatch) {
        updateEmployees(employees.map(e => e.id === empMatch.id ? { ...e, name: edited.name, role: edited.role } : e));
      }
    }

    // Если редактируем самого себя — обновить currentUser
    if (editingUser === currentUser?.login) {
      const me = updated.find(u => u.login === editingUser);
      if (me) setCurrentUser(me);
    }
    setEditingUser(null);
    showNotification('Сохранено');
  };

  const handleDeleteUser = (login) => {
    if (login === currentUser?.login) { showNotification('Нельзя удалить себя', 'error'); return; }
    showConfirm(`Удалить аккаунт ${login}?`, () => {
      const updated = regUsers.filter(u => u.login !== login);
      saveUsers(updated);
      showNotification('Аккаунт удалён');
    });
  };

  const handleAddUser = async () => {
    setAddError('');
    if (!addForm.login.trim()) { setAddError('Введите логин'); return; }
    if (addForm.login.trim().length < 2) { setAddError('Логин минимум 2 символа'); return; }
    if (!addForm.password || addForm.password.length < 4) { setAddError('Пароль минимум 4 символа'); return; }
    if (regUsers.find(u => u.login.toLowerCase() === addForm.login.trim().toLowerCase())) {
      setAddError('Логин уже занят'); return;
    }
    if (addForm.role === 'deputy' && !addForm.deputyCity) {
      setAddError('Выберите город для замдиректора'); return;
    }

    // Уникальность deputy
    const okDeputy = await checkDeputyUniqueness(null, addForm.role);
    if (!okDeputy) return;

    const hashed = await hashPassword(addForm.password);
    const isDeputy = addForm.role === 'deputy';
    const newU = {
      login: addForm.login.trim(),
      name: (addForm.name.trim() || addForm.login.trim()),
      passwordHash: hashed,
      createdAt: Date.now(),
      role: addForm.role,
      isAdmin: addForm.role === 'admin' || isDeputy,
      noSalary: !!addForm.noSalary,
      ...(isDeputy
        ? { deputyCity: addForm.deputyCity, deputyPerSale: Math.max(0, Number(addForm.deputyPerSale) || 0) }
        : {}
      ),
    };

    let updated = [...regUsers, newU];

    // Если создаём deputy — старого переводим в обычные админы
    if (isDeputy && currentDeputy) {
      updated = updated.map(u => u.login === currentDeputy.login
        ? { ...u, role: 'admin', isAdmin: true, deputyCity: undefined, deputyPerSale: undefined }
        : u
      );
    }

    saveUsers(updated);
    if (!employees.find(e => e.name === newU.name)) {
      addEmployee(newU.name, newU.role);
    }
    setAddForm({ login: '', name: '', password: '', role: 'seller', deputyCity: '', deputyPerSale: 75, noSalary: false });
    setAddMode(false);
    showNotification(`Аккаунт ${newU.login} создан`);
  };

  // Если пользователь не админ — не рендерим
  if (!isMasterAdmin && currentUser?.role !== 'admin') return null;

  return (
    <div className={`rounded-2xl shadow border-2 border-purple-200 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Заголовок-аккордеон */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-purple-50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-gray-700">Управление сотрудниками</h3>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            {regUsers.length}
          </span>
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          {/* Кнопка добавления */}
          <button
            onClick={() => { setAddMode(!addMode); setAddError(''); }}
            className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${addMode ? 'bg-gray-200 text-gray-700' : 'bg-purple-500 text-white hover:bg-purple-600'}`}
          >
            {addMode ? <><X className="w-4 h-4" />Отмена</> : <><Plus className="w-4 h-4" />Добавить аккаунт</>}
          </button>

          {/* Форма добавления */}
          {addMode && (
            <div className="bg-purple-50 rounded-xl p-3 space-y-2 border border-purple-200">
              <input
                type="text"
                placeholder="Логин"
                value={addForm.login}
                onChange={(e) => setAddForm({ ...addForm, login: e.target.value })}
                className="w-full p-2 border-2 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Имя (необязательно)"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="w-full p-2 border-2 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              />
              <input
                type="password"
                placeholder="Пароль (мин. 4 симв.)"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full p-2 border-2 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              />
              <select
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full p-2 border-2 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
              >
                <option value="seller">🐦 Продавец</option>
                <option value="senior">⭐ Старший продавец</option>
                <option value="admin">🛡️ Администратор</option>
                <option value="deputy">🎖️ Замдиректор</option>
              </select>

              {/* Поля для замдиректора */}
              {addForm.role === 'deputy' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 space-y-2">
                  <p className="text-[11px] text-indigo-700 font-semibold">Управляет городом:</p>
                  <select
                    value={addForm.deputyCity}
                    onChange={(e) => setAddForm({ ...addForm, deputyCity: e.target.value })}
                    className="w-full p-2 border-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">— выберите город —</option>
                    {getCities().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-indigo-700 whitespace-nowrap">₽ за каждый товар:</label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.deputyPerSale}
                      onChange={(e) => setAddForm({ ...addForm, deputyPerSale: e.target.value })}
                      className="flex-1 p-2 border-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  {currentDeputy && (
                    <p className="text-[10px] text-amber-700">
                      ⚠ Сейчас замдиректор: {currentDeputy.name}. При сохранении он станет обычным админом.
                    </p>
                  )}
                </div>
              )}

              {/* Чекбокс "Не начислять ЗП" */}
              <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.noSalary}
                  onChange={(e) => setAddForm({ ...addForm, noSalary: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs text-gray-700">
                  💼 Не начислять ЗП <span className="text-gray-400">(для создателя/владельца)</span>
                </span>
              </label>

              {addError && <p className="text-red-500 text-xs">{addError}</p>}
              <button
                onClick={handleAddUser}
                className="w-full py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 text-sm"
              >
                Создать
              </button>
            </div>
          )}

          {/* Список пользователей */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {regUsers.length === 0 ? (
              <div className="text-center py-6">
                <Users className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">Нет зарегистрированных пользователей</p>
              </div>
            ) : (
              regUsers.map(user => {
                const roleInfo = ROLE_LABELS[user.role || 'seller'] || ROLE_LABELS.seller;
                const isEditing = editingUser === user.login;
                const isMe = user.login === currentUser?.login;

                if (isEditing) {
                  return (
                    <div key={user.login} className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 space-y-2">
                      <p className="text-xs text-gray-500">Редактирование {user.login}</p>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Имя"
                        className="w-full p-2 border-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full p-2 border-2 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="seller">🐦 Продавец</option>
                        <option value="senior">⭐ Старший продавец</option>
                        <option value="admin">🛡️ Администратор</option>
                        <option value="deputy">🎖️ Замдиректор</option>
                      </select>

                      {/* Поля для замдиректора */}
                      {editForm.role === 'deputy' && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2 space-y-2">
                          <p className="text-[11px] text-indigo-700 font-semibold">Управляет городом:</p>
                          <select
                            value={editForm.deputyCity}
                            onChange={(e) => setEditForm({ ...editForm, deputyCity: e.target.value })}
                            className="w-full p-2 border-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
                          >
                            <option value="">— выберите город —</option>
                            {getCities().map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-indigo-700 whitespace-nowrap">₽ за товар:</label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.deputyPerSale}
                              onChange={(e) => setEditForm({ ...editForm, deputyPerSale: e.target.value })}
                              className="flex-1 p-2 border-2 rounded text-sm focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          {currentDeputy && currentDeputy.login !== editingUser && (
                            <p className="text-[10px] text-amber-700">
                              ⚠ Сейчас замдиректор: {currentDeputy.name}. При сохранении он станет обычным админом.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Чекбокс "Не начислять ЗП" */}
                      <label className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.noSalary}
                          onChange={(e) => setEditForm({ ...editForm, noSalary: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-gray-700">
                          💼 Не начислять ЗП <span className="text-gray-400">(для создателя/владельца)</span>
                        </span>
                      </label>

                      {isMasterAdmin && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.isAdmin}
                            onChange={(e) => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                          />
                          Полные права админа (isAdmin)
                        </label>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 text-sm"
                        >
                          <Save className="w-4 h-4" />Сохранить
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-400 text-sm"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={user.login}
                    className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50 hover:bg-white transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{user.name}</span>
                        {isMe && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">я</span>}
                        {user.isAdmin && <Shield className="w-3 h-3 text-red-500" />}
                        {user.noSalary && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded" title="ЗП не начисляется">💼 без ЗП</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-gray-500">@{user.login}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleInfo.color}`}>
                          {roleInfo.icon} {roleInfo.label}
                        </span>
                        {user.role === 'deputy' && user.deputyCity && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                            📍 {user.deputyCity} · {user.deputyPerSale || 0}₽/товар
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartEdit(user)}
                      className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                      title="Редактировать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!isMe && (
                      <button
                        onClick={() => handleDeleteUser(user.login)}
                        className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* === БЛОК: ПРИЗРАКИ (employees без user) === */}
          {(() => {
            // Сотрудник-«призрак» — есть в employees, но ни одно имя/логин не совпадает с user
            const ghosts = (employees || []).filter(emp => {
              const matchByName = regUsers.find(u => u.name === emp.name || u.login === emp.name);
              return !matchByName;
            });

            if (ghosts.length === 0) return null;

            const removeGhost = (id, name) => {
              showConfirm(`Удалить «${name}»? Этот сотрудник появлялся в списках (график, штрафы), но не имеет аккаунта для входа.`, () => {
                updateEmployees(employees.filter(e => e.id !== id));
                showNotification(`Удалён: ${name}`);
              });
            };

            const deactivateGhost = (id, name) => {
              updateEmployees(employees.map(e => e.id === id ? { ...e, active: false } : e));
              showNotification(`Скрыт: ${name}`);
            };

            const removeAllGhosts = () => {
              showConfirm(`Удалить ВСЕХ ${ghosts.length} сотрудников без аккаунта?\n\nЭто действие необратимо. Их записи в графике, штрафах и бонусах останутся, но самих сотрудников не будет в списках выбора.`, () => {
                const ghostIds = new Set(ghosts.map(g => g.id));
                updateEmployees(employees.filter(e => !ghostIds.has(e.id)));
                showNotification(`Удалено: ${ghosts.length}`);
              });
            };

            return (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mt-3">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <h4 className="font-bold text-amber-800 flex items-center gap-2">
                    👻 Без аккаунта
                    <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                      {ghosts.length}
                    </span>
                  </h4>
                  <button
                    onClick={removeAllGhosts}
                    className="px-3 py-1 bg-red-500 text-white rounded text-xs font-semibold hover:bg-red-600 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Удалить всех
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 mb-3 leading-tight">
                  Эти сотрудники появляются в графике, штрафах и других списках, но у них нет аккаунта для входа.
                  Скорее всего это тестовые/демо-данные или удалённые сотрудники. Можете удалить или скрыть.
                </p>
                <div className="space-y-2">
                  {ghosts.map(emp => (
                    <div
                      key={emp.id}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{emp.name}</span>
                          {!emp.active && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                              скрыт
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          {emp.role === 'admin' ? '🛡️ Админ' : emp.role === 'senior' ? '⭐ Старший' : '🐦 Продавец'}
                          {' · id ' + emp.id}
                        </p>
                      </div>
                      {emp.active && (
                        <button
                          onClick={() => deactivateGhost(emp.id, emp.name)}
                          className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                          title="Скрыть (не удалять)"
                        >
                          Скрыть
                        </button>
                      )}
                      <button
                        onClick={() => removeGhost(emp.id, emp.name)}
                        className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        title="Удалить полностью"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Подсказка */}
          <p className="text-[11px] text-gray-400 leading-tight pt-2 border-t">
            💡 «Пользователи» — это аккаунты для входа. «Сотрудники» — записи о людях, используемые в отчётах, графике, штрафах. При регистрации по инвайт-коду они синхронизируются автоматически.
          </p>
        </div>
      )}
    </div>
  );
}
