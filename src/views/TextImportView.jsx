import React, { useState } from 'react';
import { ArrowLeft, X, AlertTriangle, Check, Edit3, Clock, RotateCcw } from 'lucide-react';
import { CAT_ICONS } from '../data/products.js';
import { findProductByPrice } from '../utils/parser.js';
import { calculateSalary } from '../utils/salary.js';
import { useApp } from '../context/AppContext';

export default function TextImportView() {
  const { CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS, calculatedTotals, customAliases, darkMode, employeeName, handleParseText, inventoryDiscrepancies, parsedExpenses, parsedInventory, parsedSales, parsedWorkTime, salarySettings, saveAlias, saveParsedReports, setCalculatedTotals, setCurrentView, setInventoryDiscrepancies, setParsedExpenses, setParsedInventory, setParsedSales, setParsedWorkTime, setTextReport, setUnrecognizedSales, showNotification, textReport, unrecognizedSales } = useApp();

  const [localText, setLocalText] = useState(textReport || '');
  const [ownCardImport, setOwnCardImport] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [localName, setLocalName] = useState(() => employeeName || ''); // Локальное состояние для имени
  const [teachingIdx, setTeachingIdx] = useState(null); // Индекс нераспознанной позиции для обучения
  const [teachAlias, setTeachAlias] = useState('');
  const [teachProduct, setTeachProduct] = useState('');
  const [teachSuggestions, setTeachSuggestions] = useState([]);
  const fmt = (base, withTips) => withTips > base ? `${base.toLocaleString()}(${withTips.toLocaleString()})` : base.toLocaleString();
  const handleSearch = (value) => { setEditName(value); if (value.length >= 2) setSuggestions(DYNAMIC_ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(value.toLowerCase()) || p.aliases.some(a => a.includes(value.toLowerCase()))).slice(0, 5)); else setSuggestions([]); };
  const handleTeachSearch = (value) => { setTeachProduct(value); if (value.length >= 2) setTeachSuggestions(DYNAMIC_ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(value.toLowerCase()) || p.aliases.some(a => a.includes(value.toLowerCase()))).slice(0, 5)); else setTeachSuggestions([]); };
  const saveTeachAlias = (alias, productName) => {
    if (!alias.trim() || !productName) { showNotification('Заполните алиас и товар', 'error'); return; }
    const updated = { ...customAliases, [alias.toLowerCase().trim()]: productName };
    setCustomAliases(updated);
    localStorage.setItem('likebird-custom-aliases', JSON.stringify(updated));
    CUSTOM_ALIASES = updated; // Обновляем глобальную переменную для parseTextReport
    showNotification(`Алиас «${alias}» → ${productName} сохранён`);
    setTeachingIdx(null); setTeachAlias(''); setTeachProduct(''); setTeachSuggestions([]);
  };
  const fixUnrecognizedInImport = (idx, newName) => {
    const sale = unrecognizedSales[idx];
    const product = findProductByPrice(newName, sale.price, CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS);
    if (!product) { showNotification('Товар не найден', 'error'); return false; }
    const salary = calculateSalary(product.price, sale.price, product.category, sale.tips || 0, 'normal', salarySettings);
    const fixedSale = { ...sale, product, category: product.category, isUnrecognized: false, salary };
    setUnrecognizedSales(prev => prev.filter((_, i) => i !== idx));
    setParsedSales(prev => [...prev, fixedSale]);
    recalculateTotals([...parsedSales, fixedSale], unrecognizedSales.filter((_, i) => i !== idx));
    setEditingIdx(null); setEditName(''); setSuggestions([]);
    showNotification('Товар исправлен');
    return true;
  };
  const recalculateTotals = (recognized, unrecognized) => {
    const allSales = [...recognized, ...unrecognized];
    
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
    const totalExpenses = parsedExpenses.reduce((s, e) => s + e.amount, 0);
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
  };
  const calcToGive = () => { 
    if (!calculatedTotals) return 0; 
    // Если на свою карту - отдаём всё (нал + безнал с чаевыми) минус ЗП и расходы
    // Если не на свою карту - отдаём только наличные с чаевыми минус ЗП и расходы (безнал остаётся на карте компании)
    return ownCardImport 
      ? calculatedTotals.cash + calculatedTotals.cashless - calculatedTotals.salary - calculatedTotals.expenses 
      : calculatedTotals.cash - calculatedTotals.salary - calculatedTotals.expenses; 
  };
  const clearImport = () => { setLocalText(''); setTextReport(''); setParsedSales([]); setUnrecognizedSales([]); setParsedWorkTime(null); setCalculatedTotals(null); setParsedExpenses([]); setParsedInventory({ start: {}, end: {} }); setInventoryDiscrepancies([]); };
  
  const handleParse = () => {
    if (!localText.trim()) {
      showNotification('Введите текст отчёта', 'error');
      return;
    }
    setTextReport(localText);
    // Передаём текст напрямую в handleParseText
    handleParseText(localText);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => { clearImport(); setCurrentView('menu'); }} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">📝 Импорт отчёта</h2>
      </div>
      <div className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <label className="block text-sm font-semibold mb-2">Имя сотрудника</label>
          <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="Введите имя" className="w-full p-3 border-2 rounded-lg focus:border-amber-500 focus:outline-none" />
        </div>
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <label className="block text-sm font-semibold mb-2">Текст отчёта</label>
          <textarea 
            value={localText} 
            onChange={(e) => setLocalText(e.target.value)} 
            placeholder={"Открылась 11:00\nснегирь 5\nрусский 3\n\n1) русский 400р (100) нал\n2) снегирь 600 п\n\nрасход аренда 500\n\nЗакрыла 20:00\nснегирь 4\nрусский 3"} 
            className="w-full p-3 border-2 rounded-lg font-mono text-sm focus:border-amber-500 focus:outline-none" 
            rows={12} 
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleParse} className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 rounded-lg font-bold hover:shadow-lg">🔍 Распознать</button>
            {(parsedSales.length > 0 || unrecognizedSales.length > 0) && <button onClick={clearImport} className="px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"><RotateCcw className="w-5 h-5" /></button>}
          </div>
        </div>
        {parsedWorkTime && (parsedWorkTime.openTime || parsedWorkTime.closeTime) && (<div className="bg-blue-50 rounded-xl p-3 border border-blue-200 flex items-center gap-2 text-blue-700"><Clock className="w-5 h-5" /><span className="font-medium">{parsedWorkTime.openTime || '?'} — {parsedWorkTime.closeTime || '?'}</span>{parsedWorkTime.workHours && <span className="bg-blue-200 px-2 py-0.5 rounded font-semibold">{parsedWorkTime.workHours.toFixed(1)}ч</span>}</div>)}
        {calculatedTotals && (<>
          <div className="bg-white rounded-xl p-4 shadow space-y-2">
            <h3 className="font-bold text-lg mb-2">📊 Итоги ({calculatedTotals.count} продаж)</h3>
            {Object.entries(calculatedTotals.byCategory || {}).length > 0 && <div className="flex gap-2 mb-3">{Object.entries(calculatedTotals.byCategory).map(([cat, cnt]) => (<span key={cat} className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-sm">{CAT_ICONS[cat]} {cnt}</span>))}</div>}
            <div className="flex justify-between py-1 border-b"><span>💰 Итого</span><span className="font-bold">{fmt(calculatedTotals.total, calculatedTotals.totalWithTips)}₽</span></div>
            <div className="flex justify-between py-1 border-b">
              <span>💵 Наличные</span>
              <span className="font-bold text-green-600">
                {calculatedTotals.baseCash?.toLocaleString() || calculatedTotals.cash.toLocaleString()}
                {calculatedTotals.tipsCash > 0 && <span className="text-amber-600 ml-1">(+{calculatedTotals.tipsCash})</span>}
                ₽
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>💳 Безнал</span>
              <span className="font-bold text-blue-600">
                {calculatedTotals.baseCashless?.toLocaleString() || calculatedTotals.cashless.toLocaleString()}
                {calculatedTotals.tipsCashless > 0 && <span className="text-amber-600 ml-1">(+{calculatedTotals.tipsCashless})</span>}
                ₽
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span>🎁 Чаевые всего</span>
              <span className="font-bold text-amber-600">
                {calculatedTotals.tips}₽
                {(calculatedTotals.tipsCash > 0 || calculatedTotals.tipsCashless > 0) && 
                  <span className="text-xs text-gray-500 ml-1">
                    (💵{calculatedTotals.tipsCash || 0} + 💳{calculatedTotals.tipsCashless || 0})
                  </span>
                }
              </span>
            </div>
            <div className="flex justify-between py-1 border-b"><span>👛 ЗП</span><span className="font-bold text-amber-600">{calculatedTotals.salary.toLocaleString()}₽</span></div>
            {calculatedTotals.expenses > 0 && <div className="flex justify-between py-1 border-b"><span>📝 Расходы</span><span className="font-bold text-red-600">-{calculatedTotals.expenses}₽</span></div>}
            <div className="flex items-center py-2 border-b"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ownCardImport} onChange={(e) => setOwnCardImport(e.target.checked)} className="w-5 h-5 accent-amber-500" /><span className="text-sm font-medium">💳 Переводы на свою карту</span></label></div>
            <div className={`flex justify-between py-3 rounded-lg px-3 mt-2 ${calcToGive() >= 0 ? 'bg-green-100' : 'bg-red-100'}`}><span className="font-bold">💼 Отдаю</span><span className={`font-bold text-lg ${calcToGive() >= 0 ? 'text-green-700' : 'text-red-700'}`}>{calcToGive().toLocaleString()}₽</span></div>
            {!ownCardImport && calculatedTotals.cashless > 0 && <p className="text-xs text-gray-500 text-center">💳 Безнал {calculatedTotals.baseCashless || calculatedTotals.cashless}₽{calculatedTotals.tipsCashless > 0 && ` (+${calculatedTotals.tipsCashless}₽ чай)`} остаётся на карте компании</p>}
          </div>
          {parsedExpenses.length > 0 && (<div className="bg-red-50 rounded-xl p-3 border border-red-200"><h4 className="font-bold text-red-700 text-sm mb-2">📝 Расходы ({parsedExpenses.length})</h4>{parsedExpenses.map((e, i) => (<div key={i} className="flex justify-between text-sm py-1"><span>{e.description}</span><span className="font-bold text-red-600">{e.amount}₽</span></div>))}</div>)}
          {calculatedTotals.soldByProduct && Object.keys(calculatedTotals.soldByProduct).length > 0 && (<div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200"><h4 className="font-bold text-cyan-700 mb-3">📦 Продано по отчёту</h4><div className="grid grid-cols-2 gap-2">{Object.entries(calculatedTotals.soldByProduct).map(([name, count]) => { const product = DYNAMIC_ALL_PRODUCTS.find(p => p.name === name); return (<div key={name} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 text-sm"><span>{product?.emoji || '📦'} {name}</span><span className="font-bold text-cyan-600">{count} шт</span></div>); })}</div></div>)}
          {(Object.keys(parsedInventory.start).length > 0 || Object.keys(parsedInventory.end).length > 0) && (<div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200"><h4 className="font-bold text-indigo-700 mb-3">📋 Пересчёт товара</h4><div className="grid grid-cols-2 gap-4">{Object.keys(parsedInventory.start).length > 0 && (<div><p className="text-xs font-semibold text-indigo-600 mb-2">🌅 Начало смены</p>{Object.entries(parsedInventory.start).map(([name, count]) => { const product = DYNAMIC_ALL_PRODUCTS.find(p => p.name === name); return (<div key={name} className="flex justify-between text-xs bg-white rounded px-2 py-1 mb-1"><span>{product?.emoji} {name}</span><span className="font-bold">{count}</span></div>); })}</div>)}{Object.keys(parsedInventory.end).length > 0 && (<div><p className="text-xs font-semibold text-indigo-600 mb-2">🌙 Конец смены</p>{Object.entries(parsedInventory.end).map(([name, count]) => { const product = DYNAMIC_ALL_PRODUCTS.find(p => p.name === name); return (<div key={name} className="flex justify-between text-xs bg-white rounded px-2 py-1 mb-1"><span>{product?.emoji} {name}</span><span className="font-bold">{count}</span></div>); })}</div>)}</div></div>)}
          {inventoryDiscrepancies.length > 0 && (<div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-400"><h4 className="font-bold text-orange-700 mb-3">⚠️ Расхождения ({inventoryDiscrepancies.length})</h4>{inventoryDiscrepancies.map((d, i) => (<div key={i} className="bg-white rounded-lg p-3 border border-orange-300 mb-2"><div className="flex justify-between items-center mb-2"><span className="font-semibold">{d.emoji} {d.name}</span><span className={`font-bold px-2 py-1 rounded ${d.difference > 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{d.difference > 0 ? '+' : ''}{d.difference}</span></div><div className="grid grid-cols-3 gap-2 text-xs"><div className="text-center"><p className="text-gray-500">Было</p><p className="font-bold">{d.startCount}</p></div><div className="text-center"><p className="text-gray-500">Стало</p><p className="font-bold">{d.endCount}</p></div><div className="text-center"><p className="text-gray-500">По остаткам</p><p className="font-bold text-indigo-600">{d.expectedSold}</p></div></div><div className="mt-2 pt-2 border-t flex justify-between text-sm"><span>Записано:</span><span className="font-bold text-cyan-600">{d.actualSold}</span></div></div>))}</div>)}
          {(Object.keys(parsedInventory.start).length > 0 || Object.keys(parsedInventory.end).length > 0) && inventoryDiscrepancies.length === 0 && (<div className="bg-green-50 rounded-xl p-4 border border-green-300 text-center"><p className="text-green-700 font-bold">✅ Сверка сходится!</p></div>)}
          {unrecognizedSales.length > 0 && (<div className="bg-red-50 border-2 border-red-300 rounded-xl p-4"><h4 className="font-bold text-red-700 mb-3"><AlertTriangle className="w-4 h-4 inline" /> Нераспознанные ({unrecognizedSales.length})</h4>{unrecognizedSales.map((s, i) => (<div key={i} className="p-3 bg-white rounded-lg border border-red-200 mb-2"><div className="flex justify-between items-center"><div><span className="text-red-700 font-medium">❓ {s.extractedName}</span><p className="text-xs text-gray-400">{s.originalText}</p></div><div className="flex items-center gap-2"><span className="font-bold">{s.price}₽ {s.paymentType === 'cashless' ? '💳' : '💵'}</span><button onClick={() => setUnrecognizedSales(p => p.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="w-5 h-5" /></button></div></div>{editingIdx === i ? (<div className="mt-3 space-y-2"><div className="flex gap-2"><input type="text" value={editName} onChange={(e) => handleSearch(e.target.value)} placeholder="Название товара" className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg text-sm" autoFocus /><button onClick={() => fixUnrecognizedInImport(i, editName)} className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold">✓</button><button onClick={() => { setEditingIdx(null); setEditName(''); setSuggestions([]); }} className="px-4 py-2 bg-gray-400 text-white rounded-lg">✕</button></div>{suggestions.length > 0 && <div className="bg-white border rounded-lg shadow-lg overflow-hidden">{suggestions.map((p, j) => (<button key={j} onClick={() => fixUnrecognizedInImport(i, p.name)} className="w-full text-left px-3 py-2 hover:bg-amber-50 flex justify-between items-center border-b last:border-0"><span>{p.emoji} {p.name}</span><span className="text-amber-600 font-semibold">{p.price}₽</span></button>))}</div>}</div>) : (<div className="mt-2 flex gap-2"><button onClick={() => { setEditingIdx(i); setEditName(''); setSuggestions([]); setTeachingIdx(null); }} className="flex-1 flex items-center justify-center gap-2 text-white bg-blue-500 hover:bg-blue-600 py-2 px-3 rounded-lg text-sm font-semibold"><Edit3 className="w-4 h-4" /> Исправить</button><button onClick={() => { setTeachingIdx(i); setTeachAlias(s.extractedName || ''); setTeachProduct(''); setTeachSuggestions([]); setEditingIdx(null); }} className="flex items-center gap-1 text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-300 py-2 px-3 rounded-lg text-sm font-semibold">➕ Обучить</button></div>)}{teachingIdx === i && (<div className="mt-3 space-y-2 bg-purple-50 border border-purple-200 rounded-lg p-3"><p className="text-xs text-purple-700 font-semibold mb-1">Привязать алиас к товару:</p><input type="text" value={teachAlias} onChange={(e) => setTeachAlias(e.target.value)} placeholder="Алиас (как пишут в отчёте)" className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg text-sm mb-2" /><div className="flex gap-2"><input type="text" value={teachProduct} onChange={(e) => handleTeachSearch(e.target.value)} placeholder="Выберите товар..." className="flex-1 px-3 py-2 border-2 border-purple-300 rounded-lg text-sm" /><button onClick={() => saveTeachAlias(teachAlias, teachProduct)} className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold">✓</button><button onClick={() => setTeachingIdx(null)} className="px-3 py-2 bg-gray-200 rounded-lg">✕</button></div>{teachSuggestions.length > 0 && <div className="bg-white border rounded-lg shadow-lg overflow-hidden">{teachSuggestions.map((p, j) => (<button key={j} onClick={() => { setTeachProduct(p.name); setTeachSuggestions([]); }} className="w-full text-left px-3 py-2 hover:bg-purple-50 flex justify-between items-center border-b last:border-0"><span>{p.emoji} {p.name}</span><span className="text-purple-600 font-semibold">{p.price}₽</span></button>))}</div>}</div>)}</div>))}</div>)}
          {parsedSales.length > 0 && (<div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}><h4 className="font-bold text-green-700 mb-2"><Check className="w-4 h-4 inline" /> Распознанные ({parsedSales.length})</h4><div className="space-y-1 max-h-64 overflow-y-auto">{parsedSales.map((s, i) => (<div key={i} className="p-2 rounded-lg flex justify-between items-center text-sm bg-green-50 border border-green-200"><span>{s.product.emoji} {s.product.name}</span><div className="flex items-center gap-2"><span className="font-bold text-green-600">{s.price}₽ {s.paymentType === 'cashless' ? '💳' : '💵'}</span><span className="text-xs text-amber-600">ЗП:{s.salary}₽</span>{s.tips > 0 && <span className="text-xs text-orange-500">(+{s.tips})</span>}<button onClick={() => { setParsedSales(p => p.filter((_, j) => j !== i)); recalculateTotals(parsedSales.filter((_, j) => j !== i), unrecognizedSales); }} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button></div></div>))}</div></div>)}
          <button onClick={() => {
            if (!localName.trim()) {
              showNotification('Введите имя сотрудника', 'error');
              return;
            }
            saveParsedReports(localName.trim());
          }} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-4 rounded-xl font-bold shadow-lg hover:shadow-xl">✅ Сохранить ({parsedSales.length + unrecognizedSales.length} продаж)</button>
        </>)}
      </div>
    </div>
  );
}
