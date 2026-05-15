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
  } = useApp();

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
  const [editForm, setEditForm] = useState({ name: '', role: 'seller', isAdmin: false });
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState({ login: '', name: '', password: '', role: 'seller' });
  const [addError, setAddError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const isMasterAdmin = currentUser?.isAdmin === true;

  const ROLE_LABELS = {
    seller: { label: 'Продавец', color: 'bg-purple-100 text-purple-700', icon: '🐦' },
    senior: { label: 'Старший продавец', color: 'bg-amber-100 text-amber-700', icon: '⭐' },
    admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: '🛡️' },
  };

  const saveUsers = (updated) => {
    setRegUsers(updated);
    localStorage.setItem('likebird-users', JSON.stringify(updated));
    fbSave('likebird-users', updated);
  };

  const handleStartEdit = (user) => {
    setEditingUser(user.login);
    setEditForm({ name: user.name, role: user.role || 'seller', isAdmin: !!user.isAdmin });
  };

  const handleSaveEdit = () => {
    if (!editForm.name?.trim()) { showNotification('Имя не может быть пустым', 'error'); return; }
    const updated = regUsers.map(u => u.login === editingUser
      ? { ...u, name: editForm.name.trim(), role: editForm.role, isAdmin: editForm.isAdmin || editForm.role === 'admin' }
      : u
    );
    saveUsers(updated);
    // Синхронизируем name/role с employees
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
    const hashed = await hashPassword(addForm.password);
    const newU = {
      login: addForm.login.trim(),
      name: (addForm.name.trim() || addForm.login.trim()),
      passwordHash: hashed,
      createdAt: Date.now(),
      role: addForm.role,
      isAdmin: addForm.role === 'admin',
    };
    saveUsers([...regUsers, newU]);
    if (!employees.find(e => e.name === newU.name)) {
      addEmployee(newU.name, newU.role);
    }
    setAddForm({ login: '', name: '', password: '', role: 'seller' });
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
              </select>
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
                      </select>
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
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-gray-500">@{user.login}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${roleInfo.color}`}>
                          {roleInfo.icon} {roleInfo.label}
                        </span>
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

          {/* Подсказка */}
          <p className="text-[11px] text-gray-400 leading-tight pt-2 border-t">
            💡 Сотрудники без аккаунта (в employees, но не в users) создаются автоматически
            при регистрации по инвайт-коду или вручную здесь.
          </p>
        </div>
      )}
    </div>
  );
}
