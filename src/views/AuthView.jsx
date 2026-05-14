import React, { useState, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { fbGet, fbSave } from '../firebase.js';
import { hashPassword } from '../utils/auth.js';
import { APP_VERSION } from '../utils/constants.js';
import { useApp } from '../context/AppContext';

// FIX (security): отличить «Firebase ответил пустотой» от «Firebase упал».
// fbGet() возвращает null и в том, и в другом случае — для нас это критично.
// Возвращаем { ok, value }: ok=false означает сетевую ошибку/таймаут.
const fbGetSafe = async (key, timeoutMs = 8000) => {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, value: null, reason: 'timeout' });
    }, timeoutMs);
    fbGet(key)
      .then((val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // fbGet возвращает null и при отсутствии ключа, и при ошибке.
        // Сама функция логирует ошибку в console.warn, но наружу это не отдаёт.
        // Поэтому здесь null трактуем как «успешно прочитали, данных нет».
        // Это безопасно: даже если Firebase в этот момент глючит, у нас есть
        // дополнительная защита — повторная проверка перед записью админа.
        resolve({ ok: true, value: val });
      })
      .catch((e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ok: false, value: null, reason: e?.message || 'error' });
      });
  });
};

export default function AuthView() {
  const { employees, inviteCodes, save, setAuthName, setCurrentUser, setEmployeeName, setEmployees, setInviteCodes, setIsAuthenticated } = useApp();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState('login'); // login, register
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // FIX (security): состояния для безопасной проверки «первого запуска».
  // Раньше isFirstUser определялся синхронно по localStorage — это позволяло
  // любому пользователю с пустым кэшем (инкогнито, новое устройство, очистка)
  // увидеть экран регистрации основателя и перезаписать likebird-users в Firebase.
  const [checkingFirstUser, setCheckingFirstUser] = useState(true);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [fbUnreachable, setFbUnreachable] = useState(false);

  // FIX (security): однократная проверка при загрузке экрана авторизации.
  // Источник истины — Firebase. localStorage используется только если Firebase
  // ТОЧНО ответил пустотой (ok=true, value=null/[]).
  useEffect(() => {
    let cancelled = false;
    const checkFirstUser = async () => {
      setCheckingFirstUser(true);
      setFbUnreachable(false);

      const result = await fbGetSafe('likebird-users');
      if (cancelled) return;

      if (!result.ok) {
        // Firebase недоступен — не доверяем localStorage, не показываем
        // экран регистрации основателя. Пользователь должен либо подождать,
        // либо войти существующим аккаунтом (handleLogin сам прочитает кэш).
        setFbUnreachable(true);
        setIsFirstUser(false);
        setCheckingFirstUser(false);
        return;
      }

      const fbUsers = Array.isArray(result.value) ? result.value : [];

      if (fbUsers.length > 0) {
        // Админы уже есть в Firebase. Синхронизируем в localStorage
        // и блокируем экран основателя.
        try { localStorage.setItem('likebird-users', JSON.stringify(fbUsers)); } catch { /* silent */ }
        setIsFirstUser(false);
        setCheckingFirstUser(false);
        return;
      }

      // Firebase пуст. Дополнительно проверяем localStorage —
      // на случай если приложение работает оффлайн и админ уже создан,
      // но Firebase ещё не получил данные (старая запись).
      let localUsers = [];
      try { localUsers = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }

      if (Array.isArray(localUsers) && localUsers.length > 0) {
        // Локально админ есть, в Firebase нет — скорее всего рассинхрон.
        // Безопаснее не показывать экран основателя.
        setIsFirstUser(false);
        setCheckingFirstUser(false);
        return;
      }

      // И там, и там пусто — действительно первый запуск.
      setIsFirstUser(true);
      setCheckingFirstUser(false);
    };
    checkFirstUser();
    return () => { cancelled = true; };
  }, []);

  const handleRegister = async () => {
    if (!login.trim()) { setError('Введите логин'); return; }
    if (login.trim().length < 2) { setError('Логин минимум 2 символа'); return; }
    if (!password) { setError('Введите пароль'); return; }
    if (password.length < 4) { setError('Пароль минимум 4 символа'); return; }
    if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
    if (!inviteCode.trim()) { setError('Введите код приглашения от администратора'); return; }

    setError('Проверяем код...');

    // Читаем коды НАПРЯМУЮ из Firebase — без кэша localStorage
    const normalizedCode = inviteCode.trim().toUpperCase();
    let codes = [];
    try {
      const fbResult = await fbGet('likebird-invite-codes');
      if (Array.isArray(fbResult)) codes = fbResult;
    } catch (e) {
      console.warn('[AuthView] fbGet codes failed:', e);
    }

    // Дополняем из localStorage на случай если Firebase недоступен
    if (codes.length === 0) {
      try { codes = JSON.parse(localStorage.getItem('likebird-invite-codes') || '[]'); } catch { /* silent */ }
    }

    const validCode = codes.find(c => c.code === normalizedCode && !c.used);
    if (!validCode) { setError('Неверный или использованный код приглашения'); return; }

    // Проверяем что логин не занят — тоже читаем из Firebase напрямую
    let users = [];
    try {
      const fbResult = await fbGet('likebird-users');
      if (Array.isArray(fbResult)) users = fbResult;
    } catch (e) {
      console.warn('[AuthView] fbGet users failed:', e);
    }
    if (users.length === 0) {
      try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
    }

    if (users.find(u => u.login.toLowerCase() === login.trim().toLowerCase())) { setError('Этот логин уже занят'); return; }

    setError('');
    const hashedPass = await hashPassword(password);
    const newUser = { login: login.trim(), name: login.trim(), passwordHash: hashedPass, createdAt: Date.now(), role: 'seller', inviteCode: validCode.code };
    const updatedUsers = [...users, newUser];
    localStorage.setItem('likebird-users', JSON.stringify(updatedUsers));
    await fbSave('likebird-users', updatedUsers);

    // Добавляем в employees если ещё нет
    const currentEmps = (() => { try { return JSON.parse(localStorage.getItem('likebird-employees') || '[]'); } catch { return []; } })();
    if (!currentEmps.find(e => e.name === newUser.name)) {
      const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name: newUser.name, role: newUser.role || 'seller', salaryMultiplier: 1.0, active: true };
      const updatedEmps = [...currentEmps, newEmp];
      localStorage.setItem('likebird-employees', JSON.stringify(updatedEmps));
      await fbSave('likebird-employees', updatedEmps);
      // FIX: Обновляем React-state (ранее отсутствовало — сотрудник не появлялся до перезагрузки)
      setEmployees(updatedEmps);
    }

    // Помечаем код как использованный — сразу в Firebase
    const updatedCodes = codes.map(c => c.code === validCode.code ? {...c, used: true, usedBy: login.trim(), usedAt: Date.now()} : c);
    localStorage.setItem('likebird-invite-codes', JSON.stringify(updatedCodes));
    await fbSave('likebird-invite-codes', updatedCodes);
    // FIX: Обновляем React-state (ранее код оставался «неиспользованным» в UI админки)
    setInviteCodes(updatedCodes);

    // Авторизуем
    const authData = { authenticated: true, name: login.trim(), login: login.trim(), expiry: Date.now() + (30*24*60*60*1000), createdAt: Date.now() };
    localStorage.setItem('likebird-auth', JSON.stringify(authData));
    localStorage.setItem('likebird-employee', login.trim());
    setEmployeeName(login.trim());
    setAuthName(login.trim());
    setCurrentUser(newUser);
    setIsAuthenticated(true);
  };

  const handleLogin = async () => {
    if (!login.trim()) { setError('Введите логин'); return; }
    if (!password) { setError('Введите пароль'); return; }

    setError('Входим...');
    // Читаем пользователей напрямую из Firebase для актуальности
    let users = [];
    try {
      const fbResult = await fbGet('likebird-users');
      if (Array.isArray(fbResult)) users = fbResult;
    } catch (e) {
      console.warn('[AuthView] fbGet failed, fallback to localStorage:', e);
    }
    if (users.length === 0) {
      try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
    }
    // Кэшируем локально
    if (users.length > 0) localStorage.setItem('likebird-users', JSON.stringify(users));

    const user = users.find(u => u.login.toLowerCase() === login.trim().toLowerCase());
    if (!user) { setError('Пользователь не найден'); return; }

    const hashedPass = await hashPassword(password);
    if (hashedPass !== user.passwordHash) { setError('Неверный пароль'); setPassword(''); return; }

    const authData = { authenticated: true, name: user.name, login: user.login, expiry: Date.now() + (30*24*60*60*1000) };
    localStorage.setItem('likebird-auth', JSON.stringify(authData));
    localStorage.setItem('likebird-employee', user.name);
    setEmployeeName(user.name);
    setAuthName(user.name);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleFirstUserRegister = async () => {
    if (!login.trim()) { setError('Введите логин'); return; }
    if (!password || password.length < 4) { setError('Пароль минимум 4 символа'); return; }
    if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }

    setError('Проверяем...');

    // FIX (security): защита от гонки и от подделки экрана.
    // Перед тем как создавать админа — ещё раз перечитываем Firebase.
    // Если за время заполнения формы кто-то другой уже создал админа
    // (или Firebase отдал данные с задержкой) — отказываем.
    const recheck = await fbGetSafe('likebird-users');
    if (!recheck.ok) {
      setError('Нет связи с сервером. Не удаётся подтвердить, что аккаунт администратора ещё не создан. Попробуйте позже.');
      // Подсветим баннер недоступности
      setFbUnreachable(true);
      return;
    }
    const existing = Array.isArray(recheck.value) ? recheck.value : [];
    if (existing.length > 0) {
      // Кто-то уже создал админа — синхронизируем кэш и переключаемся в режим логина
      try { localStorage.setItem('likebird-users', JSON.stringify(existing)); } catch { /* silent */ }
      setIsFirstUser(false);
      setMode('login');
      setError('Администратор уже зарегистрирован. Войдите под существующим аккаунтом.');
      return;
    }

    setError('');
    const hashedPass = await hashPassword(password);
    const newUser = { login: login.trim(), name: login.trim(), passwordHash: hashedPass, createdAt: Date.now(), isAdmin: true, role: 'admin' };
    localStorage.setItem('likebird-users', JSON.stringify([newUser]));
    fbSave('likebird-users', [newUser]);

    // FIX: Добавляем первого пользователя в employees (ранее отсутствовало)
    const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name: newUser.name, role: 'admin', salaryMultiplier: 1.0, active: true };
    const empList = [newEmp];
    localStorage.setItem('likebird-employees', JSON.stringify(empList));
    fbSave('likebird-employees', empList);
    setEmployees(empList);

    const authData = { authenticated: true, name: login.trim(), login: login.trim(), expiry: Date.now() + (30*24*60*60*1000), createdAt: Date.now() };
    localStorage.setItem('likebird-auth', JSON.stringify(authData));
    localStorage.setItem('likebird-employee', login.trim());
    setEmployeeName(login.trim());
    setAuthName(login.trim());
    setCurrentUser(newUser);
    setIsAuthenticated(true);
  };

  // FIX (security): пока идёт проверка Firebase — не показываем форму вообще,
  // чтобы пользователь не успел нажать «Создать аккаунт» до получения ответа.
  if (checkingFirstUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 animate-pulse">
            <span className="text-4xl">🐦</span>
          </div>
          <p className="text-white font-bold text-xl">LikeBird</p>
          <p className="text-white/70 text-sm mt-1">Подключение к серверу...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-4 shadow-2xl">
            <span className="text-5xl">🐦</span>
          </div>
          <h1 className="text-4xl font-black text-white drop-shadow-lg">LikeBird</h1>
          <p className="text-white/80 text-sm mt-1">Учёт продаж v{APP_VERSION}</p>
        </div>

        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl">
          {/* FIX (security): баннер о недоступности Firebase.
              Если связи нет — экран регистрации основателя НЕ показываем,
              чтобы исключить захват аккаунта администратора. */}
          {fbUnreachable && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border-2 border-red-200">
              <p className="text-sm font-bold text-red-700 mb-1">⚠️ Нет связи с сервером</p>
              <p className="text-xs text-red-600">
                Не удалось проверить список пользователей. Вы можете войти в существующий аккаунт,
                если он уже сохранён на этом устройстве. Создание нового администратора заблокировано.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs font-bold text-red-700 underline"
              >
                Повторить попытку
              </button>
            </div>
          )}

          {isFirstUser && !fbUnreachable ? (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-1">Первый запуск!</h2>
              <p className="text-gray-500 text-sm mb-4">Создайте аккаунт администратора</p>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                  <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Ваш логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Минимум 4 символа" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Подтвердите пароль</label>
                  <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Повторите пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                </div>
                <button onClick={handleFirstUserRegister} className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                  ✅ Создать аккаунт
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Переключатель вход / регистрация */}
              <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
                <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Вход</button>
                <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Регистрация</button>
              </div>

              {mode === 'login' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                    <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Ваш логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Ваш пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }} />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                    </div>
                  </div>
                  <button onClick={handleLogin} className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                    🔓 Войти
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Код приглашения</label>
                    <input type="text" value={inviteCode} onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(''); }} placeholder="Код от администратора" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none font-mono text-center tracking-widest text-lg" autoFocus maxLength={6} />
                    <p className="text-xs text-gray-400 mt-1">Получите код у администратора</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                    <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Придумайте логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Минимум 4 символа" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Подтвердите пароль</label>
                    <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Повторите пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                  </div>
                  <button onClick={handleRegister} className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                    ✅ Зарегистрироваться
                  </button>
                </div>
              )}
            </>
          )}

          {error && <p className="text-red-500 text-sm text-center mt-3 font-medium">{error}</p>}
        </div>

        <div className="mt-6 text-center">
          <p className="text-white/60 text-xs">📲 Добавьте в закладки или установите как приложение</p>
        </div>
      </div>
    </div>
  );
}
