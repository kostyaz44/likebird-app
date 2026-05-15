/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, no-shadow, eqeqeq, no-fallthrough, no-unreachable, no-redeclare */
// FIX (vendor-out): AdminView ранее жил inline внутри LikeBirdApp как
// `const AdminView = () => {...}`. При каждом ре-рендере родителя создавалась новая
// ссылка на функцию-компонент → React делал полный re-mount → все локальные useState
// (вкладки личного состава / склада / аналитики, формы редактирования сотрудника /
// товара / мануала / достижения, незакомиченный ввод текста ревизии и т.д.) сбрасывались
// к начальным значениям. Это и было причиной «выбрасывания на первую вкладку» и
// похожих багов с потерей формы. Тот же приём (вынос наружу) уже применён для
// StockView, ShiftView, TeamView, AnalyticsView и других.
//
// Все данные и колбэки родителя приходят через AppContext (см. useApp() ниже).
import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, ArrowLeft, Trash2, X, AlertTriangle, Edit3, Package, Bell,
  Download, Upload, Settings, Calendar, CheckCircle, Shield, DollarSign, Users,
  Lock, TrendingUp, Award, MapPin, MessageCircle, Star, Key, Eye,
  ChevronRight, Camera, BarChart3, Archive
} from 'lucide-react';
import { fbSave } from '../firebase.js';
import { calculateSalary } from '../utils/salary.js';
import { PRODUCTS, ALL_PRODUCTS, CAT_ICONS } from '../data/products.js';
import { hashPassword } from '../utils/auth.js';
import { formatDate, dateForFile, parseYear } from '../utils/dates.js';
import { downloadBlob } from '../utils/helpers.js';
import { SyncManager } from '../services/sync.js';
import KpiGoalsPanel from '../components/ui/KpiGoalsPanel.jsx';
import { useApp } from '../context/AppContext';

export default function AdminView() {
  const {
    // --- данные ---
    CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS, achievementsGranted, adminPassword,
    adminTab, analyticsPeriod, analyticsSubTab, auditLog, autoOrderList,
    bonuses, challengeForm, challenges, chatMessages, currentUser,
    customAchievements, customProducts, darkMode, employeeKPI, employeeName,
    employees, eventsCalendar, expenseCategories, expenses, inviteCodes,
    isAdminUnlocked, manuals, notifSettings, paymentType, penalties,
    personnelTab, productPhotos, profilesData, quantity, reports,
    salarySettings, salePrice, salesPlan, scheduleData, shiftPhotos,
    shiftsData, stock, stockHistory, stockTab, totalBirds, userNotifications,
    writeOffs,
    customAliases,
    archivedProducts,
    // --- функции бизнес-логики ---
    addBonus, addCustomProduct, addEmployee, addLocation, addPenalty,
    addStockHistoryEntry, addTimeOff, addWriteOff, checkAdminPassword,
    clearAllData, compressImage, deleteMediaPhoto, enrichBackup, exportData,
    generateAutoOrder,
    getActiveTimeOff, getAllDates, getAnalytics, getAutoOrderText,
    getCities, getCostPrice, getEffectiveSalary, getEmployeeAverageRating,
    getEmployeeBonuses, getEmployeePenalties, getEmployeeProgress,
    getLocationsByCity, getLowStockItems, getProductName,
    importData, logAction, rateEmployee, removeAlias, removeCustomProduct,
    removeLocation, save, saveAlias,
    sendMessage, setAdminPass, setEmployeeGoal, showConfirm, showNotification,
    toggleArchiveProduct, toggleLocationActive, updateAchievementsGranted,
    updateAutoOrderList,
    updateBonuses, updateChallenges, updateCustomAchievements,
    updateEmployees, updateManuals, updateProductPhotos, updateReports,
    updateSalesPlan, updateStock,
    // --- сеттеры ---
    setAdminTab, setAnalyticsPeriod, setAnalyticsSubTab, setChallengeForm,
    setCostPrice, setCurrentUser, setCurrentView, setEventsCalendar,
    setExpenses, setInviteCodes, setIsAdminUnlocked, setNotifSettings,
    setPersonnelTab, setSalaryDecisions, setSalarySettings, setScheduleData,
    setStockTab, setTotalBirds, setUserNotifications,
    setCustomProducts,
  } = useApp();

  const [passwordInput, setPasswordInput] = useState('');
  const [newEmployee, setNewEmployee] = useState('');
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Птички-свистульки', emoji: '🎁' });
  const [editingManual, setEditingManual] = useState(null);
  const [newManual, setNewManual] = useState({ title: '', category: 'sales', content: '', isPinned: false });
  const [editBonusId, setEditBonusId] = useState(null);
  const [editBonusForm, setEditBonusForm] = useState({ amount: '', reason: '' });
  const [regUsers, setRegUsers] = useState(() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ login: '', name: '', password: '', role: 'seller', isAdmin: false });
  const [addMode, setAddMode] = useState(false);
  const [addError, setAddError] = useState('');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [expandedEdit, setExpandedEdit] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({});
  const [showEventForm, setShowEventForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', description: '', type: 'info', emoji: '📅' });
  const [editingEventRef, setEditingEventRef] = useState(null); // { dateKey, index }
  const [achForm, setAchForm] = useState({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '', bonusAmount: '' });
  const [editingAch, setEditingAch] = useState(null);

  // Refresh regUsers from localStorage (was inside IIFE)
  useEffect(() => {
    const interval = setInterval(() => {
      try { setRegUsers(JSON.parse(localStorage.getItem('likebird-users') || '[]')); } catch { /* silent */ }
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  const [kpiEditMode, setKpiEditMode] = useState(null);
  const [kpiEditValue, setKpiEditValue] = useState('');
  // States moved from IIFEs to fix input focus bug
  const [adminPassInput, setAdminPassInput] = useState('');
  const [historyLimit, setHistoryLimit] = useState(50);
  const [newWriteOff, setNewWriteOff] = useState({ product: '', quantity: '', reason: '' });
  const [chatText, setChatText] = useState('');
  const [chatTo, setChatTo] = useState('');
  // chatLimit moved to parent scope
  const [newCity, setNewCity] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [newPenalty, setNewPenalty] = useState({ employeeId: '', amount: '', reason: '' });
  const [newBonus, setNewBonus] = useState({ employeeId: '', amount: '', reason: '' });
  const [newTimeOff, setNewTimeOff] = useState({ employeeId: '', type: 'vacation', startDate: '', endDate: '', note: '' });
  // Products tab edit states
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductData, setEditProductData] = useState({ name: '', price: '', emoji: '', category: '' });
  const [productPhoto, setProductPhoto] = useState(null);
  // Revision tab states (moved from IIFE to fix hooks order)
  const [revMode, setRevMode] = useState('overview');
  const [revText, setRevText] = useState('');
  const [revParsed, setRevParsed] = useState(null);
  const [revHistory, setRevHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('likebird-revision-history') || '[]'); } catch { return []; } });
  const [viewingRev, setViewingRev] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [itemSearch, setItemSearch] = useState('');
  const [addingProduct, setAddingProduct] = useState(null);
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdCat, setNewProdCat] = useState('3D игрушки');
  // productPhotos & setProductPhotos — using global state (synced via Firebase)
  // FIX: inviteCodes перенесён в глобальное состояние LikeBirdApp (синхронизируется через Firebase)
  
  // Проверка пароля при входе
  if (adminPassword && !isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Админ-панель</h2>
            <p className="text-sm text-gray-500 mt-1">Введите пароль для доступа</p>
          </div>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-purple-500 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { checkAdminPassword(passwordInput).then(ok => ok ? setIsAdminUnlocked(true) : showNotification('Неверный пароль', 'error')).catch(() => showNotification('Ошибка проверки пароля', 'error')); }}} />
          <button onClick={() => { checkAdminPassword(passwordInput).then(ok => ok ? setIsAdminUnlocked(true) : showNotification('Неверный пароль', 'error')).catch(() => showNotification('Ошибка проверки пароля', 'error')); }} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:opacity-90">Войти</button>
          <button onClick={() => setCurrentView('menu')} className="w-full mt-3 text-gray-500 py-2">Назад</button>
        </div>
      </div>
    );
  }

  // Вычисления для дашборда
  const today = new Date();
  const todayStr = formatDate(today);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const todayReports = reports.filter(r => r.date.startsWith(todayStr) && !r.isUnrecognized);
  const todayApproved = todayReports.filter(r => r.reviewStatus === 'approved' || r.reviewStatus === 'submitted');
  const todayPending = todayReports.filter(r => !r.reviewStatus || r.reviewStatus === 'pending');
  const weekReports = reports.filter(r => {
    const [datePart] = (r.date||'').split(',');
    const [d, m, y] = datePart.split('.');
    const reportDate = new Date(parseYear(y), m - 1, d);
    return reportDate >= weekAgo && !r.isUnrecognized;
  });
  const monthReports = reports.filter(r => {
    const [datePart] = (r.date||'').split(',');
    const [d, m, y] = datePart.split('.');
    const reportDate = new Date(parseYear(y), m - 1, d);
    return reportDate >= monthAgo && !r.isUnrecognized;
  });

  const todayRevenue = todayReports.reduce((s, r) => s + r.total, 0);
  const weekRevenue = weekReports.reduce((s, r) => s + r.total, 0);
  const monthRevenue = monthReports.reduce((s, r) => s + r.total, 0);
  const todaySalary = todayReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
  const weekSalary = weekReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
  
  const todayExpenses = expenses.filter(e => e.date.startsWith(todayStr)).reduce((s, e) => s + e.amount, 0);
  const weekExpenses = expenses.filter(e => {
    const [datePart] = (e.date||'').split(',');
    const [d, m, y] = datePart.split('.');
    const expDate = new Date(parseYear(y), m - 1, d);
    return expDate >= weekAgo;
  }).reduce((s, e) => s + e.amount, 0);

  // Топ продаж за неделю
  const topProducts = weekReports.reduce((acc, r) => {
    const pName = getProductName(r.product);
    acc[pName] = (acc[pName] || 0) + (r.quantity || 1);
    return acc;
  }, {});
  const topProductsList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Статистика по сотрудникам
  const employeeStats = weekReports.reduce((acc, r) => {
    if (!acc[r.employee]) acc[r.employee] = { sales: 0, revenue: 0, count: 0 };
    acc[r.employee].sales += (r.quantity || 1);
    acc[r.employee].revenue += r.total;
    acc[r.employee].count++;
    return acc;
  }, {});

  // Статистика по категориям
  const categoryStats = weekReports.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = { count: 0, revenue: 0 };
    acc[r.category].count += (r.quantity || 1);
    acc[r.category].revenue += r.total;
    return acc;
  }, {});

  // Функции настроек зарплаты
  const updateRange = (index, field, value) => {
    const newRanges = [...salarySettings.ranges];
    newRanges[index] = {...newRanges[index], [field]: parseInt(value) || 0};
    const updated = {...salarySettings, ranges: newRanges};
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменены настройки ЗП', `Диапазон ${index + 1}`);
  };

  const toggleBonus = () => {
    const updated = {...salarySettings, bonusForBirds: !salarySettings.bonusForBirds};
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменён бонус за птичек', updated.bonusForBirds ? 'Включен' : 'Выключен');
  };

  // Компонент редактирования графика
  const ScheduleEditor = () => {
    const [weekRange, setWeekRange] = useState(scheduleData.week || '');
    const [shifts, setShifts] = useState(scheduleData.shifts || {});
    const [scheduleViewMode, setScheduleViewMode] = useState('list');
    const activeEmployees = employees.filter(e => e.active).map(e => e.name);
    
    // Функция расчёта часов из времени
    const calculateHours = (startTime, endTime, breakStart, breakEnd) => {
      if (!startTime || !endTime) return 0;
      
      const parseTime = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h + (m || 0) / 60;
      };
      
      const start = parseTime(startTime);
      const end = parseTime(endTime);
      let hours = end - start;
      
      // Вычитаем перерыв если указан
      if (breakStart && breakEnd) {
        const bStart = parseTime(breakStart);
        const bEnd = parseTime(breakEnd);
        const breakHours = bEnd - bStart;
        if (breakHours > 0) hours -= breakHours;
      }
      
      return Math.max(0, Math.round(hours * 10) / 10);
    };

    const shiftsCount = Object.values(shifts).reduce((sum, emp) => sum + (emp?.length || 0), 0);
    const totalHours = Object.values(shifts).reduce((sum, emp) => 
      sum + (emp?.reduce((s, sh) => s + (sh.hours || 0), 0) || 0), 0
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
        hours: 9 
      });
      setShifts(newShifts);
    };

    const updateShift = (employee, index, field, value) => {
      const newShifts = { ...shifts };
      newShifts[employee][index][field] = value;
      
      // Пересчитываем часы при изменении времени
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
        // FIX: Обновляем parent state напрямую (setShifts — локальный state ScheduleEditor, 
        // который теряется при remount от showConfirm → parent re-render)
        const data = { week: weekRange, shifts: {} };
        setScheduleData(data);
        save('likebird-schedule', data);
        logAction('Очищены все смены', '');
        showNotification('Смены очищены');
      });
    };

    // Быстрые шаблоны смен
    const applyTemplate = (employee, template) => {
      const newShifts = { ...shifts };
      if (!newShifts[employee]) newShifts[employee] = [];
      
      const templates = {
        'full': { startTime: '10:00', endTime: '19:00', breakStart: '13:00', breakEnd: '14:00', hours: 8 },
        'morning': { startTime: '09:00', endTime: '15:00', breakStart: '', breakEnd: '', hours: 6 },
        'evening': { startTime: '15:00', endTime: '21:00', breakStart: '', breakEnd: '', hours: 6 },
        'short': { startTime: '10:00', endTime: '14:00', breakStart: '', breakEnd: '', hours: 4 },
      };
      
      const t = templates[template];
      newShifts[employee].push({ date: '', ...t });
      setShifts(newShifts);
    };

    return (
      <div className="space-y-4">
        {/* Период + Вид */}
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />Период графика</h3>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setScheduleViewMode('list')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${scheduleViewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Список</button>
              <button onClick={() => setScheduleViewMode('table')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${scheduleViewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Таблица</button>
            </div>
          </div>
          <input type="text" value={weekRange} onChange={(e) => setWeekRange(e.target.value)} placeholder="27.01.26 - 02.02.26" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
        </div>

        {/* Статистика */}
        <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4 border-2 border-blue-300">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-blue-700">📊 Статистика</p>
              <p className="text-sm text-blue-600">{shiftsCount} смен • {totalHours} часов</p>
            </div>
            <button onClick={clearAllShifts} className="text-red-500 hover:text-red-700 text-sm">Очистить всё</button>
          </div>
        </div>

        {/* Табличный вид */}
        {scheduleViewMode === 'table' && (() => {
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
            
            const templates = {
              'morning': { startTime: '09:00', endTime: '15:00', breakStart: '', breakEnd: '', hours: 6 },
              'evening': { startTime: '15:00', endTime: '21:00', breakStart: '', breakEnd: '', hours: 6 },
              'full': { startTime: '10:00', endTime: '19:00', breakStart: '13:00', breakEnd: '14:00', hours: 8 },
            };

            if (existingIdx >= 0) {
              const existing = newShifts[emp][existingIdx];
              if (existing.startTime === templates[type].startTime && existing.endTime === templates[type].endTime) {
                newShifts[emp].splice(existingIdx, 1);
                if (newShifts[emp].length === 0) delete newShifts[emp];
              } else {
                newShifts[emp][existingIdx] = { date: dayStr, ...templates[type] };
              }
            } else {
              newShifts[emp].push({ date: dayStr, ...templates[type] });
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
                        <th key={i} className={`p-2 text-center min-w-[60px] ${isToday ? 'bg-blue-50 text-blue-700 font-black' : 'text-gray-500'}`}>
                          <div>{dayLabels[i]}</div>
                          <div className="text-[10px]">{d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}</div>
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
                        const shiftType = shift ? (shift.startTime === '09:00' ? 'morning' : shift.startTime === '15:00' ? 'evening' : 'full') : null;
                        return (
                          <td key={i} className={`p-1 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => toggleShiftType(emp, d, 'morning')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'morning' ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'}`}>☀</button>
                              <button onClick={() => toggleShiftType(emp, d, 'evening')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'evening' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-indigo-100'}`}>🌙</button>
                              <button onClick={() => toggleShiftType(emp, d, 'full')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'full' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-100'}`}>∎</button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 flex gap-3 text-[10px] text-gray-500 border-t">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded"></span> Утро (09-15)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded"></span> Вечер (15-21)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Полная (10-19)</span>
              </div>
            </div>
          );
        })()}

        {/* Список смен (оригинальный вид) */}
        {scheduleViewMode === 'list' && activeEmployees.map(emp => (
          <div key={emp} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">{emp}</h3>
              <div className="flex gap-1">
                <button onClick={() => applyTemplate(emp, 'full')} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200" title="Полный день 10-19">Полный</button>
                <button onClick={() => applyTemplate(emp, 'morning')} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200" title="Утро 9-15">Утро</button>
                <button onClick={() => applyTemplate(emp, 'evening')} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs hover:bg-purple-200" title="Вечер 15-21">Вечер</button>
                <button onClick={() => addShift(emp)} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">+ Своя</button>
              </div>
            </div>
            
            {shifts[emp]?.length > 0 ? (
              <div className="space-y-3">
                {shifts[emp].map((shift, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
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
                      <button onClick={() => removeShift(emp, idx)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Время работы */}
                    <div className="flex gap-2 items-center mb-2">
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
                    <div className="flex gap-2 items-center mb-2">
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
                      <span className="text-lg font-bold text-blue-600 ml-2">{shift.hours || 0} ч</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 px-2">
                  <span className="text-sm text-gray-500">Всего у {emp}:</span>
                  <span className="font-bold text-blue-700">{shifts[emp].reduce((s, sh) => s + (sh.hours || 0), 0)} часов</span>
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
            <p className="text-sm text-yellow-600 mt-1">Добавьте сотрудников во вкладке "Сотрудники"</p>
          </div>
        )}

        {/* Кнопка сохранения */}
        <button onClick={saveSchedule} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg">
          <CheckCircle className="w-6 h-6" />Сохранить график
        </button>
      </div>
    );
  };

  const tabs = [
    { id: 'analytics', label: '📈 Аналитика', icon: BarChart3 },
    { id: 'review', label: '✅ Проверка', icon: CheckCircle },
    { id: 'personnel', label: '👥 Персонал+', icon: Users },
    { id: 'stockplus', label: '📦 Склад+', icon: Archive },
    { id: 'chat', label: '💬 Чат', icon: MessageCircle },
    { id: 'settings', label: '⚙️ Настройки', icon: Settings },
    { id: 'notifications', label: '🔔 Уведомления', icon: Bell },
    { id: 'security', label: '🔐 Доступ', icon: Lock },
    { id: 'manuals', label: '📚 Мануалы', icon: FileText },
    { id: 'audit', label: '📋 Аудит', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50 pb-6">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => { setCurrentView('menu'); setIsAdminUnlocked(false); }} className="mb-2"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" />Админ-панель</h2>
      </div>

      {/* Вкладки — auto-scroll to active tab only on adminTab change */}
      <div className="sticky top-16 z-10 bg-white shadow-md" ref={el => {
        if (el && !el._scrollSetup) {
          el._scrollSetup = true;
          const scrollToActive = () => {
            const container = el.querySelector('#admin-tabs-scroll');
            if (!container) return;
            const active = container.querySelector('[data-active="true"]');
            if (!active) return;
            const cRect = container.getBoundingClientRect();
            const aRect = active.getBoundingClientRect();
            if (aRect.left < cRect.left || aRect.right > cRect.right) {
              active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            }
          };
          setTimeout(scrollToActive, 50);
          if (el._observer) { try { el._observer.disconnect(); } catch { /* silent */ } }
          const observer = new MutationObserver(scrollToActive);
          el._observer = observer;
          observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-active'] });
        }
      }}>
        <div className="relative flex items-center">
          {/* Кнопка влево */}
          <button
            onClick={() => { const el = document.getElementById('admin-tabs-scroll'); if (el) el.scrollBy({ left: -200, behavior: 'smooth' }); }}
            className="flex-shrink-0 px-2 py-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border-r border-gray-100 z-10 bg-white"
            style={{minWidth: 32}}>
            ‹
          </button>
          <div id="admin-tabs-scroll"
            className="flex overflow-x-auto px-1 py-2 gap-1 flex-1"
            style={{scrollbarWidth: 'thin', scrollbarColor: '#9333ea #f3f4f6', WebkitOverflowScrolling: 'touch'}}
            onWheel={e => {
              if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaX; }
              else { e.currentTarget.scrollLeft += e.deltaY; }
            }}>
          {tabs.map(tab => (
            <button key={tab.id} data-active={adminTab === tab.id}
              onClick={() => setAdminTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${adminTab === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {tab.label}
            </button>
          ))}
          </div>
          {/* Кнопка вправо */}
          <button
            onClick={() => { const el = document.getElementById('admin-tabs-scroll'); if (el) el.scrollBy({ left: 200, behavior: 'smooth' }); }}
            className="flex-shrink-0 px-2 py-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border-l border-gray-100 z-10 bg-white"
            style={{minWidth: 32}}>
            ›
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-4">
        {/* Analytics sub-tabs */}
        {adminTab === 'analytics' && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {[
              { id: 'today', label: '📊 Сегодня' },
              { id: 'charts', label: '📈 Графики' },
            ].map(t => (
              <button key={t.id} onClick={() => setAnalyticsSubTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${analyticsSubTab === t.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ВКЛАДКА: Сегодня (дашборд) */}
        {adminTab === 'analytics' && analyticsSubTab === 'today' && (() => {
          const todayTopProducts = todayReports.reduce((acc, r) => {
            const n = getProductName(r.product);
            acc[n] = (acc[n] || 0) + 1;
            return acc;
          }, {});
          const topToday = Object.entries(todayTopProducts).sort((a, b) => b[1] - a[1])[0];
          const onShiftNow = Object.entries(shiftsData).filter(([key, s]) => {
            return key.endsWith(`_${todayStr}`) && s.status === 'open';
          }).map(([key]) => {
            const login = key.replace(`_${todayStr}`, '');
            const user = employees.find(e => e.name === login) || { name: login };
            try { const users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); const u = users.find(u => u.login === login); if (u) return { name: u.name || login }; } catch { /* silent */ }
            return { name: login };
          });
          const lowStockItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= (data.minStock || 3));

          return (
            <div className="space-y-4">
              {/* KPI виджеты */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-4 text-white">
                  <p className="text-white/70 text-xs">💰 Выручка сегодня</p>
                  <p className="text-2xl font-black">{todayRevenue.toLocaleString()}₽</p>
                  <p className="text-white/60 text-xs mt-1">{todayReports.length} продаж</p>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl p-4 text-white">
                  <p className="text-white/70 text-xs">👤 На смене сейчас</p>
                  <p className="text-2xl font-black">{onShiftNow.length}</p>
                  <p className="text-white/60 text-xs mt-1 truncate">{onShiftNow.map(e => e.name).join(', ') || 'Никого'}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-4 text-white">
                  <p className="text-white/70 text-xs">🏆 Топ-товар дня</p>
                  <p className="text-lg font-black truncate">{topToday ? topToday[0] : '—'}</p>
                  <p className="text-white/60 text-xs mt-1">{topToday ? `${topToday[1]} шт` : 'Нет продаж'}</p>
                </div>
                <div className={`rounded-xl p-4 text-white ${lowStockItems.length > 0 ? 'bg-gradient-to-br from-red-400 to-rose-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                  <p className="text-white/70 text-xs">⚠️ Мало на складе</p>
                  <p className="text-2xl font-black">{lowStockItems.length}</p>
                  <p className="text-white/60 text-xs mt-1">{lowStockItems.length > 0 ? 'позиций' : 'Всё в норме'}</p>
                </div>
              </div>

              {/* Детали низких остатков */}
              {lowStockItems.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                  <h4 className="font-bold text-red-700 mb-2 text-sm">⚠️ Остатки ниже нормы</h4>
                  <div className="space-y-1">
                    {lowStockItems.slice(0, 8).map(([name, data]) => (
                      <div key={name} className="flex justify-between items-center text-sm py-1 border-b border-red-100 last:border-0">
                        <span>{data.emoji} {name}</span>
                        <span className="font-bold text-red-600">{data.count} / {data.minStock || 3}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Продажи сегодня по сотрудникам */}
              {todayReports.length > 0 && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h4 className="font-bold text-gray-700 mb-3 text-sm">👥 Продажи сегодня по сотрудникам</h4>
                  <div className="space-y-2">
                    {Object.entries(todayReports.reduce((acc, r) => {
                      if (!acc[r.employee]) acc[r.employee] = { count: 0, revenue: 0 };
                      acc[r.employee].count++;
                      acc[r.employee].revenue += r.total;
                      return acc;
                    }, {})).sort((a, b) => b[1].revenue - a[1].revenue).map(([emp, data]) => (
                      <div key={emp} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                        <span className="font-medium text-sm">{emp}</span>
                        <div className="text-right">
                          <span className="font-bold text-green-600 text-sm">{data.revenue.toLocaleString()}₽</span>
                          <span className="text-xs text-gray-400 ml-2">{data.count} шт</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        {/* ВКЛАДКА: Дашборд */}
        {/* Аналитика (объединённая) */}
        {adminTab === 'analytics' && analyticsSubTab === 'charts' && (() => {
          const analytics = getAnalytics(analyticsPeriod);
          const cities = getCities();
          const maxRevenue = Math.max(...Object.values(analytics.byDay).map(d => d.revenue), 1);
          
          return (
            <div className="space-y-4">
              {/* KPI карточки */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-3 text-white">
                  <p className="text-xs opacity-80">Сегодня</p>
                  <p className="text-xl font-bold">{todayRevenue.toLocaleString()}₽</p>
                  <p className="text-xs">{todayApproved.length} подтв.{todayPending.length > 0 && <span className="opacity-70"> · {todayPending.length} ожид.</span>}</p>
                  <div className="mt-1 bg-white/20 rounded-full h-1.5"><div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, (todayRevenue / (salesPlan.daily || 1)) * 100)}%` }} /></div>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl p-3 text-white">
                  <p className="text-xs opacity-80">За неделю</p>
                  <p className="text-xl font-bold">{weekRevenue.toLocaleString()}₽</p>
                  <p className="text-xs">{weekReports.length} продаж</p>
                  <div className="mt-1 bg-white/20 rounded-full h-1.5"><div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, (weekRevenue / (salesPlan.weekly || 1)) * 100)}%` }} /></div>
                </div>
                <div className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl p-3 text-white">
                  <p className="text-xs opacity-80">За месяц</p>
                  <p className="text-xl font-bold">{monthRevenue.toLocaleString()}₽</p>
                  <p className="text-xs">{monthReports.length} продаж</p>
                </div>
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-3 text-white">
                  <p className="text-xs opacity-80">Прибыль (неделя)</p>
                  <p className="text-xl font-bold">{(weekRevenue - weekSalary - weekExpenses).toLocaleString()}₽</p>
                  <p className="text-xs">ЗП: {weekSalary.toLocaleString()}₽ • Расх: {weekExpenses.toLocaleString()}₽</p>
                </div>
              </div>

              {/* Топ продаж + Категории */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow">
                  <h4 className="font-bold text-sm mb-2">🏆 Топ (неделя)</h4>
                  {topProductsList.slice(0, 5).map(([name, count], i) => {
                    const dn = typeof name === 'object' ? (name?.name || '?') : String(name);
                    return (<div key={i} className="flex items-center gap-2 text-xs py-0.5"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100'}`}>{i+1}</span><span className="flex-1 truncate">{dn}</span><span className="font-bold">{count}</span></div>);
                  })}
                  {topProductsList.length === 0 && <p className="text-gray-400 text-xs">Нет данных</p>}
                </div>
                <div className="bg-white rounded-xl p-3 shadow">
                  <h4 className="font-bold text-sm mb-2">📊 Категории</h4>
                  {Object.entries(categoryStats).map(([cat, data]) => (
                    <div key={cat} className="flex justify-between text-xs py-0.5"><span>{CAT_ICONS[cat]}</span><span className="font-bold">{data.count} шт ({data.revenue.toLocaleString()}₽)</span></div>
                  ))}
                </div>
              </div>

              {/* План продаж */}
              <div className="bg-white rounded-xl p-3 shadow">
                <h4 className="font-bold text-sm mb-2">🎯 План продаж</h4>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-gray-500">День</label><input type="number" value={salesPlan.daily} onChange={(e) => updateSalesPlan({...salesPlan, daily: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                  <div><label className="text-xs text-gray-500">Неделя</label><input type="number" value={salesPlan.weekly} onChange={(e) => updateSalesPlan({...salesPlan, weekly: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                  <div><label className="text-xs text-gray-500">Месяц</label><input type="number" value={salesPlan.monthly} onChange={(e) => updateSalesPlan({...salesPlan, monthly: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                </div>
              </div>

              {/* Период аналитики */}
              <div className="flex gap-2">
                {[7, 14, 30].map(p => (
                  <button key={p} onClick={() => setAnalyticsPeriod(p)}
                    className={`px-4 py-2 rounded-lg font-medium ${analyticsPeriod === p ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 border'}`}>
                    {p} дней
                  </button>
                ))}
              </div>

              {/* Основные метрики */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-4 text-white">
                  <p className="text-xs opacity-80">Выручка</p>
                  <p className="text-2xl font-bold">{analytics.totalRevenue.toLocaleString()}₽</p>
                  <p className={`text-xs ${analytics.revenueChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                    {analytics.revenueChange >= 0 ? '↑' : '↓'} {Math.abs(analytics.revenueChange)}% vs прошлый период
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-4 text-white">
                  <p className="text-xs opacity-80">Прибыль</p>
                  <p className="text-2xl font-bold">{analytics.totalProfit.toLocaleString()}₽</p>
                  <p className="text-xs opacity-70">Без себестоимости</p>
                </div>
                <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-4 text-white">
                  <p className="text-xs opacity-80">Продаж</p>
                  <p className="text-2xl font-bold">{analytics.totalSales}</p>
                  <p className="text-xs opacity-70">{(analytics.totalSales / analyticsPeriod).toFixed(1)}/день</p>
                </div>
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl p-4 text-white">
                  <p className="text-xs opacity-80">Ср. чек</p>
                  <p className="text-2xl font-bold">{analytics.avgCheck}₽</p>
                </div>
              </div>

              {/* График по дням */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-600" />Выручка по дням</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byDay).slice(-7).map(([date, data]) => (
                    <div key={date} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-16">{date.split('.').slice(0, 2).join('.')}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-400 to-purple-600 h-full rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(5, (data.revenue / maxRevenue) * 100)}%` }}>
                          <span className="text-xs text-white font-medium">{data.revenue.toLocaleString()}₽</span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 w-8">{data.sales}шт</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Топ сотрудников */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" />Топ сотрудников</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byEmployee).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([emp, data], i) => (
                    <div key={emp} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>{i + 1}</span>
                      <span className="flex-1 font-medium">{emp}</span>
                      <span className="text-purple-600 font-bold">{data.revenue.toLocaleString()}₽</span>
                      <span className="text-gray-400 text-sm">{data.sales}шт</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Топ товаров */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="w-5 h-5 text-purple-600" />Топ товаров</h3>
                <div className="space-y-2">
                  {Object.entries(analytics.byProduct).sort((a, b) => b[1].sales - a[1].sales).slice(0, 5).map(([prod, data], i) => (
                    <div key={prod} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="font-medium">{prod}</span>
                      <div className="text-right">
                        <span className="text-purple-600 font-bold">{data.sales}шт</span>
                        <span className="text-gray-400 text-sm ml-2">{data.revenue.toLocaleString()}₽</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* По локациям */}
              {Object.keys(analytics.byLocation).length > 1 && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-600" />По точкам</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.byLocation).sort((a, b) => b[1].revenue - a[1].revenue).map(([loc, data]) => (
                      <div key={loc} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="font-medium">{loc}</span>
                        <span className="text-purple-600 font-bold">{data.revenue.toLocaleString()}₽</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ВКЛАДКА: Проверка отчётов */}
        {adminTab === 'review' && (
          <div className="space-y-4">
            {/* Статистика */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-yellow-100 rounded-xl p-3 text-center border-2 border-yellow-300">
                <p className="text-2xl font-bold text-yellow-700">{reports.filter(r => r.reviewStatus === 'pending' || !r.reviewStatus).length}</p>
                <p className="text-xs text-yellow-600">Ожидают</p>
              </div>
              <div className="bg-green-100 rounded-xl p-3 text-center border-2 border-green-300">
                <p className="text-2xl font-bold text-green-700">{reports.filter(r => r.reviewStatus === 'approved').length}</p>
                <p className="text-xs text-green-600">Верно</p>
              </div>
              <div className="bg-red-100 rounded-xl p-3 text-center border-2 border-red-300">
                <p className="text-2xl font-bold text-red-700">{reports.filter(r => r.reviewStatus === 'rejected' || r.reviewStatus === 'revision').length}</p>
                <p className="text-xs text-red-600">Ошибки</p>
              </div>
            </div>

            {/* Группировка по датам */}
            {(() => {
              const groupedByDate = {};
              reports.forEach(r => {
                const dateKey = (r.date||'').split(',')[0];
                if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
                groupedByDate[dateKey].push(r);
              });
              const dates = Object.keys(groupedByDate).slice(0, 7);
              
              return dates.map(dateKey => {
                const dayReports = groupedByDate[dateKey];
                const byEmployee = {};
                dayReports.forEach(r => {
                  if (!byEmployee[r.employee]) byEmployee[r.employee] = [];
                  byEmployee[r.employee].push(r);
                });
                
                return (
                  <div key={dateKey} className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <div className="bg-purple-100 p-3 border-b">
                      <h3 className="font-bold text-purple-800">📅 {dateKey}</h3>
                      <p className="text-xs text-purple-600">{dayReports.length} продаж</p>
                    </div>
                    
                    {Object.entries(byEmployee).map(([empName, empReports]) => {
                      const empTotal = empReports.reduce((s, r) => s + r.total, 0);
                      const empSalary = empReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                      const status = empReports[0]?.reviewStatus || 'pending';
                      const hasOriginalText = empReports.some(r => r.originalReportText);
                      
                      return (
                        <div key={empName} className="p-4 border-b last:border-b-0">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-bold">{empName}</p>
                              <p className="text-sm text-gray-600">{empReports.length} продаж • {empTotal.toLocaleString()}₽</p>
                              <p className="text-xs text-amber-600">ЗП: {empSalary.toLocaleString()}₽</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {status === 'approved' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">✓ Верно</span>}
                              {status === 'rejected' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">✗ Ошибки</span>}
                              {status === 'revision' && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">↻ Доработать</span>}
                              {(status === 'pending' || !status) && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">⏳ Ожидает</span>}
                            </div>
                          </div>
                          
                          {/* Продажи — с редактированием */}
                          {(() => {
                            return (
                              <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
                                {empReports.map((r, idx) => (
                                  <div key={r.id || idx} className={`text-sm rounded-lg overflow-hidden border ${r.isUnrecognized ? 'border-red-200' : 'border-gray-200'}`}>
                                    {expandedEdit === r.id ? (
                                      <div className="p-3 bg-blue-50 space-y-2">
                                        <p className="text-xs font-bold text-blue-700 mb-1">✏️ Редактирование</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-xs text-gray-500">Цена ₽</label>
                                            <input type="number" value={adminEditForm.salePrice || ''} onChange={e => setAdminEditForm({...adminEditForm, salePrice: e.target.value})}
                                              className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5" />
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500">Тип оплаты</label>
                                            <select value={adminEditForm.paymentType || 'cash'} onChange={e => setAdminEditForm({...adminEditForm, paymentType: e.target.value})}
                                              className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5">
                                              <option value="cash">💵 Нал</option>
                                              <option value="cashless">💳 Безнал</option>
                                              <option value="mixed">💵💳 Смеш</option>
                                            </select>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="text-xs text-gray-500">Товар</label>
                                          <input type="text" value={adminEditForm.product || ''} onChange={e => setAdminEditForm({...adminEditForm, product: e.target.value})}
                                            className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-xs text-gray-500">Чаевые ₽</label>
                                            <input type="number" value={adminEditForm.tips || ''} onChange={e => setAdminEditForm({...adminEditForm, tips: e.target.value})}
                                              className="w-full p-2 border-2 border-amber-300 rounded-lg text-sm focus:border-amber-500 focus:outline-none mt-0.5" placeholder="0" />
                                          </div>
                                          {adminEditForm.paymentType === 'mixed' && (
                                            <>
                                              <div>
                                                <label className="text-xs text-gray-500">💵 Наличные ₽</label>
                                                <input type="number" value={adminEditForm.cashAmount || ''} onChange={e => setAdminEditForm({...adminEditForm, cashAmount: e.target.value})}
                                                  className="w-full p-2 border-2 border-green-300 rounded-lg text-sm focus:border-green-500 focus:outline-none mt-0.5" placeholder="0" />
                                              </div>
                                              <div>
                                                <label className="text-xs text-gray-500">💳 Безнал ₽</label>
                                                <input type="number" value={adminEditForm.cashlessAmount || ''} onChange={e => setAdminEditForm({...adminEditForm, cashlessAmount: e.target.value})}
                                                  className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5" placeholder="0" />
                                              </div>
                                            </>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <button onClick={() => {
                                            const priceNum = parseInt(adminEditForm.salePrice) || r.salePrice;
                                            const tipsNum = parseInt(adminEditForm.tips) || 0;
                                            const prod = DYNAMIC_ALL_PRODUCTS.find(p => p.name === adminEditForm.product) || { price: r.basePrice, category: r.category };
                                            const newBase = prod.price || r.basePrice;
                                            const newCat = prod.category || r.category;
                                            const newSal = calculateSalary(newBase, priceNum, newCat, tipsNum, 'normal', salarySettings);
                                            let ca = 0, cla = 0;
                                            if (adminEditForm.paymentType === 'cash') { ca = priceNum + tipsNum; }
                                            else if (adminEditForm.paymentType === 'cashless') { cla = priceNum + tipsNum; }
                                            else { ca = parseInt(adminEditForm.cashAmount) || 0; cla = parseInt(adminEditForm.cashlessAmount) || 0; }
                                            const updatedR = reports.map(rep => rep.id === r.id
                                              ? { ...rep, product: adminEditForm.product, basePrice: newBase, category: newCat, salePrice: priceNum, total: priceNum, tips: tipsNum, salary: newSal, paymentType: adminEditForm.paymentType, cashAmount: ca, cashlessAmount: cla, isBelowBase: priceNum < newBase }
                                              : rep
                                            );
                                            updateReports(updatedR);
                                            logAction('Отчёт исправлен администратором', `${empName}: ${r.product} → ${adminEditForm.product} ${priceNum}₽ tips:${tipsNum}`);
                                            setExpandedEdit(null);
                                            showNotification('Продажа исправлена');
                                          }} className="flex-1 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold">✅ Сохранить</button>
                                          <button onClick={() => {
                                            showConfirm('Удалить эту продажу?', () => {
                                              // FIX: Восстанавливаем склад при удалении (как в deleteReport)
                                              const productName = r ? getProductName(r.product) : null;
                                              if (r && !r.isUnrecognized && productName && stock[productName]) {
                                                const newStock = {...stock};
                                                newStock[productName] = {...newStock[productName], count: newStock[productName].count + (r.quantity || 1)};
                                                updateStock(newStock);
                                                addStockHistoryEntry(productName, 'return', (r.quantity || 1), `Удалена продажа (админ)`);
                                              }
                                              const nd = {...salaryDecisions}; delete nd[r.id]; setSalaryDecisions(nd); save('likebird-salary-decisions', nd);
                                              updateReports(reports.filter(rep => rep.id !== r.id));
                                              setExpandedEdit(null);
                                              showNotification('Удалено');
                                            });
                                          }} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold">🗑️</button>
                                          <button onClick={() => setExpandedEdit(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">✕</button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className={`p-2 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${r.isUnrecognized ? 'bg-red-50' : 'bg-white'}`}
                                        onClick={() => { setExpandedEdit(r.id); setAdminEditForm({ product: r.product, salePrice: String(r.salePrice), paymentType: r.paymentType, tips: String(r.tips || 0), cashAmount: String(r.cashAmount || 0), cashlessAmount: String(r.cashlessAmount || 0) }); }}>
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-base flex-shrink-0">{r.isUnrecognized ? '❓' : (DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product)?.emoji || '🐦')}</span>
                                          <span className="truncate text-sm">{getProductName(r.product)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <span className="font-bold text-sm">{r.total}₽</span>
                                          {r.tips > 0 && <span className="text-xs text-amber-500">+{r.tips}</span>}
                                          <span>{r.paymentType === 'mixed' ? '💵💳' : r.paymentType === 'cashless' ? '💳' : '💵'}</span>
                                          <Edit3 className="w-3 h-3 text-gray-400" />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          
                          {/* Исходный текст отчёта */}
                          {hasOriginalText && empReports[0].originalReportText && (
                            <details className="mb-3">
                              <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">📄 Исходный текст отчёта</summary>
                              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">{empReports[0].originalReportText}</pre>
                            </details>
                          )}
                          
                          {/* Кнопки проверки */}
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const ids = empReports.map(r => r.id);
                                showConfirm(`Утвердить ${ids.length} отчётов от ${empName}?`, () => {
                                  updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'approved'} : r));
                                });
                                logAction('Отчёт подтверждён', `${empName} ${dateKey}`);
                                showNotification('Отчёт подтверждён ✓');
                              }}
                              className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600"
                            >
                              ✓ Верно
                            </button>
                            <button 
                              onClick={() => {
                                const ids = empReports.map(r => r.id);
                                updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'revision'} : r));
                                logAction('Отчёт на доработку', `${empName} ${dateKey}`);
                                showNotification('Отправлено на доработку');
                              }}
                              className="flex-1 bg-orange-500 text-white py-2 rounded text-sm font-medium hover:bg-orange-600"
                            >
                              ↻ Доработать
                            </button>
                            <button 
                              onClick={() => {
                                const ids = empReports.map(r => r.id);
                                updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'rejected'} : r));
                                logAction('Отчёт отклонён', `${empName} ${dateKey}`);
                                showNotification('Отчёт отклонён');
                              }}
                              className="flex-1 bg-red-500 text-white py-2 rounded text-sm font-medium hover:bg-red-600"
                            >
                              ✗ Ошибки
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {reports.length === 0 && (
              <div className="text-center py-10 bg-white rounded-xl shadow">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Нет отчётов для проверки</p>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: Сотрудники */}
        {/* Personnel sub-tabs */}
        {adminTab === 'personnel' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {[
              { id: 'employees', label: '👥 Сотрудники' },
              { id: 'finance', label: '💰 Финансы' },
              { id: 'schedule', label: '📅 График' },
              { id: 'penalties', label: '⚠️ Штрафы' },
              { id: 'bonuses', label: '🎁 Бонусы' },
              { id: 'ratings', label: '⭐ Рейтинг' },
              { id: 'timeoff', label: '🏖️ Отпуска' },
              { id: 'kpi', label: '🎯 KPI' },
              { id: 'achievements', label: '🏅 Достижения' },
              { id: 'challenges', label: '🏆 Челленджи' },
            ].map(t => (
              <button key={t.id} onClick={() => setPersonnelTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${personnelTab === t.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Employees (was separate tab) */}
        {adminTab === 'personnel' && personnelTab === 'employees' && (() => {
          // regUsers refreshed via useEffect at AdminView top level

          const saveUsers = (updated) => {
            setRegUsers(updated);
            localStorage.setItem('likebird-users', JSON.stringify(updated));
            fbSave('likebird-users', updated);
          };

          const isMasterAdmin = currentUser?.isAdmin === true;

          const ROLE_LABELS = {
            seller: { label: 'Продавец', color: 'bg-purple-100 text-purple-700', icon: '🐦' },
            senior: { label: 'Старший продавец', color: 'bg-amber-100 text-amber-700', icon: '⭐' },
            admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: '🛡️' },
          };

          const handleStartEdit = (user) => {
            setEditingUser(user.login);
            setEditForm({ name: user.name, role: user.role || 'seller', isAdmin: !!user.isAdmin });
          };

          const handleSaveEdit = () => {
            const updated = regUsers.map(u => u.login === editingUser
              ? { ...u, name: editForm.name, role: editForm.role, isAdmin: editForm.isAdmin || editForm.role === 'admin' }
              : u
            );
            saveUsers(updated);
            // FIX: Синхронизируем роль в employees (ранее role менялось только в users)
            const editedUser = updated.find(u => u.login === editingUser);
            if (editedUser) {
              const empMatch = employees.find(e => e.name === editedUser.name || e.name === editingUser);
              if (empMatch) {
                updateEmployees(employees.map(e => e.id === empMatch.id ? { ...e, name: editedUser.name, role: editedUser.role } : e));
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
            if (regUsers.find(u => u.login.toLowerCase() === addForm.login.trim().toLowerCase())) { setAddError('Логин уже занят'); return; }
            const hashed = await hashPassword(addForm.password);
            const newU = {
              login: addForm.login.trim(),
              name: addForm.name.trim() || addForm.login.trim(),
              passwordHash: hashed,
              createdAt: Date.now(),
              role: addForm.role,
              isAdmin: addForm.role === 'admin',
            };
            saveUsers([...regUsers, newU]);
            // Добавляем в employees если нет
            if (!employees.find(e => e.name === newU.name)) {
              addEmployee(newU.name, newU.role);
            }
            setAddForm({ login: '', name: '', password: '', role: 'seller', isAdmin: false });
            setAddMode(false);
            showNotification(`Аккаунт ${newU.login} создан`);
          };

          return (
            <div className="space-y-4">

              {/* Заголовок */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Пользователи ({regUsers.length})
                </h3>
                {isMasterAdmin && (
                  <button onClick={() => { setAddMode(!addMode); setAddError(''); }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${addMode ? 'bg-gray-100 text-gray-600' : 'bg-purple-500 text-white hover:bg-purple-600'}`}>
                    {addMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {addMode ? 'Отмена' : 'Добавить'}
                  </button>
                )}
              </div>

              {/* Форма добавления */}
              {addMode && isMasterAdmin && (
                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-3">
                  <h4 className="font-bold text-purple-700">➕ Новый пользователь</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1">Логин *</label>
                      <input type="text" value={addForm.login} onChange={e => setAddForm({...addForm, login: e.target.value})}
                        placeholder="login" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1">Имя</label>
                      <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                        placeholder="Отображаемое" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1">Пароль *</label>
                    <input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})}
                      placeholder="Минимум 4 символа" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-semibold block mb-1">Роль</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(ROLE_LABELS).map(([val, info]) => (
                        <button key={val} onClick={() => setAddForm({...addForm, role: val})}
                          className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${addForm.role === val ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {info.icon} {info.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {addError && <p className="text-red-500 text-sm">{addError}</p>}
                  <button onClick={handleAddUser}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                    ✅ Создать аккаунт
                  </button>
                </div>
              )}

              {/* Список пользователей */}
              <div className="space-y-3">
                {regUsers.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center shadow">
                    <p className="text-4xl mb-2">👥</p>
                    <p className="text-gray-400">Нет зарегистрированных пользователей</p>
                  </div>
                ) : regUsers.map(user => {
                  const isEditing = editingUser === user.login;
                  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.seller;
                  const stats = employeeStats[user.name] || { count: 0, revenue: 0, sales: 0 };
                  const userProfile = profilesData[user.login] || {};
                  const isMe = user.login === currentUser?.login;

                  return (
                    <div key={user.login} className={`bg-white rounded-2xl shadow overflow-hidden ${isMe ? 'ring-2 ring-purple-300' : ''}`}>
                      {/* Шапка карточки */}
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          {/* Аватар */}
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-black text-lg overflow-hidden flex-shrink-0">
                            {userProfile.avatar
                              ? <img src={userProfile.avatar} alt="" className="w-full h-full object-cover" />
                              : (userProfile.displayName || user.name || '?')[0].toUpperCase()
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-gray-800">{userProfile.displayName || user.name}</p>
                              {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">это вы</span>}
                              {user.isAdmin && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">👑 Мастер-админ</span>}
                            </div>
                            <p className="text-xs text-gray-400">@{user.login}</p>
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${roleInfo.color}`}>
                              {roleInfo.icon} {roleInfo.label}
                            </span>
                          </div>
                          {/* Кнопки действий */}
                          {isMasterAdmin && !isEditing && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => handleStartEdit(user)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {!isMe && (
                                <button onClick={() => handleDeleteUser(user.login)}
                                  className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Статистика */}
                        {stats.count > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div className="bg-gray-50 rounded-lg py-1.5">
                              <p className="text-xs text-gray-400">Продаж</p>
                              <p className="font-bold text-sm">{stats.count}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg py-1.5">
                              <p className="text-xs text-gray-400">Товаров</p>
                              <p className="font-bold text-sm">{stats.sales}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg py-1.5">
                              <p className="text-xs text-gray-400">Выручка</p>
                              <p className="font-bold text-sm">{stats.revenue >= 1000 ? (stats.revenue/1000).toFixed(1)+'к' : stats.revenue}₽</p>
                            </div>
                          </div>
                        )}
                        <button onClick={() => setViewingProfile(user.login)} className="mt-2 w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 flex items-center justify-center gap-1">
                          <Eye className="w-4 h-4" /> Подробный профиль
                        </button>
                      </div>

                      {/* Форма редактирования */}
                      {isEditing && isMasterAdmin && (
                        <div className="border-t bg-gray-50 p-4 space-y-3">
                          <h4 className="font-bold text-gray-700 text-sm">✏️ Редактирование</h4>
                          <div>
                            <label className="text-xs text-gray-500 font-semibold block mb-1">Отображаемое имя</label>
                            <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                              className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-semibold block mb-1">Роль</label>
                            <div className="grid grid-cols-3 gap-2">
                              {Object.entries(ROLE_LABELS).map(([val, info]) => (
                                <button key={val} onClick={() => setEditForm({...editForm, role: val, isAdmin: val === 'admin' ? true : editForm.isAdmin})}
                                  className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${editForm.role === val ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                  {info.icon} {info.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                            <input type="checkbox" id={`admin-${user.login}`}
                              checked={editForm.isAdmin || editForm.role === 'admin'}
                              onChange={e => setEditForm({...editForm, isAdmin: e.target.checked})}
                              className="w-5 h-5 accent-purple-600" />
                            <label htmlFor={`admin-${user.login}`} className="text-sm font-semibold text-gray-700 cursor-pointer">
                              🛡️ Доступ к Админ-панели
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit}
                              className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-all">
                              ✅ Сохранить
                            </button>
                            <button onClick={() => setEditingUser(null)}
                              className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                              Отмена
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Рейтинг */}
              {Object.keys(employeeStats).length > 0 && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2">🏆 Топ по выручке (всё время)</h3>
                  <div className="space-y-2">
                    {Object.entries(employeeStats)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .slice(0, 5)
                      .map(([name, data], i) => (
                        <div key={name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>{i + 1}</span>
                          <span className="flex-1 font-medium">{name}</span>
                          <div className="text-right">
                            <p className="font-bold text-purple-600">{data.revenue.toLocaleString()}₽</p>
                            <p className="text-xs text-gray-400">{data.count} продаж</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ════ Модальное окно профиля сотрудника ════ */}
              {viewingProfile && (() => {
                const user = regUsers.find(u => u.login === viewingProfile);
                if (!user) return null;
                const empName = user.name || user.login;
                const emp = employees.find(e => e.name === empName);
                const profile = profilesData[user.login] || {};
                const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.seller;
                
                // Отчёты сотрудника
                const empReports = reports.filter(r => r.employee === empName && !r.isUnrecognized);
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 86400000);
                const monthAgo = new Date(now.getTime() - 30 * 86400000);
                
                const parseDate = (ds) => { try { const [dp] = ds.split(','); const [d,m,y] = dp.trim().split('.'); return new Date(parseYear(y), m-1, d); } catch { return new Date(0); } };
                
                const weekReports = empReports.filter(r => parseDate(r.date) >= weekAgo);
                const monthReports = empReports.filter(r => parseDate(r.date) >= monthAgo);
                
                // ЗП за неделю и месяц
                const weekSalary = weekReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                const weekRevenue = weekReports.reduce((s, r) => s + r.total, 0);
                const weekTips = weekReports.reduce((s, r) => s + (r.tips || 0), 0);
                const monthSalary = monthReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                const monthRevenue = monthReports.reduce((s, r) => s + r.total, 0);
                const monthTips = monthReports.reduce((s, r) => s + (r.tips || 0), 0);
                
                // Бонусы и штрафы
                const empBonusList = emp ? bonuses.filter(b => b.employeeId === emp.id) : [];
                const empPenaltiesList = emp ? penalties.filter(p => p.employeeId === emp.id) : [];
                const totalBonuses = empBonusList.reduce((s, b) => s + b.amount, 0);
                const totalPenalties = empPenaltiesList.reduce((s, p) => s + p.amount, 0);
                
                // Достижения
                const myAchievements = customAchievements.filter(a => (achievementsGranted[a.id] || []).includes(user.login));
                
                // Формула ЗП
                const byCat = weekReports.reduce((acc, r) => { const cat = r.category || 'Другое'; acc[cat] = (acc[cat] || 0) + 1; return acc; }, {});
                
                return (
                  <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setViewingProfile(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mt-8 mb-8 overflow-hidden" onClick={e => e.stopPropagation()}>
                      {/* Шапка */}
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black overflow-hidden">
                            {profile.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : (empName[0] || '?').toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold">{profile.displayName || empName}</h3>
                            <p className="text-white/70 text-sm">@{user.login}</p>
                            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-white/20`}>{roleInfo.icon} {roleInfo.label}</span>
                          </div>
                          <button onClick={() => setViewingProfile(null)} className="text-white/70 hover:text-white p-1"><X className="w-6 h-6" /></button>
                        </div>
                        {profile.birthDate && <p className="text-white/80 text-sm mt-3">🎂 {profile.birthDate}</p>}
                      </div>
                      
                      <div className="p-4 space-y-4">
                        {/* ЗП за неделю */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                          <h4 className="font-bold text-green-700 mb-2">💰 Зарплата за неделю</h4>
                          <p className="text-2xl font-black text-green-600">{weekSalary.toLocaleString()}₽</p>
                          <div className="mt-2 text-xs text-green-700 space-y-1">
                            <p>📦 Продаж: {weekReports.length} шт. → выручка {weekRevenue.toLocaleString()}₽</p>
                            {weekTips > 0 && <p>⭐ Чаевые: {weekTips.toLocaleString()}₽</p>}
                            {Object.entries(byCat).map(([cat, cnt]) => (
                              <p key={cat}>{cat}: {cnt} шт.</p>
                            ))}
                            <p className="text-xs text-green-500 mt-1">ЗП = сумма комиссий от продаж + чаевые</p>
                          </div>
                        </div>
                        
                        {/* ЗП за месяц */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <h4 className="font-bold text-blue-700 mb-1">📅 За месяц</h4>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div><p className="text-lg font-black text-blue-600">{monthSalary.toLocaleString()}₽</p><p className="text-xs text-blue-400">ЗП</p></div>
                            <div><p className="text-lg font-black text-blue-600">{monthRevenue.toLocaleString()}₽</p><p className="text-xs text-blue-400">Выручка</p></div>
                            <div><p className="text-lg font-black text-blue-600">{monthReports.length}</p><p className="text-xs text-blue-400">Продаж</p></div>
                          </div>
                        </div>
                        
                        {/* Бонусы и штрафы */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                            <p className="text-xs text-green-600 font-semibold">🎁 Бонусы</p>
                            <p className="text-lg font-black text-green-600">+{totalBonuses.toLocaleString()}₽</p>
                            <p className="text-xs text-green-400">{empBonusList.length} шт.</p>
                            {empBonusList.slice(-3).map(b => <p key={b.id} className="text-xs text-green-500 truncate">{b.reason}: +{b.amount}₽</p>)}
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-xs text-red-600 font-semibold">⚠️ Штрафы</p>
                            <p className="text-lg font-black text-red-600">-{totalPenalties.toLocaleString()}₽</p>
                            <p className="text-xs text-red-400">{empPenaltiesList.length} шт.</p>
                            {empPenaltiesList.slice(-3).map(p => <p key={p.id} className="text-xs text-red-500 truncate">{p.reason}: -{p.amount}₽</p>)}
                          </div>
                        </div>
                        
                        {/* Достижения */}
                        {myAchievements.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <h4 className="font-bold text-yellow-700 mb-2">🏆 Достижения ({myAchievements.length})</h4>
                            <div className="flex flex-wrap gap-2">
                              {myAchievements.map(a => (
                                <div key={a.id} className="bg-white border border-yellow-300 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                                  <span className="text-lg">{a.icon || '🏆'}</span>
                                  <div>
                                    <p className="text-xs font-bold">{a.title}</p>
                                    {a.bonusAmount > 0 && <p className="text-xs text-green-600">+{a.bonusAmount}₽</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Итого */}
                        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-4">
                          <h4 className="font-bold mb-1">📊 Итого за месяц</h4>
                          <p className="text-2xl font-black">{(monthSalary + totalBonuses - totalPenalties).toLocaleString()}₽</p>
                          <p className="text-xs text-white/70 mt-1">ЗП {monthSalary.toLocaleString()} + Бонусы {totalBonuses.toLocaleString()} - Штрафы {totalPenalties.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ВКЛАДКА: Персонал+ (штрафы, бонусы, рейтинг, отпуска) */}
        {adminTab === 'personnel' && personnelTab !== 'employees' && personnelTab !== 'finance' && personnelTab !== 'schedule' && personnelTab !== 'achievements' && personnelTab !== 'challenges' && (() => {
          return (
            <div className="space-y-4">

              {/* Штрафы */}
              {personnelTab === 'penalties' && (
                <div className="space-y-4">
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">➕ Добавить штраф</h3>
                    <div className="space-y-2">
                      <select value={newPenalty.employeeId} onChange={(e) => setNewPenalty({...newPenalty, employeeId: e.target.value})} className="w-full p-2 border rounded">
                        <option value="">Выберите сотрудника</option>
                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <input type="number" placeholder="Сумма штрафа" value={newPenalty.amount} onChange={(e) => setNewPenalty({...newPenalty, amount: e.target.value})} className="w-full p-2 border rounded" />
                      <input type="text" placeholder="Причина" value={newPenalty.reason} onChange={(e) => setNewPenalty({...newPenalty, reason: e.target.value})} className="w-full p-2 border rounded" />
                      <button onClick={() => {
                        if (newPenalty.employeeId && newPenalty.amount && newPenalty.reason) {
                          addPenalty(parseInt(newPenalty.employeeId), (parseInt(newPenalty.amount) || 0), newPenalty.reason);
                          setNewPenalty({ employeeId: '', amount: '', reason: '' });
                          showNotification('Штраф добавлен');
                        }
                      }} className="w-full bg-red-500 text-white py-2 rounded font-medium">Добавить штраф</button>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">📋 История штрафов</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {penalties.slice().reverse().slice(0, 20).map(p => {
                        const emp = employees.find(e => e.id === p.employeeId);
                        return (
                          <div key={p.id} className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                            <div>
                              <p className="font-medium text-red-700">{emp?.name || 'Удалён'}</p>
                              <p className="text-xs text-gray-500">{p.reason}</p>
                              <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('ru-RU')}</p>
                            </div>
                            <span className="text-red-600 font-bold">-{p.amount}₽</span>
                          </div>
                        );
                      })}
                      {penalties.length === 0 && <p className="text-gray-400 text-center py-4">Нет штрафов</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Бонусы */}
              {personnelTab === 'bonuses' && (() => {
                const deleteBonus = (id) => {
                  showConfirm('Удалить этот бонус?', () => {
                    updateBonuses(bonuses.filter(b => b.id !== id));
                    showNotification('Бонус удалён');
                  });
                };
                
                const startEditBonus = (b) => {
                  setEditBonusId(b.id);
                  setEditBonusForm({ amount: String(b.amount), reason: b.reason });
                };
                
                const saveEditBonus = () => {
                  const amt = parseInt(editBonusForm.amount);
                  if (!amt || !editBonusForm.reason) { showNotification('Заполните поля', 'error'); return; }
                  updateBonuses(bonuses.map(b => b.id === editBonusId ? { ...b, amount: amt, reason: editBonusForm.reason } : b));
                  setEditBonusId(null);
                  showNotification('Бонус обновлён');
                };
                
                return (
                <div className="space-y-4">
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">➕ Добавить бонус</h3>
                    <div className="space-y-2">
                      <select value={newBonus.employeeId} onChange={(e) => setNewBonus({...newBonus, employeeId: e.target.value})} className="w-full p-2 border rounded">
                        <option value="">Выберите сотрудника</option>
                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <input type="number" placeholder="Сумма бонуса" value={newBonus.amount} onChange={(e) => setNewBonus({...newBonus, amount: e.target.value})} className="w-full p-2 border rounded" />
                      <input type="text" placeholder="Причина" value={newBonus.reason} onChange={(e) => setNewBonus({...newBonus, reason: e.target.value})} className="w-full p-2 border rounded" />
                      <button onClick={() => {
                        if (newBonus.employeeId && newBonus.amount && newBonus.reason) {
                          addBonus(parseInt(newBonus.employeeId), (parseInt(newBonus.amount) || 0), newBonus.reason);
                          setNewBonus({ employeeId: '', amount: '', reason: '' });
                          showNotification('Бонус добавлен');
                        }
                      }} className="w-full bg-green-500 text-white py-2 rounded font-medium">Добавить бонус</button>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">📋 История бонусов</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {bonuses.slice().reverse().slice(0, 40).map(b => {
                        const emp = employees.find(e => e.id === b.employeeId);
                        const isAchBonus = !!b.achievementId || (b.reason && b.reason.startsWith('Достижение:'));
                        const isEditing = editBonusId === b.id;
                        
                        return (
                          <div key={b.id} className={`p-3 rounded-lg border ${isAchBonus ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                            {isEditing ? (
                              <div className="space-y-2">
                                <input type="number" value={editBonusForm.amount} onChange={e => setEditBonusForm({...editBonusForm, amount: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Сумма" />
                                <input type="text" value={editBonusForm.reason} onChange={e => setEditBonusForm({...editBonusForm, reason: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Причина" />
                                <div className="flex gap-2">
                                  <button onClick={() => setEditBonusId(null)} className="flex-1 py-1.5 bg-gray-200 rounded text-sm font-medium">Отмена</button>
                                  <button onClick={saveEditBonus} className="flex-1 py-1.5 bg-green-500 text-white rounded text-sm font-medium">Сохранить</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-green-700">{emp?.name || b.employeeName || 'Удалён'}</p>
                                    {isAchBonus && <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">🏆</span>}
                                  </div>
                                  <p className="text-xs text-gray-500">{b.reason}</p>
                                  <p className="text-xs text-gray-400">{b.date ? new Date(b.date).toLocaleDateString('ru-RU') : ''}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-green-600 font-bold">+{b.amount}₽</span>
                                  <button onClick={() => startEditBonus(b)} className="text-blue-400 hover:text-blue-600 p-1"><Edit3 className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => deleteBonus(b.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {bonuses.length === 0 && <p className="text-gray-400 text-center py-4">Нет бонусов</p>}
                    </div>
                  </div>
                </div>
                );
              })()}

              {/* Рейтинг */}
              {personnelTab === 'ratings' && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3">⭐ Рейтинг сотрудников</h3>
                  <div className="space-y-3">
                    {employees.filter(e => e.active).map(emp => {
                      const avgRating = getEmployeeAverageRating(emp.id);
                      const empPenalties = getEmployeePenalties(emp.id);
                      const empBonuses = getEmployeeBonuses(emp.id);
                      return (
                        <div key={emp.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold">{emp.name}</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} className={`w-4 h-4 cursor-pointer ${star <= avgRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                  onClick={() => rateEmployee(emp.id, star)} />
                              ))}
                              <span className="text-sm text-gray-500 ml-1">({avgRating.toFixed(1)})</span>
                            </div>
                          </div>
                          <div className="flex gap-4 text-xs">
                            <span className="text-red-500">Штрафов: {empPenalties.length} ({empPenalties.reduce((s, p) => s + p.amount, 0)}₽)</span>
                            <span className="text-green-500">Бонусов: {empBonuses.length} ({empBonuses.reduce((s, b) => s + b.amount, 0)}₽)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Отпуска/Больничные */}
              {personnelTab === 'timeoff' && (
                <div className="space-y-4">
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">➕ Добавить отпуск/больничный</h3>
                    <div className="space-y-2">
                      <select value={newTimeOff.employeeId} onChange={(e) => setNewTimeOff({...newTimeOff, employeeId: e.target.value})} className="w-full p-2 border rounded">
                        <option value="">Выберите сотрудника</option>
                        {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <select value={newTimeOff.type} onChange={(e) => setNewTimeOff({...newTimeOff, type: e.target.value})} className="w-full p-2 border rounded">
                        <option value="vacation">🏖️ Отпуск</option>
                        <option value="sick">🏥 Больничный</option>
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={newTimeOff.startDate} onChange={(e) => setNewTimeOff({...newTimeOff, startDate: e.target.value})} className="p-2 border rounded" />
                        <input type="date" value={newTimeOff.endDate} onChange={(e) => setNewTimeOff({...newTimeOff, endDate: e.target.value})} className="p-2 border rounded" />
                      </div>
                      <input type="text" placeholder="Примечание" value={newTimeOff.note} onChange={(e) => setNewTimeOff({...newTimeOff, note: e.target.value})} className="w-full p-2 border rounded" />
                      <button onClick={() => {
                        if (newTimeOff.employeeId && newTimeOff.startDate && newTimeOff.endDate) {
                          addTimeOff(parseInt(newTimeOff.employeeId), newTimeOff.type, newTimeOff.startDate, newTimeOff.endDate, newTimeOff.note);
                          setNewTimeOff({ employeeId: '', type: 'vacation', startDate: '', endDate: '', note: '' });
                          showNotification('Добавлено');
                        }
                      }} className="w-full bg-blue-500 text-white py-2 rounded font-medium">Добавить</button>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">📋 Текущие отсутствия</h3>
                    <div className="space-y-2">
                      {getActiveTimeOff().map(t => {
                        const emp = employees.find(e => e.id === t.employeeId);
                        return (
                          <div key={t.id} className={`p-3 rounded-lg ${t.type === 'sick' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{emp?.name || 'Удалён'}</span>
                              <span className="text-sm">{t.type === 'sick' ? '🏥 Больничный' : '🏖️ Отпуск'}</span>
                            </div>
                            <p className="text-xs text-gray-500">{t.startDate} — {t.endDate}</p>
                            {t.note && <p className="text-xs text-gray-400">{t.note}</p>}
                          </div>
                        );
                      })}
                      {getActiveTimeOff().length === 0 && <p className="text-gray-400 text-center py-4">Все на работе</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* KPI */}
              {personnelTab === 'kpi' && (
                // KPI: inline-форма без вложенных компонентов (чтобы state не сбрасывался)
                <KpiGoalsPanel
                  employees={employees}
                  employeeKPI={employeeKPI}
                  setEmployeeGoal={setEmployeeGoal}
                  showNotification={showNotification}
                  getEmployeeProgress={getEmployeeProgress}
                  darkMode={darkMode}
                />
              )}
            </div>
          );
        })()}

        {/* ВКЛАДКА: Финансы */}
        {adminTab === 'personnel' && personnelTab === 'finance' && (
          <div className="space-y-4">
            {/* Сводка */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
              <h3 className="font-bold mb-3">💰 Финансовая сводка (неделя)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="text-xs opacity-80">Выручка</p>
                  <p className="text-xl font-bold">+{weekRevenue.toLocaleString()}₽</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="text-xs opacity-80">ЗП сотрудников</p>
                  <p className="text-xl font-bold">-{weekSalary.toLocaleString()}₽</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="text-xs opacity-80">Расходы</p>
                  <p className="text-xl font-bold">-{weekExpenses.toLocaleString()}₽</p>
                </div>
                <div className="bg-white/20 rounded-lg p-3">
                  <p className="text-xs opacity-80">Чистая прибыль</p>
                  <p className="text-xl font-bold">{(weekRevenue - weekSalary - weekExpenses).toLocaleString()}₽</p>
                </div>
              </div>
            </div>

            {/* Настройки зарплаты */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><DollarSign className="w-5 h-5 text-purple-600" />Настройки зарплаты</h3>
              <div className="space-y-2">
                {salarySettings.ranges.map((range, i) => (
                  <div key={i} className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg text-sm">
                    <input type="number" defaultValue={range.min} onBlur={(e) => updateRange(i, 'min', e.target.value)} className="w-16 px-2 py-1 border rounded text-center" />
                    <span className="text-gray-400">—</span>
                    <input type="number" defaultValue={range.max} onBlur={(e) => updateRange(i, 'max', e.target.value)} className="w-16 px-2 py-1 border rounded text-center" />
                    <span className="text-gray-400">=</span>
                    <input type="number" defaultValue={range.base} onBlur={(e) => updateRange(i, 'base', e.target.value)} className="w-16 px-2 py-1 border-2 border-purple-200 rounded text-center font-bold" />
                    <span className="text-gray-600">₽</span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-3 mt-3 p-3 bg-amber-50 rounded-lg cursor-pointer" onClick={toggleBonus}>
                <input type="checkbox" checked={salarySettings.bonusForBirds} readOnly className="w-5 h-5 accent-purple-600" />
                <div><span className="font-medium">Бонус за птичек</span><p className="text-xs text-gray-600">Добавлять разницу при продаже выше базовой</p></div>
              </label>
            </div>

            {/* Расходы по категориям */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2">📝 Расходы по категориям</h3>
              <div className="space-y-2">
                {expenseCategories.map(cat => {
                  const catExpenses = expenses.filter(e => e.category === cat.id || (!e.category && cat.id === 'other'));
                  const total = catExpenses.reduce((s, e) => s + e.amount, 0);
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm">{cat.emoji} {cat.name}</span>
                      <span className="font-bold text-red-600">{total.toLocaleString()}₽</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Stockplus sub-tabs */}
        {/* FIX (merge admin → catalog): Подвкладки «Товары», «Ревизия», «История»,
            «Списания», «Автозаказ» перенесены в CatalogView (видны только админу).
            Здесь остались только «Точки» и «Себестоимость». */}
        {adminTab === 'stockplus' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {[
              { id: 'locations', label: '📍 Точки' },
              { id: 'cost', label: '💰 Себестоимость' },
            ].map(t => (
              <button key={t.id} onClick={() => setStockTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${stockTab === t.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ВКЛАДКА: Точки продаж */}
        {adminTab === 'stockplus' && stockTab === 'locations' && (() => {
          const cities = getCities();
          return (
            <div className="space-y-4">
              {/* Добавление точки */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-600" />Добавить точку</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Город" value={newCity} onChange={(e) => setNewCity(e.target.value)} className="flex-1 p-2 border rounded" list="cities-list" />
                    <datalist id="cities-list">{cities.map(c => <option key={c} value={c} />)}</datalist>
                  </div>
                  <input type="text" placeholder="Название точки (например: Пушкинская ул.)" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="w-full p-2 border rounded" />
                  <button onClick={() => {
                    if (newCity.trim() && newLocName.trim()) {
                      addLocation(newCity.trim(), newLocName.trim());
                      setNewCity(''); setNewLocName('');
                      showNotification('Точка добавлена');
                    }
                  }} className="w-full bg-purple-500 text-white py-2 rounded font-medium">Добавить точку</button>
                </div>
              </div>

              {/* Фильтр по городу */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button onClick={() => setSelectedCity('')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedCity ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                  Все города
                </button>
                {cities.map(city => (
                  <button key={city} onClick={() => setSelectedCity(city)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCity === city ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                    {city}
                  </button>
                ))}
              </div>

              {/* Список точек */}
              {(selectedCity ? [selectedCity] : cities).map(city => (
                <div key={city} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2">📍 {city}</h3>
                  <div className="space-y-2">
                    {getLocationsByCity(city).map(loc => (
                      <div key={loc.id} className={`flex items-center justify-between p-3 rounded-lg border ${loc.active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <div>
                          <span className="font-medium">{loc.name}</span>
                          {!loc.active && <span className="ml-2 text-xs text-red-500">неактивна</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => toggleLocationActive(loc.id)} className={`px-3 py-1 rounded text-sm ${loc.active ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                            {loc.active ? 'Отключить' : 'Включить'}
                          </button>
                          <button onClick={() => showConfirm('Удалить точку?', () => removeLocation(loc.id))} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">
                            Удалить
                          </button>
                        </div>
                      </div>
                    ))}
                    {getLocationsByCity(city).length === 0 && <p className="text-gray-400 text-center py-4">Нет точек</p>}
                  </div>
                </div>
              ))}

              {cities.length === 0 && (
                <div className="text-center py-10 bg-white rounded-xl shadow">
                  <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Добавьте первую точку продаж</p>
                </div>
              )}
            </div>
          );
        })()}


        {/* ВКЛАДКА: Себестоимость */}
        {/* FIX (merge admin → catalog): История, Списания, Автозаказ перенесены
            в CatalogView. Здесь осталась только Себестоимость. */}
        {adminTab === 'stockplus' && stockTab === 'cost' && (
          <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <h3 className="font-bold mb-3">💰 Себестоимость товаров</h3>
            <p className="text-xs text-gray-500 mb-3">⚠️ Эта информация видна только администратору</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {DYNAMIC_ALL_PRODUCTS.map(prod => (
                <div key={prod.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{prod.emoji} {prod.name}</span>
                    <span className="text-gray-400 text-sm ml-2">Цена: {prod.price}₽</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Себест:</span>
                    <input type="number" value={getCostPrice(prod.name) || ''} onChange={(e) => setCostPrice(prod.name, parseInt(e.target.value) || 0)}
                      placeholder="0" className="w-20 p-1 border rounded text-center text-sm" />
                    <span className="text-xs">₽</span>
                    {getCostPrice(prod.name) > 0 && (
                      <span className="text-xs text-green-600 font-medium ml-2">
                        Прибыль: {prod.price - getCostPrice(prod.name)}₽
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: Чат */}
        {adminTab === 'chat' && (
            <div className="space-y-4">
              {/* Отправка сообщения */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-purple-600" />Новое сообщение</h3>
                <div className="space-y-2">
                  <select value={chatTo} onChange={(e) => setChatTo(e.target.value)} className="w-full p-2 border rounded">
                    <option value="">📢 Всем сотрудникам</option>
                    {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>👤 {e.name}</option>)}
                  </select>
                  <textarea value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Текст сообщения..." className="w-full p-3 border rounded-lg" rows={3} />
                  <button onClick={() => {
                    if (chatText.trim()) {
                      sendMessage(chatText.trim(), chatTo ? parseInt(chatTo) : null);
                      setChatText('');
                      showNotification('Сообщение отправлено');
                    }
                  }} className="w-full bg-purple-500 text-white py-2 rounded font-medium">Отправить</button>
                </div>
              </div>

              {/* Список сообщений */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3">💬 История сообщений</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {chatMessages.slice().reverse().slice(0, 30).map(msg => {
                    const toEmp = msg.to ? employees.find(e => e.id === msg.to) : null;
                    return (
                      <div key={msg.id} className={`p-3 rounded-lg ${msg.read ? 'bg-gray-50' : 'bg-purple-50 border border-purple-200'}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-sm">{msg.from}</span>
                          <span className="text-xs text-gray-400">{new Date(msg.date).toLocaleString('ru-RU')}</span>
                        </div>
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {toEmp ? `→ ${toEmp.name}` : '→ Всем'}
                          {!msg.read && <span className="ml-2 text-purple-600">● Новое</span>}
                        </p>
                      </div>
                    );
                  })}
                  {chatMessages.length === 0 && <p className="text-gray-400 text-center py-8">Нет сообщений</p>}
                </div>
              </div>
            </div>
        )}

        {/* ВКЛАДКА: График работы */}
        {adminTab === 'personnel' && personnelTab === 'schedule' && (() => {
          const EVENT_TYPES = [
            { id: 'sale', label: '🎁 Акция', emoji: '🎁' },
            { id: 'holiday', label: '🎉 Праздник', emoji: '🎉' },
            { id: 'training', label: '📚 Обучение', emoji: '📚' },
            { id: 'shift', label: '🔄 Смена', emoji: '🔄' },
            { id: 'info', label: '📌 Инфо', emoji: '📌' },
          ];

          const saveEvent = () => {
            if (!newDate || !newEvent.title) { showNotification('Заполните дату и название', 'error'); return; }
            const [y, m, d] = newDate.split('-');
            const dateKey = `${d}.${m}.${y}`;
            const updated = { ...eventsCalendar };
            if (!updated[dateKey]) updated[dateKey] = [];
            if (editingEventRef) {
              // Удаляем старое событие (дата могла измениться)
              const oldKey = editingEventRef.dateKey;
              const oldIdx = editingEventRef.index;
              if (updated[oldKey]) {
                updated[oldKey] = updated[oldKey].filter((_, i) => i !== oldIdx);
                if (updated[oldKey].length === 0) delete updated[oldKey];
              }
              if (!updated[dateKey]) updated[dateKey] = [];
            }
            updated[dateKey] = [...(updated[dateKey] || []), { ...newEvent, createdAt: Date.now() }];
            setEventsCalendar(updated);
            save('likebird-events', updated);
            setNewDate(''); setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' });
            setEditingEventRef(null);
            setShowEventForm(false);
            showNotification(editingEventRef ? 'Событие обновлено' : 'Событие добавлено');
          };
          const deleteEvent = (date, index) => {
            showConfirm('Удалить событие?', () => {
              const updated = { ...eventsCalendar };
              if (updated[date]) {
                updated[date] = updated[date].filter((_, i) => i !== index);
                if (updated[date].length === 0) delete updated[date];
              }
              setEventsCalendar(updated);
              save('likebird-events', updated);
            });
          };
          const startEditEvent = (date, index, ev) => {
            const [d, m, y] = date.split('.');
            setNewDate(`${y}-${m}-${d}`);
            setNewEvent({ title: ev.title, description: ev.description || '', type: ev.type || 'info', emoji: ev.emoji || '📅' });
            setEditingEventRef({ dateKey: date, index });
            setShowEventForm(true);
          };

          // Flatten: [{date, ev, index}, ...] sorted by date
          const sortedEvents = Object.entries(eventsCalendar)
            .flatMap(([date, evArr]) => (Array.isArray(evArr) ? evArr : [evArr]).map((ev, i) => ({ date, ev, index: i })))
            .sort((a, b) => {
              const parse = (d) => { const [dd, mm, yy] = d.split('.'); return new Date(parseInt(parseYear(yy)), mm - 1, dd); };
              return parse(a.date) - parse(b.date);
            });

          return (
            <div className="space-y-4">
              <ScheduleEditor />

              {/* Календарь событий */}
              <div className="bg-white rounded-2xl p-4 shadow">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-500" />
                    События и даты ({sortedEvents.length})
                  </h3>
                  <button onClick={() => setShowEventForm(!showEventForm)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${showEventForm ? 'bg-gray-100 text-gray-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                    {showEventForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showEventForm ? 'Отмена' : 'Добавить'}
                  </button>
                </div>

                {showEventForm && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 font-semibold block mb-1">Дата *</label>
                        <input type="date" value={newDate} onChange={e => {
                          setNewDate(e.target.value);
                        }} className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold block mb-1">Тип</label>
                        <select value={newEvent.type} onChange={e => {
                          const t = EVENT_TYPES.find(et => et.id === e.target.value);
                          setNewEvent({...newEvent, type: e.target.value, emoji: t?.emoji || '📅'});
                        }} className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none">
                          {EVENT_TYPES.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                      placeholder="Название события *"
                      className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none" />
                    <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                      placeholder="Описание (необязательно)"
                      rows={2} className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none resize-none" />
                    <button onClick={saveEvent}
                      className="w-full py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">
                      {editingEventRef ? '✏️ Обновить событие' : '✅ Сохранить событие'}
                    </button>
                    {editingEventRef && (
                      <button onClick={() => { setEditingEventRef(null); setShowEventForm(false); setNewDate(''); setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' }); }}
                        className="w-full py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 mt-2">
                        Отмена редактирования
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sortedEvents.length === 0 ? (
                    <p className="text-gray-400 text-center py-6">Нет событий</p>
                  ) : sortedEvents.map(({ date, ev, index }) => (
                    <div key={`${date}_${index}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                      <span className="text-2xl flex-shrink-0">{ev.emoji || '📅'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400">{date}{ev.description && ` • ${ev.description}`}</p>
                      </div>
                      <button onClick={() => startEditEvent(date, index, ev)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg flex-shrink-0">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEvent(date, index)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ВКЛАДКА: Настройки */}

        {/* BLOCK 8: Audit Log */}
        {adminTab === 'audit' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2">📋 Журнал действий ({auditLog.length})</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLog.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Нет записей</p>
                ) : auditLog.slice(0, 50).map(entry => (
                  <div key={entry.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
                    <div className="flex justify-between items-start">
                      <span className="font-semibold">{entry.action}</span>
                      <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString('ru')}</span>
                    </div>
                    <p className="text-gray-600 text-xs mt-1">{entry.details}</p>
                    <p className="text-xs text-gray-400 mt-0.5">👤 {entry.user}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BLOCK 7: Challenges Management */}
        {adminTab === 'personnel' && personnelTab === 'challenges' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2">🏆 Челленджи</h3>
              {/* New challenge form */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 space-y-2">
                <input type="text" value={challengeForm.title} onChange={e => setChallengeForm({...challengeForm, title: e.target.value})}
                  placeholder="Название челленджа" className="w-full p-2 border rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={challengeForm.type} onChange={e => setChallengeForm({...challengeForm, type: e.target.value})}
                    className="p-2 border rounded-lg text-sm">
                    <option value="daily">Ежедневный</option>
                    <option value="weekly">Еженедельный</option>
                  </select>
                  <select value={challengeForm.metric} onChange={e => setChallengeForm({...challengeForm, metric: e.target.value})}
                    className="p-2 border rounded-lg text-sm">
                    <option value="sales_count">Кол-во продаж</option>
                    <option value="revenue">Выручка</option>
                    <option value="product_sales">Продажи товара</option>
                    <option value="avg_check">Средний чек</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={challengeForm.target} onChange={e => setChallengeForm({...challengeForm, target: parseInt(e.target.value) || 0})}
                    placeholder="Цель" className="p-2 border rounded-lg text-sm" />
                  <input type="text" value={challengeForm.reward} onChange={e => setChallengeForm({...challengeForm, reward: e.target.value})}
                    placeholder="Награда (опц.)" className="p-2 border rounded-lg text-sm" />
                </div>
                {challengeForm.metric === 'product_sales' && (
                  <input type="text" value={challengeForm.product} onChange={e => setChallengeForm({...challengeForm, product: e.target.value})}
                    placeholder="Название товара" className="w-full p-2 border rounded-lg text-sm" />
                )}
                <button onClick={() => {
                  if (!challengeForm.title || !challengeForm.target) { showNotification('Заполните название и цель', 'error'); return; }
                  const ch = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), ...challengeForm, condition: { metric: challengeForm.metric, target: challengeForm.target, product: challengeForm.product }, active: true, createdAt: new Date().toISOString() };
                  updateChallenges([...challenges, ch]);
                  setChallengeForm({ title: '', icon: '🏆', type: 'daily', metric: 'sales_count', target: 10, product: '', reward: '' });
                  showNotification('Челлендж создан!');
                }} className="w-full py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600">
                  + Создать челлендж
                </button>
              </div>
              {/* Existing challenges */}
              <div className="space-y-2">
                {challenges.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Нет челленджей</p>
                ) : challenges.map(ch => (
                  <div key={ch.id} className={`p-3 rounded-xl border ${ch.active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{ch.icon || '🏆'} {ch.title}</p>
                        <p className="text-xs text-gray-500">{ch.type === 'daily' ? 'Ежедневный' : 'Еженедельный'} · Цель: {ch.condition?.target || ch.target} · {ch.condition?.metric}</p>
                        {ch.reward && <p className="text-xs text-amber-600">🎁 {ch.reward}</p>}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => updateChallenges(challenges.map(c => c.id === ch.id ? {...c, active: !c.active} : c))}
                          className={`px-2 py-1 rounded text-xs font-bold ${ch.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {ch.active ? 'ON' : 'OFF'}
                        </button>
                        <button onClick={() => showConfirm('Удалить челлендж?', () => updateChallenges(challenges.filter(c => c.id !== ch.id)))}
                          className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'settings' && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Settings className="w-5 h-5 text-purple-600" />Общие настройки</h3>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">📊 Статистика системы</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>Отчётов: <span className="font-bold">{reports.length}</span></div>
                    <div>Расходов: <span className="font-bold">{expenses.length}</span></div>
                    <div>Товаров: <span className="font-bold">{ALL_PRODUCTS.length + customProducts.length}</span></div>
                    <div>Дней: <span className="font-bold">{getAllDates().length}</span></div>
                    <div>Фото товаров: <span className="font-bold">{Object.keys(productPhotos).length}</span></div>
                    <div>Фото смен: <span className="font-bold">{Object.keys(shiftPhotos).length}</span></div>
                    <div>Размер медиа: <span className="font-bold">{Math.round((JSON.stringify(productPhotos).length + JSON.stringify(shiftPhotos).length) / 1024)} КБ</span></div>
                  </div>
                </div>
                {Object.keys(productPhotos).length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                    <p className="font-medium text-blue-700">📷 Фото товаров</p>
                    <button onClick={() => {
                      // Пушим каждое фото отдельным ключом + индекс
                      const names = Object.keys(productPhotos);
                      names.forEach(name => {
                        const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
                        fbSave(k, productPhotos[name]);
                      });
                      fbSave('likebird-media-index', names);
                      // Легаси (для обратной совместимости)
                      fbSave('likebird-product-photos-data', productPhotos);
                      // Фото смен
                      Object.entries(shiftPhotos).forEach(([dk, v]) => {
                        fbSave('likebird-ms-' + dk.replace(/[^a-zA-Z0-9_.]/g, '_'), v);
                      });
                      showNotification(`☁️ ${names.length} фото товаров + ${Object.keys(shiftPhotos).length} фото смен → облако`);
                    }} className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" />Синхронизировать все медиа в облако
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Экспорт/Импорт */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="w-5 h-5 text-purple-600" />Резервное копирование</h3>
              <div className="space-y-2">
                <button onClick={() => { exportData(); logAction('Создана резервная копия', ''); }} className="w-full bg-green-500 text-white py-2.5 rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-semibold">
                  <Download className="w-4 h-4" />Скачать полный бэкап (Firebase + local)
                </button>
                <button onClick={() => {
                  try {
                    const data = enrichBackup(SyncManager.exportAll());
                    downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `likebird-backup-local-${dateForFile()}.json`);
                    logAction('Бэкап localStorage', '');
                    showNotification('✅ Локальный бэкап сохранён');
                  } catch (err) { showNotification('❌ Ошибка: ' + err.message, 'error'); }
                }} className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 text-sm">
                  <Download className="w-4 h-4" />Только localStorage (быстрый)
                </button>
                <label className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />Восстановить из бэкапа (JSON)
                  <input type="file" accept=".json" onChange={(e) => { if (e.target.files[0]) { importData(e.target.files[0]); logAction('Восстановление из бэкапа', ''); } }} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 text-center">После восстановления страница перезагрузится</p>
              </div>
            </div>

            {/* Очистка данных — только мастер-администратор */}
            {currentUser?.isAdmin && (
              <div className="bg-white rounded-xl p-4 shadow border-2 border-red-200">
                <h3 className="font-bold mb-3 flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />Опасная зона</h3>
                <div className="space-y-2">
                  <button onClick={() => showConfirm('Удалить ВСЕ отчёты? Это действие необратимо!', () => { updateReports([]); logAction('Удалены все отчёты', ''); showNotification('Отчёты удалены'); })} className="w-full bg-red-100 text-red-600 py-2 rounded hover:bg-red-200">
                    Удалить все отчёты
                  </button>
                  <button onClick={() => showConfirm('Удалить ВСЕ расходы? Это действие необратимо!', () => { setExpenses([]); save('likebird-expenses', []); logAction('Удалены все расходы', ''); showNotification('Расходы удалены'); })} className="w-full bg-red-100 text-red-600 py-2 rounded hover:bg-red-200">
                    Удалить все расходы
                  </button>
                  <div className="border-t border-red-200 my-3 pt-3">
                    <p className="text-xs text-red-400 mb-2">⚠️ Полная очистка удалит ВСЕ данные приложения: отчёты, расходы, склад, сотрудников, настройки и т.д. Это действие нельзя отменить!</p>
                    <button onClick={clearAllData} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600">🗑️ Очистить ВСЕ данные</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: Уведомления */}
        {adminTab === 'notifications' && (() => {
          const NotifToggle = ({ label, icon, checked, onChange, desc }) => (
            <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
              <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-5 h-5 accent-purple-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-medium">{icon} {label}</span>
                {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
              </div>
            </label>
          );
          
          const updateNS = (key, val) => {
            const updated = { ...notifSettings, [key]: val };
            setNotifSettings(updated);
            save('likebird-notif-settings', updated);
          };
          
          return (
            <div className="space-y-4">
              {/* Push-уведомления */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Bell className="w-5 h-5 text-purple-600" />Push-уведомления</h3>
                {typeof Notification !== 'undefined' && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-xl mb-3">
                    <div>
                      <p className="text-sm font-medium">Статус: {Notification.permission === 'granted' ? '✅ Разрешены' : Notification.permission === 'denied' ? '❌ Запрещены' : '⚠️ Не запрошены'}</p>
                      <p className="text-xs text-gray-400">Браузерные push-уведомления</p>
                    </div>
                    {Notification.permission !== 'granted' && (
                      <button onClick={() => Notification.requestPermission().then(p => { if (p === 'granted') showNotification('Push-уведомления включены!'); })} className="bg-purple-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold">
                        Включить
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Уведомления для сотрудников */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">👥 Уведомления сотрудникам</h3>
                <div className="space-y-2">
                  <NotifToggle icon="⏰" label="Напоминание об открытии смены" checked={notifSettings.shiftReminder !== false} onChange={v => updateNS('shiftReminder', v)} desc="Если сотрудник не открыл смену после 10:00" />
                  <NotifToggle icon="📊" label="Итог дня после закрытия смены" checked={notifSettings.shiftSummary !== false} onChange={v => updateNS('shiftSummary', v)} desc="Показать сводку продаж после закрытия" />
                  <NotifToggle icon="🏆" label="Достижения и челленджи" checked={notifSettings.achievements !== false} onChange={v => updateNS('achievements', v)} desc="Уведомлять о полученных достижениях" />
                  <NotifToggle icon="📅" label="Напоминание о событиях" checked={notifSettings.eventReminder !== false} onChange={v => updateNS('eventReminder', v)} desc="За день до события из календаря" />
                  <NotifToggle icon="💰" label="Уведомление о зарплате" checked={notifSettings.salaryNotif !== false} onChange={v => updateNS('salaryNotif', v)} desc="Когда админ принял решение по зарплате" />
                </div>
              </div>
              
              {/* Уведомления для админа */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">🛡️ Уведомления администратору</h3>
                <div className="space-y-2">
                  <NotifToggle icon="⚠️" label="Низкий остаток товара" checked={notifSettings.lowStockAlert !== false} onChange={v => updateNS('lowStockAlert', v)} desc="Когда товар на складе ниже порога" />
                  {notifSettings.lowStockAlert !== false && (
                    <div className="flex items-center gap-2 pl-8 pb-1">
                      <span className="text-xs text-gray-500">Порог:</span>
                      <input type="number" value={notifSettings.stockThreshold || 3} onChange={e => updateNS('stockThreshold', parseInt(e.target.value) || 3)} className="w-16 p-1 border rounded text-sm text-center" min="1" max="50" />
                      <span className="text-xs text-gray-500">шт</span>
                    </div>
                  )}
                  <NotifToggle icon="📉" label="Выручка ниже среднего" checked={notifSettings.revenueAlert !== false} onChange={v => updateNS('revenueAlert', v)} desc="Если выручка дня ниже среднего на 30%+" />
                  <NotifToggle icon="✅" label="Новые отчёты на проверку" checked={notifSettings.newReportsAlert !== false} onChange={v => updateNS('newReportsAlert', v)} desc="Когда сотрудник отправил отчёт" />
                  <NotifToggle icon="🕐" label="Сотрудник не закрыл смену" checked={notifSettings.unclosedShift !== false} onChange={v => updateNS('unclosedShift', v)} desc="Если смена открыта более 12 часов" />
                  <NotifToggle icon="💳" label="Крупные продажи" checked={notifSettings.bigSaleAlert || false} onChange={v => updateNS('bigSaleAlert', v)} desc="Продажа дороже указанной суммы" />
                  {notifSettings.bigSaleAlert && (
                    <div className="flex items-center gap-2 pl-8 pb-1">
                      <span className="text-xs text-gray-500">Порог:</span>
                      <input type="number" value={notifSettings.bigSaleThreshold || 3000} onChange={e => updateNS('bigSaleThreshold', parseInt(e.target.value) || 3000)} className="w-24 p-1 border rounded text-sm text-center" min="500" step="500" />
                      <span className="text-xs text-gray-500">₽</span>
                    </div>
                  )}
                  <NotifToggle icon="🔔" label="Скидки и цены ниже базы" checked={notifSettings.discountAlert !== false} onChange={v => updateNS('discountAlert', v)} desc="Когда сотрудник продал ниже базовой цены" />
                  <NotifToggle icon="📋" label="Ревизия не проведена" checked={notifSettings.noInventoryAlert !== false} onChange={v => updateNS('noInventoryAlert', v)} desc="Если сотрудник не сделал ревизию при открытии" />
                </div>
              </div>
              
              {/* Расписание уведомлений */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">🕐 Расписание</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Время напоминания о смене</span>
                    <input type="time" value={notifSettings.shiftReminderTime || '10:00'} onChange={e => updateNS('shiftReminderTime', e.target.value)}
                      className="p-1.5 border rounded-lg text-sm" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Тихий режим (не беспокоить)</span>
                    <div className="flex items-center gap-1">
                      <input type="time" value={notifSettings.quietFrom || '22:00'} onChange={e => updateNS('quietFrom', e.target.value)} className="p-1 border rounded text-xs w-20" />
                      <span className="text-xs text-gray-400">—</span>
                      <input type="time" value={notifSettings.quietTo || '08:00'} onChange={e => updateNS('quietTo', e.target.value)} className="p-1 border rounded text-xs w-20" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Отправить уведомление */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">📢 Отправить уведомление</h3>
                <p className="text-xs text-gray-500 mb-3">Отправить уведомление всем сотрудникам</p>
                <input type="text" id="admin-notif-title" defaultValue={notifSettings._draftTitle || ''} placeholder="Заголовок" maxLength={100} className="w-full p-2.5 border-2 border-gray-200 rounded-xl mb-2 text-sm focus:border-purple-500 focus:outline-none" />
                <textarea id="admin-notif-body" defaultValue={notifSettings._draftBody || ''} placeholder="Текст уведомления..." maxLength={500} className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm h-20 resize-none focus:border-purple-500 focus:outline-none" />
                <button onClick={() => {
                  const title = document.getElementById('admin-notif-title')?.value?.trim();
                  const body = document.getElementById('admin-notif-body')?.value?.trim();
                  if (!title) { showNotification('Введите заголовок', 'error'); return; }
                  const notif = { id: Date.now() + '_admin', type: 'admin-broadcast', title: '📢 ' + title, body: body || '', icon: '📢', timestamp: Date.now(), read: false, from: employeeName };
                  const updated = [...userNotifications, notif];
                  setUserNotifications(updated);
                  save('likebird-notifications', updated);
                  const titleEl = document.getElementById('admin-notif-title');
                  const bodyEl = document.getElementById('admin-notif-body');
                  if (titleEl) titleEl.value = '';
                  if (bodyEl) bodyEl.value = '';
                  showNotification('📢 Уведомление отправлено всем');
                }} className="w-full py-2.5 mt-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold">
                  📢 Отправить всем
                </button>
              </div>
              
              {/* Статистика уведомлений */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">📊 Статистика</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-purple-600">{userNotifications.length}</p>
                    <p className="text-xs text-gray-500">Всего</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-blue-600">{userNotifications.filter(n => !n.read).length}</p>
                    <p className="text-xs text-gray-500">Непрочитанных</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-amber-600">{userNotifications.filter(n => n.type?.startsWith('auto-')).length}</p>
                    <p className="text-xs text-gray-500">Автоматических</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2.5 text-center">
                    <p className="text-2xl font-bold text-green-600">{userNotifications.filter(n => n.type === 'admin-broadcast').length}</p>
                    <p className="text-xs text-gray-500">Рассылок</p>
                  </div>
                </div>
                {userNotifications.length > 50 && (
                  <button onClick={() => {
                    showConfirm(`Удалить ${userNotifications.length - 20} старых уведомлений? Останутся последние 20.`, () => {
                      const kept = userNotifications.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 20);
                      setUserNotifications(kept);
                      save('likebird-notifications', kept);
                      showNotification('Старые уведомления удалены');
                    });
                  }} className="w-full mt-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200">
                    🗑️ Очистить старые ({userNotifications.length - 20} шт)
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ВКЛАДКА: Безопасность */}
        {adminTab === 'security' && (
          <div className="space-y-4">
            {/* Коды приглашения для сотрудников */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Key className="w-5 h-5 text-green-600" />Коды приглашения</h3>
              <p className="text-sm text-gray-500 mb-3">Сгенерируйте код и передайте сотруднику для регистрации</p>
              <button onClick={() => {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                const newCodes = [...inviteCodes, { code, createdAt: Date.now(), used: false, usedBy: null }];
                setInviteCodes(newCodes);
                save('likebird-invite-codes', newCodes);
                logAction('Создан код приглашения', code);
                showNotification(`Код: ${code}`);
              }} className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 mb-3">🔑 Сгенерировать код</button>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {inviteCodes.slice().reverse().map((ic, i) => (
                  <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-sm ${ic.used ? 'bg-gray-100' : 'bg-green-50 border border-green-200'}`}>
                    <div>
                      <span className={`font-mono font-bold text-lg ${ic.used ? 'text-gray-400 line-through' : 'text-green-700'}`}>{ic.code}</span>
                      {ic.used && <span className="text-xs text-gray-500 ml-2">→ {ic.usedBy}</span>}
                    </div>
                    <div className="flex gap-2">
                      {!ic.used && <button onClick={() => { navigator.clipboard.writeText(ic.code); showNotification('Код скопирован'); }} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">📋</button>}
                      <button onClick={() => {
                        const updated = inviteCodes.filter((_, j) => j !== inviteCodes.length - 1 - i);
                        setInviteCodes(updated);
                        save('likebird-invite-codes', updated);
                      }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
                {inviteCodes.length === 0 && <p className="text-gray-400 text-center text-sm py-4">Нет созданных кодов</p>}
              </div>
              {/* Зарегистрированные пользователи */}
              {(() => { try { const users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); return users.length > 0 ? (
                <div className="mt-4 pt-3 border-t">
                  <h4 className="font-semibold text-sm mb-2">👥 Зарегистрированные ({users.length})</h4>
                  {users.map((u, i) => (
                    <div key={i} className="flex justify-between items-center py-1 text-sm">
                      <span>{u.name}</span>
                      <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  ))}
                </div>
              ) : null; } catch { return null; } })()}
            </div>

            {/* Пароль */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Lock className="w-5 h-5 text-purple-600" />Пароль админ-панели</h3>
              <p className="text-sm text-gray-600 mb-3">{adminPassword ? '🔒 Пароль установлен' : '🔓 Пароль не установлен'}</p>
              <input type="password" value={adminPassInput || ''} onChange={e => setAdminPassInput(e.target.value)} placeholder="Новый пароль (оставьте пустым для отключения)" className="w-full p-2 border rounded mb-2" />
              <button onClick={() => {
                setAdminPass(adminPassInput || '');
                showNotification(adminPassInput ? 'Пароль установлен' : 'Пароль отключён');
                setAdminPassInput('');
              }} className="w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600">
                {adminPassword ? 'Изменить пароль' : 'Установить пароль'}
              </button>
            </div>

            {/* Журнал действий */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-purple-600" />Журнал действий</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {auditLog.length > 0 ? auditLog.slice(0, 20).map(entry => (
                  <div key={entry.id} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{entry.action}</span>
                      <span className="text-gray-400 text-xs">{new Date(entry.timestamp).toLocaleString('ru-RU')}</span>
                    </div>
                    {entry.details && <p className="text-gray-500 text-xs">{entry.details}</p>}
                    <p className="text-gray-400 text-xs">👤 {entry.user}</p>
                  </div>
                )) : <p className="text-gray-400 text-sm">Журнал пуст</p>}
              </div>
              {auditLog.length > 20 && <p className="text-center text-xs text-gray-400 mt-2">Показаны последние 20 из {auditLog.length}</p>}
            </div>
          </div>
        )}

        {/* ВКЛАДКА: Мануалы */}
        {adminTab === 'manuals' && (() => {
          const saveManual = () => {
            if (!newManual.title.trim() || !newManual.content.trim()) {
              showNotification('Заполните название и содержимое', 'error');
              return;
            }
            if (editingManual) {
              updateManuals(manuals.map(m => m.id === editingManual.id ? { ...newManual, id: editingManual.id } : m));
              logAction('Мануал изменён', newManual.title);
              showNotification('Мануал обновлён ✓');
            } else {
              updateManuals([...manuals, { ...newManual, id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) }]);
              logAction('Мануал добавлен', newManual.title);
              showNotification('Мануал добавлен ✓');
            }
            setNewManual({ title: '', category: 'sales', content: '', isPinned: false });
            setEditingManual(null);
          };

          const deleteManual = (id) => {
            showConfirm('Удалить этот мануал?', () => {
              const manual = manuals.find(m => m.id === id);
              updateManuals(manuals.filter(m => m.id !== id));
              logAction('Мануал удалён', manual?.title);
              showNotification('Мануал удалён');
            });
          };

          const togglePin = (id) => {
            updateManuals(manuals.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m));
          };

          return (
            <div className="space-y-4">
              {/* Форма добавления/редактирования */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  {editingManual ? 'Редактировать мануал' : 'Добавить мануал'}
                </h3>
                <div className="space-y-3">
                  <input 
                    type="text" 
                    placeholder="Название (например: 🐦 Методичка продаж)" 
                    value={newManual.title}
                    onChange={(e) => setNewManual({...newManual, title: e.target.value})}
                    className="w-full p-3 border-2 rounded-lg focus:border-purple-500 focus:outline-none" 
                  />
                  <div className="flex gap-2">
                    <select 
                      value={newManual.category}
                      onChange={(e) => setNewManual({...newManual, category: e.target.value})}
                      className="flex-1 p-2 border rounded-lg"
                    >
                      <option value="sales">🎯 Продажи</option>
                      <option value="info">💰 Финансы/Инфо</option>
                      <option value="faq">❓ FAQ</option>
                    </select>
                    <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input 
                        type="checkbox" 
                        checked={newManual.isPinned}
                        onChange={(e) => setNewManual({...newManual, isPinned: e.target.checked})}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span className="text-sm">📌 Закрепить</span>
                    </label>
                  </div>
                  <textarea 
                    placeholder="Содержимое мануала..."
                    value={newManual.content}
                    onChange={(e) => setNewManual({...newManual, content: e.target.value})}
                    className="w-full p-3 border-2 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none"
                    rows={10}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={saveManual}
                      className="flex-1 bg-purple-500 text-white py-3 rounded-lg font-bold hover:bg-purple-600"
                    >
                      {editingManual ? '💾 Сохранить изменения' : '➕ Добавить мануал'}
                    </button>
                    {editingManual && (
                      <button 
                        onClick={() => { setEditingManual(null); setNewManual({ title: '', category: 'sales', content: '', isPinned: false }); }}
                        className="px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                      >
                        Отмена
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Список мануалов */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Все мануалы ({manuals.length})
                </h3>
                <div className="space-y-2">
                  {manuals.map(manual => (
                    <div key={manual.id} className={`p-3 rounded-lg border flex justify-between items-center ${manual.isPinned ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {manual.isPinned && <span className="text-purple-500">📌</span>}
                          <span className="font-medium">{manual.title}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {manual.category === 'sales' ? '🎯 Продажи' : manual.category === 'faq' ? '❓ FAQ' : '💰 Инфо'}
                          {' • '}{manual.content.length} символов
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => togglePin(manual.id)}
                          className={`p-2 rounded hover:bg-gray-200 ${manual.isPinned ? 'text-purple-500' : 'text-gray-400'}`}
                          title={manual.isPinned ? 'Открепить' : 'Закрепить'}
                        >
                          📌
                        </button>
                        <button 
                          onClick={() => { setEditingManual(manual); setNewManual(manual); }}
                          className="p-2 text-blue-500 rounded hover:bg-blue-50"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteManual(manual.id)}
                          className="p-2 text-red-500 rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {manuals.length === 0 && (
                    <p className="text-gray-400 text-center py-4">Нет мануалов</p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ===== ВКЛАДКА: ДОСТИЖЕНИЯ ===== */}
        {adminTab === 'personnel' && personnelTab === 'achievements' && (() => {
          const COND_TYPES = [
            { id: 'manual', label: '🎖️ Выдать вручную' },
            { id: 'sales_count', label: '🛒 Кол-во продаж' },
            { id: 'revenue', label: '💰 Выручка (₽)' },
            { id: 'big_sale', label: '🎯 Продажа от N ₽' },
            { id: 'tips_count', label: '⭐ Чаевые (раз)' },
          ];
          const ICON_PRESETS = ['🏆','🥇','🥈','🥉','🌟','⭐','🔥','💎','🎯','🎖️','👑','🚀','💪','🦅','🐦','🎁','💡','🌈','⚡','🎪','🏅','✨','🌙','🦁','🐯'];

          const handleSaveAch = () => {
            if (!achForm.title.trim()) { showNotification('Введите название', 'error'); return; }
            if (achForm.condType !== 'manual' && !achForm.condValue) { showNotification('Укажите значение условия', 'error'); return; }
            if (editingAch) {
              updateCustomAchievements(customAchievements.map(a => a.id === editingAch ? { ...a, ...achForm } : a));
              setEditingAch(null);
            } else {
              const newA = { ...achForm, id: 'custom_' + Date.now(), condValue: Number(achForm.condValue) || 0, bonusAmount: Number(achForm.bonusAmount) || 0, createdAt: Date.now() };
              updateCustomAchievements([...customAchievements, newA]);
            }
            setAchForm({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '' });
            showNotification(editingAch ? 'Достижение обновлено' : 'Достижение создано');
          };

          const handleDeleteAch = (id) => {
            showConfirm('Удалить достижение?', () => {
              updateCustomAchievements(customAchievements.filter(a => a.id !== id));
              // Убираем из выданных
              const newGranted = { ...achievementsGranted };
              delete newGranted[id];
              updateAchievementsGranted(newGranted);
              showNotification('Удалено');
            });
          };

          const handleGrantToggle = (achId, userLogin) => {
            const current = achievementsGranted[achId] || [];
            const isRevoking = current.includes(userLogin);
            const updated = isRevoking
              ? current.filter(l => l !== userLogin)
              : [...current, userLogin];
            updateAchievementsGranted({ ...achievementsGranted, [achId]: updated });

            // ═══ СНЯТИЕ достижения — удалить бонус ═══
            if (isRevoking) {
              const ach = customAchievements.find(a => a.id === achId);
              if (ach && ach.bonusAmount > 0) {
                const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
                const user = regUsers.find(u => u.login === userLogin);
                const empName = user?.name || userLogin;
                // Удаляем бонус с пометкой achievementId или по reason
                const updatedBonuses = bonuses.filter(b => {
                  if (b.achievementId === achId && (b.employeeName === empName || b.employeeLogin === userLogin)) return false;
                  if (b.reason === `Достижение: ${ach.title}` && (b.employeeName === empName || b.employeeLogin === userLogin)) return false;
                  return true;
                });
                if (updatedBonuses.length !== bonuses.length) {
                  updateBonuses(updatedBonuses);
                  showNotification(`Достижение снято, бонус ${ach.bonusAmount}₽ удалён`);
                } else {
                  showNotification('Достижение снято');
                }
              } else {
                showNotification('Достижение снято');
              }
              return;
            }

            // ═══ ВЫДАЧА достижения — начислить бонус и отправить уведомление ═══
            const ach = customAchievements.find(a => a.id === achId);
            if (!ach) return;
            // Уведомление в Firebase
            const notifKey = 'likebird-notifications';
            const existingNotifs = (() => { try { return JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch { return []; } })();
            const newNotif = {
              id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6),
              type: 'achievement',
              targetLogin: userLogin,
              title: '🏆 Новое достижение!',
              body: `Вы получили достижение: «${ach.title}»${ach.bonusAmount > 0 ? ` + бонус ${Number(ach.bonusAmount).toLocaleString()}₽` : ''}`,
              bonusAmount: ach.bonusAmount || 0,
              achievementId: achId,
              createdAt: Date.now(),
              read: false,
            };
            const updatedNotifs = [newNotif, ...existingNotifs].slice(0, 100);
            localStorage.setItem(notifKey, JSON.stringify(updatedNotifs));
            fbSave(notifKey, updatedNotifs);

            // Если бонус — добавить в bonuses (с achievementId для отката)
            if (ach.bonusAmount > 0) {
              const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
              const user = regUsers.find(u => u.login === userLogin);
              const emp = employees.find(e => e.name === (user?.name || userLogin));
              if (emp) {
                const newBonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId: emp.id, employeeName: emp.name, employeeLogin: userLogin, achievementId: achId, amount: Number(ach.bonusAmount), reason: `Достижение: ${ach.title}`, date: new Date().toLocaleDateString('ru-RU'), createdAt: Date.now() };
                const updatedBonuses = [newBonus, ...bonuses];
                updateBonuses(updatedBonuses);
              }
            }
            showNotification(`Достижение выдано${ach.bonusAmount > 0 ? ` + бонус ${ach.bonusAmount}₽` : ''}`);
          };

          const users = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();

          return (
            <div className="space-y-4">

              {/* Форма создания/редактирования */}
              <div className="bg-white rounded-2xl p-4 shadow">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  {editingAch ? 'Редактировать достижение' : 'Новое достижение'}
                </h3>

                {/* Выбор иконки */}
                <div className="mb-3">
                  <label className="text-xs text-gray-500 font-semibold block mb-2">Иконка</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {ICON_PRESETS.map(ic => (
                      <button key={ic} onClick={() => setAchForm({...achForm, icon: ic})}
                        className={`w-10 h-10 text-xl rounded-xl transition-all ${achForm.icon === ic ? 'bg-amber-100 ring-2 ring-amber-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        {ic}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{achForm.icon}</span>
                    <input type="text" value={achForm.icon} onChange={e => setAchForm({...achForm, icon: e.target.value})}
                      placeholder="или введите свой эмодзи"
                      className="flex-1 p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" maxLength={4} />
                  </div>
                </div>

                {/* Название и описание */}
                <div className="space-y-2 mb-3">
                  <input type="text" value={achForm.title} onChange={e => setAchForm({...achForm, title: e.target.value})}
                    placeholder="Название достижения *"
                    className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-amber-400 focus:outline-none" />
                  <input type="text" value={achForm.desc} onChange={e => setAchForm({...achForm, desc: e.target.value})}
                    placeholder="Описание (подсказка для сотрудника)"
                    className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" />
                  <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
                    <span className="text-amber-600 font-semibold text-sm flex-shrink-0">🎁 Бонус:</span>
                    <input type="number" value={achForm.bonusAmount || ''} onChange={e => setAchForm({...achForm, bonusAmount: e.target.value})}
                      placeholder="0 ₽ (оставьте пустым без бонуса)"
                      className="flex-1 p-2 border-2 border-amber-200 rounded-lg text-sm focus:border-amber-400 focus:outline-none" />
                    <span className="text-gray-400 text-sm">₽</span>
                  </div>
                </div>

                {/* Условие получения */}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 font-semibold block mb-2">Условие получения</label>
                  <div className="grid grid-cols-1 gap-2 mb-2">
                    {COND_TYPES.map(ct => (
                      <button key={ct.id} onClick={() => setAchForm({...achForm, condType: ct.id, condValue: ''})}
                        className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${achForm.condType === ct.id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {ct.label}
                      </button>
                    ))}
                  </div>
                  {achForm.condType !== 'manual' && (
                    <input type="number" value={achForm.condValue} onChange={e => setAchForm({...achForm, condValue: e.target.value})}
                      placeholder={achForm.condType === 'sales_count' ? 'Кол-во продаж, например 25' : achForm.condType === 'revenue' ? 'Сумма выручки, например 100000' : achForm.condType === 'big_sale' ? 'Минимальная сумма продажи, например 2000' : 'Количество раз'}
                      className="w-full p-2.5 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" />
                  )}
                </div>

                <div className="flex gap-2">
                  <button onClick={handleSaveAch}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                    {editingAch ? '💾 Сохранить' : '✅ Создать достижение'}
                  </button>
                  {editingAch && (
                    <button onClick={() => { setEditingAch(null); setAchForm({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '' }); }}
                      className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">
                      Отмена
                    </button>
                  )}
                </div>
              </div>

              {/* Список созданных достижений */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span>Созданные достижения</span>
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{customAchievements.length}</span>
                </h3>
                {customAchievements.length === 0 && (
                  <div className="bg-white rounded-xl p-8 text-center shadow">
                    <p className="text-4xl mb-2">🏅</p>
                    <p className="text-gray-400">Нет кастомных достижений</p>
                    <p className="text-gray-400 text-sm mt-1">Создайте первое выше</p>
                  </div>
                )}
                {customAchievements.map(ach => {
                  const grantedTo = achievementsGranted[ach.id] || [];
                  const condLabel = COND_TYPES.find(c => c.id === ach.condType)?.label || ach.condType;
                  return (
                    <div key={ach.id} className="bg-white rounded-2xl shadow overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                            {ach.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-800">{ach.title}</p>
                            {ach.desc && <p className="text-xs text-gray-400 mt-0.5">{ach.desc}</p>}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                {condLabel}{ach.condValue ? `: ${Number(ach.condValue).toLocaleString()}` : ''}
                              </span>
                              {ach.bonusAmount > 0 && (
                                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🎁 +{Number(ach.bonusAmount).toLocaleString()}₽</span>
                              )}
                              {grantedTo.length > 0 && (
                                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                  ✅ Выдано: {grantedTo.length}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingAch(ach.id); setAchForm({ icon: ach.icon, title: ach.title, desc: ach.desc || '', condType: ach.condType, condValue: String(ach.condValue || ''), bonusAmount: String(ach.bonusAmount || '') }); }}
                              className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteAch(ach.id)}
                              className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Ручная выдача */}
                        {ach.condType === 'manual' && users.length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-500 font-semibold mb-2">Выдать сотрудникам:</p>
                            <div className="flex flex-wrap gap-2">
                              {users.map(u => {
                                const granted = grantedTo.includes(u.login);
                                const profile = profilesData[u.login] || {};
                                return (
                                  <button key={u.login} onClick={() => handleGrantToggle(ach.id, u.login)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${granted ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    <span>{granted ? '✅' : '○'}</span>
                                    <span>{profile.displayName || u.name || u.login}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
