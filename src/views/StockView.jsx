import React, { useState } from 'react';
import { Search, ArrowLeft, X, FileInput, ChevronRight, Bell, RefreshCw, RotateCcw } from 'lucide-react';
import { CAT_ICONS, PRODUCTS } from '../data/products.js';
import { useDebounce } from '../utils/dates.js';
import { findProductByPrice } from '../utils/parser.js';
import { useApp } from '../context/AppContext';

export default function StockView() {
  const { CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS, addStockHistoryEntry, autoOrderList, darkMode, employeeName, employees, getLowStockItems, getWeekSales, logAction, partnerStock, predictDemand, save, setCurrentView, setPartnerStock, setStockCategory, setTotalBirds, showConfirm, showInputModal, showNotification, stock, stockCategory, stockHistory, totalBirds, updateStock } = useApp();

  const [actualInput, setActualInput] = useState({});
  const [showLow, setShowLow] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const debouncedStockSearch = useDebounce(stockSearch, 200);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPartners, setShowPartners] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkParsed, setBulkParsed] = useState([]);
  const [bulkTotalBirds, setBulkTotalBirds] = useState(null);
  const [bulkPartnerMoves, setBulkPartnerMoves] = useState([]);
  const [parseStatus, setParseStatus] = useState(''); // FIX: Локальный статус вместо showNotification
  const [editingMin, setEditingMin] = useState(null);
  const [minValue, setMinValue] = useState('');
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerValue, setPartnerValue] = useState('');
  const weekSales = getWeekSales();
  const lowStock = getLowStockItems();
  // BLOCK 10: Demand prediction for category items
  const getDemandColor = (name) => {
    const pred = predictDemand(name);
    if (pred.daysRemaining < 7) return 'bg-red-400';
    if (pred.daysRemaining < 14) return 'bg-yellow-400';
    return 'bg-green-400';
  };
  const getDemandText = (name) => {
    const pred = predictDemand(name);
    if (pred.avgDaily === 0) return '';
    return 'Хватит на ~' + pred.daysRemaining + ' дн';
  };

  // BLOCK 10: Generate order text
  const generateSmartOrder = () => {
    const orderItems = [];
    Object.entries(stock).forEach(([name, data]) => {
      if (data.count <= 0) return;
      const pred = predictDemand(name, 14);
      const threshold = autoOrderList.find(a => a.productName === name)?.minStock || 7;
      if (pred.daysRemaining < threshold) {
        const toOrder = Math.max(1, pred.predictedNeed - data.count);
        orderItems.push(name + ' — ' + toOrder + ' шт');
      }
    });
    if (orderItems.length === 0) { showNotification('Все товары в достатке'); return; }
    const text = orderItems.join('\n');
    try { navigator.clipboard.writeText(text); showNotification('📋 Заказ скопирован (' + orderItems.length + ' поз.)'); } catch { showNotification(text); }
  };

  const categoryItems = Object.entries(stock).filter(([name, data]) => data.category === stockCategory).filter(([name]) => !debouncedStockSearch || name.toLowerCase().includes(debouncedStockSearch.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  
  // Подсчёт всех птичек-свистулек
  const totalBirdsInStock = Object.entries(stock).filter(([_, data]) => data.category === 'Птички-свистульки').reduce((sum, [_, data]) => sum + data.count, 0);

  
  // FIX #57: Добавлено логирование в stockHistory для ручных изменений
  const updateStockCount = (name, delta) => { const newStock = {...stock}; const oldCount = newStock[name].count; newStock[name] = {...newStock[name], count: Math.max(0, oldCount + delta)}; updateStock(newStock); addStockHistoryEntry(name, delta > 0 ? 'manual_add' : 'manual_remove', delta, `Ручная корректировка ${employeeName}`); };
  // FIX #58: Добавлено логирование в stockHistory для checkActual
  const setStockCount = (name, count) => { const newStock = {...stock}; const oldCount = newStock[name].count; const newCount = Math.max(0, parseInt(count) || 0); newStock[name] = {...newStock[name], count: newCount}; updateStock(newStock); if (newCount !== oldCount) addStockHistoryEntry(name, 'actual_check', newCount - oldCount, `Сверка: ${oldCount} → ${newCount} (${employeeName})`); };
  const setMinStock = (name, min) => { const newStock = {...stock}; newStock[name] = {...newStock[name], minStock: Math.max(0, parseInt(min) || 0)}; updateStock(newStock); showNotification(`Минимум для ${name}: ${min}`); };
  const checkActual = (name) => { const actual = parseInt(actualInput[name]); if (isNaN(actual)) { showNotification('Введите число', 'error'); return; } const current = stock[name].count; if (actual !== current) showConfirm(`${name}: факт ${actual}, в системе ${current}. Обновить?`, () => { setStockCount(name, actual); showNotification('Остаток обновлён'); }); else showNotification('Остаток совпадает ✓'); setActualInput({...actualInput, [name]: ''}); };
  // FIX #59: Добавлено логирование в stockHistory при обнулении остатков
  const resetAllStock = () => showConfirm('Обнулить все остатки в этой категории?', () => { const newStock = {...stock}; categoryItems.forEach(([name]) => { const oldCount = newStock[name].count; if (oldCount !== 0) { newStock[name] = {...newStock[name], count: 0}; addStockHistoryEntry(name, 'reset', -oldCount, `Обнуление категории (${employeeName})`); } }); updateStock(newStock); showNotification('Остатки обнулены'); });
  
  const updatePartnerStock = (partner, product, count) => {
    const newPartners = {...partnerStock};
    if (!newPartners[partner]) newPartners[partner] = {};
    newPartners[partner][product] = Math.max(0, count);
    setPartnerStock(newPartners);
    save('likebird-partners', newPartners);
  };
  
  const getPartnerTotal = (partner) => {
    if (!partnerStock[partner]) return 0;
    return Object.values(partnerStock[partner]).reduce((sum, count) => sum + count, 0);
  };
  
  const parseBulkInventory = () => {
    if (!bulkText.trim()) {
      showNotification('Вставьте текст ревизии', 'error');
      return;
    }
    
    const lines = bulkText.split('\n');
    const parsed = [];
    const partnerMoves = [];
    const notRecognized = [];
    let currentProduct = null;
    let foundTotalBirds = null;
    
    // Алиасы для товаров в ревизии
    const revisionAliases = {
      'птицы': '__TOTAL_BIRDS__',
      'пластиковые птицы': 'Пластик птичка',
      'лабубы': 'Лабубу',
      'лабубу': 'Лабубу',
      'цветные птицы': 'Цветная птица 3D',
      'белые птицы': 'Белая птица 3D',
      'хомяки': 'Хомяк',
      'хомяк': 'Хомяк',
      'динозавры': 'Динозавр',
      'динозавтры': 'Динозавр',
      'динозавр': 'Динозавр',
      'касатки': 'Косатка',
      'касатка': 'Косатка',
      'косатки': 'Косатка',
      'змеи': 'Змейка',
      'змея': 'Змейка',
      'змейка': 'Змейка',
      'акула мем': 'Акула',
      'акулы': 'Акула',
      'акула': 'Акула',
      'снеговики мал': 'Снеговик маленький',
      'снеговики маленькие': 'Снеговик маленький',
      'снеговики большие': 'Снеговик большой',
      'снеговик большой': 'Снеговик большой',
      'песы': 'Собака 3D',
      'белые фигурки': 'Брелок',
      'мемы брм': 'Брелок Брейнрот',
      'крысы серые': 'Крыса',
      'крысы': 'Крыса',
      'лягушки': 'Лягушка',
      'лягушка': 'Лягушка',
      'тюлени': 'Тюлень',
      'тюлень': 'Тюлень',
      'рыба молот': 'Рыба молот',
      'рыба': 'Рыба молот',
      'коты': 'Кот 3D',
      'кот': 'Кот 3D',
      'окарина': 'Окарина',
      'черепа-свечки': 'Брелок',
      'черепа животных': 'Брелок',
      'брелоки ивк': 'Брелок Кальмар',
      'брелоки': 'Брелок',
      'крысы фиолетовые': 'Мышь фиолетовая',
      'совы': 'Сова',
      'сова': 'Сова',
      'собака большая': 'Собака мех',
      'кошки большие': 'Кот мех',
      'кролик большой': 'Кролик',
      'кролик сидит': 'Кролик',
      'кролик маленький': 'Кролик',
      'кролик лежит': 'Кролик',
      'лошад мал': 'Лошадь маленькая',
      'лошадь мал': 'Лошадь маленькая',
      'лошад в ассорт': 'Лошадь маленькая',
      'цыплёнок поющий': 'Цыплёнок поющий',
      'цыпленок поющий': 'Цыплёнок поющий',
      'шпиц': 'Шпиц',
      'хаски': 'Хаски',
      'котята мех': 'Котята мех',
      'магнит лабубу': 'Магнит Лабубу',
      'зайце-олени': 'Брелок',
      'антистрессы': 'Брелок',
      'пингвины': 'Брелок',
      'павук огромный': 'Паук',
      'павук': 'Паук',
      'паук': 'Паук',
      'паук огромный': 'Паук',
    };
    
    // Функция поиска продукта
    const findProduct = (text) => {
      const t = text.toLowerCase().trim();
      // Сначала проверяем алиасы ревизии
      if (revisionAliases[t]) {
        if (revisionAliases[t] === '__TOTAL_BIRDS__') return { special: '__TOTAL_BIRDS__' };
        const p = DYNAMIC_ALL_PRODUCTS.find(p => p.name === revisionAliases[t]);
        if (p) return p;
      }
      // Потом ищем в товарах
      return findProductByPrice(t, 500, CUSTOM_ALIASES, DYNAMIC_ALL_PRODUCTS);
    };
    
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;
      
      // Игнорируем строки с telegram датами "[17.01.2026 18:12]"
      if (/\[\d{2}\.\d{2}\.\d{4}/.test(l)) continue;
      
      // Игнорируем строку "Отчет с ... по ..."
      if (/^отчет\s+с/i.test(l)) continue;
      
      // Игнорируем заголовки разделов
      if (/^(3D|Мелкие|Меховые):?\s*$/i.test(l)) continue;
      
      // FIX: Динамический поиск партнёров (ранее захардкожено только "Олеся")
      const partnerNames = Object.keys(partnerStock);
      const matchedPartner = partnerNames.find(name => {
        const nameBase = name.toLowerCase().replace(/[аяуюоеиыэ]$/, ''); // склонения
        return l.toLowerCase().includes(nameBase);
      });
      if (matchedPartner) {
        const numMatch = l.match(/([+-]?\s*\d+)/);
        if (numMatch && currentProduct && currentProduct.name !== '__TOTAL_BIRDS__') {
          let amount = parseInt(numMatch[1].replace(/\s/g, ''));
          const text = l.toLowerCase();
          if (text.includes('от')) amount = Math.abs(amount);
          else amount = -Math.abs(amount);
          
          partnerMoves.push({
            partner: matchedPartner,
            product: currentProduct.name,
            amount,
            direction: amount > 0 ? 'приход' : 'расход',
            line: l
          });
        }
        continue;
      }
      
      // FIX: Динамический список имён сотрудников (ранее захардкожены "мила|саша|ада|костя|дара")
      const empNamesPattern = employees.map(e => e.name.toLowerCase().replace(/[аяуюоеиыэ]$/, '')).filter(n => n.length >= 3).join('|');
      const empIgnoreRegex = empNamesPattern ? new RegExp(`^\\d+\\s+(${empNamesPattern}|незаписан)`, 'i') : /^\d+\s+незаписан/i;
      if (empIgnoreRegex.test(l)) continue;
      
      // Игнорируем "Количество продаж:", "Брак:", "Выдано:", "Фактич:"
      if (/^(количество продаж|брак|незаписан|выдано|фактич)/i.test(l)) continue;
      
      // Ищем "На данный момент: X" или "На данный момент: X, Y свет"
      const currentMatch = l.match(/на данный момент:?\s*(\d+)/i);
      if (currentMatch) {
        const count = parseInt(currentMatch[1]);
        if (currentProduct) {
          if (currentProduct.special === '__TOTAL_BIRDS__') {
            foundTotalBirds = count;
          } else {
            parsed.push({ 
              name: currentProduct.name, 
              emoji: currentProduct.emoji, 
              count, 
              found: true, 
              original: currentProduct.original 
            });
          }
          currentProduct = null;
        }
        continue;
      }
      
      // Ищем "Сдал остаток: X" или "Остаток: X" или "Итого: X" или "Факт: X" или "Факт. X"
      const ostatokMatch = l.match(/(?:сдал остаток|остаток|итого|факт\.?):?\s*(\d+)/i);
      if (ostatokMatch && currentProduct && currentProduct.name !== '__TOTAL_BIRDS__') {
        const count = parseInt(ostatokMatch[1]);
        parsed.push({ 
          name: currentProduct.name, 
          emoji: currentProduct.emoji, 
          count, 
          found: true, 
          original: currentProduct.original 
        });
        currentProduct = null;
        continue;
      }
      
      // Ищем просто число на отдельной строке (после названия товара)
      // Например: "Хомяки\n12" — число = количество
      if (currentProduct && currentProduct.name !== '__TOTAL_BIRDS__' && /^\d+\s*(?:шт\.?)?\s*$/.test(l)) {
        const count = parseInt(l);
        if (!isNaN(count) && count >= 0 && count < 10000) {
          parsed.push({
            name: currentProduct.name,
            emoji: currentProduct.emoji,
            count,
            found: true,
            original: currentProduct.original
          });
          currentProduct = null;
          continue;
        }
      }
      
      // Игнорируем строки с датами типа "26.12: 6" или "26,12: 5"
      if (/^\d{2}[.,]\d{2}:?\s*\d/.test(l)) continue;
      
      // Ищем инлайн-формат: "Хомяки - 12" или "Хомяки: 12" или "Хомяки 12 шт"
      const inlineMatch = l.match(/^([а-яёa-z\s\-]+?)\s*[-:]\s*(\d+)\s*(?:шт\.?)?\s*$/i) || l.match(/^([а-яёa-z\s\-]+?)\s+(\d+)\s*(?:шт\.?)?\s*$/i);
      if (inlineMatch) {
        const productText = inlineMatch[1].trim();
        const count = parseInt(inlineMatch[2]);
        if (productText.length >= 2 && !isNaN(count) && count >= 0 && count < 10000) {
          if (!/^(отчет|мелкие|3d|меховые|птички|меха?|количество|брак|выдано|сдал|фактич)$/i.test(productText)) {
            const product = findProduct(productText);
            if (product) {
              if (product.special === '__TOTAL_BIRDS__') {
                foundTotalBirds = count;
              } else {
                parsed.push({ name: product.name, emoji: product.emoji, count, found: true, original: productText });
              }
              currentProduct = null;
              continue;
            }
          }
        }
      }
      
      // Ищем название товара: "Лабубы✅" или "Песы ❗" или просто "Хомяки"
      const titleMatch = l.match(/^([а-яёa-z\s\-]+?)(?:\s*[✅❗])?\s*$/i);
      if (titleMatch) {
        const productText = titleMatch[1].trim();
        
        // Игнорируем слишком короткие или служебные
        if (productText.length < 2) continue;
        if (/^(отчет|мелкие|3d|меховые|птички|меха?)$/i.test(productText)) continue;
        
        const product = findProduct(productText);
        if (product) {
          if (product.special === '__TOTAL_BIRDS__') {
            currentProduct = { special: '__TOTAL_BIRDS__', original: productText };
          } else {
            currentProduct = { name: product.name, emoji: product.emoji, original: productText };
          }
        } else {
          // Не распознан - добавляем в нераспознанные, если это похоже на название товара
          if (!/^(количество|брак|выдано|сдал|фактич|\d)/i.test(productText)) {
            notRecognized.push({ text: productText, line: l });
            currentProduct = { name: productText, emoji: '❓', original: productText, notFound: true };
          }
        }
        continue;
      }
    }
    
    // Убираем дубликаты, оставляем последнее значение
    const uniqueParsed = [];
    const seen = new Set();
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (!seen.has(parsed[i].name)) {
        seen.add(parsed[i].name);
        uniqueParsed.unshift(parsed[i]);
      }
    }
    
    setBulkParsed(uniqueParsed);
    setBulkTotalBirds(foundTotalBirds);
    setBulkPartnerMoves(partnerMoves);
    
    const foundCount = uniqueParsed.filter(p => p.found).length;
    const notFoundCount = notRecognized.length;
    
    let msg = '';
    if (foundCount > 0) msg += `✅ Распознано: ${foundCount}`;
    if (notFoundCount > 0) msg += `${msg ? ', ' : ''}❌ Не распознано: ${notFoundCount}`;
    if (foundTotalBirds !== null) msg += `${msg ? ', ' : ''}🐦 Птичек: ${foundTotalBirds}`;
    if (partnerMoves.length > 0) msg += `${msg ? ', ' : ''}👥 Партнёры: ${partnerMoves.length}`;
    
    if (!msg) msg = '❌ Не удалось распознать данные';
    // FIX #56: showNotification теперь DOM-based и НЕ вызывает parent re-render.
    // Дополнительно показываем parseStatus инлайн для удобства.
    setParseStatus(msg);
    const isError = msg.startsWith('❌');
    showNotification(msg, isError ? 'error' : 'success');
  };
  
  const applyBulkInventory = () => {
    const newStock = {...stock};
    let updated = 0;
    const changes = []; // Собираем лог изменений
    bulkParsed.filter(p => p.found).forEach(p => {
      if (newStock[p.name]) {
        const oldCount = newStock[p.name].count;
        const diff = p.count - oldCount;
        if (diff !== 0) {
          newStock[p.name] = {...newStock[p.name], count: p.count};
          updated++;
          changes.push({ name: p.name, oldCount, newCount: p.count, diff });
          // Записываем в историю склада
          addStockHistoryEntry(p.name, 'revision', diff, `Ревизия: ${oldCount} → ${p.count}`);
        }
      }
    });
    updateStock(newStock);
    
    // Сохраняем общее количество птичек
    if (bulkTotalBirds !== null) {
      setTotalBirds(bulkTotalBirds);
      save('likebird-totalbirds', bulkTotalBirds);
    }
    
    // Обрабатываем движения партнёров
    if (bulkPartnerMoves.length > 0) {
      const newPartners = {...partnerStock};
      bulkPartnerMoves.forEach(move => {
        if (!newPartners[move.partner]) newPartners[move.partner] = { total: 0, history: [] };
        newPartners[move.partner].total = (newPartners[move.partner].total || 0) - move.amount;
        newPartners[move.partner].history = [...(newPartners[move.partner].history || []), { ...move, date: new Date().toLocaleDateString('ru-RU') }];
      });
      setPartnerStock(newPartners);
      save('likebird-partners', newPartners);
    }
    
    // Логируем ревизию в аудит
    logAction('Ревизия применена', `Обновлено ${updated} позиций${bulkTotalBirds !== null ? `, птичек: ${bulkTotalBirds}` : ''}${bulkPartnerMoves.length > 0 ? `, партнёрских движений: ${bulkPartnerMoves.length}` : ''}`);
    
    showNotification(`Обновлено ${updated} позиций`);
    setBulkText('');
    setBulkParsed([]);
    setBulkTotalBirds(null);
    setBulkPartnerMoves([]);
    setShowBulkImport(false);
  };
  
  const handleMinDoubleClick = (name, currentMin) => {
    setEditingMin(name);
    setMinValue(currentMin.toString());
  };
  
  const saveMinStock = (name) => {
    setMinStock(name, minValue);
    setEditingMin(null);
    setMinValue('');
  };
  
  const updateTotalBirdsManual = (value) => {
    const newVal = parseInt(value) || 0;
    setTotalBirds(newVal);
    save('likebird-totalbirds', newVal);
    showNotification(`Всего птичек: ${newVal}`);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">📦 Ревизия</h2>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        
        {/* Общее количество птичек-свистулек */}
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 border-2 border-amber-300">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-amber-700 font-semibold">🐦 Всего птичек-свистулек</p>
              <p className="text-xs text-amber-600">По ревизии / В системе</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-amber-700">{totalBirds > 0 ? totalBirds : '—'} <span className="text-lg text-amber-500">/ {totalBirdsInStock}</span></p>
              <button onClick={() => showInputModal({ title: '🐦 Общее количество птичек', placeholder: 'Введите число', defaultValue: String(totalBirds), onSave: (v) => updateTotalBirdsManual(v) })} className="text-xs text-amber-600 underline">изменить</button>
            </div>
          </div>
        </div>
        
        {/* Партнёры */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
          <button onClick={() => setShowPartners(!showPartners)} className="w-full flex justify-between items-center">
            <span className="font-bold text-purple-700">👥 Партнёры-реализаторы</span>
            <ChevronRight className={`w-5 h-5 text-purple-500 transition-transform ${showPartners ? 'rotate-90' : ''}`} />
          </button>
          {showPartners && (
            <div className="mt-3 space-y-2">
              {Object.keys(partnerStock).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">Нет данных о партнёрах</p>
              ) : (
                Object.entries(partnerStock).map(([partner, data]) => (
                  <div key={partner} className="bg-white rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{partner}</span>
                      <span className="text-purple-600 font-bold">{data.total || 0} шт</span>
                    </div>
                    {data.history && data.history.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 max-h-20 overflow-y-auto">
                        {data.history.slice(-5).map((h, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{h.date}: {h.product}</span>
                            <span className={h.amount > 0 ? 'text-green-600' : 'text-red-600'}>{h.amount > 0 ? '+' : ''}{h.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <button onClick={() => showInputModal({
                title: '👥 Новый партнёр-реализатор',
                placeholder: 'Имя партнёра',
                onSave: (name) => {
                  const newPartners = {...partnerStock, [name]: { total: 0, history: [] }};
                  setPartnerStock(newPartners);
                  save('likebird-partners', newPartners);
                }
              })} className="w-full py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-semibold hover:bg-purple-200">+ Добавить партнёра</button>
            </div>
          )}
        </div>
        
        {lowStock.length > 0 && (<div className="bg-orange-50 border border-orange-300 rounded-xl p-3"><button onClick={() => setShowLow(!showLow)} className="w-full flex justify-between items-center"><span className="font-bold text-orange-700"><Bell className="w-4 h-4 inline" /> Дозаказать ({lowStock.length})</span><ChevronRight className={`w-5 h-5 text-orange-500 transition-transform ${showLow ? 'rotate-90' : ''}`} /></button>{showLow && <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">{lowStock.map(item => (<div key={item.name} className="flex justify-between text-sm bg-white p-2 rounded"><span>{item.emoji} {item.name}</span><span className="text-orange-600 font-bold">{item.count} шт</span></div>))}</div>}</div>)}
        
        <button onClick={() => setShowBulkImport(!showBulkImport)} className="w-full bg-blue-500 text-white py-3 rounded-xl font-bold hover:bg-blue-600 flex items-center justify-center gap-2">
          <FileInput className="w-5 h-5" /> {showBulkImport ? 'Скрыть импорт' : 'Импорт ревизии'}
        </button>
        
        {showBulkImport && (
          <div className="bg-white rounded-xl p-4 shadow space-y-3">
            <p className="text-sm text-gray-600">Вставьте текст ревизии. Распознаёт:<br/>• "На данный момент: X"<br/>• "Остаток: X", "Факт: X", "Итого: X"<br/>• Число на отдельной строке после названия<br/>• Движения партнёров ("+X от ...", "-X ...")<br/>• "Птицы: 410" (общее кол-во)</p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="Вставьте текст ревизии..." className="w-full p-3 border-2 rounded-lg font-mono text-sm h-40 focus:border-blue-500 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={parseBulkInventory} className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600">🔍 Распознать</button>
              <button onClick={() => { setBulkText(''); setBulkParsed([]); setBulkTotalBirds(null); setBulkPartnerMoves([]); setParseStatus(''); }} className="px-4 bg-gray-200 rounded-lg hover:bg-gray-300"><RotateCcw className="w-5 h-5" /></button>
            </div>
            
            {parseStatus && (
              <div className={`text-sm font-medium p-2 rounded-lg text-center ${parseStatus.includes('❌') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                {parseStatus}
              </div>
            )}
            
            {bulkTotalBirds !== null && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                <p className="font-semibold text-amber-700">🐦 Птички-свистульки: <span className="text-xl">{bulkTotalBirds}</span></p>
              </div>
            )}
            
            {bulkPartnerMoves.length > 0 && (
              <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                <p className="font-semibold text-purple-700 mb-2">👥 Движения партнёров:</p>
                {bulkPartnerMoves.map((m, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{m.partner}: {m.product}</span>
                    <span className={m.amount > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{m.amount > 0 ? '+' : ''}{m.amount}</span>
                  </div>
                ))}
              </div>
            )}
            
            {bulkParsed.length > 0 && (
              <div className="space-y-2">
                <p className="font-semibold text-sm">Товары ({bulkParsed.filter(p => p.found).length} распознано):</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {bulkParsed.map((p, i) => {
                    const currentCount = stock[p.name]?.count ?? 0;
                    const diff = p.found ? p.count - currentCount : 0;
                    return (
                      <div key={i} className={`flex justify-between items-center text-sm p-2 rounded ${p.found ? (diff !== 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50') : 'bg-red-50'}`}>
                        <span className="flex-1">{p.emoji} {p.name}</span>
                        {p.found ? (
                          <div className="flex items-center gap-2 text-right">
                            <span className="text-gray-400 text-xs">{currentCount}→</span>
                            <span className="font-bold text-green-600">{p.count}</span>
                            {diff !== 0 && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{diff > 0 ? '+' : ''}{diff}</span>}
                          </div>
                        ) : (
                          <span className="font-bold text-red-600">{p.count} шт</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const totalDiff = bulkParsed.filter(p => p.found).reduce((sum, p) => {
                    const currentCount = stock[p.name]?.count ?? 0;
                    return sum + (p.count - currentCount);
                  }, 0);
                  const changedCount = bulkParsed.filter(p => p.found && p.count !== (stock[p.name]?.count ?? 0)).length;
                  return changedCount > 0 ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-sm">
                      <span className="text-blue-700">📊 Изменений: <strong>{changedCount}</strong> позиций, итого: <strong className={totalDiff >= 0 ? 'text-green-600' : 'text-red-600'}>{totalDiff > 0 ? '+' : ''}{totalDiff} шт</strong></span>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-sm text-center">
                      <span className="text-green-700">✅ Все остатки совпадают</span>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {(bulkParsed.length > 0 || bulkTotalBirds !== null || bulkPartnerMoves.length > 0) && (
              <button onClick={applyBulkInventory} className="w-full bg-green-500 text-white py-3 rounded-lg font-semibold hover:bg-green-600">✅ Применить изменения</button>
            )}
            {stockHistory.length > historyLimit && <button onClick={() => setHistoryLimit(prev => prev + 50)} className="w-full text-center py-2 text-purple-500 text-sm hover:text-purple-700">↑ Показать ещё ({stockHistory.length - historyLimit})</button>}
          </div>
        )}
        
        {/* BLOCK 10: Smart Order Button */}
        <button onClick={generateSmartOrder}
          className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:shadow-lg mb-3 flex items-center justify-center gap-2">
          📋 Сформировать заказ
        </button>
        <div className="flex gap-2">{Object.keys(PRODUCTS).map(cat => (<button key={cat} onClick={() => setStockCategory(cat)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${stockCategory === cat ? 'bg-amber-500 text-white shadow-md' : 'bg-white hover:bg-gray-50'}`}>{CAT_ICONS[cat]}</button>))}</div>
        <div className="relative mt-2 mb-2"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input type="text" placeholder="Поиск по складу..." value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className="w-full pl-9 pr-8 py-2 rounded-xl bg-white shadow text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />{stockSearch && <button onClick={() => setStockSearch('')} className="absolute right-3 top-2.5 text-gray-400"><X className="w-4 h-4" /></button>}</div>
        <div className="flex justify-between items-center"><span className="text-sm text-gray-500">{categoryItems.length} позиций</span><button onClick={resetAllStock} className="text-xs text-red-500 hover:text-red-700">Обнулить всё</button></div>
        <div className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          {categoryItems.map(([name, data]) => { const sold = weekSales[name] || 0; const isLow = data.count <= data.minStock; return (
            <div key={name} className={`p-3 border-b last:border-0 ${isLow ? 'bg-orange-50' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex-1"><p className="font-semibold text-sm">{data.emoji} {name}</p><p className="text-xs text-gray-400">За неделю: {sold} | Мин: {data.minStock}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateStockCount(name, -1)} className="w-8 h-8 bg-red-100 rounded-full text-red-600 font-bold hover:bg-red-200">-</button>
                  <span className={`w-10 text-center font-bold ${isLow ? 'text-orange-600' : ''}`}>{data.count}</span>
                  <button onClick={() => updateStockCount(name, 1)} className="w-8 h-8 bg-green-100 rounded-full text-green-600 font-bold hover:bg-green-200">+</button>
                </div>
              </div>
              <div className="mt-2 flex gap-2 items-center">
                <input type="number" value={actualInput[name] || ''} onChange={(e) => setActualInput({...actualInput, [name]: e.target.value})} placeholder="Факт" className="flex-1 px-2 py-1 border rounded text-sm focus:border-amber-500 focus:outline-none" />
                <button onClick={() => checkActual(name)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"><RefreshCw className="w-4 h-4" /></button>
                {editingMin === name ? (
                  <div className="flex items-center gap-1">
                    <input type="number" value={minValue} onChange={(e) => setMinValue(e.target.value)} className="w-12 px-1 py-1 border rounded text-xs text-center" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveMinStock(name); if (e.key === 'Escape') { setEditingMin(null); setMinValue(''); } }} />
                    <button onClick={() => saveMinStock(name)} className="px-2 py-1 bg-green-500 text-white rounded text-xs">✓</button>
                  </div>
                ) : (
                  <button onDoubleClick={() => handleMinDoubleClick(name, data.minStock)} className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300 cursor-pointer" title="Двойной клик для изменения">м:{data.minStock}</button>
                )}
              </div>
              {/* BLOCK 10: Demand prediction bar */}
              {data.count > 0 && getDemandText(name) && (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${getDemandColor(name)}`} style={{width: `${Math.min(100, (predictDemand(name).daysRemaining / 30) * 100)}%`}}></div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{getDemandText(name)}</span>
                </div>
              )}
            </div>
          ); })}
        </div>
        <div className="bg-cyan-50 rounded-xl p-4"><p className="font-bold text-cyan-700">Итого в категории:</p><p className="text-2xl font-bold">{categoryItems.reduce((s, [_, d]) => s + d.count, 0)} шт</p></div>
      </div>
    </div>
  );
}
