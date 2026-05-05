import React, { useState } from 'react';
import { Plus, Search, ArrowLeft, X, MapPin, Camera, Image } from 'lucide-react';
import { CAT_ICONS, PRODUCTS } from '../data/products.js';
import { calculateSalary } from '../utils/salary.js';
import { useApp } from '../context/AppContext';

export default function NewReportView() {
  const { DYNAMIC_ALL_PRODUCTS, addStockHistoryEntry, archivedProducts, compressImage, customProducts, darkMode, employeeName, locations, mixedCash, mixedCashless, paymentType, profilesData, quantity, reports, salarySettings, salePrice, saveReport, selectedCategory, selectedProduct, setCurrentView, setEmployeeName, setPaymentType, setQuantity, setSelectedCategory, setSelectedProduct, showNotification, stock, stockHistory, tipsAmount, updateProfilesData, updateReports, updateStock } = useApp();

  // Берём locations прямо из состояния родителя (обновляется через Firebase subscription)
  const activeLocations = locations.filter(l => l.active);

  const [localPrice, setLocalPrice] = useState(() => salePrice || '');
  const [localTips, setLocalTips] = useState(() => tipsAmount || '');
  const [localName, setLocalName] = useState(() => employeeName || '');
  const [productSearch, setProductSearch] = useState('');
  const [localMixedCash, setLocalMixedCash] = useState(() => mixedCash || '');
  const [localMixedCashless, setLocalMixedCashless] = useState(() => mixedCashless || '');
  // localPaymentType — локальный, не сбрасывает price при изменении
  const [localPaymentType, setLocalPaymentType] = useState('cash');
  const [localQuantity, setLocalQuantity] = useState(1);
  const [quickMode, setQuickMode] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickParsed, setQuickParsed] = useState([]);
  const [salePhoto, setSalePhoto] = useState(null);
  // Точка: берём из профиля сотрудника
  const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
  const myProfile = profilesData[myLogin] || {};
  const [saleLocation, setSaleLocation] = useState(myProfile.defaultLocation || '');
  const [discountReason, setDiscountReason] = useState(''); // Причина скидки
  const [showDiscountNote, setShowDiscountNote] = useState(false); // Показать поле пояснения
  
  // Проверка: цена ниже базы?
  const isBelowBase = selectedProduct && localPrice && parseInt(localPrice) < selectedProduct.price;
  
  // FIX: Чаевые и цена продажи — полностью независимые поля.
  // Чаевые — это доплата от клиента СВЕРХ цены, вводятся вручную.
  // Наценка (продал дороже базы) — НЕ чаевые.
  const handlePriceChange = (newPrice) => {
    setLocalPrice(newPrice);
    // Не трогаем чаевые при изменении цены — они вводятся отдельно
  };
  
  // Обработчик изменения чаевых вручную
  const handleTipsChange = (newTips) => {
    setLocalTips(newTips);
  };
  
  // Обработка загрузки фото
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Файл слишком большой (макс. 5МБ)', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => setSalePhoto(event.target.result);
      reader.readAsDataURL(file);
    }
  };
  
  // FIX: Включаем кастомные товары в список (PRODUCTS содержит только встроенные)
  const allCategoryProducts = selectedCategory ? [
    ...(PRODUCTS[selectedCategory] || []),
    ...customProducts.filter(p => (p.category || '3D игрушки') === selectedCategory).map(p => ({ ...p, aliases: p.aliases || [p.name.toLowerCase()] })),
  ] : [];
  const filteredProducts = (selectedCategory && productSearch ? allCategoryProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.aliases.some(a => a.includes(productSearch.toLowerCase()))) : allCategoryProducts).filter(p => !(archivedProducts || []).includes(p.name));
  
  // Парсинг быстрого ввода: "Снегирь 600 (100) перевод"
  const parseQuickLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    // Извлекаем чаевые (100) или (+100)
    let tips = 0;
    let textWithoutTips = trimmed;
    const tipsMatch = trimmed.match(/\([\+]?(\d+)\)/);
    if (tipsMatch) {
      tips = parseInt(tipsMatch[1]);
      textWithoutTips = trimmed.replace(/\([\+]?\d+\)/, '').trim();
    }
    
    // Определяем способ оплаты
    let payType = 'cash';
    const lowerText = textWithoutTips.toLowerCase();
    if (lowerText.includes('перевод') || lowerText.includes(' п ') || lowerText.endsWith(' п') || 
        lowerText.includes('безнал') || lowerText.includes('карт') || lowerText.includes('💳')) {
      payType = 'cashless';
      textWithoutTips = textWithoutTips.replace(/\s*(перевод|безнал|карта|💳|\bп\b)\s*/gi, ' ').trim();
    } else if (lowerText.includes('нал') || lowerText.includes('💵')) {
      payType = 'cash';
      textWithoutTips = textWithoutTips.replace(/\s*(наличные|нал|💵)\s*/gi, ' ').trim();
    }
    
    // Извлекаем цену (последнее число в строке)
    const priceMatch = textWithoutTips.match(/(\d+)\s*р?$/i);
    let price = 0;
    let productName = textWithoutTips;
    if (priceMatch) {
      price = parseInt(priceMatch[1]);
      productName = textWithoutTips.replace(/\s*\d+\s*р?$/i, '').trim();
    }
    
    // FIX: Используем DYNAMIC_ALL_PRODUCTS чтобы находить кастомные товары
    const product = DYNAMIC_ALL_PRODUCTS.find(p => 
      p.name.toLowerCase() === productName.toLowerCase() ||
      p.aliases.some(a => a === productName.toLowerCase())
    );
    
    return {
      originalText: trimmed,
      productName,
      price: price || (product ? product.price : 0),
      tips,
      paymentType: payType,
      product,
      isUnrecognized: !product
    };
  };
  
  const handleQuickParse = () => {
    const lines = quickText.split('\n').filter(l => l.trim());
    const parsed = lines.map(parseQuickLine).filter(Boolean);
    setQuickParsed(parsed);
  };
  
  const saveQuickSales = () => {
    if (!localName.trim()) {
      showNotification('Введите имя сотрудника', 'error');
      return;
    }
    
    const dateStr = new Date().toLocaleString('ru-RU');
    let saved = 0;
    const newReports = [];
    
    quickParsed.forEach((sale, idx) => {
      const report = {
        id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + idx,
        date: dateStr,
        employee: localName.trim(),
        total: sale.price,
        salePrice: sale.price,
        tips: sale.tips,
        tipsModel: 'v2', // FIX: без этого миграция обнулит чаевые при перезагрузке
        cashAmount: sale.paymentType === 'cash' ? sale.price : 0,
        cashlessAmount: sale.paymentType === 'cashless' ? sale.price : 0,
        paymentType: sale.paymentType,
        createdAt: Date.now(),
        reviewStatus: 'pending',
        location: saleLocation || null,
        photo: salePhoto || null,
        quantity: 1,
      };
      
      if (sale.product) {
        report.product = sale.product.name; // Строка, не объект!
        report.category = sale.product.category;
        report.basePrice = sale.product.price;
        report.salary = calculateSalary(sale.product.price, sale.price, sale.product.category, sale.tips, 'normal', salarySettings);
        report.isUnrecognized = false;
        // Добавляем в историю склада
        addStockHistoryEntry(sale.product.name, 'sale', -1, `Продажа ${localName.trim()}`);
      } else {
        report.product = sale.productName; // Нераспознанный - используем введённое имя
        report.extractedName = sale.productName;
        report.originalText = sale.originalText;
        report.category = 'Нераспознанное';
        report.basePrice = 0;
        report.salary = 0;
        report.isUnrecognized = true;
      }
      
      newReports.push(report);
      saved++;
    });
    
    // FIX: Обновляем остатки на складе (ранее только stockHistory обновлялся)
    const newStock = {...stock};
    quickParsed.forEach(sale => {
      if (sale.product && newStock[sale.product.name]) {
        newStock[sale.product.name] = {...newStock[sale.product.name], count: Math.max(0, newStock[sale.product.name].count - 1)};
      }
    });
    updateStock(newStock);

    updateReports([...newReports, ...reports]);
    localStorage.setItem('likebird-employee', localName.trim());
    setEmployeeName(localName.trim());
    showNotification(`Сохранено ${saved} продаж`);
    setQuickText('');
    setQuickParsed([]);
    setCurrentView('menu');
  };
  
  const handleSave = () => {
    // Сохраняем точку в профиль пользователя
    if (saleLocation) {
      const login = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
      if (login) {
        const updatedProfiles = { ...profilesData, [login]: { ...(profilesData[login] || {}), defaultLocation: saleLocation } };
        updateProfilesData(updatedProfiles);
      }
    }
    // Передаём параметры напрямую в saveReport вместо использования setState
    // Используем localPaymentType и localQuantity чтобы не сбрасывать данные
    const prevPayment = paymentType;
    const prevQty = quantity;
    setPaymentType(localPaymentType);
    setQuantity(localQuantity);
    saveReport({
      employeeName: localName,
      salePrice: localPrice,
      tipsAmount: localTips,
      mixedCash: localMixedCash,
      mixedCashless: localMixedCashless,
      selectedProduct: selectedProduct,
      selectedCategory: selectedCategory,
      photo: salePhoto,
      location: saleLocation,
      discountReason: isBelowBase ? discountReason : '',
      paymentType: localPaymentType,
      quantity: localQuantity,
    });
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('shift')} className="mb-2"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">➕ Новая продажа</h2>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        {/* Переключатель режимов */}
        <div className="flex gap-2 bg-white rounded-xl p-2 shadow">
          <button onClick={() => setQuickMode(false)} className={`flex-1 py-2 rounded-lg font-medium transition-all ${!quickMode ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            📋 По шагам
          </button>
          <button onClick={() => setQuickMode(true)} className={`flex-1 py-2 rounded-lg font-medium transition-all ${quickMode ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            ⚡ Быстрый ввод
          </button>
        </div>
        
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <label className="text-sm font-semibold">Имя сотрудника</label>
          <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} placeholder="Введите имя" className="w-full p-3 border-2 rounded-lg mt-1 focus:border-amber-500 focus:outline-none" />
        </div>
        
        {/* Быстрый режим */}
        {quickMode && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <label className="text-sm font-semibold block mb-2">Быстрый ввод (каждая продажа с новой строки)</label>
              <textarea 
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                placeholder={"Снегирь 600 (100) перевод\nКанарейка 400 нал\nРусский 350 п\nТукан 800 (50)"}
                className="w-full p-3 border-2 rounded-lg font-mono text-sm focus:border-amber-500 focus:outline-none"
                rows={6}
              />
              <p className="text-xs text-gray-500 mt-2">Формат: Название Цена (чаевые) способ_оплаты</p>
              <p className="text-xs text-gray-400">Способ: нал/наличные, перевод/п/безнал/карта</p>
              <button onClick={handleQuickParse} className="w-full mt-3 bg-amber-100 text-amber-700 py-2 rounded-lg font-semibold hover:bg-amber-200">
                🔍 Распознать
              </button>
            </div>
            
            {/* Локация и фото для быстрого режима */}
            {activeLocations.length > 0 && (
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <label className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Точка продаж</label>
                <select value={saleLocation} onChange={(e) => {
                    setSaleLocation(e.target.value);
                    if (myLogin && e.target.value) {
                      const upd = { ...profilesData, [myLogin]: { ...(profilesData[myLogin] || {}), defaultLocation: e.target.value } };
                      updateProfilesData(upd);
                    }
                  }} className="w-full p-3 border-2 rounded-lg mt-1 focus:border-amber-500 focus:outline-none">
                  <option value="">Не указана</option>
                  {[...new Set(activeLocations.map(l => l.city))].map(city => (
                    <optgroup key={city} label={city}>
                      {activeLocations.filter(l => l.city === city).map(loc => (
                        <option key={loc.id} value={`${loc.city} - ${loc.name}`}>{loc.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            
            {quickParsed.length > 0 && (
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-semibold mb-3">Распознано: {quickParsed.length}</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {quickParsed.map((sale, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${sale.isUnrecognized ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-medium">{sale.product?.emoji || '❓'} {sale.productName}</span>
                          {sale.isUnrecognized && <span className="ml-2 text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded">Новый товар</span>}
                        </div>
                        <div className="text-right">
                          <span className="font-bold">{sale.price}₽</span>
                          <span className="ml-1">{sale.paymentType === 'cashless' ? '💳' : '💵'}</span>
                          {sale.tips > 0 && <span className="text-amber-600 ml-1">(+{sale.tips})</span>}
                        </div>
                      </div>
                      <button onClick={() => setQuickParsed(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700 mt-1">Удалить</button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Итого:</span>
                    <span className="font-bold">{quickParsed.reduce((s, p) => s + p.price, 0).toLocaleString()}₽</span>
                  </div>
                  <button onClick={saveQuickSales} className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 rounded-xl font-bold hover:shadow-lg">
                    ✅ Сохранить ({quickParsed.length} продаж)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Пошаговый режим */}
        {!quickMode && (<>
          {!selectedCategory && (<div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}><h3 className="font-semibold mb-3">Выберите категорию</h3>{Object.keys(PRODUCTS).map(cat => (<button key={cat} onClick={() => setSelectedCategory(cat)} className="w-full text-left p-3 bg-gray-50 rounded-lg mb-2 font-semibold hover:bg-amber-50 flex items-center gap-2"><span className="text-2xl">{CAT_ICONS[cat]}</span>{cat}</button>))}</div>)}
          {selectedCategory && !selectedProduct && (
            <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <div className="flex justify-between items-center mb-3"><h3 className="font-semibold">{CAT_ICONS[selectedCategory]} {selectedCategory}</h3><button onClick={() => { setSelectedCategory(null); setProductSearch(''); }} className="text-amber-600 text-sm hover:text-amber-700">← Назад</button></div>
              <div className="relative mb-3"><Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" /><input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Поиск в категории..." className="w-full pl-9 pr-4 py-2 border-2 rounded-lg text-sm focus:border-amber-500 focus:outline-none" /></div>
              <div className="max-h-80 overflow-y-auto space-y-2">{filteredProducts.length > 0 ? filteredProducts.map((p, i) => (<button key={i} onClick={() => { setSelectedProduct(p); setLocalPrice(p.price.toString()); setLocalTips('0'); setDiscountReason(''); setShowDiscountNote(false); setProductSearch(''); }} className={`w-full text-left p-3 rounded-lg flex justify-between ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-50 hover:bg-amber-50"}`}><span className="flex items-center gap-2"><span className="text-xl">{p.emoji}</span>{p.name}</span><span className="font-bold text-amber-600">{p.price}₽</span></button>)) : <p className="text-center text-gray-400 py-4">Ничего не найдено</p>}</div>
            </div>
          )}
          {selectedProduct && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-xl p-3 border-2 border-amber-200 flex justify-between items-center">
                <div className="flex items-center gap-2"><span className="text-2xl">{selectedProduct.emoji}</span><div><p className="font-bold">{selectedProduct.name}</p><p className="text-xs text-gray-500">База: {selectedProduct.price}₽</p></div></div>
                <button onClick={() => { setSelectedProduct(null); setLocalPrice(''); setLocalMixedCash(''); setLocalMixedCashless(''); setLocalTips('0'); setDiscountReason(''); setShowDiscountNote(false); }} className="text-amber-600 hover:text-amber-700"><X className="w-6 h-6" /></button>
              </div>
              
              {/* Цена продажи */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <label className="text-sm font-semibold">Цена продажи</label>
                <input type="number" value={localPrice} onChange={(e) => handlePriceChange(e.target.value)} className="w-full p-3 border-2 rounded-lg text-xl font-bold text-center mt-1 focus:border-amber-500 focus:outline-none" />
                {isBelowBase && (
                  <div className="mt-2">
                    <p className="text-xs text-orange-500 text-center">⚠️ Ниже базовой цены на {selectedProduct.price - parseInt(localPrice)}₽</p>
                    {!showDiscountNote ? (
                      <button onClick={() => setShowDiscountNote(true)} className="w-full mt-2 text-xs text-blue-500 hover:text-blue-700 flex items-center justify-center gap-1">
                        <Plus className="w-3 h-3" /> Добавить пояснение
                      </button>
                    ) : (
                      <div className="mt-2">
                        <input 
                          type="text" 
                          value={discountReason} 
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="Причина скидки (например: постоянный клиент)" maxLength={200}
                          className="w-full p-2 border rounded-lg text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Чаевые — отдельная доплата от клиента */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <label className="text-sm font-semibold">Чаевые (доплата от клиента)</label>
                <input 
                  type="number" 
                  value={localTips} 
                  onChange={(e) => handleTipsChange(e.target.value)} 
                  placeholder="0" 
                  className="w-full p-3 border-2 rounded-lg text-center mt-1 focus:border-amber-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">Дополнительная сумма сверх цены продажи</p>
              </div>
              
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}><label className="text-sm font-semibold">Количество</label><div className="flex items-center justify-center gap-4 mt-2"><button onClick={() => setLocalQuantity(Math.max(1, localQuantity - 1))} className="w-12 h-12 bg-amber-100 rounded-full text-xl font-bold hover:bg-amber-200">-</button><span className="text-3xl font-bold w-16 text-center">{localQuantity}</span><button onClick={() => setLocalQuantity(localQuantity + 1)} className="w-12 h-12 bg-amber-100 rounded-full text-xl font-bold hover:bg-amber-200">+</button></div></div>
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <label className="text-sm font-semibold">Способ оплаты</label>
                <div className="mt-2 space-y-2">
                  {[{v: 'cash', l: '💵 Наличные'}, {v: 'cashless', l: '💳 Безналичный'}, {v: 'mixed', l: '💵💳 Смешанная'}].map(o => (
                    <label key={o.v} className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer ${localPaymentType === o.v ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="payment" value={o.v} checked={localPaymentType === o.v} onChange={(e) => setLocalPaymentType(e.target.value)} className="w-5 h-5 accent-amber-500" />
                      <span className="font-medium">{o.l}</span>
                    </label>
                  ))}
                </div>
                {localPaymentType === 'mixed' && (
                  <div className="mt-3 space-y-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-24">💵 Наличные:</span>
                      <input type="number" value={localMixedCash} onChange={(e) => setLocalMixedCash(e.target.value)} placeholder="0" className="flex-1 p-2 border rounded text-center" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-24">💳 Безнал:</span>
                      <input type="number" value={localMixedCashless} onChange={(e) => setLocalMixedCashless(e.target.value)} placeholder="0" className="flex-1 p-2 border rounded text-center" />
                    </div>
                    {localMixedCash && localMixedCashless && <p className="text-xs text-center text-gray-500">Сумма: {(parseInt(localMixedCash)||0) + (parseInt(localMixedCashless)||0)}₽</p>}
                  </div>
                )}
              </div>
              {localPrice && (<div className="bg-green-50 rounded-xl p-4 border-2 border-green-200"><div className="flex justify-between items-center mb-2"><span className="text-gray-600">Итого:</span><span className="text-2xl font-bold text-green-600">{(parseInt(localPrice || 0) * localQuantity).toLocaleString()}₽</span></div><div className="flex justify-between items-center"><span className="text-gray-600">ЗП:</span><span className="text-lg font-bold text-amber-600">{(calculateSalary(selectedProduct.price, parseInt(localPrice || 0), selectedCategory, parseInt(localTips) || 0, 'normal', salarySettings) * localQuantity).toLocaleString()}₽</span></div></div>)}
              
              {/* Локация */}
              {activeLocations.length > 0 && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <label className="text-sm font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Точка продаж</label>
                  <select value={saleLocation} onChange={(e) => {
                    setSaleLocation(e.target.value);
                    if (myLogin && e.target.value) {
                      const upd = { ...profilesData, [myLogin]: { ...(profilesData[myLogin] || {}), defaultLocation: e.target.value } };
                      updateProfilesData(upd);
                    }
                  }} className="w-full p-3 border-2 rounded-lg mt-1 focus:border-amber-500 focus:outline-none">
                    <option value="">Не указана</option>
                    {[...new Set(activeLocations.map(l => l.city))].map(city => (
                      <optgroup key={city} label={city}>
                        {activeLocations.filter(l => l.city === city).map(loc => (
                          <option key={loc.id} value={`${loc.city} - ${loc.name}`}>{loc.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Фото */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <label className="text-sm font-semibold flex items-center gap-2"><Camera className="w-4 h-4" /> Фото (необязательно)</label>
                <div className="mt-2">
                  {salePhoto ? (
                    <div className="relative">
                      <img src={salePhoto} alt="Фото продажи" className="w-full h-40 object-cover rounded-lg" />
                      <button onClick={() => setSalePhoto(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-amber-400 hover:bg-amber-50">
                      <Image className="w-8 h-8 text-gray-400 mb-1" />
                      <span className="text-sm text-gray-500">Нажмите для загрузки</span>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2"><button onClick={() => { setSelectedProduct(null); setLocalPrice(''); setLocalQuantity(1); setLocalPaymentType('cash'); setLocalTips('0'); setLocalMixedCash(''); setLocalMixedCashless(''); setSalePhoto(null); setDiscountReason(''); setShowDiscountNote(false); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold hover:bg-gray-300">Отмена</button><button onClick={handleSave} className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white py-3 rounded-xl font-bold hover:shadow-lg">Сохранить</button></div>
            </div>
          )}
        </>)}
      </div>
    </div>
}
