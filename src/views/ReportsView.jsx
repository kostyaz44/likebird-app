import React, { useState, useMemo } from 'react';
import { Search, ArrowLeft, Trash2, X, ChevronLeft, ChevronRight, Settings, Calendar, Edit3 } from 'lucide-react';
import { parseYear } from '../utils/dates.js';
import { isBelowBasePrice } from '../utils/salary.js';
import { useApp } from '../context/AppContext';

// Inline-компонент: исправление нераспознанного товара (раньше жил в LikeBirdApp.jsx)
function FixUnrecognizedButton({ report }) {
  const { DYNAMIC_ALL_PRODUCTS, fixUnrecognizedReport } = useApp();
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
}

export default function ReportsView() {
  const { darkMode, deleteReport, getAllDates, getEffectiveSalary, getProductName, getReportsByDate, navigateDate, visibleReports, selectedDate, setCurrentView, setSelectedDate } = useApp();
  const reports = visibleReports; // фильтрация по городам уже применена в контексте

  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const dates = getAllDates();
  const idx = dates.indexOf(selectedDate);
  
  const uniqueEmployees = useMemo(() => [...new Set(reports.map(r => r.employee))], [reports]);
  const uniqueLocations = useMemo(() => [...new Set(reports.filter(r => r.location).map(r => r.location))], [reports]);
  
  // Фильтрация отчётов с useMemo
  const filteredReports = useMemo(() => {
    let baseReports;
    // Если фильтры по дате активны — фильтруем по диапазону дат, иначе по выбранной дате
    if (filterDateFrom || filterDateTo) {
      baseReports = reports.filter(r => {
        const [datePart] = (r.date||'').split(',');
        const [d, m, y] = datePart.trim().split('.');
        const reportDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
        if (filterDateFrom) {
          const from = new Date(filterDateFrom);
          if (reportDate < from) return false;
        }
        if (filterDateTo) {
          const to = new Date(filterDateTo);
          to.setHours(23, 59, 59);
          if (reportDate > to) return false;
        }
        return true;
      });
    } else {
      baseReports = getReportsByDate(selectedDate);
    }
    return baseReports.filter(r => {
      if (searchQuery && !getProductName(r.product).toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterEmployee && r.employee !== filterEmployee) return false;
      if (filterLocation && r.location !== filterLocation) return false;
      return true;
    });
  }, [reports, selectedDate, searchQuery, filterEmployee, filterLocation, filterDateFrom, filterDateTo]);
  
  const dateTotal = filteredReports.reduce((s, r) => s + r.total, 0);
  const dateTips = filteredReports.reduce((s, r) => s + (r.tips || 0), 0);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">📜 История продаж</h2>
        {/* Поиск */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
          <input type="text" placeholder="Поиск по товару..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-10 pr-10 py-2 rounded-xl text-gray-800 focus:outline-none" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-10 top-2.5 text-gray-400"><X className="w-5 h-5" /></button>}
          <button onClick={() => setShowFilters(!showFilters)} className={`absolute right-2 top-1.5 p-1 rounded ${showFilters ? 'bg-amber-600' : ''}`}>
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4">
        {/* Фильтры */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-2">
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="w-full p-2 border rounded">
              <option value="">Все сотрудники</option>
              {uniqueEmployees.map(emp => <option key={emp} value={emp}>{emp}</option>)}
            </select>
            {uniqueLocations.length > 0 && (
              <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="w-full p-2 border rounded">
                <option value="">Все точки</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 font-semibold">От даты</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full p-2 border rounded text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold">До даты</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full p-2 border rounded text-sm" />
              </div>
            </div>
            {(filterDateFrom || filterDateTo) && (
              <p className="text-xs text-blue-600 text-center font-medium">📅 Фильтр по диапазону дат активен</p>
            )}
            <button onClick={() => { setFilterEmployee(''); setFilterLocation(''); setSearchQuery(''); setFilterDateFrom(''); setFilterDateTo(''); }} className="w-full text-amber-600 text-sm">Сбросить фильтры</button>
          </div>
        )}
        
        <div className="bg-white rounded-xl shadow p-3 flex items-center justify-between mb-4">
          <button onClick={() => navigateDate('prev')} disabled={idx >= dates.length - 1} className={`p-2 rounded-lg ${idx >= dates.length - 1 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronLeft className="w-6 h-6" /></button>
          <div className="text-center"><p className="font-bold">{selectedDate}</p><p className="text-xs text-gray-400">{filteredReports.length} продаж • {filteredReports.reduce((s, r) => s + r.total, 0).toLocaleString()}₽</p></div>
          <button onClick={() => navigateDate('next')} disabled={idx <= 0} className={`p-2 rounded-lg ${idx <= 0 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronRight className="w-6 h-6" /></button>
        </div>
        {filteredReports.length > 0 ? (
          <div className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>{filteredReports.map(r => (
            <div key={r.id} className={`p-3 border-b last:border-0 ${r.isUnrecognized ? 'bg-red-50 border-l-4 border-l-red-500' : isBelowBasePrice(r.basePrice, r.salePrice) ? 'bg-yellow-50 border-l-4 border-l-yellow-500' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-sm truncate max-w-[200px]">{getProductName(r.product)}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <span className="truncate max-w-[100px] inline-block">{r.employee}</span>
                    <span>•</span>
                    <span>{r.paymentType === 'cashless' ? '💳' : '💵'}</span>
                    {r.quantity > 1 && <><span>•</span><span>{r.quantity} шт</span></>}
                    {r.date && r.date.includes(',') && (
                      <><span>•</span><span className="font-mono">🕐 {(r.date||'').split(',')[1]?.trim()?.slice(0,5)}</span></>
                    )}
                  </div>

                  {r.location && <p className="text-xs text-blue-500">📍 {r.location}</p>}
                  {r.photo && <img src={r.photo} alt="" className="w-8 h-8 rounded object-cover mt-1 inline-block" />}
                </div>
                <div className="flex items-center gap-2"><div className="text-right"><p className="font-bold text-green-600 text-sm">{r.total}₽{r.tips > 0 && <span className="text-amber-500 font-normal"> ({r.tips})</span>}</p><p className="text-xs text-amber-600">ЗП: {getEffectiveSalary(r)}₽</p></div><button onClick={() => deleteReport(r.id)} className="text-red-400 p-1 hover:text-red-600" aria-label="Удалить отчёт"><Trash2 className="w-4 h-4" /></button></div>
              </div>
              <FixUnrecognizedButton report={r} />
              {r.editHistory && r.editHistory.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 mt-1">
                  <p className="text-xs text-blue-700">✏️ Изменено {r.editHistory.length}x (посл.: {r.editHistory[r.editHistory.length-1].by}, {r.editHistory[r.editHistory.length-1].at})</p>
                </div>
              )}
              {r.addedBy && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 mt-1">
                  <p className="text-xs text-purple-700">👤 Добавлено: {r.addedBy}</p>
                </div>
              )}
              {isBelowBasePrice(r.basePrice, r.salePrice) && r.discountReason && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 mt-1">
                  <p className="text-xs text-yellow-700">💬 Причина скидки: {r.discountReason}</p>
                </div>
              )}
            </div>
          ))}</div>
        ) : (<div className="text-center py-10"><Calendar className="w-12 h-12 mx-auto text-gray-300 mb-2" /><p className="text-gray-400">{searchQuery || filterEmployee || filterLocation ? 'Ничего не найдено' : 'Нет записей за этот день'}</p></div>)}
      </div>
    </div>
  );
}
