/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, no-shadow, eqeqeq, no-fallthrough, no-unreachable, no-redeclare */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShoppingBag, FileText, BarChart3, Plus, Search, ArrowLeft, Trash2, X, FileInput, AlertTriangle, Check, AlertCircle, ChevronLeft, ChevronRight, Edit3, Clock, Package, Bell, RefreshCw, Download, Upload, Copy, Settings, Calendar, RotateCcw, Info, CheckCircle, Shield, DollarSign, Users, Lock, TrendingUp, Award, MapPin, Archive, MessageCircle, Star, Camera, Image, LogOut, Key, Wifi, WifiOff, Eye, EyeOff, Smartphone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { fbSave, fbSubscribe, fbGet, fbSetPresence, fbSubscribePresence, SYNC_KEYS } from './firebase.js';
import { calculateSalary, isBelowBasePrice } from './utils/salary.js';
import { PRODUCTS, AMBIGUOUS_PRODUCTS, ALL_PRODUCTS, CAT_ICONS } from './data/products.js';
import { checkCashless, parseWorkTime, findProductByPrice, parseExpenses, parseInventory, countSoldProducts, compareInventory, parseTextReport } from './utils/parser.js';
import { hashPassword } from './utils/auth.js';
import { formatDate, dateForFile, useDebounce, parseRuDate, parseYear } from './utils/dates.js';
import { APP_VERSION, DATA_VERSION } from './utils/constants.js';
import { downloadBlob, getInitialStock, logErr } from './utils/helpers.js';
import { SyncManager } from './services/sync.js';
import { AppProvider } from './context/AppContext.jsx';
import LikeBirdErrorBoundary from './components/ui/ErrorBoundary.jsx';
import KpiGoalsPanel from './components/ui/KpiGoalsPanel.jsx';
import BirdPriceEditor from './components/inventory/BirdPriceEditor.jsx';
import ItemsEditor from './components/inventory/ItemsEditor.jsx';
import RevisionTextInput from './components/inventory/RevisionTextInput.jsx';
import CatalogView from './views/CatalogView.jsx';
import MenuView from './views/MenuView.jsx';
import NotificationsView from './views/NotificationsView.jsx';
import GameView from './views/GameView.jsx';
import SettingsView from './views/SettingsView.jsx';
import TextImportView from './views/TextImportView.jsx';
import NewReportView from './views/NewReportView.jsx';
import StockView from './views/StockView.jsx';
import ReportsView from './views/ReportsView.jsx';
import DayReportView from './views/DayReportView.jsx';
import AnalyticsView from './views/AnalyticsView.jsx';
import TeamView from './views/TeamView.jsx';
import ShiftView from './views/ShiftView.jsx';
import ProfileView from './views/ProfileView.jsx';
import AuthView from './views/AuthView.jsx';
import AdminView from './views/AdminView.jsx';

// ===== PWA: Регистрация Service Worker =====
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}



// Динамический список всех товаров (включая кастомные) - будет обновляться в компоненте
let DYNAMIC_ALL_PRODUCTS = [...ALL_PRODUCTS];

// Загружаем кастомные алиасы при инициализации
let CUSTOM_ALIASES = {};
try {
  const saved = localStorage.getItem('likebird-custom-aliases');
  if (saved) CUSTOM_ALIASES = JSON.parse(saved);
} catch { /* silent */ }





export default function LikeBirdApp() {
  return React.createElement(LikeBirdErrorBoundary, null, React.createElement(LikeBirdAppInner));
};

function LikeBirdAppInner() {
  // ===== АВТОРИЗАЦИЯ =====
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // полный объект user из likebird-users
  const [authLoading, setAuthLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'register', 'forgot'
  const [authPin, setAuthPin] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // ===== PWA =====
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // ===== SYNC =====

  
  // ===== Состояния перенесённые на уровень компонента (FIX: useState в IIFE) =====
  const [analyticsPeriod, setAnalyticsPeriod] = useState(7);
  const [manualFilter, setManualFilter] = useState('all');

  const [currentView, _setCurrentView] = useState('menu');
  const [chatLimit, setChatLimit] = useState(50);
  const viewHistoryRef = useRef(['menu']);
  const skipPopRef = useRef(false);
  const setCurrentView = useCallback((v, { replace = false } = {}) => {
    _setCurrentView(v);
    try { window.scrollTo(0, 0); } catch { /* silent */ }
    if (replace) {
      viewHistoryRef.current[viewHistoryRef.current.length - 1] = v;
      try { window.history.replaceState({ view: v }, ''); } catch { /* silent */ }
    } else {
      viewHistoryRef.current.push(v);
      try { window.history.pushState({ view: v }, ''); } catch { /* silent */ }
    }
  }, []);
  // Browser back/forward button support
  useEffect(() => {
    const onPopState = (e) => {
      const hist = viewHistoryRef.current;
      if (hist.length > 1) {
        hist.pop();
        const prev = hist[hist.length - 1] || 'menu';
        _setCurrentView(prev);
        try { window.scrollTo(0, 0); } catch { /* silent */ }
      } else {
        // Already at menu — push state back so user can't leave app
        try { window.history.pushState({ view: 'menu' }, ''); } catch { /* silent */ }
      }
    };
    window.addEventListener('popstate', onPopState);
    // Push initial state
    try { window.history.replaceState({ view: 'menu' }, ''); } catch { /* silent */ }
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stock, setStock] = useState(getInitialStock);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [salePrice, setSalePrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [employeeName, setEmployeeName] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [tipsAmount, setTipsAmount] = useState('');
  const [textReport, setTextReport] = useState('');
  const [parsedSales, setParsedSales] = useState([]);
  const [unrecognizedSales, setUnrecognizedSales] = useState([]);
  const [parsedWorkTime, setParsedWorkTime] = useState(null);
  const [parsedExpenses, setParsedExpenses] = useState([]);
  const [parsedInventory, setParsedInventory] = useState({ start: {}, end: {} });
  const [inventoryDiscrepancies, setInventoryDiscrepancies] = useState([]);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  const [givenToAdmin, setGivenToAdmin] = useState({});
  const [salaryDecisions, setSalaryDecisions] = useState({});
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [ownCardTransfers, setOwnCardTransfers] = useState({});
  const [stockCategory, setStockCategory] = useState('Птички-свистульки');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedCashless, setMixedCashless] = useState('');
  const [salePhotoGlobal, setSalePhotoGlobal] = useState(null);
  const [saleLocationGlobal, setSaleLocationGlobal] = useState('');
  // FIX #56: Notification через useRef + DOM, НЕ через useState.
  // Причина: showNotification вызывала setNotification → parent re-render → 
  // все inner-компоненты (ShiftView, StockView, AdminView и др.) пересоздавались → 
  // их локальный useState терялся. Это корневая причина ~80% багов с потерей данных.
  const notificationRef = useRef(null);
  const notificationTimerRef = useRef(null);
  // FIX #56b: ConfirmDialog тоже через ref + DOM (та же проблема что и с notification)
  const confirmDialogRef = useRef(null);
  const confirmCallbackRef = useRef(null);
  // FIX: React-стейт для модала расходов (заменяет DOM-манипуляцию)
  const [expenseModal, setExpenseModal] = useState(null); // { employee: string }
  const [partnerStock, setPartnerStock] = useState({});
  const [totalBirds, setTotalBirds] = useState(0);
  const [scheduleData, setScheduleData] = useState({});
  const [eventsCalendar, setEventsCalendar] = useState({});
  
  // Мануалы и обучающие материалы
  const [manuals, setManuals] = useState([
    {
      id: 1,
      title: '🐦 Методичка по продаже птичек-свистулек',
      category: 'sales',
      content: `МЕТОДИЧКА ПО ПРОДАЖЕ ПТИЧКИ-СВИСТУЛЬКИ

📋 ПОДГОТОВКА К РАБОТЕ

[1.] Самое важное: опрятный вид, чистый стол, салфетки на столе (если нету — покупаем, с кассы берём потом).

С вечера нужно воду набрать, птиц посчитать, чтобы утром нужно было только покушать и обуться.

⚠️ На точке важно стоять одному! Причины:
• Понижается концентрация на работе (редко свистишь, много разговариваешь)
• Снижается эффективность КПД продавца
• Вдвоём на одной точке продадите 35-40, на двух по 30 на стол и больше

❌ ЧТО НЕЛЬЗЯ ДЕЛАТЬ НА РАБОЧЕМ МЕСТЕ:
• Материться
• Курить (в т.ч вейпы, для этого можно отойти)
• Залипать/болтать в телефоне (внимание направляем на проходящих людей)
• Кушать на столе с товаром
• Уходить не предупредив
• Стоять совместно с друзьями/проходимцами

💬 ДИАЛОГ С КЛИЕНТОМ

Первым делом ловим взгляды и внимание, которые привлекаем чудным пением птиц.

Когда замечаешь взгляд 2 раза (идут смотрят, потом обернулись, или обсудили и посмотрели ещё раз) — вступаем в диалог:

"Добрый день! Подходите, почирикаем! Научу вас 3-м интересным трюкам на этой птичке"

➡️ Красиво свистишь чередуя ноты, выполняешь 2 простых трюка максимально правдоподобно изобразить звук настоящей птицы.

❓ "Ой что это у вас?"
✅ "Птички свистульки ручной работы, это полноценный одно-нотный музыкальный инструмент."

💡 Часто на этом моменте спрашивают цену — если не спрашивают, не говорите сразу, постарайтесь сначала максимально заинтересовать. (если повторяет вопрос — от 300 и выше)

🎯 ДЕМОНСТРАЦИЯ

Протягиваешь клиенту птичку объясняя как пользоваться:
"Дуете в самый край хвостика — в кружочек, не закрывая свисток (треугольник на кончике)"

❗ Важно прям вручить птицу как можно большему количеству людей из подошедших!

После того как человек свистнул:
"Отлично! Молодцом, а теперь я покажу вам 3 упражнения, которые развивают дыхательную систему:"

1️⃣ Глубоко вдыхаем, и плавно выдыхаем перебирая ноту — это разминка на объем легких

2️⃣ На выдохе произносим букву РРрр в свистульку — развивает мышцы языка! (для картавых — можно гортанным способом)

3️⃣ Гудим в птицу, произносим букву О/А/Ы — укрепляем голосовые связки, так музыканты распеваются перед сценой

🛒 ЗАКРЫТИЕ СДЕЛКИ

"Прекрасная птичка, мало того интересная и привлекает много внимания, так ещё и полезная! Какая понравилась?"

При раздумьях клиента используйте эпитеты:
• Соловей громко свистит и более прочный
• Снегирь более крутой и заливистый
• Собаки певчие, канарейки свистящие

💰 РАБОТА С ВОЗРАЖЕНИЯМИ

❓ "Ой а это дорого"
✅ "Это ручная работа, труд лепщика, скульптора, художника, а так же продавца. Полезный и красивый сувенир который точно порадует получателя"

❓ "Сделайте скидку"
✅ "Конкретно этот предмет — маленькая принцесса, заточённая злой колдуньей в птичку и поэтому я не снижу цену ни на копеечку!"

😄 Если серьёзно — мы получаем с птицы по 100 рублей и очень любим кушать пельмени и к ним ещё и майонез покупать.

❓ "Мне не хватает"
✅ Могу уступить 50-100р если совсем нет денег (но лучше сделать наценку заранее и её использовать в качестве скидки)

✅ "Ладно беру"
✅ "Чаевые приветствуются!"

⭐ ВАЖНО: Никогда не скупитесь на ценник! Лучше клиент купит без выгоды для вас, но это добавит вам +продажу к плану на бонусы — лучше чем ничего!

У каждого индивидуальный подход, но советую ознакомиться с этим текстом и изучив базу брать лучшее, вырабатывая свою собственную стратегию продаж.`,
      isPinned: true
    },
    {
      id: 2,
      title: '💰 Расчёт зарплаты',
      category: 'info',
      content: `КАК РАССЧИТЫВАЕТСЯ ЗАРПЛАТА

📊 Базовая ставка зависит от цены продажи:
• от 2001₽ и выше — 300₽
• от 1400₽ до 2000₽ — 300₽
• от 1000₽ до 1399₽ — 200₽
• от 300₽ до 999₽ — 100₽
• от 100₽ до 299₽ — 50₽
• до 99₽ — 50₽

🎁 Чаевые — 100% ваши!

🐦 Бонус за птичек-свистулек — +50₽ за каждую продажу!

💡 Формула: Базовая ставка + Чаевые + Бонус за птичек (50₽)

Пример:
Снегирь продан за 600₽ + чаевые от клиента 100₽ = 100₽ (база) + 100₽ (чаевые) + 50₽ (птичка) = 250₽`,
      isPinned: false
    },
    {
      id: 3,
      title: '❓ Частые вопросы',
      category: 'faq',
      content: `ЧАСТЫЕ ВОПРОСЫ (FAQ)

❓ Как заполнять отчёт?
✅ Используйте "Импорт отчёта" — введите текст в свободной форме, система сама распознает продажи.

❓ Что делать если товара нет в каталоге?
✅ Продажа запишется как "нераспознанная". Админ может добавить товар или исправить запись.

❓ Как работает время редактирования?
✅ После сохранения продажи у вас есть 20 минут на редактирование. После — только админ может изменить.

❓ Что значит "переводы на свою карту"?
✅ Если клиент переводит на вашу личную карту — отметьте это галочкой, чтобы сумма учлась в расчёте "К выдаче".

❓ Как узнать свой график?
✅ Раздел "Команда" → вкладка "График"

❓ Куда писать расходы?
✅ В "Итог дня" есть кнопка "Добавить расход" — укажите описание и сумму.`,
      isPinned: false
    }
  ]);
  
  // ИСПРАВЛЕНИЕ #1: Состояние для настроек зарплаты (теперь работает!)
  const [salarySettings, setSalarySettings] = useState({
    ranges: [
      { min: 2001, max: 99999, base: 300 },
      { min: 1400, max: 2000, base: 300 },
      { min: 1000, max: 1399, base: 200 },
      { min: 300, max: 999, base: 100 },
      { min: 100, max: 299, base: 50 },
      { min: 0, max: 99, base: 50 },
    ],
    bonusForBirds: true,
    // ЗП администратора — новый режим выбора
    adminSalaryMode: 'percentage', // 'percentage' | 'perSale'
    adminSalaryPercentage: 10,     // используется когда mode === 'percentage'
    adminSalaryPerSale: 50,        // используется когда mode === 'perSale' (фикс ₽ за каждую продажу)
  });

  // НОВОЕ: Расширенные состояния для админ-панели
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  // Админ-импорт: позволяет админу импортировать отчёт за любого сотрудника не меняя свою сессию
  const [adminImportMode, setAdminImportMode] = useState(false);
  const [adminTab, setAdminTab] = useState('analytics');
  // FIX (tabs): подвкладки админки подняты на уровень LikeBirdApp.
  // Раньше personnelTab / stockTab / analyticsSubTab были useState внутри inline-компонента
  // AdminView (объявлен как const AdminView = () => {...} внутри LikeBirdApp). При любом
  // ре-рендере родителя (Firebase-подписки, presence, setReports, setStock, таймеры и т.д.)
  // создавалась новая ссылка на функцию AdminView, React видел "другой тип компонента",
  // полностью размонтировал старый и монтировал новый — все локальные useState сбрасывались
  // к начальным значениям, и пользователя выбрасывало на первую вкладку раздела
  // ("👥 Сотрудники", "📦 Товары", "📊 Сегодня"). Подняв их в state родителя, мы делаем
  // их устойчивыми к ре-маунту AdminView. Тот же приём уже применён к adminTab и teamTab.
  const [personnelTab, setPersonnelTab] = useState('ratings');
  const [stockTab, setStockTab] = useState('locations');
  const [analyticsSubTab, setAnalyticsSubTab] = useState('today');
  const [challengeForm, setChallengeForm] = useState({ title: '', icon: '🏆', type: 'daily', metric: 'sales_count', target: 10, product: '', reward: '' });
  const [teamTab, setTeamTab] = useState('online');
  const [employees, setEmployees] = useState([]);
  const [expenseCategories] = useState([
    { id: 'supplies', name: 'Закупка товара', emoji: '📦' },
    { id: 'rent', name: 'Аренда', emoji: '🏠' },
    { id: 'ads', name: 'Реклама', emoji: '📣' },
    { id: 'transport', name: 'Транспорт', emoji: '🚗' },
    { id: 'other', name: 'Прочее', emoji: '📝' },
  ]);
  const [salesPlan, setSalesPlan] = useState({ daily: 10000, weekly: 70000, monthly: 300000 });
  const [auditLog, setAuditLog] = useState([]);
  const [customProducts, setCustomProducts] = useState([]);
  const [archivedProducts, setArchivedProducts] = useState(() => { try { return JSON.parse(localStorage.getItem('likebird-archived-products') || '[]'); } catch { return []; } });
  const toggleArchiveProduct = (name) => { const isArch = archivedProducts.includes(name); const upd = isArch ? archivedProducts.filter(n => n !== name) : [...archivedProducts, name]; setArchivedProducts(upd); save('likebird-archived-products', upd); };

  // ===== НОВЫЕ СОСТОЯНИЯ v2.4 =====
  
  // Мультиточки и локации
  const [locations, setLocations] = useState([
    { id: 1, city: 'Ростов-на-Дону', name: 'Пушкинская улица (пить кофе)', active: true },
    { id: 2, city: 'Ростов-на-Дону', name: 'Соборный переулок (Университет)', active: true },
    { id: 3, city: 'Ейск', name: 'Набережная', active: true },
    { id: 4, city: 'Ейск', name: 'Центр', active: true },
  ]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Себестоимость товаров (только для админа)
  const [costPrices, setCostPrices] = useState({});
  
  // Штрафы и бонусы
  const [penalties, setPenalties] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  
  // Больничные и отпуска
  const [timeOff, setTimeOff] = useState([]);
  
  // Рейтинг сотрудников
  const [employeeRatings, setEmployeeRatings] = useState({});
  
  // Чат/комментарии
  const [chatMessages, setChatMessages] = useState([]);
  
  // История движения товара
  const [stockHistory, setStockHistory] = useState([]);
  
  // Брак и списания
  const [writeOffs, setWriteOffs] = useState([]);
  
  // Автозаказ (список для заказа)
  const [autoOrderList, setAutoOrderList] = useState([]);
  
  // KPI и цели сотрудников
  const [employeeKPI, setEmployeeKPI] = useState({});
  // Пользовательские алиасы для распознавания товаров
  const [customAliases, setCustomAliases] = useState({});
  
  // Global alias save function
  const saveAlias = (alias, productName) => {
    if (!alias?.trim() || !productName) return;
    const key = alias.toLowerCase().trim();
    const updated = { ...customAliases, [key]: productName };
    setCustomAliases(updated);
    localStorage.setItem('likebird-custom-aliases', JSON.stringify(updated));
    CUSTOM_ALIASES = updated;
    save('likebird-custom-aliases', updated);
    showNotification(`Алиас «${alias}» → ${productName} ✓`);
  };
  const removeAlias = (alias) => {
    const updated = { ...customAliases };
    delete updated[alias.toLowerCase().trim()];
    setCustomAliases(updated);
    localStorage.setItem('likebird-custom-aliases', JSON.stringify(updated));
    CUSTOM_ALIASES = updated;
    save('likebird-custom-aliases', updated);
  };
  // Онлайн-присутствие сотрудников { login: { displayName, lastSeen, online } }
  const [presenceData, setPresenceData] = useState({});

  // Системные уведомления для пользователей (Firebase-synced)
  const [userNotifications, setUserNotifications] = useState([]);
  
  // Настройки умных уведомлений
  const [notifSettings, setNotifSettings] = useState({
    shiftReminder: true,
    lowStockAlert: true,
    stockThreshold: 3,
  });

  // FIX: Коды приглашения — перенесено из AdminView в глобальное состояние для Firebase-синхронизации
  const [inviteCodes, setInviteCodes] = useState([]);

  // Кастомные достижения (созданные администратором)
  const [customAchievements, setCustomAchievements] = useState([]);
  // Смены сотрудников: { 'login_date': { openTime, closeTime, status, confirmedAt } }
  const [shiftsData, setShiftsData] = useState({});
  // Выданные вручную достижения { achievementId: [login1, login2, ...] }
  const [achievementsGranted, setAchievementsGranted] = useState({});
  
  // ===== Профили сотрудников (аватар, bio, синхронизируется) =====
  const [profilesData, setProfilesData] = useState({});
  
  // Уведомления системы
  const [systemNotifications, setSystemNotifications] = useState([]);
  
  // Фильтры для поиска
  const [searchFilters, setSearchFilters] = useState({ query: '', dateFrom: '', dateTo: '', employee: '', location: '' });
  
  // Аналитика - кэш данных
  const [analyticsCache, setAnalyticsCache] = useState(null);

  // === BLOCK 9: Dark Theme ===
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('likebird-dark-mode') === 'true'; } catch { return false; }
  });

  // === BLOCK 7: Gamification — Challenges ===
  const [challenges, setChallenges] = useState([]);

  // === BLOCK 4: Product Photos (MediaStore — per-photo Firebase keys) ===
  const [productPhotos, setProductPhotos] = useState({});
  const [shiftPhotos, setShiftPhotos] = useState({});
  const mediaKeysRef = useRef(new Set());

  // === BLOCK 11: Offline Queue (placeholder for future use) ===
  // syncQueue data is loaded from localStorage on demand


  // === BLOCK 9: Dark Theme CSS injection ===
  useEffect(() => {
    const styleId = 'likebird-dark-theme';
    let styleEl = document.getElementById(styleId);
    if (darkMode) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        .dark-theme { --bg-primary: #1a1a2e; --bg-card: #16213e; --text-primary: #e0e0e0; --text-secondary: #a0a0a0; --border: #2a2a4a; }
        .dark-theme .bg-white { background: var(--bg-card) !important; color: var(--text-primary) !important; }
        .dark-theme .bg-gradient-to-b, .dark-theme .min-h-screen { background: var(--bg-primary) !important; }
        .dark-theme .bg-gradient-to-br { background: linear-gradient(135deg, #1a1a2e, #16213e) !important; }
        .dark-theme .from-amber-50, .dark-theme .via-orange-50, .dark-theme .to-amber-100 { --tw-gradient-from: #1a1a2e !important; --tw-gradient-to: #16213e !important; }
        .dark-theme .text-gray-600, .dark-theme .text-gray-500, .dark-theme .text-gray-400, .dark-theme .text-gray-700, .dark-theme .text-gray-800 { color: var(--text-secondary) !important; }
        .dark-theme .bg-gray-100, .dark-theme .bg-gray-50, .dark-theme .bg-amber-50, .dark-theme .bg-orange-50 { background: #1e2a3a !important; }
        .dark-theme .border-gray-200, .dark-theme .border-gray-100 { border-color: var(--border) !important; }
        .dark-theme input, .dark-theme textarea, .dark-theme select { background: #1e2a3a !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .dark-theme .shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; }
        .dark-theme .bg-amber-100, .dark-theme .bg-orange-100, .dark-theme .bg-blue-50, .dark-theme .bg-green-50 { background: #1e2a3a !important; }
        .dark-theme .text-amber-600 { color: #fbbf24 !important; }
        .dark-theme h3, .dark-theme h2, .dark-theme h1 { color: #e0e0e0 !important; }
        .dark-theme .bg-gradient-to-r.from-amber-400, .dark-theme .sticky { background: linear-gradient(to right, #d97706, #ea580c) !important; }
      `;
      localStorage.setItem('likebird-dark-mode', 'true');
    } else {
      if (styleEl) styleEl.textContent = '';
      localStorage.setItem('likebird-dark-mode', 'false');
    }
  }, [darkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadJson = (key, setter, def) => {
      try {
        const s = localStorage.getItem(key);
        if (s) {
          const parsed = JSON.parse(s);
          // Защита: если в LS лежит null/string/number — используем def
          if (parsed === null || parsed === undefined) {
            if (def !== undefined) setter(def);
          } else {
            setter(parsed);
          }
        } else if (def !== undefined) {
          setter(def);
        }
      } catch {
        if (def !== undefined) setter(def);
      }
    };
    
    // ===== АВТОРИЗАЦИЯ: проверка сохранённой сессии =====
    try {
      const authData = localStorage.getItem('likebird-auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.authenticated && parsed.expiry > Date.now()) {
          setIsAuthenticated(true);
          setAuthName(parsed.name || '');
          // Загружаем полный объект пользователя
          try {
            const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
            const foundUser = users.find(u => u.login === parsed.login);
            if (foundUser) setCurrentUser(foundUser);
          } catch { /* silent */ }
        }
      }
    } catch { /* silent */ }
    setAuthLoading(false);
    
    // ===== PWA: Перехватываем событие установки =====
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // ===== Онлайн/оффлайн =====
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    const flushOfflineQueue = () => {
      try {
        const q = JSON.parse(localStorage.getItem('likebird-offline-queue') || '[]');
        if (q.length === 0) return;
        q.forEach(key => { try { const data = JSON.parse(localStorage.getItem(key)); if (data != null) fbSave(key, data); } catch { /* silent */ } });
        localStorage.removeItem('likebird-offline-queue');
      } catch { /* silent */ }
    };
    window.addEventListener('online', flushOfflineQueue);
    window.addEventListener('offline', handleOffline);
    
    // Загрузка reports с миграцией старых данных
    try {
      const savedReports = localStorage.getItem('likebird-reports');
      if (savedReports) {
        const parsed = JSON.parse(savedReports);
        // Миграция: если product - объект, преобразуем в строку
        let migrated = parsed.map(r => {
          if (r.product && typeof r.product === 'object' && r.product.name) {
            return { ...r, product: r.product.name };
          }
          return r;
        });
        // FIX: Миграция v2 — обнуляем auto-tips (старая модель записывала наценку как чаевые)
        // В старой модели: tips = salePrice - basePrice (автоматически), cashAmount = salePrice
        // В новой модели: tips = только реальные чаевые (вводятся вручную)
        migrated = migrated.map(r => {
          if (!r.tipsModel && r.tips > 0 && r.basePrice > 0 && r.tips === r.salePrice - r.basePrice) {
            // Это автоматически рассчитанные «чаевые» = наценка, обнуляем
            const newSalary = r.salary - r.tips; // Убираем tips из salary (salary = base + tips)
            return { ...r, tips: 0, salary: Math.max(0, newSalary), tipsModel: 'v2' };
          }
          return { ...r, tipsModel: r.tipsModel || 'v2' };
        });
        setReports(migrated);
        // Сохраняем миграцию
        if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
          localStorage.setItem('likebird-reports', JSON.stringify(migrated));
        }
      }
    } catch { setReports([]); }
    
    loadJson('likebird-expenses', setExpenses, []);
    const savedName = localStorage.getItem('likebird-employee');
    if (savedName) setEmployeeName(savedName);
    loadJson('likebird-given', setGivenToAdmin, {});
    loadJson('likebird-salary-decisions', setSalaryDecisions, {});
    loadJson('likebird-stock', setStock, getInitialStock());
    loadJson('likebird-owncard', setOwnCardTransfers, {});
    loadJson('likebird-partners', setPartnerStock, {});
    loadJson('likebird-totalbirds', setTotalBirds, 0);
    loadJson('likebird-schedule', setScheduleData, {});
    // Загрузка событий с миграцией: старый формат { date: eventObj } → новый { date: [eventObj, ...] }
    try {
      const savedEvents = localStorage.getItem('likebird-events');
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        let migrated = false;
        const result = {};
        Object.entries(parsed).forEach(([key, val]) => {
          if (Array.isArray(val)) {
            result[key] = val;
          } else if (val && typeof val === 'object') {
            result[key] = [val];
            migrated = true;
          }
        });
        setEventsCalendar(result);
        if (migrated) localStorage.setItem('likebird-events', JSON.stringify(result));
      }
    } catch { setEventsCalendar({}); }
    // Загружаем мануалы (если есть кастомные)
    try {
      const savedManuals = localStorage.getItem('likebird-manuals');
      if (savedManuals) {
        const parsed = JSON.parse(savedManuals);
        if (parsed.length > 0) setManuals(parsed);
      }
    } catch { /* silent */ }
    // ИСПРАВЛЕНИЕ #1: Загружаем настройки зарплаты
    loadJson('likebird-salary-settings', setSalarySettings, {
      ranges: [
        { min: 2001, max: 99999, base: 300 },
        { min: 1400, max: 2000, base: 300 },
        { min: 1000, max: 1399, base: 200 },
        { min: 300, max: 999, base: 100 },
        { min: 100, max: 299, base: 50 },
        { min: 0, max: 99, base: 50 },
      ],
      bonusForBirds: true,
      adminSalaryMode: 'percentage',
      adminSalaryPercentage: 10,
      adminSalaryPerSale: 50,
    });
    // НОВОЕ: Загружаем данные админ-панели
    loadJson('likebird-admin-password', setAdminPassword, '');
    loadJson('likebird-employees', setEmployees, []);
    loadJson('likebird-sales-plan', setSalesPlan, { daily: 10000, weekly: 70000, monthly: 300000 });
    loadJson('likebird-audit-log', setAuditLog, []);
    loadJson('likebird-custom-products', setCustomProducts, []);
    
    // ===== ЗАГРУЗКА НОВЫХ ДАННЫХ v2.4 =====
    loadJson('likebird-locations', setLocations, [
      { id: 1, city: 'Ростов-на-Дону', name: 'Пушкинская улица (пить кофе)', active: true },
      { id: 2, city: 'Ростов-на-Дону', name: 'Соборный переулок (Университет)', active: true },
      { id: 3, city: 'Ейск', name: 'Набережная', active: true },
      { id: 4, city: 'Ейск', name: 'Центр', active: true },
    ]);
    loadJson('likebird-cost-prices', setCostPrices, {});
    loadJson('likebird-penalties', setPenalties, []);
    loadJson('likebird-bonuses', setBonuses, []);
    loadJson('likebird-timeoff', setTimeOff, []);
    loadJson('likebird-ratings', setEmployeeRatings, {});
    loadJson('likebird-chat', setChatMessages, []);
    loadJson('likebird-stock-history', setStockHistory, []);
    loadJson('likebird-writeoffs', setWriteOffs, []);
    loadJson('likebird-autoorder', setAutoOrderList, []);
    loadJson('likebird-kpi', setEmployeeKPI, {});
    // Загрузка пользовательских алиасов
    try {
      const savedAliases = localStorage.getItem('likebird-custom-aliases');
      if (savedAliases) setCustomAliases(JSON.parse(savedAliases));
    } catch { /* silent */ }
    loadJson('likebird-invite-codes', setInviteCodes, []);
    loadJson('likebird-notif-settings', setNotifSettings, { shiftReminder: true, lowStockAlert: true, stockThreshold: 3 });
    loadJson('likebird-notifications', setUserNotifications, []);
    loadJson('likebird-custom-achievements', setCustomAchievements, []);
    loadJson('likebird-shifts', setShiftsData, {});
    loadJson('likebird-achievements-granted', setAchievementsGranted, {});
    loadJson('likebird-challenges', setChallenges, []);
    // Загрузка фото из MediaStore (per-photo ключи)
    loadJson('likebird-product-photos-data', (legacy) => {
      // Загружаем индекс
      let idx = [];
      try { idx = JSON.parse(localStorage.getItem('likebird-media-index') || '[]'); } catch { /* silent */ }
      const photos = {};
      // Сначала загружаем из per-photo ключей
      for (const name of idx) {
        try {
          const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
          const v = localStorage.getItem(k);
          if (v && v.startsWith('data:')) photos[name] = v;
        } catch { /* silent */ }
      }
      // Дополняем из legacy (если per-photo ключа нет)
      if (legacy && typeof legacy === 'object') {
        for (const [name, val] of Object.entries(legacy)) {
          if (val && !photos[name]) photos[name] = val;
        }
      }
      setProductPhotos(photos);
      // Обновляем mediaKeysRef
      mediaKeysRef.current = new Set(Object.keys(photos));
    }, {});
    // Загрузка фото смен
    loadJson('likebird-shift-photos', setShiftPhotos, {});
    // likebird-sync-queue loaded on demand
    
    // ===== Cleanup =====
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', flushOfflineQueue);
    };
  }, []);


  // ===== FIREBASE: Realtime синхронизация между устройствами =====
  useEffect(() => {
    // Маппинг: ключ localStorage → React-setter
    // Firebase уведомляет нас об изменениях от ДРУГИХ устройств
    // FIX: Обёртка для подписок — игнорирует обновления для ключей, которые мы сейчас сами записываем
    const guardedSubscribe = (key, callback) => fbSubscribe(key, (val) => {
      if (fbWriteKeys.current.has(key)) return; // Игнорируем echo от нашей же записи
      callback(val);
    });

    const subscriptions = [
      // Отчёты (с миграцией старого формата)
      guardedSubscribe('likebird-reports', (val) => {
        let migrated = Array.isArray(val) ? val.map(r => {
          if (r.product && typeof r.product === 'object' && r.product.name) return { ...r, product: r.product.name };
          return r;
        }) : [];
        // FIX: Миграция v2 для данных от Firebase (auto-tips → 0)
        migrated = migrated.map(r => {
          if (!r.tipsModel && r.tips > 0 && r.basePrice > 0 && r.tips === r.salePrice - r.basePrice) {
            return { ...r, tips: 0, salary: Math.max(0, (r.salary || 0) - r.tips), tipsModel: 'v2' };
          }
          return { ...r, tipsModel: r.tipsModel || 'v2' };
        });
        setReports(migrated);
        localStorage.setItem('likebird-reports', JSON.stringify(migrated));
      }),
      guardedSubscribe('likebird-expenses', (val) => { setExpenses(val); try { try { localStorage.setItem('likebird-expenses', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-stock', (val) => { setStock(val); try { try { localStorage.setItem('likebird-stock', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-given', (val) => { setGivenToAdmin(val); try { try { localStorage.setItem('likebird-given', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-salary-decisions', (val) => { setSalaryDecisions(val); try { try { localStorage.setItem('likebird-salary-decisions', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-owncard', (val) => { setOwnCardTransfers(val); try { try { localStorage.setItem('likebird-owncard', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-partners', (val) => { setPartnerStock(val); try { try { localStorage.setItem('likebird-partners', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-totalbirds', (val) => { setTotalBirds(val); try { try { localStorage.setItem('likebird-totalbirds', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-schedule', (val) => { setScheduleData(val); try { try { localStorage.setItem('likebird-schedule', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-events', (val) => {
        // Миграция: старый формат { date: eventObj } → новый { date: [eventObj, ...] }
        if (val && typeof val === 'object') {
          const migrated = {};
          Object.entries(val).forEach(([key, v]) => {
            if (Array.isArray(v)) migrated[key] = v;
            else if (v && typeof v === 'object') migrated[key] = [v];
          });
          setEventsCalendar(migrated);
          localStorage.setItem('likebird-events', JSON.stringify(migrated));
        }
      }),
      guardedSubscribe('likebird-manuals', (val) => { if (Array.isArray(val) && val.length > 0) { setManuals(val); try { try { localStorage.setItem('likebird-manuals', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-salary-settings', (val) => { setSalarySettings(val); try { try { localStorage.setItem('likebird-salary-settings', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-admin-password', (val) => { setAdminPassword(val); try { try { localStorage.setItem('likebird-admin-password', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-employees', (val) => {
        if (!Array.isArray(val)) return;
        // Синхронизируем employees с registered users: матчим по login (стабильный ID),
        // если login совпадает — обновляем name. Если ничего не нашли — добавляем нового.
        const regUsersLocal = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
        let merged = [...val];
        regUsersLocal.forEach(u => {
          const name = u.name || u.login;
          // 1) Ищем по login (если есть привязка)
          let idx = merged.findIndex(e => e.login && e.login === u.login);
          // 2) Если не нашли по login, ищем по имени (legacy совместимость)
          if (idx === -1) idx = merged.findIndex(e => e.name === name || e.name === u.login);
          if (idx !== -1) {
            // Нашли — синхронизируем name, role и login (если был пропущен)
            merged[idx] = { ...merged[idx], name, role: u.role || merged[idx].role || 'seller', login: u.login };
          } else {
            // Реально новый — добавляем
            merged.push({
              id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(),
              name,
              role: u.role || 'seller',
              salaryMultiplier: 1.0,
              active: true,
              login: u.login,
            });
          }
        });
        setEmployees(merged);
        localStorage.setItem('likebird-employees', JSON.stringify(merged));
      }),
      guardedSubscribe('likebird-sales-plan', (val) => { setSalesPlan(val); try { try { localStorage.setItem('likebird-sales-plan', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-audit-log', (val) => { setAuditLog(val); try { try { localStorage.setItem('likebird-audit-log', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-custom-products', (val) => { setCustomProducts(val); try { try { localStorage.setItem('likebird-custom-products', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-locations', (val) => { setLocations(val); try { try { localStorage.setItem('likebird-locations', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-cost-prices', (val) => { setCostPrices(val); try { try { localStorage.setItem('likebird-cost-prices', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-penalties', (val) => { setPenalties(val); try { try { localStorage.setItem('likebird-penalties', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-bonuses', (val) => { setBonuses(val); try { try { localStorage.setItem('likebird-bonuses', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-timeoff', (val) => { setTimeOff(val); try { try { localStorage.setItem('likebird-timeoff', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-ratings', (val) => { setEmployeeRatings(val); try { try { localStorage.setItem('likebird-ratings', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-chat', (val) => {
        if (Array.isArray(val) && val.length > 0) {
          const last = val[val.length - 1];
          const myL = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
          if (last.fromLogin && last.fromLogin !== myL && last.date && Date.now() - last.date < 10000) {
            try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(660, ctx.currentTime); o.frequency.setValueAtTime(880, ctx.currentTime + 0.1); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.start(); o.stop(ctx.currentTime + 0.3); } catch { /* silent */ }
          }
        }
        setChatMessages(val); try { try { localStorage.setItem('likebird-chat', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-stock-history', (val) => { setStockHistory(val); try { try { localStorage.setItem('likebird-stock-history', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-writeoffs', (val) => { setWriteOffs(val); try { try { localStorage.setItem('likebird-writeoffs', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-autoorder', (val) => { setAutoOrderList(val); try { try { localStorage.setItem('likebird-autoorder', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-kpi', (val) => { setEmployeeKPI(val); try { try { localStorage.setItem('likebird-kpi', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-custom-achievements', (val) => { if (Array.isArray(val)) { setCustomAchievements(val); try { try { localStorage.setItem('likebird-custom-achievements', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-archived-products', (val) => { if (Array.isArray(val)) setArchivedProducts(val); }),
      guardedSubscribe('likebird-system-notifications', (val) => { if (Array.isArray(val)) { try { localStorage.setItem('likebird-system-notifications', JSON.stringify(val)); } catch { /* silent */ } } }),
      guardedSubscribe('likebird-challenges', (val) => { if (Array.isArray(val)) { setChallenges(val); try { try { localStorage.setItem('likebird-challenges', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      // MediaStore: подписка на индекс фото → загрузка каждого фото отдельно
      guardedSubscribe('likebird-media-index', (idx) => {
        if (!Array.isArray(idx)) return;
        try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
        mediaKeysRef.current = new Set(idx);
        // Загружаем каждое фото по отдельному ключу
        idx.forEach(name => {
          const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
          fbSubscribe(k, (val) => {
            if (val && typeof val === 'string') {
              setProductPhotos(prev => {
                const next = { ...prev, [name]: val };
                try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
                return next;
              });
              try { localStorage.setItem(k, val); } catch { /* silent */ }
            }
          });
        });
      }),
      // Легаси подписка (для обратной совместимости)
      guardedSubscribe('likebird-product-photos-data', (val) => {
        if (val && typeof val === 'object') {
          setProductPhotos(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(val)) { if (v && !merged[k]) merged[k] = v; }
            return merged;
          });
        }
      }),
      guardedSubscribe('likebird-notifications', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-notifications', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        setUserNotifications(val);
        // Показать push-уведомления для НОВЫХ непрочитанных (но НЕ помечаем read автоматически)
        try {
          const authRaw = localStorage.getItem('likebird-auth');
          if (!authRaw) return;
          const auth = JSON.parse(authRaw);
          // Ищем уведомления которые ещё не показывали (по shownLocally флагу)
          const myNew = val.filter(n => n.targetLogin === auth.login && !n.read && !n.shownLocally);
          myNew.forEach(n => {
            showNotification(n.body || n.title, 'achievement');
            // Web Notification API (push на телефон)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification(n.title || 'LikeBird', { body: n.body, icon: '/favicon.ico', badge: '/favicon.ico' }); } catch { /* silent */ }
            }
            // Звук
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
              osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
            } catch { /* silent */ }
          });
          // Помечаем shownLocally чтобы не показывать toast повторно (но НЕ read!)
          if (myNew.length > 0) {
            const updatedVal = val.map(n => (n.targetLogin === auth.login && !n.shownLocally) ? { ...n, shownLocally: true } : n);
            localStorage.setItem('likebird-notifications', JSON.stringify(updatedVal));
            setUserNotifications(updatedVal);
            fbSave('likebird-notifications', updatedVal);
          }
        } catch { /* silent */ }
      }),
      guardedSubscribe('likebird-achievements-granted', (val) => { if (val && typeof val === 'object') { setAchievementsGranted(val); try { try { localStorage.setItem('likebird-achievements-granted', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-profiles', (val) => { setProfilesData(val); try { try { localStorage.setItem('likebird-profiles', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-users', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-users', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        // Обновляем currentUser если его данные изменились (например роль)
        try {
          const authRaw = localStorage.getItem('likebird-auth');
          if (authRaw) {
            const auth = JSON.parse(authRaw);
            const me = val.find(u => u.login === auth.login);
            if (me) setCurrentUser(me);
          }
        } catch { /* silent */ }
      }),
      guardedSubscribe('likebird-shifts', (val) => {
        const safe = (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};
        setShiftsData(safe);
        try { localStorage.setItem('likebird-shifts', JSON.stringify(safe)); } catch { /* silent */ }
      }),
      guardedSubscribe('likebird-invite-codes', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-invite-codes', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        setInviteCodes(val); // FIX: обновляем глобальное состояние
      }),
    ];

    // Подписка на онлайн-присутствие всех пользователей
    const unsubPresence = fbSubscribePresence(setPresenceData);

    // Отписываемся при размонтировании компонента
    return () => {
      subscriptions.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
      if (unsubPresence) unsubPresence();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Запросить разрешение на уведомления
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);



  // Heartbeat presence — отдельный useEffect зависящий от currentUser
  useEffect(() => {
    if (!currentUser?.login) return;
    const sendPresence = () => {
      const dispName = profilesData[currentUser.login]?.displayName || currentUser.name || currentUser.login;
      fbSetPresence(currentUser.login, dispName);
    };
    sendPresence(); // сразу при входе
    const interval = setInterval(sendPresence, 60000); // каждую минуту
    return () => clearInterval(interval);
  }, [currentUser?.login]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Интеграция кастомных товаров в поиск =====
  useEffect(() => {
    DYNAMIC_ALL_PRODUCTS = [
      ...ALL_PRODUCTS,
      ...customProducts.map(p => ({
        name: p.name, price: p.price, emoji: p.emoji || '📦',
        aliases: p.aliases || [p.name.toLowerCase()],
        category: p.category || '3D игрушки', isCustom: true,
      })),
    ];
    // FIX: Дозаполняем stock для кастомных товаров без записей (миграция)
    if (customProducts.length > 0) {
      let needUpdate = false;
      const newStock = {...stock};
      customProducts.forEach(p => {
        if (!newStock[p.name]) {
          newStock[p.name] = { count: 0, minStock: 3, category: p.category || '3D игрушки', emoji: p.emoji || '📦', price: p.price };
          needUpdate = true;
        }
      });
      if (needUpdate) updateStock(newStock);
    }
  }, [customProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Проверка низкого остатка при изменении склада =====
  useEffect(() => {
    const lowItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock);
    if (lowItems.length > 0 && reports.length > 0) {
      // Проверяем не слишком ли часто уведомляем
      const lastNotif = localStorage.getItem('likebird-last-low-stock-notif');
      const now = Date.now();
      if (!lastNotif || now - parseInt(lastNotif) > 3600000) { // Не чаще раза в час
        addSystemNotification('stock', `Низкий остаток: ${lowItems.slice(0, 3).map(([n]) => n).join(', ')}${lowItems.length > 3 ? ` и ещё ${lowItems.length - 3}` : ''}`, 'high');
        localStorage.setItem('likebird-last-low-stock-notif', now.toString());
      }
    }
  }, [stock]);

  // ===== Автоматическое начисление достижений при изменении отчётов =====
  useEffect(() => {
    if (!currentUser?.login || !customAchievements.length) return;
    // Для каждого активного пользователя проверяем автоматические достижения
    const allUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
    let anyGranted = false;
    const newGranted = { ...achievementsGranted };

    allUsers.forEach(u => {
      const login = u.login;
      const empName = u.name || u.login;
      const empDisplayName = profilesData[login]?.displayName;
      // FIX: Ищем отчёты по login И по displayName (отчёты сохраняются под login, но displayName мог измениться)
      const userReports = reports.filter(r => (r.employee === empName || r.employee === login || (empDisplayName && r.employee === empDisplayName)) && !r.isUnrecognized);
      const totalRevenue = userReports.reduce((s, r) => s + r.total, 0);

      customAchievements.forEach(ach => {
        if (ach.condType === 'manual') return; // ручные — только через админ
        const val = Number(ach.condValue) || 0;
        const alreadyGranted = (newGranted[ach.id] || []).includes(login);
        if (alreadyGranted) return;

        let done = false;
        if (ach.condType === 'sales_count') done = userReports.length >= val;
        else if (ach.condType === 'revenue') done = totalRevenue >= val;
        else if (ach.condType === 'big_sale') done = userReports.some(r => r.salePrice >= val);
        else if (ach.condType === 'tips_count') done = userReports.filter(r => r.tips > 0).length >= val;

        if (done) {
          newGranted[ach.id] = [...(newGranted[ach.id] || []), login];
          anyGranted = true;
          // Уведомление сотруднику
          const notifKey = 'likebird-notifications';
          const existing = (() => { try { return JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch { return []; } })();
          const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'achievement', targetLogin: login, title: `🏆 Новое достижение: ${ach.title}`, body: ach.desc || '', icon: ach.icon || '🏆', timestamp: Date.now(), read: false };
          const updated = [notif, ...existing.slice(0, 49)];
          localStorage.setItem(notifKey, JSON.stringify(updated));
          // Сохраняем в Firebase чтобы уведомление дошло до устройства сотрудника
          fbSave(notifKey, updated);
          // Бонус если задан
          if (ach.bonusAmount) {
            const matchedEmp = employees.find(e => e.name === empName);
            const empId = matchedEmp ? matchedEmp.id : login;
            const bonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), employeeId: empId, employeeName: empName, employeeLogin: login, achievementId: ach.id, amount: Number(ach.bonusAmount), reason: `Достижение: ${ach.title}`, date: new Date().toISOString(), createdAt: Date.now() };
            const newBonuses = [...bonuses, bonus];
            setBonuses(newBonuses);
            save('likebird-bonuses', newBonuses);
          }
        }
      });
    });

    if (anyGranted) {
      setAchievementsGranted(newGranted);
      save('likebird-achievements-granted', newGranted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, customAchievements]);

  // ===== УМНЫЕ УВЕДОМЛЕНИЯ: Проверка смены и остатков =====
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkShiftReminder = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('likebird-notif-settings') || '{}');
        if (!settings.shiftReminder) return;
        const now = new Date();
        if (now.getHours() < 10) return; // До 10:00 не проверяем
        const login = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
        if (!login) return;
        const todayStr = formatDate(now);
        const shiftKey = `${login}_${todayStr}`;
        const shifts = JSON.parse(localStorage.getItem('likebird-shifts') || '{}');
        if (!shifts[shiftKey] || !shifts[shiftKey].status) {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification('LikeBird 🐦', { body: '⏰ Смена ещё не открыта! Не забудьте начать работу.', icon: '/favicon.ico' }); } catch { /* silent */ }
          }
        }
      } catch { /* silent */ }
    };
    // Проверяем сразу и каждый час
    const timer = setTimeout(checkShiftReminder, 5000);
    const interval = setInterval(checkShiftReminder, 60 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [isAuthenticated]);

  // ===== Реф для блокировки Firebase-обновлений пока мы сами пишем =====
  const fbWriting = useRef(false);
  const fbWriteKeys = useRef(new Set());

  // Сохраняет данные: локально + в Firebase (для всех устройств)
  // FIX: устанавливает guard чтобы подписки не перезаписывали данные обратно
  // Рекурсивно удаляет undefined-поля. Firebase их не принимает.
  const stripUndefinedDeep = (val) => {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) return val.map(stripUndefinedDeep);
    if (typeof val === 'object') {
      const out = {};
      for (const k of Object.keys(val)) {
        if (val[k] === undefined) continue;
        out[k] = stripUndefinedDeep(val[k]);
      }
      return out;
    }
    return val;
  };

  const save = (key, data) => {
    fbWriteKeys.current.add(key);
    fbWriting.current = true;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { logErr('save:localStorage:' + key, e); }
    if (navigator.onLine !== false) {
      try { fbSave(key, stripUndefinedDeep(data)); } catch (e) { logErr('save:firebase', e); }
    } else {
      try { const q = JSON.parse(localStorage.getItem('likebird-offline-queue') || '[]'); if (!q.includes(key)) { q.push(key); localStorage.setItem('likebird-offline-queue', JSON.stringify(q)); } } catch { /* silent */ }
    }
    setTimeout(() => {
      fbWriteKeys.current.delete(key);
      if (fbWriteKeys.current.size === 0) fbWriting.current = false;
    }, 500);
  };
  const updateReports = (r) => {
    // Архивация: если >5000, удаляем старейшие
    let data = r;
    if (data.length > 5000) {
      data = data.slice(-5000);
      showNotification('Автоочистка: удалены старые записи');
    }

    // === Замдиректор: применяем/удаляем бонусы при изменении reports ===
    try {
      const oldIds = new Set(reports.map(x => x.id));
      const newIds = new Set(data.map(x => x.id));
      // Новые отчёты — добавились в data
      const addedReports = data.filter(x => !oldIds.has(x.id));
      // Удалённые отчёты — были в reports, но нет в data
      const removedReportIds = reports.filter(x => !newIds.has(x.id)).map(x => x.id);

      if (addedReports.length > 0 || removedReportIds.length > 0) {
        let newBonuses = bonuses;
        for (const rep of addedReports) {
          newBonuses = applyDeputyBonusForReport(rep, newBonuses);
        }
        for (const rid of removedReportIds) {
          newBonuses = removeDeputyBonusesForReport(rid, newBonuses);
        }
        if (newBonuses !== bonuses) {
          setBonuses(newBonuses);
          save('likebird-bonuses', newBonuses);
        }
      }
    } catch (e) {
      // silent — не блокируем основную операцию из-за ошибки в бонусах
      console.warn('Deputy bonus calc error:', e);
    }

    setReports(data); save('likebird-reports', data); };
  const updateStock = (s) => { 
    setStock(s); 
    save('likebird-stock', s);
    try { checkLowStockAuto(s); } catch { /* silent */ }
    // Проверка низких остатков
    try {
      const settings = JSON.parse(localStorage.getItem('likebird-notif-settings') || '{}');
      if (settings.lowStockAlert) {
        const threshold = settings.stockThreshold || 3;
        Object.entries(s).forEach(([name, data]) => {
          if (data.count > 0 && data.count <= threshold && data.count <= (data.minStock || threshold)) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification('LikeBird — Низкий остаток', { body: `⚠️ ${name}: осталось ${data.count} шт`, icon: '/favicon.ico' }); } catch { /* silent */ }
            }
          }
        });
      }
    } catch { /* silent */ }
  };
  const updateSalaryDecision = (id, dec) => { const u = {...salaryDecisions, [id]: dec}; setSalaryDecisions(u); save('likebird-salary-decisions', u); };

  // Получает user по имени/логину сотрудника (для получения роли, флага noSalary, deputy-полей и т.д.)
  const getUserByEmployeeName = (employeeName) => {
    if (!employeeName) return null;
    try {
      const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      return users.find(u => u.login === employeeName || u.name === employeeName) || null;
    } catch { return null; }
  };

  // Получает роль сотрудника
  const getEmployeeRole = (employeeName) => {
    if (!employeeName) return null;
    const emp = employees.find(e => e.name === employeeName);
    if (emp?.role) return emp.role;
    const u = getUserByEmployeeName(employeeName);
    if (u) return u.isAdmin && !u.role ? 'admin' : (u.role || 'seller');
    return null;
  };

  // getEffectiveSalary с учётом noSalary (например для создателя/владельца)
  const getEffectiveSalary = (r) => {
    if (!r) return 0;
    const u = getUserByEmployeeName(r.employee);
    if (u?.noSalary) return 0; // Не начисляем ЗП этому пользователю
    return calculateSalary(r.basePrice, r.salePrice, r.category, r.tips || 0, salaryDecisions[r.id] || 'normal', salarySettings, getEmployeeRole(r.employee));
  };

  // Заработок админа за смену (надбавка с продаж ДРУГИХ сотрудников за день).
  // Используется в "Итог дня" для отображения админу его заработка.
  // - В режиме 'percentage': % от выручки чужих продаж за день
  // - В режиме 'perSale':    фикс ₽ × количество чужих продаж за день
  // Возвращает 0 если у админа noSalary или режим не установлен.
  const getAdminShiftEarnings = (dayReports, adminName) => {
    if (!adminName || !Array.isArray(dayReports)) return 0;
    const adminUser = getUserByEmployeeName(adminName);
    if (adminUser?.noSalary) return 0;
    const role = getEmployeeRole(adminName);
    // Только админ или замдиректор получают надбавку
    // Только админ, замдиректор или директор получают надбавку
    if (role !== 'admin' && role !== 'deputy' && role !== 'director' && !adminUser?.isAdmin) return 0;
    // Продажи ДРУГИХ сотрудников (не свои) и не от других "admin-уровней"
    const othersReports = dayReports.filter(r => {
      if (r.isUnrecognized) return false;
      if (r.employee === adminName) return false;
      const otherRole = getEmployeeRole(r.employee);
      // Не считаем продажи других админов/замдиректоров/директоров (чтобы не было двойной надбавки)
      if (otherRole === 'admin' || otherRole === 'deputy' || otherRole === 'director') return false;
      return true;
    });
    if (othersReports.length === 0) return 0;
    const mode = salarySettings?.adminSalaryMode || 'percentage';
    if (mode === 'perSale') {
      const perSale = Number(salarySettings?.adminSalaryPerSale) || 0;
      return perSale * othersReports.length;
    }
    // percentage
    const pct = Number(salarySettings?.adminSalaryPercentage) || 0;
    if (pct <= 0) return 0;
    const totalRevenue = othersReports.reduce((s, r) => s + (Number(r.total) || 0), 0);
    return Math.round(totalRevenue * pct / 100);
  };

  // === Замдиректор: автоматическое начисление бонусов за продажи в его городе ===
  // Извлекает город из location-строки отчёта ("Город - Точка" или просто "Город")
  const extractCityFromReport = (r) => {
    if (!r) return null;
    const loc = r.location || r.saleLocation || '';
    if (!loc) return null;
    return String(loc).split(' - ')[0].trim();
  };

  // Находит текущего deputy по городу
  const findDeputyForCity = (city) => {
    if (!city) return null;
    try {
      const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      return users.find(u => u.role === 'deputy' && u.deputyCity === city) || null;
    } catch { return null; }
  };

  // Применяет бонус замдиректору при добавлении отчёта. Возвращает обновлённый массив bonuses.
  // Идемпотентность: если для этого reportId уже есть deputy-бонус — не дублируем.
  const applyDeputyBonusForReport = (report, currentBonuses) => {
    if (!report || !report.id) return currentBonuses;
    const city = extractCityFromReport(report);
    const deputy = findDeputyForCity(city);
    if (!deputy) return currentBonuses;
    const perSale = Number(deputy.deputyPerSale) || 0;
    if (perSale <= 0) return currentBonuses;
    // Проверка идемпотентности
    const alreadyExists = (currentBonuses || []).some(b => b.linkedReportId === report.id && b.deputyBonus === true);
    if (alreadyExists) return currentBonuses;
    // Найти employee deputy по имени
    const deputyEmp = employees.find(e => e.name === deputy.name);
    const newBonus = {
      id: Date.now() + Math.random().toString(36).slice(2, 8),
      employeeId: deputyEmp?.id || null,
      employeeName: deputy.name,
      employeeLogin: deputy.login,
      amount: perSale,
      reason: `ЗП замдиректора · продажа в ${city} (${report.product || 'товар'})`,
      date: report.date || new Date().toLocaleDateString('ru-RU'),
      createdAt: Date.now(),
      deputyBonus: true,
      linkedReportId: report.id,
    };
    return [newBonus, ...(currentBonuses || [])];
  };

  // Удаляет deputy-бонусы, связанные с отчётом (при удалении отчёта)
  const removeDeputyBonusesForReport = (reportId, currentBonuses) => {
    if (!reportId) return currentBonuses;
    return (currentBonuses || []).filter(b => !(b.deputyBonus === true && b.linkedReportId === reportId));
  };
  // FIX #56: showNotification через DOM — НЕ вызывает parent re-render, 
  // inner-компоненты сохраняют свой локальный state.
  const showNotification = (message, type = 'success') => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    const el = notificationRef.current;
    if (!el) return;
    el.textContent = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    el.className = `fixed top-4 left-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white text-sm font-medium transition-opacity duration-300 ${type === 'error' ? 'bg-red-500' : type === 'achievement' ? 'bg-yellow-500' : 'bg-green-500'}`;
    el.style.transform = 'translateX(-50%)';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    notificationTimerRef.current = setTimeout(() => {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, 3000);
  };
  // FIX #56b: showConfirm через DOM — НЕ вызывает parent re-render.
  const showConfirm = (message, onConfirm) => {
    confirmCallbackRef.current = onConfirm;
    const el = confirmDialogRef.current;
    if (!el) return;
    el.querySelector('[data-confirm-msg]').textContent = message;
    el.style.display = 'flex';
  };
  const hideConfirm = () => {
    const el = confirmDialogRef.current;
    if (el) el.style.display = 'none';
    confirmCallbackRef.current = null;
  };
  const handleConfirmClick = () => {
    const callback = confirmCallbackRef.current;
    hideConfirm();
    if (callback) callback();
  };
  
  // FIX #56c: InputModal тоже через ref + DOM (та же проблема)
  const inputModalRef = useRef(null);
  const inputModalInputRef = useRef(null);
  const [inputModalValue, setInputModalValue] = useState('');
  const inputModalCallbackRef = useRef(null);
  
  const showInputModal = ({ title, placeholder, defaultValue = '', onSave }) => {
    inputModalCallbackRef.current = onSave;
    const el = inputModalRef.current;
    if (!el) return;
    el.querySelector('[data-input-title]').textContent = title;
    const input = inputModalInputRef.current;
    if (input) { input.placeholder = placeholder; input.value = defaultValue; }
    el.style.display = 'flex';
    setTimeout(() => input && input.focus(), 50);
  };
  const hideInputModal = () => {
    const el = inputModalRef.current;
    if (el) el.style.display = 'none';
    inputModalCallbackRef.current = null;
  };
  const handleInputModalSave = () => {
    const val = inputModalInputRef.current?.value?.trim();
    const callback = inputModalCallbackRef.current;
    hideInputModal();
    if (val && callback) callback(val);
  };
  const updateOwnCard = (emp, date, value) => { const u = {...ownCardTransfers, [`${emp}_${date}`]: value}; setOwnCardTransfers(u); save('likebird-owncard', u); };
  const getOwnCard = (emp, date) => ownCardTransfers[`${emp}_${date}`] || false;

  // НОВОЕ: Функция аудита действий
  const logAction = (action, details) => {
    const entry = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), action, details, user: employeeName || 'Аноним' };
    const updated = [entry, ...auditLog].slice(0, 500); // Храним последние 500 записей
    setAuditLog(updated);
    save('likebird-audit-log', updated);
  };

  // Безопасное получение имени продукта (на случай если product - объект)
  const getProductName = (product) => {
    if (!product) return 'Неизвестно';
    if (typeof product === 'string') return product;
    if (typeof product === 'object' && product.name) return product.name;
    return String(product);
  };

  // НОВОЕ: Функции для управления сотрудниками
  const updateEmployees = (newEmployees) => { setEmployees(newEmployees); save('likebird-employees', newEmployees); };

  // Миграция имени сотрудника: обновляет имя во всех связанных записях
  // (reports, expenses, bonuses, employees, scheduleData).
  // shiftsData использует login как ключ — миграция не нужна.
  //
  // ВАЖНО: читаем данные из localStorage напрямую, чтобы избежать race condition
  // с устаревшим React state в момент вызова.
  const migrateEmployeeName = (oldName, newName, userLogin) => {
    if (!oldName || !newName || oldName === newName) return;

    const readLS = (key, fallback) => {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch { return fallback; }
    };

    // 1. reports
    const curReports = readLS('likebird-reports', []);
    const updReports = curReports.map(r => r.employee === oldName ? { ...r, employee: newName } : r);
    setReports(updReports); save('likebird-reports', updReports);

    // 2. expenses
    const curExpenses = readLS('likebird-expenses', []);
    const updExpenses = curExpenses.map(e => e.employee === oldName ? { ...e, employee: newName } : e);
    setExpenses(updExpenses); save('likebird-expenses', updExpenses);

    // 3. bonuses
    const curBonuses = readLS('likebird-bonuses', []);
    const updBonuses = curBonuses.map(b => b.employeeName === oldName ? { ...b, employeeName: newName } : b);
    setBonuses(updBonuses); save('likebird-bonuses', updBonuses);

    // 4. employees — переименование + дедупликация + привязка login
    let curEmployees = readLS('likebird-employees', []);
    // Шаг 1: переименовываем все записи с oldName в newName и проставляем login
    curEmployees = curEmployees.map(e => {
      const matchByOldName = e.name === oldName;
      const matchByLogin = userLogin && e.login === userLogin;
      if (matchByOldName || matchByLogin) {
        return { ...e, name: newName, login: userLogin || e.login };
      }
      return e;
    });
    // Шаг 2: дедупликация — после переименования могут оказаться 2 записи с newName
    // (например, старая «Лена» + новая «Елена» которая уже была автодобавлена)
    // Оставляем первую активную и удаляем дубликаты
    const seenNames = new Set();
    curEmployees = curEmployees.filter(e => {
      const key = e.name;
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });
    setEmployees(curEmployees); save('likebird-employees', curEmployees);

    // 5. scheduleData.shifts — ключ это имя сотрудника
    const curSchedule = readLS('likebird-schedule', {});
    if (curSchedule?.shifts && curSchedule.shifts[oldName]) {
      const newShifts = { ...curSchedule.shifts };
      newShifts[newName] = newShifts[oldName];
      delete newShifts[oldName];
      const newScheduleData = { ...curSchedule, shifts: newShifts };
      setScheduleData(newScheduleData);
      save('likebird-schedule', newScheduleData);
    }

    logAction('Переименование сотрудника', `${oldName} → ${newName}`);
  };

  const addEmployee = (name, role = 'seller') => {
    const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name, role, salaryMultiplier: 1.0, active: true };
    updateEmployees([...employees, newEmp]);
    logAction('Добавлен сотрудник', name);
  };
  // === BLOCK 8: Enhanced audit for deletions ===
  // eslint-disable-next-line no-unused-vars
  const deleteReportWithAudit = (reportId) => {
    const report = reports.find(r => r.id === reportId);
    if (report) {
      showConfirm('Удалить отчёт о продаже ' + getProductName(report.product) + '?', () => {
        const updated = reports.filter(r => r.id !== reportId);
        updateReports(updated);
        logAction('delete-report', JSON.stringify({ product: getProductName(report.product), total: report.total, employee: report.employee }));
        showNotification('Отчёт удалён');
      });
    }
  };

  const removeEmployee = (id) => {
    const emp = employees.find(e => e.id === id);
    updateEmployees(employees.filter(e => e.id !== id));
    if (emp) logAction('Удалён сотрудник', emp.name);
  };
  const toggleEmployeeActive = (id) => {
    updateEmployees(employees.map(e => e.id === id ? { ...e, active: !e.active } : e));
  };

  // НОВОЕ: Функции для плана продаж
  const updateSalesPlan = (plan) => { setSalesPlan(plan); save('likebird-sales-plan', plan); };

  // НОВОЕ: Функции для пароля админа (с хэшированием)
  const setAdminPass = async (pass) => { 
    const hashed = await hashPassword(pass);
    setAdminPassword(hashed); 
    save('likebird-admin-password', hashed); 
    logAction('Изменён пароль админки', '***'); 
  };
  const checkAdminPassword = async (input) => {
    if (!adminPassword) return true;
    const hashed = await hashPassword(input);
    return hashed === adminPassword;
  };

  // НОВОЕ: Функции для кастомных товаров
  const updateCustomProducts = (products) => { setCustomProducts(products); save('likebird-custom-products', products); };
  const updateManuals = (newManuals) => { setManuals(newManuals); save('likebird-manuals', newManuals); };
  const addCustomProduct = (product) => {
    // Проверка дубликата
    const dup = DYNAMIC_ALL_PRODUCTS.find(p => p.name.toLowerCase() === product.name.toLowerCase());
    if (dup) { showNotification(`Товар "${product.name}" уже существует`, 'error'); return; }
    const newProd = { ...product, id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), isCustom: true };
    updateCustomProducts([...customProducts, newProd]);
    // FIX: Добавляем товар в склад (ранее кастомные не появлялись в остатках)
    if (!stock[product.name]) {
      const newStock = {...stock, [product.name]: { count: 0, minStock: 3, category: product.category || '3D игрушки', emoji: product.emoji || '📦', price: product.price }};
      updateStock(newStock);
    }
    logAction('Добавлен товар', product.name);
  };
  const removeCustomProduct = (id) => {
    const prod = customProducts.find(p => p.id === id);
    if (prod) {
      const usedIn = reports.filter(r => getProductName(r.product) === prod.name).length;
      if (usedIn > 0) { showNotification(`Товар используется в ${usedIn} отчётах. Лучше архивировать.`, 'error'); return; }
    }
    updateCustomProducts(customProducts.filter(p => p.id !== id));
    // FIX: Убираем запись из склада (ранее оставался «призрачный» товар)
    if (prod && stock[prod.name]) {
      const newStock = {...stock};
      delete newStock[prod.name];
      updateStock(newStock);
    }
    if (prod) logAction('Удалён товар', prod.name);
  };

  // ===== НОВЫЕ ФУНКЦИИ v2.4 =====
  
  // Локации
  const updateLocations = (locs) => { setLocations(locs); save('likebird-locations', locs); };
  const addLocation = (city, name) => {
    const newLoc = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), city, name, active: true };
    updateLocations([...locations, newLoc]);
    logAction('Добавлена точка', `${city} - ${name}`);
  };
  const removeLocation = (id) => {
    const loc = locations.find(l => l.id === id);
    updateLocations(locations.filter(l => l.id !== id));
    if (loc) logAction('Удалена точка', `${loc.city} - ${loc.name}`);
  };
  const toggleLocationActive = (id) => {
    updateLocations(locations.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };
  const getCities = () => [...new Set(locations.map(l => l.city))];
  const getLocationsByCity = (city) => locations.filter(l => l.city === city);
  
  // Себестоимость (только админ)
  const updateCostPrices = (prices) => { setCostPrices(prices); save('likebird-cost-prices', prices); };
  const setCostPrice = (productName, cost) => {
    updateCostPrices({ ...costPrices, [productName]: cost });
    logAction('Себестоимость установлена', `${productName}: ${cost}₽`);
  };
  const getCostPrice = (productName) => costPrices[productName] || 0;
  const getProfit = (productName, salePrice) => salePrice - getCostPrice(productName);
  
  // Штрафы и бонусы
  const updatePenalties = (p) => { setPenalties(p); save('likebird-penalties', p); };
  const updateBonuses = (b) => { setBonuses(b); save('likebird-bonuses', b); };
  const addPenalty = (employeeId, amount, reason, date = new Date().toISOString()) => {
    const penalty = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, amount, reason, date };
    updatePenalties([...penalties, penalty]);
    logAction('Штраф добавлен', `${employees.find(e => e.id === employeeId)?.name}: ${amount}₽ - ${reason}`);
  };
  const addBonus = (employeeId, amount, reason, date = new Date().toISOString()) => {
    const bonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, amount, reason, date };
    updateBonuses([...bonuses, bonus]);
    logAction('Бонус добавлен', `${employees.find(e => e.id === employeeId)?.name}: ${amount}₽ - ${reason}`);
  };
  // FIX: Безопасный парсинг дат (поддержка ISO и DD.MM.YYYY)
  const safeParseDateStr = (dateStr) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.split('.');
    if (parts.length === 3) return new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(0);
  };
  const getEmployeePenalties = (employeeId, period = 30) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
    return penalties.filter(p => p.employeeId === employeeId && safeParseDateStr(p.date) >= cutoff);
  };
  const getEmployeeBonuses = (employeeId, period = 30) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
    return bonuses.filter(b => b.employeeId === employeeId && safeParseDateStr(b.date) >= cutoff);
  };
  
  // Больничные и отпуска
  const updateTimeOff = (t) => { setTimeOff(t); save('likebird-timeoff', t); };
  const addTimeOff = (employeeId, type, startDate, endDate, note = '') => {
    const record = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, type, startDate, endDate, note };
    updateTimeOff([...timeOff, record]);
    logAction(`${type === 'sick' ? 'Больничный' : 'Отпуск'} добавлен`, employees.find(e => e.id === employeeId)?.name);
  };
  const getActiveTimeOff = () => {
    const today = new Date().toISOString().split('T')[0];
    return timeOff.filter(t => t.startDate <= today && t.endDate >= today);
  };
  
  // Рейтинг сотрудников
  const updateEmployeeRatings = (r) => { setEmployeeRatings(r); save('likebird-ratings', r); };
  const rateEmployee = (employeeId, rating, comment = '') => {
    const key = `${employeeId}_${Date.now()}`;
    const updated = { ...employeeRatings, [key]: { employeeId, rating, comment, date: new Date().toISOString() } };
    updateEmployeeRatings(updated);
  };
  const getEmployeeAverageRating = (employeeId) => {
    const ratings = Object.values(employeeRatings).filter(r => r.employeeId === employeeId);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  };
  
  // Чат/комментарии
  const updateChatMessages = (m) => { setChatMessages(m); save('likebird-chat', m); };
  const sendMessage = (text, toEmployeeId = null) => {
    const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Админ', to: toEmployeeId, text, date: new Date().toISOString(), read: false };
    updateChatMessages([...chatMessages, msg]);
  };
  const getUnreadMessages = (forEmployee) => chatMessages.filter(m => !m.read && (m.to === forEmployee || m.to === null));
  const markAsRead = (messageId) => {
    updateChatMessages(chatMessages.map(m => m.id === messageId ? { ...m, read: true } : m));
  };
  
  // История склада
  const updateStockHistory = (h) => { setStockHistory(h); save('likebird-stock-history', h); };
  const addStockHistoryEntry = (productName, action, quantity, note = '') => {
    const entry = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), productName, action, quantity, note, date: new Date().toISOString(), user: employeeName || 'Система' };
    updateStockHistory([entry, ...stockHistory].slice(0, 1000));
  };
  
  // Брак и списания
  const updateWriteOffs = (w) => { setWriteOffs(w); save('likebird-writeoffs', w); };
  const checkLowStockAuto = (currentStock) => {
    try {
      const threshold = 3;
      const lastCheck = localStorage.getItem('likebird-last-low-stock-check');
      const now = Date.now();
      if (lastCheck && now - parseInt(lastCheck, 10) < 900000) return; // 15 мин
      const lowItems = [];
      Object.entries(currentStock).forEach(([name, data]) => {
        if (data.count > 0 && data.count <= (data.minStock || threshold)) lowItems.push(name + ': ' + data.count);
      });
      if (lowItems.length > 0) {
        showNotification('⚠️ Низкие остатки: ' + lowItems.slice(0, 3).join(', '));
        try { localStorage.setItem('likebird-last-low-stock-check', String(now)); } catch { /* silent */ }
      }
    } catch { /* silent */ }
  };

  const addWriteOff = (productName, quantity, reason) => {
    const writeOff = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), productName, quantity, reason, date: new Date().toISOString(), user: employeeName || 'Админ' };
    updateWriteOffs([...writeOffs, writeOff]);
    // Уменьшаем склад
    if (stock[productName]) {
      const newStock = { ...stock };
      newStock[productName] = { ...newStock[productName], count: Math.max(0, newStock[productName].count - quantity) };
      updateStock(newStock);
    }
    addStockHistoryEntry(productName, 'writeoff', -quantity, reason);
    logAction('Списание', `${productName}: ${quantity} шт - ${reason}`);
  };
  
  // Автозаказ
  const updateAutoOrderList = (list) => { setAutoOrderList(list); save('likebird-autoorder', list); };
  const generateAutoOrder = () => {
    const order = [];
    Object.entries(stock).forEach(([name, data]) => {
      // FIX: Не включаем товары с count=0, у которых никогда не было остатка (init state)
      if (data.count > 0 && data.count <= data.minStock) {
        const toOrder = (data.minStock * 2) - data.count; // Заказываем до двойного минимума
        order.push({ productName: name, currentStock: data.count, minStock: data.minStock, toOrder, selected: true });
      }
    });
    updateAutoOrderList(order);
    return order;
  };
  const getAutoOrderText = () => {
    return autoOrderList.filter(i => i.selected).map(i => `${i.productName}: ${i.toOrder} шт (сейчас: ${i.currentStock})`).join('\n');
  };
  
  // KPI и цели
  const updateEmployeeKPI = (kpi) => { setEmployeeKPI(kpi); save('likebird-kpi', kpi); };
  const updateShiftsData = (s) => {
    const safe = (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
    setShiftsData(safe);
    save('likebird-shifts', safe);
  };
  const updateCustomAchievements = (a) => { setCustomAchievements(a); save('likebird-custom-achievements', a); };
  const updateAchievementsGranted = (g) => { setAchievementsGranted(g); save('likebird-achievements-granted', g); };
  const updateProfilesData = (p) => { setProfilesData(p); save('likebird-profiles', p); };
  // === BLOCK 7: Challenges update ===
  const updateChallenges = (c) => { setChallenges(c); save('likebird-challenges', c); };

  // === BLOCK 4: Product Photos update ===
  // ═══ MediaStore: каждое фото — отдельный Firebase ключ ═══
  const mediaKeyEncode = (name) => 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
  const shiftMediaKey = (dateKey) => 'likebird-ms-' + dateKey.replace(/[^a-zA-Z0-9_.]/g, '_');

  const saveMediaPhoto = (productName, base64) => {
    const key = mediaKeyEncode(productName);
    // Сохраняем в state
    setProductPhotos(prev => {
      const next = { ...prev, [productName]: base64 };
      try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
    // Сохраняем ОТДЕЛЬНЫМ ключом в Firebase (маленький, ~3-5KB)
    try { localStorage.setItem(key, base64); } catch { /* silent */ }
    fbSave(key, base64);
    // Обновляем индекс (список ключей фото)
    mediaKeysRef.current.add(productName);
    const idx = [...mediaKeysRef.current];
    try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
    fbSave('likebird-media-index', idx);
  };

  const deleteMediaPhoto = (productName) => {
    const key = mediaKeyEncode(productName);
    setProductPhotos(prev => {
      const next = { ...prev };
      delete next[productName];
      try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
    try { localStorage.removeItem(key); } catch { /* silent */ }
    fbSave(key, null);
    mediaKeysRef.current.delete(productName);
    const idx = [...mediaKeysRef.current];
    try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
    fbSave('likebird-media-index', idx);
  };

  const saveShiftPhoto = (dateKey, base64) => {
    const key = shiftMediaKey(dateKey);
    setShiftPhotos(prev => ({ ...prev, [dateKey]: base64 }));
    try { localStorage.setItem(key, base64); } catch { /* silent */ }
    fbSave(key, base64);
  };

  const updateProductPhotos = (p) => {
    // Легаси обёртка — вызывает saveMediaPhoto для каждого нового фото
    const oldKeys = Object.keys(productPhotos);
    const newKeys = Object.keys(p);
    // Добавленные
    for (const k of newKeys) {
      if (p[k] && p[k] !== productPhotos[k]) {
        saveMediaPhoto(k, p[k]);
      }
    }
    // Удалённые
    for (const k of oldKeys) {
      if (!p[k]) {
        deleteMediaPhoto(k);
      }
    }
  };

  // === BLOCK 8: Role-based access ===
  const ROLE_ACCESS = {
    seller: ['catalog','shift','profile','game','chat','analytics-own','notifications','reports','day-report','team'],
    senior: ['catalog','shift','profile','game','chat','analytics-own','reports','day-report','stock','team','analytics','notifications'],
    manager: ['*'], // Управляющий (местный директор) — полные права, но ограничен городами managedCities
    admin: ['*'],
    deputy: ['*'], // Замдиректор имеет все права как админ
    director: ['*'], // Директор — высшая роль (Константин/владелец)
  };
  const hasAccess = (action) => {
    const role = currentUser?.role || 'seller';
    // Админ, управляющий, замдиректор или директор — полный доступ
    if (role === 'admin' || role === 'manager' || role === 'deputy' || role === 'director' || currentUser?.isAdmin) return true;
    const allowed = ROLE_ACCESS[role];
    if (!allowed) return false;
    if (allowed.includes('*')) return true;
    return allowed.includes(action);
  };

  // === BLOCK 8b: City-based access (мульти-городовая фильтрация) ===
  // Извлекает город из location-строки ("Город - Точка" или просто "Город").
  const extractCity = (loc) => {
    if (!loc) return null;
    return String(loc).split(' - ')[0].trim();
  };

  // Возвращает массив городов, которые видит текущий пользователь.
  // null = все города (нет ограничений). Иначе — массив строк.
  // Управляющий (manager) ВСЕГДА ограничен своими managedCities.
  // Для других ролей managedCities — опциональное ограничение (выдаётся директором).
  // Замдиректор (deputy) — НЕ ограничен (видит всё, как админ), его deputyCity влияет только на бонусы.
  // Директор и админ без managedCities — видят всё.
  const accessibleCities = useMemo(() => {
    if (!currentUser) return null;
    const role = currentUser.role;
    const cities = Array.isArray(currentUser.managedCities) ? currentUser.managedCities.filter(Boolean) : [];

    // Директор всегда видит всё (его managedCities игнорируется — он владелец)
    if (role === 'director') return null;

    // Управляющий ОБЯЗАН иметь хотя бы один город; если не задано — видит пустоту (для безопасности)
    if (role === 'manager') return cities;

    // Остальные роли: если managedCities явно задано — ограничены, иначе видят всё
    if (cities.length > 0) return cities;

    return null;
  }, [currentUser]);

  // Проверка доступа к конкретному городу
  const canAccessCity = (city) => {
    if (!accessibleCities) return true; // null = доступ ко всем
    if (!city) return true; // если у отчёта нет города — показываем (наследие)
    return accessibleCities.includes(city);
  };

  // Фильтрация массива отчётов/расходов по доступным городам.
  // Если у записи нет location — она доступна всем (наследие старых данных).
  const filterByAccessibleCities = (items) => {
    if (!accessibleCities) return items || [];
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const loc = item?.location || item?.saleLocation;
      if (!loc) return true; // записи без локации видят все
      const city = extractCity(loc);
      return accessibleCities.includes(city);
    });
  };

  // Видимые коллекции — отфильтрованные по городам.
  // Используются в Views для отображения; raw reports/expenses остаются для админских операций.
  const visibleReports = useMemo(
    () => accessibleCities ? filterByAccessibleCities(reports) : reports,
    [reports, accessibleCities]
  );
  const visibleExpenses = useMemo(
    () => accessibleCities ? filterByAccessibleCities(expenses) : expenses,
    [expenses, accessibleCities]
  );

  // === BLOCK 4: Image compression utility ===
  const compressImage = (file, maxSize = 800, quality = 0.7) => new Promise((resolve) => {
    const drawToCanvas = (img) => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let result = canvas.toDataURL('image/jpeg', quality);
        // Гарантируем < 50KB для Firebase. Пережимаем если нужно.
        let attempts = 0;
        while (result.length > 50000 && attempts < 3) {
          attempts++;
          const scale = 0.7;
          canvas.width = Math.round(canvas.width * scale);
          canvas.height = Math.round(canvas.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', Math.max(0.3, quality - attempts * 0.15));
        }
        resolve(result);
      } catch { resolve(''); }
    };
    try {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => { URL.revokeObjectURL(url); drawToCanvas(img); };
      img.onerror = () => { URL.revokeObjectURL(url); tryReader(); };
      img.src = url;
    } catch { tryReader(); }
    function tryReader() {
      const r = new FileReader();
      r.onload = () => { const img = new window.Image(); img.onload = () => drawToCanvas(img); img.onerror = () => resolve(''); img.src = r.result; };
      r.onerror = () => resolve('');
      r.readAsDataURL(file);
    }
  });

  // === BLOCK 10: Demand prediction ===
  const predictDemand = (productName, days = 7) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recentReports = reports.filter(r => {
      try { const d = parseRuDate(r.date || r.timestamp); return d >= cutoff; } catch { return false; }
    });
    let totalSold = 0;
    recentReports.forEach(r => {
      if (getProductName(r.product) === productName) totalSold += (r.quantity || 1);
    });
    const daysSinceFirst = Math.max(1, Math.min(30, Math.ceil((Date.now() - (recentReports.length > 0 ? parseRuDate(recentReports[recentReports.length-1].date || recentReports[recentReports.length-1].timestamp).getTime() : Date.now())) / 86400000)));
    const avgDaily = totalSold / daysSinceFirst;
    const currentStock = stock[productName]?.count || 0;
    const daysRemaining = avgDaily > 0 ? currentStock / avgDaily : 999;
    return { avgDaily: Math.round(avgDaily * 100) / 100, daysRemaining: Math.round(daysRemaining), predictedNeed: Math.round(avgDaily * days) };
  };

  // === BLOCK 2: Auto notifications ===
  const checkAutoNotifications = useCallback(() => {
    try {
      const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
      const isAdminUser = currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'deputy';
      if (!isAdminUser) return;
      const todayStr = formatDate(new Date());
      const newNotifs = [];
      const existingToday = userNotifications.filter(n => {
        try { return formatDate(parseRuDate(n.timestamp)) === todayStr; } catch { return false; }
      });
      const isDuplicate = (type, title) => existingToday.some(n => n.type === type && n.title === title);

      // Low stock
      Object.entries(stock).forEach(([name, data]) => {
        const threshold = autoOrderList.find(a => a.productName === name)?.minStock || 3;
        if (data.count > 0 && data.count <= threshold) {
          const title = '📦 ' + name + ': осталось ' + data.count + ' шт';
          if (!isDuplicate('auto-stock', title)) {
            newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-stock', targetLogin: myLogin, title, body: 'Необходимо пополнить запас', icon: '📦', timestamp: Date.now(), read: false });
          }
        }
      });

      // Revenue below average
      const last30 = reports.filter(r => { try { const d = parseRuDate(r.date || r.timestamp); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30); return d >= cutoff; } catch { return false; } });
      const dailyTotals = {};
      last30.forEach(r => { const d = r.date?.split(',')[0] || ''; dailyTotals[d] = (dailyTotals[d] || 0) + (r.total || 0); });
      const dailyValues = Object.values(dailyTotals);
      if (dailyValues.length > 7) {
        const avg = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
        const todayRevenue = dailyTotals[todayStr] || 0;
        const now = new Date();
        if (now.getHours() >= 18 && todayRevenue > 0 && todayRevenue < avg * 0.7) {
          const pct = Math.round((1 - todayRevenue / avg) * 100);
          const title = '📉 Выручка за ' + todayStr + ': ' + todayRevenue + '₽';
          if (!isDuplicate('auto-revenue', title)) {
            newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-revenue', targetLogin: myLogin, title, body: 'Ниже среднего на ' + pct + '%', icon: '📉', timestamp: Date.now(), read: false });
          }
        }
      }

      // Upcoming events
      Object.entries(eventsCalendar).forEach(([date, evArr]) => {
        try {
          const [d, m, y] = date.split('.');
          const eventDate = new Date(parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
          const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= 0 && daysUntil <= 1) {
            const events = Array.isArray(evArr) ? evArr : [evArr];
            events.forEach(ev => {
              const title = '📅 Завтра: ' + (ev.title || ev.name || 'Событие');
              if (!isDuplicate('auto-event', title)) {
                newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-event', targetLogin: myLogin, title, body: date, icon: '📅', timestamp: Date.now(), read: false });
              }
            });
          }
        } catch { /* silent */ }
      });

      if (newNotifs.length > 0) {
        const updated = [...userNotifications, ...newNotifs];
        setUserNotifications(updated);
        save('likebird-notifications', updated);
      }
    } catch (e) { console.warn('Auto notifications error:', e); }
  }, [reports, stock, userNotifications, eventsCalendar, autoOrderList, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run auto notifications on mount and after report save
  useEffect(() => {
    if (isAuthenticated && (currentUser?.isAdmin || currentUser?.role === 'admin' || currentUser?.role === 'deputy')) {
      const timer = setTimeout(checkAutoNotifications, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, checkAutoNotifications]);

  // === BLOCK 7: Check challenges ===
  // eslint-disable-next-line no-unused-vars
  const checkChallenges = useCallback(() => {
    try {
      if (!challenges.length) return;
      const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
      const now = new Date();
      const todayStr = formatDate(now);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

      challenges.filter(c => c.active).forEach(ch => {
        const periodReports = reports.filter(r => {
          if (r.employee !== employeeName) return false;
          try {
            const d = parseRuDate(r.date || r.timestamp);
            if (ch.type === 'daily') return formatDate(d) === todayStr;
            if (ch.type === 'weekly') return d >= weekAgo;
            return false;
          } catch { return false; }
        });

        let current = 0;
        if (ch.condition.metric === 'sales_count') current = periodReports.length;
        else if (ch.condition.metric === 'revenue') current = periodReports.reduce((s, r) => s + (r.total || 0), 0);
        else if (ch.condition.metric === 'product_sales') current = periodReports.filter(r => getProductName(r.product) === ch.condition.product).reduce((s, r) => s + (r.quantity || 1), 0);
        else if (ch.condition.metric === 'avg_check') { const total = periodReports.reduce((s, r) => s + (r.total || 0), 0); current = periodReports.length > 0 ? Math.round(total / periodReports.length) : 0; }

        if (current >= ch.condition.target) {
          const alreadyNotified = userNotifications.some(n => n.type === 'challenge-complete' && n.title?.includes(ch.title) && formatDate(parseRuDate(n.timestamp)) === todayStr);
          if (!alreadyNotified) {
            const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'challenge-complete', targetLogin: myLogin, title: '🏆 Челлендж выполнен: ' + ch.title, body: 'Результат: ' + current + ' / ' + ch.condition.target, icon: '🏆', timestamp: Date.now(), read: false };
            const updated = [...userNotifications, notif];
            setUserNotifications(updated);
            save('likebird-notifications', updated);
            showNotification('🏆 Челлендж выполнен: ' + ch.title, 'achievement');
          }
        }
      });
    } catch (e) { console.warn('Challenge check error:', e); }
  }, [challenges, reports, employeeName, userNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  // BLOCK 7: Run challenge checks when reports change
  useEffect(() => {
    if (isAuthenticated && challenges.length > 0) {
      const timer = setTimeout(checkChallenges, 2000);
      return () => clearTimeout(timer);
    }
  }, [reports.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // === BLOCK 11: Swipe navigation ===
  const swipeRef = useRef({ startX: 0, startY: 0 });
  const handleTouchStart = (e) => {
    let el = e.target;
    let inScrollable = false;
    while (el && el !== e.currentTarget) {
      if (el.classList && (el.classList.contains('overflow-x-auto') || el.scrollWidth > el.clientWidth + 2)) {
        inScrollable = true; break;
      }
      el = el.parentElement;
    }
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, inScrollable };
  };
  const handleTouchEnd = (e) => {
    if (swipeRef.current.inScrollable) return;
    const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.startY);
    if (dx > 80 && dy < 50 && currentView !== 'menu') setCurrentView('menu');
  };

  // === BLOCK 7: Leaderboard state (lifted from IIFE) ===
  const [lbPeriod, setLbPeriod] = useState('week');

  // === BLOCK 3: Chat state (lifted from IIFE) ===
  const [chatText, setChatText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const chatEndRef = useRef(null);

  // === BLOCK 11: Skeleton component ===
  // eslint-disable-next-line no-unused-vars
  const Skeleton = ({w = '100%', h = '1rem', r = '0.5rem'}) => (
    <div className="animate-pulse bg-gray-200 rounded" style={{width:w, height:h, borderRadius:r}} />
  );

  const setEmployeeGoal = (employeeId, goalType, target, period = 'month') => {
    const key = `${employeeId}_${goalType}_${period}`;
    updateEmployeeKPI({ ...employeeKPI, [key]: { employeeId, goalType, target, period, createdAt: new Date().toISOString() } });
  };
  const getEmployeeProgress = (employeeId, goalType, period = 'month') => {
    const key = `${employeeId}_${goalType}_${period}`;
    const goal = employeeKPI[key];
    if (!goal) return null;
    
    // Считаем прогресс
    let current = 0;
    const now = new Date();
    const periodStart = new Date();
    if (period === 'week') periodStart.setDate(now.getDate() - 7);
    else if (period === 'month') periodStart.setDate(now.getDate() - 30); // FIX: единообразно 30 дней
    
    const empReports = reports.filter(r => {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp || r.employee !== emp.name) return false;
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= periodStart;
    });
    
    if (goalType === 'sales') current = empReports.length;
    else if (goalType === 'revenue') current = empReports.reduce((sum, r) => sum + r.total, 0);
    
    return { goal: goal.target, current, percentage: Math.min(100, Math.round((current / goal.target) * 100)) };
  };
  
  // Системные уведомления (с сохранением)
  const addSystemNotification = (type, message, priority = 'normal') => {
    const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), type, message, priority, date: new Date().toISOString(), read: false };
    const updated = [notif, ...systemNotifications].slice(0, 50);
    setSystemNotifications(updated);
    save('likebird-system-notifications', updated);
  };
  
  // Проверка низкого остатка и создание уведомлений
  const checkLowStock = () => {
    const lowItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock);
    if (lowItems.length > 0) {
      addSystemNotification('stock', `Низкий остаток: ${lowItems.map(([n]) => n).join(', ')}`, 'high');
    }
    return lowItems;
  };
  
  // Аналитика
  const getAnalytics = (period = 7) => {
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(now.getDate() - period);
    
    const periodReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= periodStart && !r.isUnrecognized;
    });
    
    // По дням
    const byDay = {};
    periodReports.forEach(r => {
      const [datePart] = (r.date||'').split(',');
      if (!byDay[datePart]) byDay[datePart] = { sales: 0, revenue: 0, profit: 0 };
      byDay[datePart].sales += 1;
      byDay[datePart].revenue += r.total;
      byDay[datePart].profit += getProfit(r.product, r.total);
    });
    
    // По сотрудникам
    const byEmployee = {};
    periodReports.forEach(r => {
      if (!byEmployee[r.employee]) byEmployee[r.employee] = { sales: 0, revenue: 0 };
      byEmployee[r.employee].sales += 1;
      byEmployee[r.employee].revenue += r.total;
    });
    
    // По товарам
    const byProduct = {};
    periodReports.forEach(r => {
      if (!byProduct[r.product]) byProduct[r.product] = { sales: 0, revenue: 0 };
      byProduct[r.product].sales += 1;
      byProduct[r.product].revenue += r.total;
    });
    
    // По локациям
    const byLocation = {};
    periodReports.forEach(r => {
      const loc = r.location || 'Не указано';
      if (!byLocation[loc]) byLocation[loc] = { sales: 0, revenue: 0 };
      byLocation[loc].sales += 1;
      byLocation[loc].revenue += r.total;
    });
    
    // Общие метрики
    const totalSales = periodReports.length;
    const totalRevenue = periodReports.reduce((sum, r) => sum + r.total, 0);
    const totalProfit = periodReports.reduce((sum, r) => sum + getProfit(r.product, r.total), 0);
    const avgCheck = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
    
    // Сравнение с предыдущим периодом
    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - period);
    const prevReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= prevStart && reportDate < periodStart && !r.isUnrecognized;
    });
    const prevRevenue = prevReports.reduce((sum, r) => sum + r.total, 0);
    const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    
    return { byDay, byEmployee, byProduct, byLocation, totalSales, totalRevenue, totalProfit, avgCheck, revenueChange, period };
  };
  
  // Точка безубыточности
  const getBreakEvenPoint = (fixedCosts = 0) => {
    const analytics = getAnalytics(30);
    if (analytics.totalRevenue === 0) return null;
    const avgMargin = analytics.totalProfit / analytics.totalRevenue;
    if (avgMargin <= 0) return null;
    return Math.round(fixedCosts / avgMargin);
  };

  const fixUnrecognizedReport = (reportId, productName) => {
    const report = reports.find(r => r.id === reportId);
    const product = findProductByPrice(productName, report?.salePrice || 0, CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS);
    if (!product) { showNotification('Товар не найден', 'error'); return false; }
    const updated = reports.map(r => r.id === reportId ? { ...r, product: product.name, category: product.category, basePrice: product.price, salary: calculateSalary(product.price, r.salePrice, product.category, r.tips || 0, 'normal', salarySettings), isUnrecognized: false } : r);
    updateReports(updated);
    showNotification('Товар исправлен');
    return true;
  };

  const saveReport = (params = {}) => {
    // Используем переданные параметры или глобальные состояния
    const empName = params.employeeName || employeeName;
    const price = params.salePrice || salePrice;
    const product = params.selectedProduct || selectedProduct;
    const category = params.selectedCategory || selectedCategory;
    const tips = params.tipsAmount || tipsAmount;
    const mixCash = params.mixedCash || mixedCash;
    const mixCashless = params.mixedCashless || mixedCashless;
    const photo = params.photo !== undefined ? params.photo : salePhotoGlobal;
    const location = params.location !== undefined ? params.location : saleLocationGlobal;
    const discountNote = params.discountReason || '';
    // paymentType и qty берём из params (localPaymentType/localQuantity из NewReportView)
    const pType = params.paymentType || 'cash';
    const qty = params.quantity ? parseInt(params.quantity) : 1;
    
    if (!product || !price || !empName) { showNotification('Заполните все поля', 'error'); return; }
    const priceNum = parseInt(price), tipsNum = parseInt(tips) || 0;
    const salary = calculateSalary(product.price, priceNum, category, tipsNum, 'normal', salarySettings);
    const now = Date.now();
    const dateStr = params.customDate || new Date().toLocaleString('ru-RU');
    // Каждая единица — отдельная запись
    const newReports = Array.from({ length: qty }, (_, i) => {
      let cashAmt = 0, cashlessAmt = 0;
      if (pType === 'cash') { cashAmt = priceNum; }
      else if (pType === 'cashless') { cashlessAmt = priceNum; }
      else if (pType === 'mixed') {
        // При смешанной и qty>1 делим пропорционально
        cashAmt = Math.round((parseInt(mixCash) || 0) / qty);
        cashlessAmt = Math.round((parseInt(mixCashless) || 0) / qty);
      }
      return {
        id: now + i, date: dateStr, product: product.name, category: category,
        basePrice: product.price, salePrice: priceNum, quantity: 1, employee: empName,
        total: priceNum, tips: tipsNum, salary: salary, tipsModel: 'v2',
        paymentType: pType, cashAmount: cashAmt, cashlessAmount: cashlessAmt, isUnrecognized: false,
        createdAt: now + i, reviewStatus: 'pending',
        photo: photo || null,
        location: location || null,
        discountReason: discountNote || null,
        isBelowBase: priceNum < product.price,
        ...(params.addedBy ? { addedBy: params.addedBy } : {}),
      };
    });
    updateReports([...newReports, ...reports]);
    addStockHistoryEntry(product.name, 'sale', -qty, `Продажа ${empName} x${qty}${discountNote ? ' (скидка: ' + discountNote + ')' : ''}`);
    if (stock[product.name]) {
      const newStock = {...stock};
      newStock[product.name] = {...newStock[product.name], count: Math.max(0, newStock[product.name].count - qty)};
      updateStock(newStock);
    }
    localStorage.setItem('likebird-employee', empName);
    setEmployeeName(empName);
    setSalePrice(''); setQuantity(1); setPaymentType('cash'); setTipsAmount(''); setSelectedProduct(null); setSelectedCategory(null); setMixedCash(''); setMixedCashless('');
    setSalePhotoGlobal(null); setSaleLocationGlobal('');
    showNotification(`Продажа сохранена: ${product.name}${qty > 1 ? ' x' + qty : ''}`);
    if (!params.noRedirect) setCurrentView('shift');
  };

  const saveParsedReports = (empNameParam, customDateParam) => {
    // Используем переданное имя или глобальное состояние
    const empName = empNameParam || employeeName;
    if (!empName) { showNotification('Введите имя сотрудника', 'error'); return; }
    if (parsedSales.length === 0 && unrecognizedSales.length === 0) { showNotification('Нет продаж для сохранения', 'error'); return; }
    // Дата отчёта: либо кастомная (для админ-импорта задним числом), либо сейчас
    let dateStr;
    if (customDateParam && /^\d{4}-\d{2}-\d{2}$/.test(customDateParam)) {
      // YYYY-MM-DD → DD.MM.YYYY, 12:00:00 (полдень — маркер «дата выставлена вручную»)
      const [y, m, d] = customDateParam.split('-');
      dateStr = `${d}.${m}.${y}, 12:00:00`;
    } else {
      dateStr = new Date().toLocaleString('ru-RU');
    }
    const now = Date.now();
    const newReports = [
      // FIX: добавлен tipsModel:'v2' чтобы миграция не обнулила реальные чаевые
      ...parsedSales.map((s, i) => ({ id: now + i, date: dateStr, product: s.product.name, category: s.category, basePrice: s.product.price, salePrice: s.price, quantity: 1, employee: empName, total: s.price, tips: s.tips || 0, salary: s.salary, tipsModel: 'v2', paymentType: s.paymentType, cashAmount: s.cashAmount, cashlessAmount: s.cashlessAmount, isUnrecognized: false, workTime: parsedWorkTime, createdAt: now, reviewStatus: 'pending', originalReportText: textReport })),
      ...unrecognizedSales.map((s, i) => ({ id: now + 10000 + i, date: dateStr, product: s.extractedName, category: 'Нераспознанный товар', basePrice: 0, salePrice: s.price, quantity: 1, employee: empName, total: s.price, tips: s.tips || 0, salary: s.salary, tipsModel: 'v2', paymentType: s.paymentType, cashAmount: s.cashAmount, cashlessAmount: s.cashlessAmount, isUnrecognized: true, originalText: s.originalText, workTime: parsedWorkTime, createdAt: now, reviewStatus: 'pending', originalReportText: textReport })),
    ];
    if (parsedExpenses.length > 0) {
      const newExpenses = parsedExpenses.map((e, i) => ({ id: now + 20000 + i, date: dateStr, amount: e.amount, description: e.description, employee: empName }));
      const updatedExpenses = [...newExpenses, ...expenses];
      setExpenses(updatedExpenses);
      save('likebird-expenses', updatedExpenses);
    }
    const newStock = {...stock};
    parsedSales.forEach(s => { if (newStock[s.product.name]) newStock[s.product.name] = {...newStock[s.product.name], count: Math.max(0, newStock[s.product.name].count - 1)}; });
    updateStock(newStock);
    updateReports([...newReports, ...reports]);
    // Если админ импортит за другого сотрудника — НЕ меняем свою сессию
    if (!adminImportMode) {
      localStorage.setItem('likebird-employee', empName);
      setEmployeeName(empName); // Сохраняем в глобальное состояние
    } else {
      logAction('admin-import', JSON.stringify({ admin: employeeName, importedFor: empName, salesCount: parsedSales.length + unrecognizedSales.length, dateUsed: dateStr }));
    }
    showNotification(adminImportMode ? `[Админ] Сохранено ${parsedSales.length + unrecognizedSales.length} продаж за ${empName}` : `Сохранено ${parsedSales.length + unrecognizedSales.length} продаж`);
    setTextReport(''); setParsedSales([]); setUnrecognizedSales([]); setParsedWorkTime(null); setCalculatedTotals(null); setParsedExpenses([]); setParsedInventory({ start: {}, end: {} }); setInventoryDiscrepancies([]);
    // Сбрасываем флаг админ-импорта после сохранения
    if (adminImportMode) setAdminImportMode(false);
    setCurrentView(adminImportMode ? 'admin' : 'menu');
  };

  const deleteReport = (id) => {
    showConfirm('Удалить эту запись?', () => {
      const r = reports.find(x => x.id === id);
      const productName = r ? getProductName(r.product) : null;
      if (r && !r.isUnrecognized && productName && stock[productName]) {
        const qty = r.quantity || 1;
        const newStock = {...stock};
        newStock[productName] = {...newStock[productName], count: newStock[productName].count + qty};
        updateStock(newStock);
        addStockHistoryEntry(productName, 'return', qty, 'Удалена продажа');
      }
      updateReports(reports.filter(x => x.id !== id));
      const nd = {...salaryDecisions}; delete nd[id]; setSalaryDecisions(nd); save('likebird-salary-decisions', nd);
      logAction('delete-report', JSON.stringify({ product: productName, total: r?.total, employee: r?.employee, deletedBy: employeeName, date: r?.date }));
      showNotification('Запись удалена');
    });
  };

  const addExpense = (emp) => {
    // FIX: Используем React-стейт вместо DOM-манипуляции
    setExpenseModal({ employee: emp });
  };

  const deleteExpense = (id) => {
    showConfirm('Удалить этот расход?', () => {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated); save('likebird-expenses', updated);
      showNotification('Расход удалён');
    });
  };

  const updateGivenToAdmin = (emp, amount) => { const key = emp + '_' + selectedDate; const updated = {...givenToAdmin, [key]: amount}; setGivenToAdmin(updated); save('likebird-given', updated); };
  const getGivenToAdmin = (emp) => givenToAdmin[emp + '_' + selectedDate] || 0;
  // Используем visibleReports/visibleExpenses чтобы автоматически применить городскую фильтрацию.
  const getReportsByDate = (date) => visibleReports.filter(r => (r.date||'').split(',')[0] === date);
  const getExpensesByDate = (date) => visibleExpenses.filter(e => (e.date||'').split(',')[0] === date);
  const getAllDates = () => [...new Set(visibleReports.map(r => (r.date||'').split(',')[0]))].sort((a, b) => { const [d1,m1,y1] = a.split('.'); const [d2,m2,y2] = b.split('.'); return new Date(y2,m2-1,d2) - new Date(y1,m1-1,d1); });
  const navigateDate = (dir) => { const dates = getAllDates(); const idx = dates.indexOf(selectedDate); if (dir === 'prev' && idx < dates.length - 1) setSelectedDate(dates[idx + 1]); else if (dir === 'next' && idx > 0) setSelectedDate(dates[idx - 1]); };

  const handleParseText = useCallback((inputText) => {
    // Используем переданный текст или глобальный textReport
    const text = inputText || textReport;
    if (!text.trim()) { showNotification('Введите текст отчёта', 'error'); return; }
    const { recognized, unrecognized, workTime, expenses: exp, inventory } = parseTextReport(text, CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS);
    // FIX: Пересчитываем salary по актуальным salarySettings (parseTextReport не имеет к ним доступа)
    const recalcRecognized = recognized.map(s => ({
      ...s,
      salary: calculateSalary(s.product.price, s.price, s.category, s.tips || 0, 'normal', salarySettings),
    }));
    setParsedSales(recalcRecognized); setUnrecognizedSales(unrecognized); setParsedWorkTime(workTime); setParsedExpenses(exp); setParsedInventory(inventory);
    const sold = countSoldProducts(recalcRecognized);
    setInventoryDiscrepancies(compareInventory(inventory, sold, DYNAMIC_ALL_PRODUCTS));
    const allSales = [...recalcRecognized, ...unrecognized];
    
    // Считаем суммы продаж без чаевых
    const baseCash = allSales.reduce((s, x) => s + (x.cashAmount || 0), 0);
    const baseCashless = allSales.reduce((s, x) => s + (x.cashlessAmount || 0), 0);
    
    // Считаем чаевые отдельно по типу оплаты
    const tipsCash = allSales.filter(x => x.paymentType === 'cash' || x.paymentType === 'mixed').reduce((s, x) => s + (x.tips || 0), 0);
    const tipsCashless = allSales.filter(x => x.paymentType === 'cashless').reduce((s, x) => s + (x.tips || 0), 0);
    const totalTips = tipsCash + tipsCashless;
    
    // Итого с чаевыми
    const totalCash = baseCash + tipsCash;
    const totalCashless = baseCashless + tipsCashless;
    
    const totalSalary = allSales.reduce((s, x) => s + (x.salary || 0), 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    const byCat = {}; recognized.forEach(x => { byCat[x.category] = (byCat[x.category] || 0) + 1; });
    const soldByProduct = {}; recognized.forEach(x => { soldByProduct[x.product.name] = (soldByProduct[x.product.name] || 0) + 1; });
    
    setCalculatedTotals({ 
      total: baseCash + baseCashless, 
      totalWithTips: totalCash + totalCashless, 
      cash: totalCash, // Наличные с чаевыми
      cashless: totalCashless, // Безнал с чаевыми
      baseCash, // Наличные без чаевых
      baseCashless, // Безнал без чаевых
      tipsCash, // Чаевые наличными
      tipsCashless, // Чаевые безналом
      salary: totalSalary, 
      tips: totalTips, 
      count: allSales.length, 
      byCategory: byCat, 
      expenses: totalExpenses, 
      soldByProduct 
    });
    if (recognized.length > 0 || unrecognized.length > 0) showNotification(`Распознано: ${recognized.length}, нераспознано: ${unrecognized.length}`);
  }, [textReport, salarySettings]);

  // FIX: Условие count > 0 — при инициализации все count=0, не считаем их «низким остатком»
  const getLowStockItems = () => Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock).map(([name, data]) => ({name, ...data}));
  
  const getWeekSales = () => { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0); const sales = {}; reports.filter(r => { const [d, m, y] = (r.date||'').split(',')[0].split('.'); return new Date(y, m-1, d) >= weekAgo && !r.isUnrecognized; }).forEach(r => { const pName = getProductName(r.product); sales[pName] = (sales[pName] || 0) + (r.quantity || 1); }); return sales; };

  // Helper: enrich backup with component-level media data
  const enrichBackup = (data) => ({
    ...data,
    _mediaPhotos: productPhotos,
    _shiftPhotos: shiftPhotos,
    _mediaIndex: [...(mediaKeysRef.current || [])],
  });

  const exportData = async () => {
    const fname = `likebird-backup-${dateForFile()}.json`;
    
    // Быстрый локальный бэкап — готовим сразу как fallback
    let localBackup;
    try { localBackup = enrichBackup(SyncManager.exportAll()); } catch { localBackup = { _version: 2, _error: 'exportAll failed', _date: new Date().toISOString() }; }
    
    showNotification('⏳ Получаем данные...');
    try {
      const fbData = {};
      const keys = [...SyncManager.ALL_KEYS];
      const fetchWithTimeout = (key) => new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 5000);
        try { fbGet(key).then(val => { clearTimeout(timer); resolve(val); }).catch(() => { clearTimeout(timer); resolve(null); }); } catch { clearTimeout(timer); resolve(null); }
      });
      await Promise.all(keys.map(async (key) => {
        const val = await fetchWithTimeout(key);
        if (val !== null && val !== undefined) fbData[key] = val;
      }));
      const fbKeyCount = Object.keys(fbData).length;
      const finalData = fbKeyCount > 0 ? enrichBackup({ ...localBackup, ...fbData, _source: 'firebase+local' }) : localBackup;
      downloadBlob(new Blob([JSON.stringify(finalData)], { type: 'application/json' }), fname);
      showNotification(fbKeyCount > 0 ? `✅ Бэкап сохранён (Firebase: ${fbKeyCount})` : '✅ Бэкап сохранён');
    } catch (err) {
      try {
        downloadBlob(new Blob([JSON.stringify(localBackup)], { type: 'application/json' }), fname);
        showNotification('✅ Бэкап сохранён (локально)');
      } catch (e2) {
        showNotification('❌ Ошибка: ' + (e2.message || 'неизвестная'), 'error');
      }
    }
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // 1. Записываем в localStorage
        const imported = SyncManager.importAll(data);
        // 2. Синхронизируем каждый ключ с Firebase
        let fbPushed = 0;
        // FIX: Используем SYNC_KEYS из firebase.js (ранее — неполный хардкод с дубликатом)
        for (const key of SYNC_KEYS) {
          if (data[key] !== undefined) {
            try {
              await fbSave(key, data[key]);
              fbPushed++;
            } catch { /* silent */ }
          }
        }
        showNotification(`✅ Импортировано ${imported} записей → Firebase (${fbPushed}). Перезагрузка...`);
        setTimeout(() => window.location.reload(), 2500);
      } catch (err) {
        showNotification('Ошибка импорта: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    showConfirm('Очистить ВСЕ данные? Это действие нельзя отменить!', () => {
      logAction('Полная очистка данных', `Пользователь: ${employeeName || 'Неизвестен'}`);
      SyncManager.ALL_KEYS.forEach(k => localStorage.removeItem(k));
      // FIX: Очищаем и Firebase, иначе данные вернутся через подписки
      SYNC_KEYS.forEach(key => fbSave(key, null));
      setReports([]); setExpenses([]); setStock(getInitialStock()); setGivenToAdmin({}); setSalaryDecisions({}); setOwnCardTransfers({});
      setPartnerStock({}); setTotalBirds(0); setScheduleData({}); setEventsCalendar({});
      setAuditLog([]); setCustomProducts([]); setPenalties([]); setBonuses([]);
      setTimeOff([]); setEmployeeRatings({}); setChatMessages([]); setStockHistory([]);
      setWriteOffs([]); setAutoOrderList([]); setEmployeeKPI({}); setSystemNotifications([]);
      // FIX: Ранее не очищались
      setInviteCodes([]); setCustomAchievements([]); setAchievementsGranted({});
      setShiftsData({}); setProfilesData({}); setUserNotifications([]);
      showNotification('Все данные очищены');
    });
  };

  const copyDayReport = (emp, empReports, totals) => {
    const { cashTotal, cashlessTotal, totalTips, totalSalary, empExpenses, toGive } = totals;
    const byCat = empReports.filter(r => !r.isUnrecognized).reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + (r.quantity || 1); return acc; }, {});
    // Добавляем время смены
    let shiftLine = '';
    try {
      const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      const u = users.find(u => (u.name || u.login) === emp);
      const login = u?.login || emp;
      const shift = (shiftsData || {})[`${login}_${selectedDate}`];
      if (shift?.openTime) {
        shiftLine = `⏱️ Смена: ${shift.openTime}`;
        if (shift.closeTime) {
          shiftLine += ` → ${shift.closeTime}`;
          const [oh, om] = shift.openTime.split(':').map(Number);
          const [ch, cm] = shift.closeTime.split(':').map(Number);
          let mins = (ch * 60 + cm) - (oh * 60 + om);
          if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
          if (mins > 0) {
            const h = Math.floor(mins / 60);
            const roundedH = h + Math.floor((mins % 60) / 15) * 0.25;
            shiftLine += ` (${Number.isInteger(roundedH) ? roundedH : roundedH.toFixed(2).replace(/0$/, '')} ч)`;
          }
        }
        shiftLine += '\n';
      }
    } catch { /* silent */ }
    let text = `📅 ${selectedDate} - ${emp}\n${shiftLine}📦 Продаж: ${empReports.length}\n`;
    Object.entries(byCat).forEach(([cat, cnt]) => { text += `${CAT_ICONS[cat]} ${cat}: ${cnt}\n`; });
    text += `\n💰 Итого: ${(cashTotal + cashlessTotal).toLocaleString()}₽\n💵 Наличные: ${cashTotal.toLocaleString()}₽\n💳 Безнал: ${cashlessTotal.toLocaleString()}₽\n🎁 Чаевые: ${totalTips.toLocaleString()}₽\n👛 ЗП: ${totalSalary.toLocaleString()}₽\n`;
    if (empExpenses > 0) text += `📝 Расходы: -${empExpenses}₽\n`;
    text += `\n💼 Отдаю: ${toGive.toLocaleString()}₽`;
    navigator.clipboard.writeText(text).then(() => showNotification('Скопировано в буфер обмена'));
  };

  const SalaryDecisionButtons = ({ report, compact }) => {
    const decision = salaryDecisions[report.id] || 'normal';
    const belowPrice = isBelowBasePrice(report.basePrice, report.salePrice);
    const priceDiff = report.basePrice - report.salePrice;
    if (!belowPrice || report.isUnrecognized) return null;
    const baseSalary = calculateSalary(report.basePrice, report.salePrice, report.category, report.tips || 0, 'normal', salarySettings);
    if (compact) return (
      <div className="flex gap-1 mt-1">
        <button onClick={() => updateSalaryDecision(report.id, 'normal')} className={`px-2 py-0.5 rounded text-xs ${decision === 'normal' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>ЗП {baseSalary}₽</button>
        <button onClick={() => updateSalaryDecision(report.id, 'none')} className={`px-2 py-0.5 rounded text-xs ${decision === 'none' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>0₽</button>
        <button onClick={() => updateSalaryDecision(report.id, 'deduct')} className={`px-2 py-0.5 rounded text-xs ${decision === 'deduct' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>-{priceDiff}₽</button>
      </div>
    );
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
        <p className="text-xs text-yellow-700 mb-2">⚠️ Ниже базовой цены на {priceDiff}₽</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => updateSalaryDecision(report.id, 'normal')} className={`px-3 py-1 rounded text-sm ${decision === 'normal' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>✅ ЗП ({baseSalary}₽)</button>
          <button onClick={() => updateSalaryDecision(report.id, 'none')} className={`px-3 py-1 rounded text-sm ${decision === 'none' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>❌ Без ЗП</button>
          <button onClick={() => updateSalaryDecision(report.id, 'deduct')} className={`px-3 py-1 rounded text-sm ${decision === 'deduct' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>💸 -{priceDiff}₽</button>
        </div>
      </div>
    );
  };

  const FixUnrecognizedButton = ({ report }) => {
    const [editing, setEditing] = useState(false);
    const [newName, setNewName] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    if (!report.isUnrecognized) return null;
    const handleSearch = (value) => { setNewName(value); if (value.length >= 2) setSuggestions(DYNAMIC_ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(value.toLowerCase()) || p.aliases.some(a => a.includes(value.toLowerCase()))).slice(0, 5)); else setSuggestions([]); };
    if (editing) return (
      <div className="mt-2 space-y-2">
        <div className="flex gap-2">
          <input type="text" value={newName} onChange={(e) => handleSearch(e.target.value)} placeholder="Название товара" className="flex-1 px-2 py-1 border-2 border-blue-300 rounded text-sm" autoFocus />
          <button onClick={() => { if (fixUnrecognizedReport(report.id, newName)) { setEditing(false); setNewName(''); setSuggestions([]); } }} className="px-3 py-1 bg-green-500 text-white rounded text-sm font-bold">✓</button>
          <button onClick={() => { setEditing(false); setNewName(''); setSuggestions([]); }} className="px-3 py-1 bg-gray-400 text-white rounded text-sm">✕</button>
        </div>
        {suggestions.length > 0 && <div className="bg-white border rounded-lg shadow-lg overflow-hidden">{suggestions.map((p, i) => (<button key={i} onClick={() => { if (fixUnrecognizedReport(report.id, p.name)) { setEditing(false); setNewName(''); setSuggestions([]); } }} className="w-full text-left px-3 py-2 hover:bg-amber-50 flex justify-between items-center border-b last:border-0"><span>{p.emoji} {p.name}</span><span className="text-amber-600 font-semibold">{p.price}₽</span></button>))}</div>}
      </div>
    );
    return <button onClick={() => setEditing(true)} className="mt-2 w-full flex items-center justify-center gap-2 text-white bg-blue-500 hover:bg-blue-600 py-2 px-3 rounded-lg text-sm font-semibold"><Edit3 className="w-4 h-4" /> Исправить название</button>;
  };

  // FIX #56b: ConfirmDialog теперь DOM-based через confirmDialogRef (см. showConfirm выше)
  // FIX #56: ToastNotification теперь DOM-based через notificationRef (см. showNotification выше)

  // FIX: React-компонент модала расходов (заменяет DOM-манипуляцию)
  const ExpenseModal = () => {
    const [desc, setDesc] = useState('');
    const [amt, setAmt] = useState('');
    if (!expenseModal) return null;
    const handleSave = () => {
      if (!desc.trim()) { showNotification('Введите описание', 'error'); return; }
      const amtNum = parseInt(amt, 10);
      if (!amtNum || isNaN(amtNum) || amtNum <= 0) { showNotification('Введите положительную сумму', 'error'); return; }
      const newExp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), date: new Date().toLocaleString('ru-RU'), amount: amtNum, description: desc.trim(), employee: expenseModal.employee };
      const updated = [newExp, ...expenses]; setExpenses(updated); save('likebird-expenses', updated);
      showNotification('Расход добавлен');
      setExpenseModal(null);
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <h3 className="text-lg font-bold mb-4">📝 Новый расход</h3>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание расхода" maxLength={200} className="w-full p-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-amber-500 focus:outline-none" autoFocus />
          <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Сумма" className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-amber-500 focus:outline-none" onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
          <div className="flex gap-3">
            <button onClick={() => setExpenseModal(null)} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">Сохранить</button>
          </div>
        </div>
      </div>
    );
  };

  // FIX #56c: InputModal теперь DOM-based через inputModalRef (см. showInputModal выше)

  // FIX (vendor-out AdminView): inline-объявление AdminView ВЫНЕСЕНО в
  // src/views/AdminView.jsx (импортируется наверху файла). Раньше AdminView был
  // объявлен здесь как const AdminView = () => {...}, и при каждом ре-рендере
  // LikeBirdApp создавалась новая ссылка на функцию-компонент → React делал полный
  // re-mount → все локальные useState внутри AdminView (30+ штук: вкладки, формы
  // редактирования, незакомиченный ввод) сбрасывались к начальным значениям.
  // Подробнее: см. AdminView.jsx и комментарии FIX #56 рядом с showNotification.

  // Объединённый TeamView с вкладками (только просмотр для сотрудников)

  // ===== РАЗДЕЛ: СМЕНА =====

  // ===== ЛИЧНЫЙ КАБИНЕТ СОТРУДНИКА =====

  // ===== СТРАНИЦА АВТОРИЗАЦИИ =====

  // ===== ЗАГРУЗКА =====
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 animate-pulse">
            <span className="text-4xl">🐦</span>
          </div>
          <p className="text-white font-bold text-xl">LikeBird</p>
          <p className="text-white/70 text-sm mt-1">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ===== АВТОРИЗАЦИЯ =====
  if (!isAuthenticated) {
    const authContext = {
      employees, inviteCodes, save,
      setAuthName, setCurrentUser, setEmployeeName,
      setEmployees, setInviteCodes, setIsAuthenticated,
    };
    return (
      <AppProvider value={authContext}>
        <AuthView />
      </AppProvider>
    );
  }

  // ===== APP CONTEXT: собираем все данные и функции для будущих выносимых компонентов =====
  const appContext = {
    // --- Данные (useState переменные) ---
    reports, employees, stock, expenses, salarySettings,
    salaryDecisions, employeeName, currentUser, isAdminUnlocked,
    darkMode, isOnline, locations, costPrices, penalties, bonuses,
    timeOff, employeeRatings, chatMessages, stockHistory, writeOffs,
    autoOrderList, employeeKPI, customProducts, archivedProducts,
    customAliases, profilesData, presenceData, userNotifications,
    shiftsData, eventsCalendar, scheduleData, manuals, inviteCodes,
    challenges, customAchievements, achievementsGranted, productPhotos,
    shiftPhotos, notifSettings, partnerStock, totalBirds,
    givenToAdmin, ownCardTransfers, selectedDate, parsedSales,
    unrecognizedSales, parsedWorkTime, parsedExpenses, textReport,
    systemNotifications, expenseModal, selectedCategory, selectedProduct,
    salePrice, quantity, paymentType, tipsAmount, mixedCash, mixedCashless,
    parsedInventory, inventoryDiscrepancies, calculatedTotals,
    adminPassword, adminTab, challengeForm, teamTab, salesPlan,
    personnelTab, stockTab, analyticsSubTab,
    auditLog, selectedLocation, searchFilters, analyticsCache,
    stockCategory, salePhotoGlobal, saleLocationGlobal,
    deferredPrompt, showInstallBanner, expenseCategories,
    isAuthenticated, authName, authLoading,
    analyticsPeriod, manualFilter, chatLimit,
    lbPeriod, chatText, showMentions, reactionMsgId, chatEndRef,
    currentView, adminImportMode,
    // --- Мутабельные глобальные (для Views, которые их используют) ---
    DYNAMIC_ALL_PRODUCTS, CUSTOM_ALIASES,

    // --- Функции бизнес-логики ---
    save, showNotification, showConfirm, showInputModal, logAction,
    setCurrentView, updateReports, updateStock,
    updateEmployees, addEmployee, removeEmployee, toggleEmployeeActive,
    saveReport, saveParsedReports, deleteReport, addExpense,
    deleteExpense, updateGivenToAdmin, getGivenToAdmin,
    getOwnCard, updateOwnCard, getEffectiveSalary, getAdminShiftEarnings, getProductName, migrateEmployeeName,
    hasAccess, exportData, importData, clearAllData,
    accessibleCities, canAccessCity, filterByAccessibleCities,
    visibleReports, visibleExpenses, extractCity,
    addPenalty, addBonus, addTimeOff, addWriteOff,
    generateAutoOrder, getAutoOrderText, updateSalesPlan,
    updateLocations, addLocation, removeLocation, toggleLocationActive,
    getCities, getLocationsByCity, updateCostPrices, setCostPrice,
    getCostPrice, getProfit, fixUnrecognizedReport, updateManuals,
    updateCustomProducts, addCustomProduct, removeCustomProduct,
    compressImage, saveMediaPhoto, deleteMediaPhoto, saveShiftPhoto,
    updateProductPhotos, updateShiftsData, updateChallenges,
    updateCustomAchievements, updateAchievementsGranted,
    updateProfilesData, updateChatMessages, sendMessage, markAsRead,
    getUnreadMessages, rateEmployee, getEmployeeAverageRating,
    setEmployeeGoal, getEmployeeProgress, addSystemNotification,
    addStockHistoryEntry, saveAlias, removeAlias, checkAdminPassword,
    setAdminPass, getAnalytics, getBreakEvenPoint, predictDemand,
    getAllDates, getReportsByDate, getExpensesByDate, navigateDate,
    handleParseText, getLowStockItems, getWeekSales, copyDayReport,
    checkAutoNotifications, updateSalaryDecision, updateAutoOrderList,
    toggleArchiveProduct,
    // FIX (vendor-out AdminView): функции, ранее доступные через замыкание родителя
    enrichBackup, getActiveTimeOff, getEmployeeBonuses, getEmployeePenalties, updateBonuses,

    // --- set-функции от useState ---
    setSelectedDate, setExpenseModal, setSelectedCategory,
    setSelectedProduct, setSalePrice, setQuantity, setPaymentType,
    setTipsAmount, setMixedCash, setMixedCashless, setTextReport,
    setParsedSales, setUnrecognizedSales, setParsedWorkTime,
    setParsedExpenses, setCalculatedTotals, setInventoryDiscrepancies,
    setParsedInventory, setDarkMode, setIsAdminUnlocked,
    setEmployeeName, setAuthName, setIsAuthenticated, setCurrentUser,
    setSalarySettings, setAdminPassword, setAdminTab,
    setEmployees, setSalesPlan, setAuditLog, setInviteCodes,
    setNotifSettings, setUserNotifications, setChallenges,
    setCustomAchievements, setAchievementsGranted,
    setBonuses, setPenalties, setProfilesData,
    setStockCategory, setSalePhotoGlobal, setSaleLocationGlobal,
    setSelectedLocation, setCostPrices, setSearchFilters,
    setAnalyticsCache, setChallengeForm, setTeamTab,
    setPartnerStock, setTotalBirds, setScheduleData, setEventsCalendar,
    setManuals, setCustomProducts, setArchivedProducts,
    setAutoOrderList, setEmployeeKPI, setCustomAliases,
    setPresenceData, setShiftsData, setProductPhotos, setShiftPhotos,
    setSystemNotifications, setDeferredPrompt, setShowInstallBanner,
    setAnalyticsPeriod, setManualFilter, setChatLimit,
    setPersonnelTab, setStockTab, setAnalyticsSubTab,
    setLbPeriod, setChatText, setShowMentions, setReactionMsgId,
    setReports, setExpenses, setStock, setGivenToAdmin,
    setSalaryDecisions, setOwnCardTransfers, setStockHistory,
    setWriteOffs, setTimeOff, setEmployeeRatings, setChatMessages,
    setIsOnline,
    setAdminImportMode,
  };

  return (
    <AppProvider value={appContext}>
      <div className={darkMode ? 'dark-theme' : ''} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div ref={notificationRef} style={{opacity: 0, pointerEvents: 'none'}} className="fixed top-4 left-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white text-sm font-medium transition-opacity duration-300 bg-green-500" />
        <div ref={confirmDialogRef} style={{display: 'none'}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <p data-confirm-msg className="text-lg mb-4"></p>
            <div className="flex gap-3">
              <button onClick={hideConfirm} className="flex-1 py-2 bg-gray-200 rounded-lg font-semibold">Отмена</button>
              <button onClick={handleConfirmClick} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold">Подтвердить</button>
            </div>
          </div>
        </div>
        <ExpenseModal key={expenseModal ? 'exp-' + expenseModal.employee : 'exp-closed'} />
        <div ref={inputModalRef} style={{display: 'none'}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 data-input-title className="text-lg font-bold mb-3"></h3>
            <input ref={inputModalInputRef} type="text" value={inputModalValue || ""} onChange={e => setInputModalValue(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-amber-500 focus:outline-none" onKeyDown={e => { if (e.key === 'Enter') handleInputModalSave(); if (e.key === 'Escape') hideInputModal(); }} />
            <div className="flex gap-3">
              <button onClick={hideInputModal} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
              <button onClick={handleInputModalSave} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">Сохранить</button>
            </div>
          </div>
        </div>
        {currentView === 'menu' && <MenuView />}
        {currentView === 'catalog' && <CatalogView />}
        {currentView === 'new-report' && <NewReportView />}
        {currentView === 'text-import' && <TextImportView />}
        {currentView === 'stock' && <StockView />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'day-report' && <DayReportView />}
        {currentView === 'notifications' && <NotificationsView />}
        {currentView === 'settings' && <SettingsView />}
        {currentView === 'admin' && <AdminView />}
        {currentView === 'team' && <TeamView />}
        {currentView === 'profile' && <ProfileView />}
        {currentView === 'shift' && <ShiftView />}
        {currentView === 'analytics' && <AnalyticsView />}
        {currentView === 'game' && <GameView />}
      </div>
    </AppProvider>
  );
}
