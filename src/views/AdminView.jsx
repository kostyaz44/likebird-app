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
import { formatDate, parseYear } from '../utils/dates.js';
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
    // --- функции бизнес-логики ---
    addBonus, addCustomProduct, addEmployee, addLocation, addPenalty,
    addStockHistoryEntry, addTimeOff, addWriteOff, checkAdminPassword,
    clearAllData, compressImage, enrichBackup, exportData, generateAutoOrder,
    getActiveTimeOff, getAllDates, getAnalytics, getAutoOrderText,
    getCities, getCostPrice, getEffectiveSalary, getEmployeeAverageRating,
    getEmployeeBonuses, getEmployeePenalties, getEmployeeProgress,
    getLocationsByCity, getLowStockItems, getProductName,
    importData, logAction, rateEmployee, removeLocation, save, saveAlias,
    sendMessage, setAdminPass, setEmployeeGoal, showConfirm, showNotification,
    toggleLocationActive, updateAchievementsGranted, updateAutoOrderList,
    updateBonuses, updateChallenges, updateCustomAchievements,
    updateEmployees, updateManuals, updateProductPhotos, updateReports,
    updateSalesPlan, updateStock,
    // --- сеттеры ---
    setAdminTab, setAnalyticsPeriod, setAnalyticsSubTab, setChallengeForm,
    setCostPrice, setCurrentUser, setCurrentView, setEventsCalendar,
    setExpenses, setInviteCodes, setIsAdminUnlocked, setNotifSettings,
    setPersonnelTab, setSalaryDecisions, setSalarySettings, setScheduleData,
    setStockTab, setTotalBirds, setUserNotifications,
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
        {adminTab === 'stockplus' && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {[
              { id: 'products', label: '📦 Товары' },
              { id: 'revision', label: '📋 Ревизия' },
              { id: 'locations', label: '📍 Точки' },
              { id: 'history', label: '📜 История' },
              { id: 'writeoff', label: '🗑️ Списания' },
              { id: 'autoorder', label: '📦 Автозаказ' },
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

        {/* ВКЛАДКА: Товары */}
        {adminTab === 'stockplus' && stockTab === 'products' && (
          <div className="space-y-4">
            {/* Добавление товара */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-5 h-5 text-purple-600" />Добавить товар</h3>
              <div className="space-y-2">
                <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} placeholder="Название" className="w-full p-2 border rounded" />
                <div className="flex gap-2">
                  <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} placeholder="Цена" className="flex-1 p-2 border rounded" />
                  <input type="text" value={newProduct.emoji} onChange={(e) => setNewProduct({...newProduct, emoji: e.target.value})} placeholder="🎁" className="w-16 p-2 border rounded text-center" />
                </div>
                <select value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border rounded">
                  {Object.keys(PRODUCTS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {/* Фото товара */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Фото товара</label>
                  <label className="flex items-center justify-center h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50">
                    <span className="text-sm text-gray-500">{productPhoto ? '✅ Фото загружено' : '📷 Нажмите для загрузки'}</span>
                    <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files[0]; if (f) { const compressed = await compressImage(f, 400, 0.6); if (compressed) { setProductPhoto(compressed); showNotification('📷 Фото загружено'); } else { showNotification('Формат не поддерживается', 'error'); } }}} className="hidden" />
                  </label>
                  {productPhoto && <div className="mt-2 relative"><img src={productPhoto} alt="Фото товара" className="w-36 h-36 object-cover rounded-xl border border-gray-200 shadow-sm" /><button onClick={() => setProductPhoto(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button></div>}
                </div>
                <button onClick={() => {
                  if (newProduct.name && newProduct.price) {
                    const prod = { ...newProduct, price: parseInt(newProduct.price), aliases: [newProduct.name.toLowerCase()] };
                    addCustomProduct(prod);
                    if (productPhoto) { updateProductPhotos({...productPhotos, [newProduct.name]: productPhoto}); }
                    setNewProduct({ name: '', price: '', category: 'Птички-свистульки', emoji: '🎁' });
                    setProductPhoto(null);
                    showNotification('Товар добавлен');
                  }
                }} className="w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600">Добавить товар</button>
              </div>
            </div>

            {/* Все товары с возможностью редактирования */}
            {/* Alias management */}
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <details className="group">
                <summary className="cursor-pointer font-bold flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />📝 Алиасы товаров ({Object.keys(customAliases).length})
                </summary>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">Алиасы позволяют распознавать товары по альтернативным названиям (из отчётов, ревизий)</p>
                  {Object.entries(customAliases).length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(customAliases).map(([alias, prod]) => (
                        <div key={alias} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-1.5 text-sm">
                          <span>«{alias}» → <strong>{prod}</strong></span>
                          <button onClick={() => { removeAlias(alias); showNotification('Алиас удалён'); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="text" id="admin-alias-input" placeholder="Алиас (как пишут)" className="flex-1 p-2 border rounded-lg text-sm" />
                    <input type="text" id="admin-alias-product" placeholder="Товар из каталога" className="flex-1 p-2 border rounded-lg text-sm" list="admin-alias-prodlist" />
                    <datalist id="admin-alias-prodlist">{DYNAMIC_ALL_PRODUCTS.map(p => <option key={p.name} value={p.name}>{p.emoji} {p.name}</option>)}</datalist>
                    <button onClick={() => {
                      const al = document.getElementById('admin-alias-input')?.value;
                      const pr = document.getElementById('admin-alias-product')?.value;
                      if (al && pr && DYNAMIC_ALL_PRODUCTS.find(p => p.name === pr)) {
                        saveAlias(al, pr);
                        document.getElementById('admin-alias-input').value = '';
                        document.getElementById('admin-alias-product').value = '';
                      } else { showNotification('Укажите алиас и выберите товар из каталога', 'error'); }
                    }} className="bg-purple-500 text-white px-3 rounded-lg text-sm font-bold">+</button>
                  </div>
                </div>
              </details>
            </div>
            
            {Object.entries(PRODUCTS).map(([cat, items]) => (
              <div key={cat} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3">{CAT_ICONS[cat]} {cat} ({items.length + customProducts.filter(p => p.category === cat).length})</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {[...items.map(p => ({...p, category: cat, isBase: true})), ...customProducts.filter(p => p.category === cat).map(p => ({...p, isBase: false}))].map((prod, i) => (
                    <div key={prod.name + i} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${prod.isBase ? 'bg-gray-50' : 'bg-purple-50'}`}>
                      {productPhotos[prod.name] ? (
                        <img src={productPhotos[prod.name]} alt={prod.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-200 shadow-sm" />
                      ) : (
                        <span className="text-2xl flex-shrink-0 w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center text-4xl">{prod.emoji}</span>
                      )}
                      {editingProduct === prod.name ? (
                        <div className="flex-1 flex gap-1">
                          <input type="text" value={editProductData.emoji} onChange={(e) => setEditProductData({...editProductData, emoji: e.target.value})} className="w-10 p-1 border rounded text-center text-xs" />
                          <input type="number" value={editProductData.price} onChange={(e) => setEditProductData({...editProductData, price: e.target.value})} className="w-16 p-1 border rounded text-xs" placeholder="Цена" />
                          <button onClick={() => { if (!prod.isBase) { const updated = customProducts.map(p => p.name === prod.name ? {...p, emoji: editProductData.emoji, price: parseInt(editProductData.price) || p.price} : p); setCustomProducts(updated); save('likebird-custom-products', updated); } setEditingProduct(null); showNotification('Сохранено'); }} className="px-2 py-1 bg-green-500 text-white rounded text-xs">✓</button>
                          <button onClick={() => setEditingProduct(null)} className="px-2 py-1 bg-gray-300 rounded text-xs">✕</button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1">{prod.name}</span>
                          <span className="text-gray-500">{prod.price}₽</span>
                          <div className="flex gap-1">
                            {/* Загрузка фото */}
                            <label className="text-gray-400 hover:text-purple-500 cursor-pointer"><Camera className="w-4 h-4" /><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files[0]; if (f) { const compressed = await compressImage(f, 400, 0.6); if (compressed) { updateProductPhotos({...productPhotos, [prod.name]: compressed}); showNotification('📷 Фото добавлено'); } else { showNotification('Формат не поддерживается', 'error'); } }}} className="hidden" /></label>
                            {!prod.isBase && <button onClick={() => { setEditingProduct(prod.name); setEditProductData({ name: prod.name, price: prod.price, emoji: prod.emoji, category: prod.category }); }} className="text-gray-400 hover:text-blue-500"><Edit3 className="w-3.5 h-3.5" /></button>}
                            {!prod.isBase && <button onClick={() => showConfirm(`Удалить ${prod.name}?`, () => removeCustomProduct(prod.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                            <button onClick={() => { toggleArchiveProduct(prod.name); showNotification(archivedProducts.includes(prod.name) ? 'Товар восстановлен' : 'Товар в архиве'); }} className={`text-xs ${archivedProducts.includes(prod.name) ? 'text-green-500' : 'text-gray-400 hover:text-amber-500'}`} title={archivedProducts.includes(prod.name) ? 'Восстановить' : 'Архивировать'}>{archivedProducts.includes(prod.name) ? '♻️' : '📦'}</button>
                            <button onClick={() => {
                              const alias = prompt(`Добавить алиас для «${prod.name}»:\n(как товар называют в отчёте/ревизии)`);
                              if (alias?.trim()) saveAlias(alias.trim(), prod.name);
                            }} className="text-gray-400 hover:text-purple-500" title="Добавить алиас">📝</button>
                            {productPhotos[prod.name] && <button onClick={() => { deleteMediaPhoto(prod.name); showNotification('Фото удалено'); }} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}


          </div>
        )}

        {/* ВКЛАДКА: Ревизия */}
        {adminTab === 'stockplus' && stockTab === 'revision' && (() => {
          
          // Parse warehouse revision text
          const parseWarehouseRevision = (text) => {
            const lines = text.split('\n');
            let period = '';
            let category = '';
            let currentItem = null;
            const items = [];
            let birdSection = null;
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;
              const lower = line.toLowerCase();
              
              // Period
              if (/^период/i.test(line)) { period = line.replace(/^период:\s*/i, ''); continue; }
              
              // Category header
              if (/^вид товар/i.test(line)) {
                const catMatch = line.match(/:\s*(.+)/);
                if (catMatch) category = catMatch[1].trim();
                // Detect bird section
                if (/птиц/i.test(line)) {
                  if (!birdSection) birdSection = { totalNow: 0, startCount: 0, arrivals: [], salesCount: 0, writeoffs: [], shortage: 0, found: 0 };
                  // Flush current item from previous section
                  if (currentItem) { items.push(currentItem); currentItem = null; }
                }
                continue;
              }
              
              // Skip formula/calculation lines like "1) 410 - 62..."
              if (/^\d+\)\s*\d+\s*[-+]/.test(line)) continue;
              
              // "На данный момент: N"
              const currentMatch = line.match(/на данный момент:\s*(\d+)/i);
              if (currentMatch) {
                const count = parseInt(currentMatch[1], 10);
                if (currentItem) { currentItem.currentCount = count; }
                else if (birdSection) { birdSection.totalNow = count; }
                continue;
              }
              
              // "Количество продаж: N"
              const salesCountMatch = line.match(/количество продаж:\s*(\d+)/i);
              if (salesCountMatch) {
                const cnt = parseInt(salesCountMatch[1], 10);
                if (currentItem) currentItem.salesCount = cnt;
                else if (birdSection) birdSection.salesCount = cnt;
                continue;
              }
              
              // "Найдены из недосдачи : 27" or "Найдено: 27" — MUST check BEFORE writeoffs
              const foundMatch = lower.match(/найден[а-яё]*.*?(\d+)/i);
              if (foundMatch && birdSection && !currentItem) {
                birdSection.found = parseInt(foundMatch[1], 10);
                continue;
              }
              
              // "Итоговая недосдача: 4 птицы" or "31 недосдача" — MUST check BEFORE writeoffs
              const shortageExactMatch = line.match(/итоговая недосдач.*?(\d+)/i);
              if (shortageExactMatch && birdSection) { birdSection.shortage = parseInt(shortageExactMatch[1], 10); continue; }
              const shortageMatch = line.match(/(\d+)\s*недосдач/i);
              if (shortageMatch && birdSection && !currentItem) { birdSection.shortage = parseInt(shortageMatch[1], 10); continue; }
              
              // Date with count: "15.01: 22" or "14.02.2026: +330 птиц"
              const dateCountMatch = line.match(/^(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*:\s*(.+)/);
              if (dateCountMatch) {
                const val = dateCountMatch[2].trim();
                const numMatch = val.match(/^\+?\s*(\d+)/);
                if (numMatch) {
                  const isArrival = /^\+/.test(val.trim());
                  const count = parseInt(numMatch[1], 10);
                  
                  if (currentItem) {
                    if (isArrival) {
                      currentItem.arrivals.push({ date: dateCountMatch[1], count, note: val });
                    } else if (!currentItem.startDate) {
                      currentItem.startCount = count;
                      currentItem.startDate = dateCountMatch[1];
                      currentItem.extra = val.replace(/^\d+/, '').trim();
                    }
                  } else if (birdSection) {
                    if (isArrival) birdSection.arrivals.push({ date: dateCountMatch[1], count, note: val });
                    else if (!birdSection.startDate) { birdSection.startCount = count; birdSection.startDate = dateCountMatch[1]; }
                  }
                }
                continue;
              }
              
              // Sale line: "1 Алиса 14.02"
              const saleMatch = line.match(/^(\d+)\s+([А-Яа-яЁёA-Za-z]+)\s+(\d{1,2}\.\d{1,2})/);
              if (saleMatch) {
                if (currentItem) currentItem.sales.push({ qty: parseInt(saleMatch[1], 10), employee: saleMatch[2], date: saleMatch[3] });
                continue;
              }
              
              // Write-off lines (bird section only): "Брак/разбиты: 8" etc.
              // Only match known writeoff patterns, NOT "найден" or "недосдач"
              if (birdSection && !currentItem) {
                const woMatch = line.match(/^(.+?):\s*(\d+)\s*(.*?)(?:\[.*\])?$/);
                if (woMatch) {
                  const reason = woMatch[1].trim();
                  // Only specific writeoff keywords, exclude "найден" and "недосдач" and "итогов"
                  if (/брак|разб|списан|отдал|подарок|забрал|зп|потер|украд|слом/i.test(reason) && !/найден|недосдач|итогов/i.test(reason)) {
                    birdSection.writeoffs.push({ reason, count: parseInt(woMatch[2], 10), note: woMatch[3]?.trim() || '' });
                    continue;
                  }
                }
              }
              
              // "Новые 8 штук 01.03" or "(Лежали с декабря, 10.12 3 шт)" — count for current item
              // MUST check BEFORE item header detection
              const specialMatch = line.match(/(\d+)\s*(?:шт|штук)/i);
              if (specialMatch && currentItem) {
                const cnt = parseInt(specialMatch[1], 10);
                if (currentItem.currentCount === 0) currentItem.currentCount = cnt;
                if (currentItem.startCount === 0) currentItem.startCount = cnt;
                continue;
              }
              
              // Section headers like "Мелкие:" — skip as items
              if (/^(мелкие|крупные|средние|большие|другие)\s*:?\s*$/i.test(line)) continue;
              
              // New item header (product name, possibly with ✅)
              const itemLine = line.replace(/[✅✔️☑️]/g, '').trim();
              if (itemLine.length > 1 && !/^[\d(]/.test(itemLine) && !/количество|на данный|период|вид товар|итого/i.test(itemLine)) {
                // Look ahead: does next few lines have "На данный момент" or a date line?
                let isItem = false;
                for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                  const nextLine = lines[j].trim();
                  if (/на данный момент|количество продаж/i.test(nextLine)) { isItem = true; break; }
                  if (/^\d{1,2}\.\d{1,2}.*:\s*\d/.test(nextLine)) { isItem = true; break; }
                }
                // Also check for special patterns like "Новые N штук" or "(Лежали..."
                const nextLine = (lines[i + 1] || '').trim();
                if (/новые|лежали|штук|\d+\s*шт/i.test(nextLine)) isItem = true;
                
                if (isItem) {
                  if (currentItem) items.push(currentItem);
                  currentItem = { name: itemLine, startCount: 0, currentCount: 0, sales: [], arrivals: [], writeoffs: [], salesCount: 0, startDate: '', extra: '' };
                  continue;
                }
              }
              
            }
            if (currentItem) items.push(currentItem);
            
            // Match items to catalog products (with CUSTOM_ALIASES support)
            items.forEach(item => {
              const nameLow = item.name.toLowerCase();
              let bestMatch = null;
              let bestScore = 0;
              
              // 1. Check custom aliases first
              for (const [alias, productName] of Object.entries(CUSTOM_ALIASES)) {
                if (nameLow === alias.toLowerCase() || nameLow.includes(alias.toLowerCase())) {
                  const found = DYNAMIC_ALL_PRODUCTS.find(p => p.name === productName);
                  if (found) { bestMatch = found; bestScore = 95; break; }
                }
              }
              
              // 2. Catalog matching
              if (!bestMatch) {
                DYNAMIC_ALL_PRODUCTS.forEach(p => {
                  const pLow = p.name.toLowerCase();
                  // Exact
                  if (pLow === nameLow) { bestMatch = p; bestScore = 100; return; }
                  // Alias match (bi-directional)
                  for (const alias of (p.aliases || [])) {
                    const aLow = alias.toLowerCase();
                    if (nameLow === aLow) { if (100 > bestScore) { bestMatch = p; bestScore = 100; } return; }
                    if (nameLow.includes(aLow) && aLow.length >= 3) {
                      const score = aLow.length / nameLow.length * 85;
                      if (score > bestScore) { bestMatch = p; bestScore = score; }
                    }
                    if (aLow.includes(nameLow) && nameLow.length >= 3) {
                      const score = nameLow.length / aLow.length * 85;
                      if (score > bestScore) { bestMatch = p; bestScore = score; }
                    }
                  }
                  // Partial name match (only if no alias found and significant overlap)
                  if (bestScore < 50) {
                    if (pLow.includes(nameLow) && nameLow.length >= 4) {
                      const score = nameLow.length / pLow.length * 60;
                      if (score > bestScore) { bestMatch = p; bestScore = score; }
                    }
                    if (nameLow.includes(pLow) && pLow.length >= 4) {
                      const score = pLow.length / nameLow.length * 60;
                      if (score > bestScore) { bestMatch = p; bestScore = score; }
                    }
                  }
                });
              }
              
              // Only accept matches above threshold
              item.matchedProduct = bestScore >= 30 ? bestMatch : null;
              item.matchScore = bestScore;
            });
            
            // Auto-calculate bird shortage
            if (birdSection) {
              const totalArrivals = birdSection.arrivals.reduce((s, a) => s + a.count, 0);
              const totalWriteoffs = birdSection.writeoffs.reduce((s, w) => s + w.count, 0);
              const expected = birdSection.startCount + totalArrivals - birdSection.salesCount - totalWriteoffs;
              birdSection.expected = expected;
              birdSection.calculatedShortage = expected - birdSection.totalNow;
              birdSection.netShortage = birdSection.calculatedShortage - (birdSection.found || 0);
            }
            
            return { period, category, items, birdSection };
          };
          
          // Apply revision: update stock + write-offs + save doc
          const applyRevision = (parsed) => {
            const newStock = { ...stock };
            let updatedCount = 0;
            let createdWriteoffs = 0;
            
            // Update item counts
            parsed.items.forEach(item => {
              if (!item.matchedProduct) return;
              const pName = item.matchedProduct.name;
              if (newStock[pName]) {
                const oldCount = newStock[pName].count;
                newStock[pName] = { ...newStock[pName], count: item.currentCount };
                if (oldCount !== item.currentCount) {
                  addStockHistoryEntry(pName, 'revision', item.currentCount - oldCount, `Ревизия: ${oldCount} → ${item.currentCount}`);
                  updatedCount++;
                }
              }
              // Create write-offs for discrepancies
              if (item.startCount > 0 && item.salesCount >= 0) {
                const expected = item.startCount + item.arrivals.reduce((s, a) => s + a.count, 0) - item.salesCount;
                const diff = expected - item.currentCount;
                if (diff > 0) {
                  addWriteOff(item.matchedProduct.name, diff, `Ревизия: недосдача (ожидалось ${expected}, факт ${item.currentCount})`);
                  createdWriteoffs++;
                }
              }
            });
            
            // Bird section write-offs
            if (parsed.birdSection) {
              parsed.birdSection.writeoffs.forEach(wo => {
                const reason = `${wo.reason}: ${wo.count} шт${wo.note ? ' ' + wo.note : ''}`;
                // Generic bird write-off
                addWriteOff('Попугай', wo.count, reason);
                createdWriteoffs++;
              });
            }
            
            updateStock(newStock);
            
            // Save revision as document
            const doc = {
              id: Date.now() + '_rev',
              date: new Date().toISOString(),
              period: parsed.period,
              category: parsed.category,
              itemCount: parsed.items.length,
              birdSection: parsed.birdSection,
              items: parsed.items.map(i => ({ name: i.name, matched: i.matchedProduct?.name, current: i.currentCount, start: i.startCount, sales: i.salesCount })),
              rawText: revText,
              appliedBy: employeeName,
              updatedCount,
              createdWriteoffs
            };
            const hist = [doc, ...revHistory].slice(0, 50);
            setRevHistory(hist);
            try { localStorage.setItem('likebird-revision-history', JSON.stringify(hist)); } catch {}
            save('likebird-revision-history', hist);
            
            logAction('Ревизия склада', `${parsed.items.length} позиций, ${updatedCount} обновлено, ${createdWriteoffs} списаний`);
            showNotification(`✅ Ревизия применена: ${updatedCount} обновлено, ${createdWriteoffs} списаний`);
            setRevMode('overview');
            setRevText('');
            setRevParsed(null);
          };
          
          // OVERVIEW MODE
          if (revMode === 'overview') return (
            <div className="space-y-4">
              {/* Summary card */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 border-2 border-amber-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-amber-700">🐦 Всего птичек-свистулек</p>
                    <p className="text-xs text-amber-600">По ревизии / В системе</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-700">
                      {totalBirds > 0 ? totalBirds : '—'} 
                      <span className="text-lg text-amber-500"> / {Object.entries(stock).filter(([_, d]) => d.category === 'Птички-свистульки').reduce((s, [_, d]) => s + d.count, 0)}</span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Low stock alert */}
              {getLowStockItems().length > 0 && (
                <div className="bg-orange-50 border border-orange-300 rounded-xl p-4">
                  <h3 className="font-bold text-orange-700 mb-2 flex items-center gap-2"><Bell className="w-4 h-4" />Дозаказ ({getLowStockItems().length})</h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {getLowStockItems().map(item => (
                      <div key={item.name} className="flex justify-between items-center p-1.5 bg-white rounded text-sm">
                        <span>{item.emoji} {item.name}</span>
                        <span className="font-bold text-orange-600">{item.count} шт</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Quick bird input */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-2">🐦 Птицы по ревизии</h3>
                <div className="flex gap-2">
                  <input type="number" defaultValue={totalBirds || ''} onBlur={(e) => { const v = parseInt(e.target.value) || 0; setTotalBirds(v); save('likebird-totalbirds', v); }} placeholder="Кол-во" className="flex-1 p-3 border rounded-lg" />
                  <button onClick={() => showNotification('✅ Сохранено')} className="bg-amber-500 text-white px-4 rounded-lg hover:bg-amber-600">💾</button>
                </div>
              </div>
              
              {/* Categories summary */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3">📊 Остатки по категориям</h3>
                {Object.keys(PRODUCTS).map(cat => {
                  const catItems = Object.entries(stock).filter(([_, d]) => d.category === cat);
                  const total = catItems.reduce((s, [_, d]) => s + d.count, 0);
                  const low = catItems.filter(([_, d]) => d.count <= d.minStock && d.count > 0).length;
                  return (
                    <div key={cat} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg mb-1.5">
                      <span className="font-medium text-sm">{CAT_ICONS[cat]} {cat}</span>
                      <div className="text-right">
                        <span className="font-bold">{total} шт</span>
                        {low > 0 && <span className="text-orange-500 text-xs ml-1">({low} ⚠️)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Main buttons */}
              <button onClick={() => setRevMode('input')} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 text-lg shadow-lg">
                📝 Вставить текст ревизии
              </button>
              <div className="flex gap-2">
                <button onClick={() => setCurrentView('stock')} className="flex-1 bg-amber-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  <Package className="w-5 h-5" />Склад (позиции)
                </button>
                <button onClick={() => setRevMode('history')} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                  📜 История ({revHistory.length})
                </button>
              </div>
            </div>
          );
          
          // INPUT MODE
          if (revMode === 'input') return (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                <h3 className="font-bold text-purple-700 mb-1">📝 Вставьте текст ревизии</h3>
                <p className="text-xs text-purple-500">Формат: «Название✅ / дата: кол-во / На данный момент: N / Количество продаж: N»</p>
              </div>
              <textarea value={revText} onChange={e => setRevText(e.target.value)}
                placeholder={"Период: Отчет с 15.02 по 01.03\nВид товаров: 3D:\n\nЛабубы✅\n15.02: 7\nНа данный момент: 7\nКоличество продаж: 0\n\nХомяки✅\n15.01: 22\nНа данный момент: 21\nКоличество продаж: 1\n1 Алиса 31.01"}
                className="w-full h-64 p-3 border-2 border-gray-200 rounded-xl text-sm font-mono focus:border-purple-500 focus:outline-none resize-none" autoFocus />
              <div className="flex gap-2">
                <button onClick={() => { setRevMode('overview'); setRevText(''); }} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
                <button onClick={() => {
                  if (!revText.trim()) { showNotification('Вставьте текст', 'error'); return; }
                  const parsed = parseWarehouseRevision(revText);
                  if (parsed.items.length === 0 && !parsed.birdSection) { showNotification('Не удалось распознать товары', 'error'); return; }
                  setRevParsed(parsed);
                  setRevMode('preview');
                }} disabled={!revText.trim()} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                  🔍 Распознать
                </button>
              </div>
            </div>
          );
          
          // PREVIEW MODE
          if (revMode === 'preview' && revParsed) {
            const p = revParsed;
            
            const searchResults = itemSearch.length >= 1
              ? DYNAMIC_ALL_PRODUCTS.filter(pr => pr.name.toLowerCase().includes(itemSearch.toLowerCase()) || (pr.aliases||[]).some(a => a.includes(itemSearch.toLowerCase()))).slice(0, 8)
              : [];
            
            // Reassign item to a product
            const assignItem = (idx, product, teachAlias) => {
              const items = [...p.items];
              const oldName = items[idx].name;
              items[idx] = { ...items[idx], matchedProduct: product, matchScore: 100 };
              setRevParsed({ ...p, items });
              if (teachAlias && oldName.toLowerCase() !== product.name.toLowerCase()) {
                saveAlias(oldName, product.name);
              }
              setEditingItem(null);
              setItemSearch('');
            };
            
            // Add new product from unmatched
            const addNewFromRevision = (item) => {
              if (!newProdPrice) { showNotification('Укажите цену', 'error'); return; }
              const prod = { name: item.name, price: parseInt(newProdPrice, 10), category: newProdCat, emoji: '📦', aliases: [item.name.toLowerCase()] };
              addCustomProduct(prod);
              // Re-match this item
              const idx = p.items.findIndex(i => i.name === item.name);
              if (idx >= 0) {
                const newProd = { ...prod };
                const items = [...p.items];
                items[idx] = { ...items[idx], matchedProduct: newProd, matchScore: 100 };
                setRevParsed({ ...p, items });
              }
              setAddingProduct(null);
              setNewProdPrice('');
              showNotification(`✅ Товар «${item.name}» добавлен в каталог`);
            };
            
            const matched = p.items.filter(i => i.matchedProduct);
            const unmatched = p.items.filter(i => !i.matchedProduct);
            
            return (
              <div className="space-y-3">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-4">
                  <h3 className="font-bold text-lg">📋 Результат распознавания</h3>
                  {p.period && <p className="text-white/70 text-sm mt-1">{p.period}</p>}
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="bg-white/20 px-2 py-0.5 rounded">✅ {matched.length} распознано</span>
                    {unmatched.length > 0 && <span className="bg-red-400/30 px-2 py-0.5 rounded">❓ {unmatched.length} не найдено</span>}
                  </div>
                </div>
                
                {/* Bird section */}
                {p.birdSection && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h4 className="font-bold text-amber-700 mb-2">🐦 Птицы (сводка)</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white rounded-lg p-2"><span className="text-gray-500">Начало:</span> <strong>{p.birdSection.startCount}</strong></div>
                      {p.birdSection.arrivals.map((a, i) => (
                        <div key={i} className="bg-green-50 rounded-lg p-2"><span className="text-green-600">+ {a.count}</span> <span className="text-xs text-gray-400">({a.date})</span></div>
                      ))}
                      <div className="bg-white rounded-lg p-2"><span className="text-gray-500">Продано:</span> <strong className="text-red-500">−{p.birdSection.salesCount}</strong></div>
                      <div className="bg-blue-50 rounded-lg p-2"><span className="text-gray-500">Сейчас:</span> <strong>{p.birdSection.totalNow}</strong></div>
                    </div>
                    {p.birdSection.writeoffs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {p.birdSection.writeoffs.map((w, i) => (
                          <div key={i} className="text-xs bg-red-50 rounded px-2 py-1">📌 {w.reason}: <strong>−{w.count}</strong></div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 pt-2 border-t border-amber-200">
                      <div className="flex justify-between text-sm"><span>Ожидаемый:</span><strong>{p.birdSection.expected}</strong></div>
                      <div className="flex justify-between text-sm"><span>Фактический:</span><strong>{p.birdSection.totalNow}</strong></div>
                      {p.birdSection.calculatedShortage > 0 && <div className="flex justify-between text-sm mt-1 text-red-600 font-bold"><span>⚠️ Недосдача:</span><span>{p.birdSection.calculatedShortage} шт</span></div>}
                      {p.birdSection.found > 0 && <div className="flex justify-between text-sm text-green-600"><span>Найдено:</span><span>+{p.birdSection.found}</span></div>}
                      {p.birdSection.netShortage > 0 && <div className="flex justify-between text-sm mt-1 bg-red-100 rounded px-2 py-1 font-bold text-red-700"><span>Итоговая недосдача:</span><span>{p.birdSection.netShortage} шт</span></div>}
                    </div>
                  </div>
                )}
                
                {/* ALL items — editable */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h4 className="font-bold mb-2 text-sm">📦 Товары ({p.items.length}) <span className="text-xs text-gray-400 font-normal">— нажмите для редактирования</span></h4>
                  <div className="space-y-1.5 max-h-80 overflow-y-auto">
                    {p.items.map((item, idx) => {
                      const isMatched = !!item.matchedProduct;
                      const isEditing = editingItem === idx;
                      const inStock = isMatched ? (stock[item.matchedProduct.name]?.count ?? '?') : '—';
                      const diff = isMatched ? item.currentCount - (stock[item.matchedProduct.name]?.count || 0) : 0;
                      const isAdding = addingProduct?.name === item.name;
                      
                      return (
                        <div key={idx} className={`rounded-lg border ${isMatched ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'} overflow-hidden`}>
                          {/* Item row */}
                          <div className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-gray-100" onClick={() => { if (!isEditing && !isAdding) { setEditingItem(isEditing ? null : idx); setItemSearch(''); setAddingProduct(null); } }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className={isMatched ? '' : 'text-red-600'}>{isMatched ? item.matchedProduct.emoji : '❓'} {item.name}</span>
                                {isMatched && item.name.toLowerCase() !== item.matchedProduct.name.toLowerCase() && (
                                  <span className="text-[10px] text-purple-500 bg-purple-50 px-1 rounded">→ {item.matchedProduct.name}</span>
                                )}
                              </div>
                              {item.salesCount > 0 && <span className="text-[10px] text-gray-400">Продаж: {item.salesCount}</span>}
                            </div>
                            <div className="text-right shrink-0 flex items-center gap-2">
                              <span className="font-bold">{item.currentCount}</span>
                              {isMatched && <span className="text-xs text-gray-400">({inStock})</span>}
                              {isMatched && diff !== 0 && <span className={`text-xs font-bold ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>{diff > 0 ? '+' : ''}{diff}</span>}
                              <Edit3 className="w-3 h-3 text-gray-300" />
                            </div>
                          </div>
                          
                          {/* Edit panel */}
                          {isEditing && (
                            <div className="border-t px-3 py-2 bg-white space-y-2">
                              <p className="text-xs text-gray-500">Привязать «{item.name}» к товару из каталога:</p>
                              <div className="relative">
                                <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                                  placeholder="🔍 Найти товар..." className="w-full p-2 border-2 border-purple-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" autoFocus />
                                {searchResults.length > 0 && (
                                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {searchResults.map(pr => (
                                      <button key={pr.name} onClick={() => assignItem(idx, pr, true)}
                                        className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm flex justify-between border-b last:border-0">
                                        <span>{pr.emoji} {pr.name}</span>
                                        <span className="text-gray-400">{pr.price}₽</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {isMatched && (
                                  <button onClick={() => {
                                    const items = [...p.items];
                                    items[idx] = { ...items[idx], matchedProduct: null, matchScore: 0 };
                                    setRevParsed({ ...p, items });
                                    setEditingItem(null);
                                  }} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">Отвязать</button>
                                )}
                                {!isMatched && (
                                  <button onClick={() => { setAddingProduct(item); setEditingItem(null); }} className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
                                    <Plus className="w-3 h-3" />Создать товар
                                  </button>
                                )}
                                <button onClick={() => { setEditingItem(null); setItemSearch(''); }} className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded ml-auto">Закрыть</button>
                              </div>
                            </div>
                          )}
                          
                          {/* Add new product panel */}
                          {isAdding && (
                            <div className="border-t px-3 py-2 bg-green-50 space-y-2">
                              <p className="text-xs text-green-700 font-semibold">Добавить «{item.name}» в каталог:</p>
                              <div className="flex gap-2">
                                <input type="number" value={newProdPrice} onChange={e => setNewProdPrice(e.target.value)} placeholder="Цена ₽" className="w-24 p-2 border rounded-lg text-sm" />
                                <select value={newProdCat} onChange={e => setNewProdCat(e.target.value)} className="flex-1 p-2 border rounded-lg text-sm">
                                  {Object.keys(PRODUCTS).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setAddingProduct(null)} className="flex-1 py-2 bg-gray-200 rounded-lg text-sm font-semibold">Отмена</button>
                                <button onClick={() => addNewFromRevision(item)} disabled={!newProdPrice} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                                  ✅ Добавить и привязать
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => setRevMode('input')} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">✏️ Назад</button>
                  <button onClick={() => applyRevision(p)} className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold">
                    ✅ Применить ({matched.length} поз.)
                  </button>
                </div>
              </div>
            );
          }
          
          // HISTORY MODE
          if (revMode === 'history') {
            if (viewingRev) {
              return (
                <div className="space-y-3">
                  <button onClick={() => setViewingRev(null)} className="text-purple-600 text-sm font-semibold flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Назад к списку
                  </button>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-1">📋 Ревизия от {new Date(viewingRev.date).toLocaleDateString('ru-RU')}</h3>
                    {viewingRev.period && <p className="text-sm text-gray-500 mb-2">{viewingRev.period}</p>}
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-3">
                      <div className="bg-purple-50 rounded-lg p-2"><p className="font-bold text-purple-700">{viewingRev.itemCount}</p><p className="text-[10px] text-gray-500">Позиций</p></div>
                      <div className="bg-green-50 rounded-lg p-2"><p className="font-bold text-green-700">{viewingRev.updatedCount}</p><p className="text-[10px] text-gray-500">Обновлено</p></div>
                      <div className="bg-red-50 rounded-lg p-2"><p className="font-bold text-red-700">{viewingRev.createdWriteoffs}</p><p className="text-[10px] text-gray-500">Списаний</p></div>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Применил: {viewingRev.appliedBy}</p>
                    {viewingRev.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100">
                        <span>{item.matched ? '✅' : '❓'} {item.name}{item.matched && item.matched !== item.name ? ` → ${item.matched}` : ''}</span>
                        <span className="font-bold">{item.current} шт</span>
                      </div>
                    ))}
                    {viewingRev.birdSection && (
                      <div className="mt-3 bg-amber-50 rounded-lg p-3">
                        <p className="font-bold text-sm text-amber-700">🐦 Птицы: {viewingRev.birdSection.totalNow} шт</p>
                        {viewingRev.birdSection.netShortage > 0 && <p className="text-sm text-red-600">Недосдача: {viewingRev.birdSection.netShortage}</p>}
                      </div>
                    )}
                  </div>
                  {viewingRev.rawText && (
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-gray-500 font-semibold">📄 Исходный текст</summary>
                      <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-60 overflow-y-auto">{viewingRev.rawText}</pre>
                    </details>
                  )}
                </div>
              );
            }
            
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setRevMode('overview')} className="text-purple-600 text-sm font-semibold flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" /> Назад
                  </button>
                  <h3 className="font-bold">📜 История ревизий</h3>
                </div>
                {revHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-4xl mb-2">📋</p>
                    <p>Ревизий ещё не было</p>
                  </div>
                ) : revHistory.map(rev => (
                  <button key={rev.id} onClick={() => setViewingRev(rev)} className={`w-full text-left rounded-xl p-3 shadow ${darkMode ? "bg-gray-800" : "bg-white"} hover:shadow-md`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{new Date(rev.date).toLocaleDateString('ru-RU')}</p>
                        {rev.period && <p className="text-xs text-gray-400">{rev.period}</p>}
                      </div>
                      <div className="text-right text-xs">
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{rev.itemCount} поз.</span>
                        <p className="text-gray-400 mt-0.5">{rev.appliedBy}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            );
          }
          
          return null;
        })()}

        {/* ВКЛАДКА: Склад+ (история, списания, автозаказ) */}
        {adminTab === 'stockplus' && (stockTab === 'history' || stockTab === 'writeoff' || stockTab === 'autoorder' || stockTab === 'cost') && (
            <div className="space-y-4">

              {/* История движения */}
              {stockTab === 'history' && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3">📜 История движения товаров</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {stockHistory.slice(0, historyLimit).map(entry => (
                      <div key={entry.id} className={`flex justify-between items-center p-2 rounded ${entry.action === 'sale' ? 'bg-green-50' : entry.action === 'writeoff' ? 'bg-red-50' : entry.action === 'add' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                        <div>
                          <p className="font-medium text-sm">{entry.productName}</p>
                          <p className="text-xs text-gray-500">{entry.note || entry.action}</p>
                          <p className="text-xs text-gray-400">{new Date(entry.date).toLocaleString('ru-RU')}</p>
                        </div>
                        <span className={`font-bold ${entry.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.quantity > 0 ? '+' : ''}{entry.quantity}
                        </span>
                      </div>
                    ))}
                    {stockHistory.length === 0 && <p className="text-gray-400 text-center py-8">История пуста</p>}
                  </div>
                </div>
              )}

              {/* Списания */}
              {stockTab === 'writeoff' && (
                <div className="space-y-4">
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">➕ Списать товар</h3>
                    <div className="space-y-2">
                      <select value={newWriteOff.product} onChange={(e) => setNewWriteOff({...newWriteOff, product: e.target.value})} className="w-full p-2 border rounded">
                        <option value="">Выберите товар</option>
                        {Object.keys(stock).map(name => <option key={name} value={name}>{name} ({stock[name].count} шт)</option>)}
                      </select>
                      <input type="number" placeholder="Количество" value={newWriteOff.quantity} onChange={(e) => setNewWriteOff({...newWriteOff, quantity: e.target.value})} className="w-full p-2 border rounded" />
                      <select value={newWriteOff.reason} onChange={(e) => setNewWriteOff({...newWriteOff, reason: e.target.value})} className="w-full p-2 border rounded">
                        <option value="">Причина списания</option>
                        <option value="Брак">Брак</option>
                        <option value="Потеря">Потеря</option>
                        <option value="Подарок">Подарок</option>
                        <option value="Личное использование">Личное использование</option>
                        <option value="Другое">Другое</option>
                      </select>
                      <button onClick={() => {
                        if (newWriteOff.product && newWriteOff.quantity && newWriteOff.reason) {
                          addWriteOff(newWriteOff.product, parseInt(newWriteOff.quantity), newWriteOff.reason);
                          setNewWriteOff({ product: '', quantity: '', reason: '' });
                        }
                      }} className="w-full bg-red-500 text-white py-2 rounded font-medium">Списать</button>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">📋 История списаний</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {writeOffs.slice().reverse().slice(0, 20).map(w => (
                        <div key={w.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                          <div>
                            <p className="font-medium">{w.productName}</p>
                            <p className="text-xs text-gray-500">{w.reason} • {w.user}</p>
                            <p className="text-xs text-gray-400">{new Date(w.date).toLocaleDateString('ru-RU')}</p>
                          </div>
                          <span className="text-red-600 font-bold">-{w.quantity} шт</span>
                        </div>
                      ))}
                      {writeOffs.length === 0 && <p className="text-gray-400 text-center py-4">Нет списаний</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Автозаказ */}
              {stockTab === 'autoorder' && (
                <div className="space-y-4">
                  <button onClick={() => generateAutoOrder()} className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold">
                    🔄 Сформировать список для заказа
                  </button>
                  {autoOrderList.length > 0 && (
                    <>
                      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                        <h3 className="font-bold mb-3">📦 Список для заказа</h3>
                        <div className="space-y-2">
                          {autoOrderList.map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                              <input type="checkbox" checked={item.selected} onChange={() => {
                                const updated = [...autoOrderList];
                                updated[i].selected = !updated[i].selected;
                                updateAutoOrderList(updated);
                              }} className="w-5 h-5 accent-purple-500" />
                              <div className="flex-1">
                                <p className="font-medium">{item.productName}</p>
                                <p className="text-xs text-gray-500">Сейчас: {item.currentStock} / Мин: {item.minStock}</p>
                              </div>
                              <input type="number" value={item.toOrder} onChange={(e) => {
                                const updated = [...autoOrderList];
                                updated[i].toOrder = parseInt(e.target.value) || 0;
                                updateAutoOrderList(updated);
                              }} className="w-20 p-2 border rounded text-center" />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                        <h3 className="font-bold mb-3">📝 Текст для заказа</h3>
                        <textarea value={getAutoOrderText()} readOnly className="w-full p-3 border rounded-lg bg-gray-50 text-sm" rows={6} />
                        <button onClick={() => {
                          const orderText = getAutoOrderText(); navigator.clipboard.writeText(orderText); if (navigator.share) { try { navigator.share({ title: 'Автозаказ', text: orderText }); } catch { /* silent */ } }
                          showNotification('Скопировано в буфер обмена');
                        }} className="w-full mt-2 bg-green-500 text-white py-2 rounded font-medium">
                          📋 Копировать список
                        </button>
                      </div>
                    </>
                  )}
                  {autoOrderList.length === 0 && (
                    <div className="text-center py-10 bg-white rounded-xl shadow">
                      <Package className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500">Нажмите кнопку выше для формирования списка</p>
                    </div>
                  )}
                </div>
              )}

              {/* Себестоимость */}
              {stockTab === 'cost' && (
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
