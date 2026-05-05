import React, { useState } from 'react';
import { BarChart3, Plus, ArrowLeft, Trash2, X, AlertTriangle, AlertCircle, ChevronLeft, ChevronRight, Copy, Lock } from 'lucide-react';
import { CAT_ICONS } from '../data/products.js';
import { calculateSalary, isBelowBasePrice } from '../utils/salary.js';
import FixUnrecognizedButton from '../components/reports/FixUnrecognizedButton.jsx';
import SalaryDecisionButtons from '../components/reports/SalaryDecisionButtons.jsx';
import { useApp } from '../context/AppContext';

export default function DayReportView() {
  const { DYNAMIC_ALL_PRODUCTS, addExpense, archivedProducts, copyDayReport, currentUser, deleteExpense, deleteReport, employeeName, employees, expenseModal, getAllDates, getEffectiveSalary, getExpensesByDate, getGivenToAdmin, getOwnCard, getProductName, getReportsByDate, isAdminUnlocked, locations, navigateDate, salarySettings, saveReport, selectedDate, setCurrentView, setExpenseModal, shiftsData, showNotification, updateGivenToAdmin, updateOwnCard, updateShiftsData } = useApp();

  const dates = getAllDates();
  const dateReports = getReportsByDate(selectedDate);
  const dateExpenses = getExpensesByDate(selectedDate);
  const idx = dates.indexOf(selectedDate);
  const byEmployee = dateReports.reduce((acc, r) => { if (!acc[r.employee]) acc[r.employee] = []; acc[r.employee].push(r); return acc; }, {});
  const expByEmp = dateExpenses.reduce((acc, e) => { if (!acc[e.employee]) acc[e.employee] = []; acc[e.employee].push(e); return acc; }, {});
  const dayTotal = dateReports.reduce((s, r) => s + r.total, 0);
  const dayCash = dateReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
  const dayCashless = dateReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
  const dayTips = dateReports.reduce((s, r) => s + (r.tips || 0), 0);
  const daySalary = dateReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
  const dayExpenses = dateExpenses.reduce((s, e) => s + e.amount, 0);
  
  // Редактирование смены
  const [editingShift, setEditingShift] = useState(null); // login сотрудника
  const [editOpen, setEditOpen] = useState('');
  const [editClose, setEditClose] = useState('');
  
  // Админ: добавление продажи за сотрудника
  const [adminReport, setAdminReport] = useState(null); // { employee: string } или null
  const [arProduct, setArProduct] = useState(null);
  const [arPrice, setArPrice] = useState('');
  const [arTips, setArTips] = useState('0');
  const [arPayment, setArPayment] = useState('cash');
  const [arQty, setArQty] = useState(1);
  const [arSearch, setArSearch] = useState('');
  const [arLocation, setArLocation] = useState('');
  const [arDiscount, setArDiscount] = useState('');
  
  const activeEmployeesList = employees.filter(e => e.active);
  
  const adminSaveReport = () => {
    if (!adminReport?.employee) { showNotification('Выберите сотрудника', 'error'); return; }
    if (!arProduct) { showNotification('Выберите товар', 'error'); return; }
    const price = parseInt(arPrice, 10);
    if (!price || price <= 0) { showNotification('Введите цену', 'error'); return; }
    // Формируем дату: если выбрана дата не сегодня, используем её
    const today = new Date().toLocaleDateString('ru-RU');
    const customDate = selectedDate !== today ? (selectedDate + ', ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) : null;
    saveReport({
      employeeName: adminReport.employee,
      selectedProduct: arProduct,
      selectedCategory: arProduct.category,
      salePrice: price,
      tipsAmount: parseInt(arTips, 10) || 0,
      paymentType: arPayment,
      quantity: arQty,
      location: arLocation || null,
      discountReason: arDiscount || null,
      photo: null,
      customDate: customDate,
      noRedirect: true,
      addedBy: employeeName || 'Админ',
    });
    showNotification(`Продажа ${arProduct.name} добавлена за ${adminReport.employee}`);
    setAdminReport(null); setArProduct(null); setArPrice(''); setArTips('0');
    setArPayment('cash'); setArQty(1); setArSearch(''); setArDiscount('');
  };
  
  const AdminReportModal = () => {
    if (!adminReport) return null;
    const filteredProds = arSearch.length >= 1
      ? DYNAMIC_ALL_PRODUCTS.filter(p => !(archivedProducts||[]).includes(p.name))
          .filter(p => p.name.toLowerCase().includes(arSearch.toLowerCase()) || p.aliases?.some(a => a.includes(arSearch.toLowerCase())))
          .slice(0, 8)
      : [];
    const isBelowBase = arProduct && arPrice && parseInt(arPrice, 10) < arProduct.price;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdminReport(null)}>
        <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">📝 Продажа за сотрудника</h3>
            <button onClick={() => setAdminReport(null)} className="text-gray-400" aria-label="Закрыть"><X className="w-5 h-5" /></button>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Сотрудник</label>
              <select value={adminReport.employee} onChange={e => setAdminReport({ employee: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                <option value="">— Выберите —</option>
                {activeEmployeesList.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Товар</label>
              {arProduct ? (
                <div className="flex items-center justify-between p-2.5 bg-amber-50 border-2 border-amber-200 rounded-xl">
                  <span>{arProduct.emoji} {arProduct.name} — {arProduct.price}₽</span>
                  <button onClick={() => { setArProduct(null); setArPrice(''); setArSearch(''); }} className="text-gray-400"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div>
                  <input type="text" value={arSearch} onChange={e => setArSearch(e.target.value)} placeholder="Поиск товара..." className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                  {filteredProds.length > 0 && (
                    <div className="mt-1 border rounded-xl max-h-40 overflow-y-auto">
                      {filteredProds.map(p => (
                        <button key={p.name} onClick={() => { setArProduct(p); setArPrice(String(p.price)); setArSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm flex justify-between border-b last:border-0">
                          <span>{p.emoji} {p.name}</span>
                          <span className="text-amber-600 font-semibold">{p.price}₽</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Цена продажи</label>
                <input type="number" value={arPrice} onChange={e => setArPrice(e.target.value)} className={`w-full p-2.5 border-2 rounded-xl focus:outline-none ${isBelowBase ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 focus:border-amber-500'}`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Чаевые</label>
                <input type="number" value={arTips} onChange={e => setArTips(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
              </div>
            </div>
            
            {isBelowBase && (
              <input type="text" value={arDiscount} onChange={e => setArDiscount(e.target.value)} placeholder="Причина скидки" maxLength={200} className="w-full p-2.5 border-2 border-yellow-300 rounded-xl bg-yellow-50 focus:outline-none" />
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Оплата</label>
                <select value={arPayment} onChange={e => setArPayment(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                  <option value="cash">💵 Наличные</option>
                  <option value="cashless">💳 Безнал</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Кол-во</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setArQty(Math.max(1, arQty - 1))} className="w-10 h-10 bg-gray-100 rounded-xl font-bold text-lg">−</button>
                  <span className="font-bold text-lg flex-1 text-center">{arQty}</span>
                  <button onClick={() => setArQty(arQty + 1)} className="w-10 h-10 bg-gray-100 rounded-xl font-bold text-lg">+</button>
                </div>
              </div>
            </div>
            
            {locations.filter(l => l.active).length > 1 && (
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Точка продаж</label>
                <select value={arLocation} onChange={e => setArLocation(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                  <option value="">— Не указана —</option>
                  {locations.filter(l => l.active).map(l => <option key={l.id} value={`${l.city} — ${l.name}`}>{l.city} — {l.name}</option>)}
                </select>
              </div>
            )}
            
            {arProduct && arPrice && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">ЗП сотрудника:</span><span className="font-bold text-amber-600">{calculateSalary(arProduct.price, parseInt(arPrice,10), arProduct.category, parseInt(arTips,10)||0, 'normal', salarySettings)}₽</span></div>
                {arQty > 1 && <div className="flex justify-between"><span className="text-gray-500">Итого ({arQty} шт):</span><span className="font-bold">{parseInt(arPrice,10) * arQty}₽</span></div>}
              </div>
            )}
            
            <button onClick={adminSaveReport} disabled={!adminReport.employee || !arProduct || !arPrice} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              ✅ Сохранить продажу
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Получить login сотрудника по имени
  const getLoginByName = (empName) => {
    try {
      const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      const u = users.find(u => (u.name || u.login) === empName);
      return u?.login || empName;
    } catch { return empName; }
  };
  
  // Получить данные смены сотрудника за выбранную дату
  const getEmployeeShift = (empName) => {
    const login = getLoginByName(empName);
    const key = `${login}_${selectedDate}`;
    return { shift: shiftsData[key] || null, key, login };
  };
  
  // Округление минут до четверти часа (0, 0.25, 0.5, 0.75)
  const roundMinutesToQuarter = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return h + Math.floor(m / 15) * 0.25;
  };
  
  // Форматировать округлённые часы
  const formatRoundedHours = (roundedHours) => {
    if (roundedHours <= 0) return '—';
    if (Number.isInteger(roundedHours)) return `${roundedHours} ч`;
    return `${roundedHours.toFixed(2).replace(/0$/, '')} ч`;
  };
  
  // Посчитать минуты смены
  // Посчитать минуты смены (с поддержкой ночных смен через полночь)
  const getShiftMinutes = (shift) => {
    if (!shift?.openTime || !shift?.closeTime) return 0;
    const [oh, om] = shift.openTime.split(':').map(Number);
    const [ch, cm] = shift.closeTime.split(':').map(Number);
    let mins = (ch * 60 + cm) - (oh * 60 + om);
    if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
    return mins;
  };
  
  // Сохранить отредактированное время смены
  const saveShiftEdit = (empName) => {
    // Валидация
    const openVal = editOpen.trim();
    const closeVal = editClose.trim();
    if (!openVal) { showNotification('Укажите время начала смены', 'error'); return; }
    if (closeVal) {
      // Проверка формата HH:MM
      const timeRe = /^\d{1,2}:\d{2}$/;
      if (!timeRe.test(openVal) || !timeRe.test(closeVal)) { showNotification('Неверный формат времени', 'error'); return; }
    }
    const { key } = getEmployeeShift(empName);
    const existing = shiftsData[key] || {};
    const updated = { 
      ...shiftsData, 
      [key]: { 
        ...existing,
        openTime: openVal, 
        closeTime: closeVal || undefined, 
        status: closeVal ? 'closed' : 'open',
        openedAt: existing.openedAt || Date.now(),
        closedAt: closeVal ? (existing.closedAt || Date.now()) : undefined,
        editedInDayReport: true
      } 
    };
    updateShiftsData(updated);
    setEditingShift(null);
    showNotification('Время смены обновлено');
  };
  
  // Проверка можно ли редактировать (20 минут = 1200000 мс)
  // Администраторы могут редактировать без ограничений
  const EDIT_TIME_LIMIT = 20 * 60 * 1000;
  const isAdminUser = isAdminUnlocked || currentUser?.role === 'admin' || currentUser?.isAdmin;
  const canEdit = (report) => {
    if (isAdminUser) return true; // Админ может редактировать всегда
    if (!report.createdAt) return true;
    return Date.now() - report.createdAt < EDIT_TIME_LIMIT;
  };
  
  const getRemainingTime = (report) => {
    if (!report.createdAt) return null;
    const remaining = EDIT_TIME_LIMIT - (Date.now() - report.createdAt);
    if (remaining <= 0) return null;
    const mins = Math.ceil(remaining / 60000);
    return mins;
  };
  
  // Статус проверки для группы отчётов
  const getReviewStatus = (empReports) => {
    const statuses = empReports.map(r => r.reviewStatus || 'pending');
    if (statuses.every(s => s === 'approved')) return 'approved';
    if (statuses.some(s => s === 'rejected')) return 'rejected';
    if (statuses.some(s => s === 'revision')) return 'revision';
    return 'pending';
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 pt-safe sticky top-0 z-10" style={{paddingTop: "max(1rem, env(safe-area-inset-top))"}}>
        <button onClick={() => setCurrentView('menu')} className="mb-2 mt-1 block"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">📊 Итог дня</h2>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 pb-8" style={{scrollMarginTop:"80px"}}>
        <div className="bg-white rounded-xl shadow p-3 flex items-center justify-between mb-4">
          <button onClick={() => navigateDate('prev')} disabled={idx >= dates.length - 1} className={`p-2 rounded-lg ${idx >= dates.length - 1 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronLeft className="w-6 h-6" /></button>
          <div className="text-center"><p className="font-bold">{selectedDate}</p><p className="text-xs text-gray-400">{dateReports.length} продаж</p></div>
          <button onClick={() => navigateDate('next')} disabled={idx <= 0} className={`p-2 rounded-lg ${idx <= 0 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronRight className="w-6 h-6" /></button>
        </div>
        {dateReports.length > 0 && (<div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-4 mb-4 shadow-lg"><h3 className="font-bold mb-2">📈 Общий итог</h3><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="opacity-75">Выручка:</span> <span className="font-bold">{dayTotal.toLocaleString()}₽</span></div><div><span className="opacity-75">Наличные:</span> <span className="font-bold">{dayCash.toLocaleString()}₽</span></div><div><span className="opacity-75">Безнал:</span> <span className="font-bold">{dayCashless.toLocaleString()}₽</span></div><div><span className="opacity-75">Чаевые:</span> <span className="font-bold">{dayTips.toLocaleString()}₽</span></div><div><span className="opacity-75">ЗП:</span> <span className="font-bold">{daySalary.toLocaleString()}₽</span></div><div><span className="opacity-75">Расходы:</span> <span className="font-bold">{dayExpenses.toLocaleString()}₽</span></div></div></div>)}
      </div>
      <div className="max-w-md mx-auto px-4 pb-6 space-y-4">
        {Object.entries(byEmployee).map(([emp, empReports]) => {
          const unrec = empReports.filter(r => r.isUnrecognized);
          const belowPrice = empReports.filter(r => !r.isUnrecognized && isBelowBasePrice(r.basePrice, r.salePrice));
          const cashTotal = empReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
          const cashlessTotal = empReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
          const totalTips = empReports.reduce((s, r) => s + (r.tips || 0), 0);
          const totalSalary = empReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
          const empExpenses = (expByEmp[emp] || []).reduce((s, e) => s + e.amount, 0);
          const expensesList = expByEmp[emp] || [];
          const given = getGivenToAdmin(emp);
          const grandTotal = cashTotal + cashlessTotal;
          const ownCard = getOwnCard(emp, selectedDate);
          const toGive = ownCard ? (cashTotal + cashlessTotal + totalTips - totalSalary - empExpenses - given) : (cashTotal + totalTips - totalSalary - empExpenses - given);
          const byCat = empReports.filter(r => !r.isUnrecognized).reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + (r.quantity || 1); return acc; }, {});
          const reviewStatus = getReviewStatus(empReports);
          const anyEditable = empReports.some(r => canEdit(r));
          
          return (
            <div key={emp} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{emp}</h3>
                      {reviewStatus === 'approved' && <span className="bg-green-400 text-white px-2 py-0.5 rounded text-xs">✓ Проверен</span>}
                      {reviewStatus === 'rejected' && <span className="bg-red-400 text-white px-2 py-0.5 rounded text-xs">✗ Ошибки</span>}
                      {reviewStatus === 'revision' && <span className="bg-orange-300 text-white px-2 py-0.5 rounded text-xs">↻ Доработать</span>}
                    </div>
                    <p className="text-white/80 text-xs">{empReports.length} продаж{Object.entries(byCat).map(([cat, cnt]) => (<span key={cat} className="ml-2">{CAT_ICONS[cat]}{cnt}</span>))}</p>
                  </div>
                  <button onClick={() => copyDayReport(emp, empReports, { cashTotal, cashlessTotal, totalTips, totalSalary, empExpenses, toGive })} className="bg-white/20 p-1.5 rounded hover:bg-white/30" title="Скопировать"><Copy className="w-4 h-4" /></button>
                  {isAdminUser && <button onClick={() => setAdminReport({ employee: emp })} className="bg-white/20 p-1.5 rounded hover:bg-white/30" title="Добавить продажу"><Plus className="w-4 h-4" /></button>}
                </div>
              </div>
              <div className="p-3 space-y-3">
                {/* Время смены */}
                {(() => {
                  const { shift, login } = getEmployeeShift(emp);
                  const mins = getShiftMinutes(shift);
                  const roundedHours = roundMinutesToQuarter(mins);
                  const salesCount = empReports.length;
                  const speed = roundedHours > 0 ? parseFloat((salesCount / roundedHours).toFixed(2)) : 0;
                  const isEditing = editingShift === login;
                  
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-blue-700">⏱️ Время работы</span>
                        {!isEditing && (
                          <button onClick={() => {
                            setEditingShift(login);
                            setEditOpen(shift?.openTime || '');
                            setEditClose(shift?.closeTime || '');
                          }} className="text-xs text-blue-500 hover:text-blue-700 underline">
                            {shift?.openTime ? 'изменить' : 'указать'}
                          </button>
                        )}
                      </div>
                      
                      {isEditing ? (
                        <div className="space-y-2 mt-2">
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-gray-500 w-16">Начало:</label>
                            <input type="time" value={editOpen} onChange={e => setEditOpen(e.target.value)}
                              className="flex-1 p-2 border-2 border-blue-300 rounded-lg text-sm font-bold focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-gray-500 w-16">Конец:</label>
                            <input type="time" value={editClose} onChange={e => setEditClose(e.target.value)}
                              className="flex-1 p-2 border-2 border-blue-300 rounded-lg text-sm font-bold focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingShift(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold">Отмена</button>
                            <button onClick={() => saveShiftEdit(emp)} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold">Сохранить</button>
                          </div>
                        </div>
                      ) : shift?.openTime ? (
                        <div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-lg font-black text-blue-800">
                              {shift.openTime} → {shift.closeTime || <span className="text-green-500 animate-pulse text-sm">работает</span>}
                            </span>
                          </div>
                          <div className="flex gap-4 mt-1.5 text-xs text-blue-600">
                            {mins > 0 && <span className="bg-blue-100 px-2 py-0.5 rounded-full font-semibold">{formatRoundedHours(roundedHours)}</span>}
                            {speed > 0 && <span className="bg-indigo-100 px-2 py-0.5 rounded-full font-semibold">🚀 {speed} прод/ч</span>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-400 mt-1">Смена не зафиксирована</p>
                      )}
                    </div>
                  );
                })()}
                {/* Предупреждение о времени редактирования */}
                {anyEditable && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                    ⏱️ Редактирование доступно {getRemainingTime(empReports[0]) || 20} мин. после создания
                  </div>
                )}
                
                {unrec.length > 0 && (<div className="bg-red-50 border border-red-200 rounded-lg p-2"><h4 className="font-bold text-red-700 text-xs mb-1"><AlertTriangle className="w-3 h-3 inline" /> Нераспознанные ({unrec.length})</h4>{unrec.map(r => (<div key={r.id} className="py-1 border-b border-red-200 last:border-0"><div className="flex justify-between items-center text-xs"><span className="text-red-600">❓ {getProductName(r.product)}</span><div className="flex items-center gap-1"><span>{r.total}₽</span>{canEdit(r) ? (<button onClick={() => deleteReport(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>) : (<Lock className="w-3 h-3 text-gray-400" />)}</div></div><FixUnrecognizedButton report={r} /></div>))}</div>)}
                {belowPrice.length > 0 && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2"><h4 className="font-bold text-yellow-700 text-xs mb-1"><AlertCircle className="w-3 h-3 inline" /> Со скидкой ({belowPrice.length})</h4>{belowPrice.map(r => (<div key={r.id} className="py-1 border-b border-yellow-200 last:border-0"><div className="flex justify-between items-center text-xs"><span>{getProductName(r.product)}</span><span>{r.total}₽ <span className="text-gray-400">(база: {r.basePrice}₽)</span></span></div>{r.discountReason && <p className="text-xs text-yellow-600 mt-0.5">💬 {r.discountReason}</p>}{isAdminUser && <SalaryDecisionButtons report={r} compact />}</div>))}</div>)}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between py-1 border-b"><span>💰 Итого</span><span className="font-bold">{grandTotal.toLocaleString()}{totalTips > 0 && <span className="text-amber-500"> ({(grandTotal+totalTips).toLocaleString()})</span>}₽</span></div>
                  <div className="flex justify-between py-1 border-b"><span>💵 Наличные</span><span className="font-bold text-green-600">{cashTotal.toLocaleString()}₽</span></div>
                  <div className="flex justify-between py-1 border-b"><span>💳 Безнал</span><span className="font-bold text-blue-600">{cashlessTotal.toLocaleString()}₽</span></div>
                  <div className="flex justify-between py-1 border-b"><span>🎁 Чаевые</span><span className="font-bold text-amber-600">{totalTips.toLocaleString()}₽</span></div>
                  <div className="flex justify-between py-1 border-b"><span>👛 ЗП</span><span className="font-bold text-amber-600">{totalSalary.toLocaleString()}₽</span></div>
                  {expensesList.length > 0 && (<div className="py-1 border-b"><div className="flex justify-between"><span>📝 Расходы</span><span className="font-bold text-red-600">-{empExpenses}₽</span></div><div className="text-xs text-gray-500 mt-1">{expensesList.map((e) => (<div key={e.id} className="flex justify-between items-center"><span>{e.description}</span><button onClick={() => deleteExpense(e.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button></div>))}</div></div>)}
                  <div className="flex justify-between items-center py-1 border-b"><span>📝 Добавить расход</span><button onClick={() => addExpense(emp)} className="text-amber-600 text-xs bg-amber-100 px-2 py-1 rounded hover:bg-amber-200">+ Добавить</button></div>
                  <div className="flex justify-between items-center py-1 border-b"><span>💸 Уже отдано</span><input type="number" defaultValue={given || ''} onBlur={(e) => updateGivenToAdmin(emp, parseInt(e.target.value) || 0)} className="w-24 p-1 border rounded text-right text-sm font-bold focus:border-amber-500 focus:outline-none" placeholder="0" /></div>
                  <div className="flex items-center py-1 border-b"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ownCard} onChange={(e) => updateOwnCard(emp, selectedDate, e.target.checked)} className="w-4 h-4 accent-amber-500" /><span className="text-sm">💳 Переводы на свою карту</span></label></div>
                </div>
                <div className={`rounded-lg p-3 text-white ${toGive >= 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}>
                  <p className="text-xs opacity-90">💼 К выдаче</p>
                  <p className="text-2xl font-bold">{toGive.toLocaleString()}₽</p>
                  <p className="text-xs opacity-80 mt-1">{ownCard ? `(${cashTotal}+${cashlessTotal}+${totalTips})-${totalSalary}-${empExpenses}-${given}` : `(${cashTotal}+${totalTips})-${totalSalary}-${empExpenses}-${given}`}</p>
                  {!ownCard && cashlessTotal > 0 && <p className="text-xs opacity-80">💳 Безнал {cashlessTotal}₽ на карте компании</p>}
                </div>
                <details className="group"><summary className="cursor-pointer text-amber-600 font-semibold text-sm flex items-center gap-1"><ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />Все продажи ({empReports.length})</summary><div className="mt-2 space-y-1 max-h-64 overflow-y-auto">{empReports.map(r => { const isDiscount = isBelowBasePrice(r.basePrice, r.salePrice); return (<div key={r.id} className={`py-1.5 text-xs px-2 rounded ${isDiscount ? 'bg-yellow-50 border border-yellow-200' : r.isUnrecognized ? 'bg-red-50' : 'bg-gray-50'}`}><div className="flex justify-between items-center"><span className="truncate flex-1">{r.isUnrecognized ? '❓ ' : ''}{getProductName(r.product)}{isDiscount && ' ⚠️'}</span><div className="flex items-center gap-1 ml-2"><span>{r.total}₽ {r.paymentType === 'cashless' ? '💳' : '💵'}</span><span className="text-amber-600">ЗП:{getEffectiveSalary(r)}</span>{canEdit(r) ? (<button onClick={() => deleteReport(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>) : (<Lock className="w-3 h-3 text-gray-400" title="Заблокировано" />)}</div></div>{isDiscount && <p className="text-yellow-600 mt-0.5">Скидка: {r.basePrice - r.salePrice}₽{r.discountReason ? ` — ${r.discountReason}` : ''}</p>}{r.addedBy && <p className="text-purple-500 mt-0.5">👤 {r.addedBy}</p>}</div>); })}</div></details>
              </div>
            </div>
          );
        })}
        {Object.keys(byEmployee).length === 0 && (<div className="text-center py-10"><BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-2" /><p className="text-gray-400">Нет продаж за этот день</p></div>)}
        
        {isAdminUser && (
          <button onClick={() => setAdminReport({ employee: '' })} className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg">
            <Plus className="w-5 h-5" /> Добавить продажу за сотрудника
          </button>
        )}
      </div>
      <AdminReportModal />
    </div>
  );
}
