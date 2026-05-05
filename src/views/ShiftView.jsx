import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, ArrowLeft, Trash2, FileInput, ChevronRight, Edit3, Package, Camera } from 'lucide-react';
import { BirdPriceEditor } from '../components/inventory/BirdPriceEditor.jsx';
import { ItemsEditor } from '../components/inventory/ItemsEditor.jsx';
import { RevisionTextInput } from '../components/inventory/RevisionTextInput.jsx';
import { formatDate } from '../utils/dates.js';
import { calculateSalary } from '../utils/salary.js';
import { useApp } from '../context/AppContext';

export default function ShiftView() {
  const { DYNAMIC_ALL_PRODUCTS, addStockHistoryEntry, archivedProducts, compressImage, currentUser, customProducts, darkMode, employeeName, getEffectiveSalary, getProductName, isAdminUnlocked, reports, salaryDecisions, salarySettings, save, saveShiftPhoto, setCurrentView, setSalaryDecisions, setTotalBirds, shiftPhotos, shiftsData, showConfirm, showNotification, stock, totalBirds, updateReports, updateShiftsData, updateStock } = useApp();

  // BLOCK 6: Geolocation helper
  const getGeoLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: false }
    );
  });

  const [shiftTab, setShiftTab] = useState('main'); // main | history | report
  const [timeInput, setTimeInput] = useState('');
  const [showTimeModal, setShowTimeModal] = useState(null); // 'open' | 'close'
  const [editingReport, setEditingReport] = useState(null); // id редактируемой продажи
  const [editForm, setEditForm] = useState({});
  const [reportConfirmed, setReportConfirmed] = useState(false);

  const login = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
  const todayStr = formatDate(new Date());
  const shiftKey = `${login}_${todayStr}`;
  const myShift = shiftsData[shiftKey] || {};

  // Мои продажи сегодня (только pending + approved своего отчёта)
  const myTodayReports = reports.filter(r =>
    r.employee === employeeName &&
    (r.date||'').split(',')[0].trim() === todayStr
  ).sort((a, b) => b.createdAt - a.createdAt);

  // Продажи в статусе "черновик" (ещё не подтверждены мной)
  const draftReports = myTodayReports.filter(r => r.reviewStatus === 'pending' || r.reviewStatus === 'draft');
  const confirmedReports = myTodayReports.filter(r => r.reviewStatus === 'approved' || r.reviewStatus === 'submitted');

  const myTotal = myTodayReports.reduce((s, r) => s + r.total, 0);
  const myCash = myTodayReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
  const myCashless = myTodayReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
  const mySalary = myTodayReports.reduce((s, r) => s + getEffectiveSalary(r), 0);

  const [shiftPhotoMode, setShiftPhotoMode] = useState(null); // 'open' | 'close'
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [invPhotoUrl, setInvPhotoUrl] = useState(null);
  const [invTextMode, setInvTextMode] = useState(false);
  const [invRawText, setInvRawText] = useState('');

  // FIX: Lifted state from InventoryModal (was inline component — re-mount on parent re-render lost state)
  const [mTotalBirds, setMTotalBirds] = useState(0);
  const [mBirdsByPrice, setMBirdsByPrice] = useState({});
  const [mItems, setMItems] = useState([]);
  const [mTextMode, setMTextMode] = useState(false);

  // FIX: Lifted state from RevisionTab (same re-mount issue)
  const [revEditMode, setRevEditMode] = useState(false);
  const [revTextMode, setRevTextMode] = useState(false);
  const [revTotalBirds, setRevTotalBirds] = useState(0);
  const [revBirdsByPrice, setRevBirdsByPrice] = useState({});
  const [revItems, setRevItems] = useState([]);

  const inventory = myShift?.inventory || null;
  const isAdmin = isAdminUnlocked || currentUser?.role === 'admin' || currentUser?.isAdmin;
  
  // Bird price tiers from catalog
  const birdPriceTiers = useMemo(() => {
    const tiers = {};
    DYNAMIC_ALL_PRODUCTS.filter(p => p.category === 'Птички-свистульки' && !(archivedProducts||[]).includes(p.name))
      .forEach(p => {
        if (!tiers[p.price]) tiers[p.price] = [];
        tiers[p.price].push(p.name);
      });
    return tiers;
  }, [customProducts, archivedProducts]);
  
  // 3D and Мех products list (individual items, not grouped by price)
  const otherProducts = useMemo(() => {
    return DYNAMIC_ALL_PRODUCTS
      .filter(p => p.category !== 'Птички-свистульки' && !(archivedProducts||[]).includes(p.name))
      .map(p => ({ name: p.name, emoji: p.emoji, category: p.category, price: p.price }));
  }, [customProducts, archivedProducts]);
  
  // Parse text input into structured data
  // Save inventory
  const saveInventoryData = (data, photo) => {
    // data = { totalBirds, birdsByPrice: { 300: 10, 400: 20 }, items: [{ name, qty }] }
    const birdValue = Object.entries(data.birdsByPrice).reduce((s, [p, c]) => s + parseInt(p, 10) * c, 0);
    const birdCount = Object.values(data.birdsByPrice).reduce((s, c) => s + c, 0);
    const itemCount = data.items.reduce((s, i) => s + i.qty, 0);
    const inv = {
      totalBirds: data.totalBirds || birdCount,
      birdsByPrice: data.birdsByPrice,
      birdValue,
      items: data.items,
      totalCount: (data.totalBirds || birdCount) + itemCount,
      photos: [...(inventory?.photos || []), ...(photo ? [photo] : [])],
      createdAt: inventory?.createdAt || Date.now(),
      updatedAt: Date.now(),
      history: [...(inventory?.history || []),
        { time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), action: inventory ? 'Обновлена' : 'Создана', by: employeeName }
      ]
    };
    const updated = { ...shiftsData, [shiftKey]: { ...myShift, inventory: inv } };
    updateShiftsData(updated);
    showNotification(inventory ? 'Ревизия обновлена ✓' : 'Ревизия сохранена ✓');
  };
  
  // Photo handler
  const handleInvPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showNotification('Фото слишком большое', 'error'); return; }
    try { const c = await compressImage(file, 800, 0.6); if (c) setInvPhotoUrl(c); } catch { showNotification('Ошибка', 'error'); }
  };
  
  // ═══ Bird Price Editor ═══
  // ═══ Items Editor (3D / Мех / Кастомные — by name) ═══
  // ═══ Text Input Mode ═══
  // FIX: InventoryModal state lifted to ShiftView level (was inline component causing state loss)
  const openInventoryModal = () => {
    setMTotalBirds(0); setMBirdsByPrice({}); setMItems([]); setMTextMode(false);
    setShowInventoryModal(true);
  };
  const mBirdCount = Object.values(mBirdsByPrice).reduce((s,c)=>s+c, 0);
  const mItemCount = mItems.reduce((s,i)=>s+i.qty, 0);
  const mTotalCount = (mTotalBirds || mBirdCount) + mItemCount;
  
  // ═══ Revision Tab ═══
  // FIX: RevisionTab state lifted to ShiftView level (was inline component causing state loss on re-render)
  const revBirdCount = Object.values(revBirdsByPrice).reduce((s,c)=>s+c, 0);
  const revItemCount = revItems.reduce((s,i)=>s+i.qty, 0);

  // Sync revision state when inventory changes (e.g. first load)
  // Initialize revision state when entering the revision tab
  const prevShiftTabRef = useRef(null);
  useEffect(() => {
    if (shiftTab === 'revision' && prevShiftTabRef.current !== 'revision') {
      setRevTotalBirds(inventory?.totalBirds || 0);
      setRevBirdsByPrice(inventory?.birdsByPrice ? {...inventory.birdsByPrice} : {});
      setRevItems(inventory?.items ? [...inventory.items] : []);
      setRevEditMode(false);
      setRevTextMode(false);
    }
    prevShiftTabRef.current = shiftTab;
  }, [shiftTab]);

  const renderRevisionTab = () => {
    // No inventory — creation mode
    if (!inventory && !revEditMode) {
      if (revTextMode) {
        return <RevisionTextInput onSave={(parsed) => { saveInventoryData(parsed, null); setRevTextMode(false); }} onCancel={() => setRevTextMode(false)} />;
      }
      return (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <p className="text-4xl mb-2">📋</p>
            <p className="font-bold text-purple-700">Ревизия не проведена</p>
            <p className="text-sm text-purple-500 mt-1">Укажите количество товара на витрине</p>
          </div>
          
          <BirdPriceEditor birdsByPrice={revBirdsByPrice} setBirdsByPrice={setRevBirdsByPrice} totalBirds={revTotalBirds} setTotalBirds={setRevTotalBirds} birdPriceTiers={birdPriceTiers} darkMode={darkMode} isAdmin={isAdmin} />
          <ItemsEditor items={revItems} setItems={setRevItems} otherProducts={otherProducts} darkMode={darkMode} />
          
          <label className="flex items-center justify-center h-12 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50">
            <Camera className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">📷 Фото витрины</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleInvPhoto} className="hidden" />
          </label>
          
          <div className="flex gap-2">
            <button onClick={() => setRevTextMode(true)} className="py-3 px-4 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600">📝 Текстом</button>
            <button onClick={() => {
                if ((revTotalBirds || revBirdCount) === 0 && revItemCount === 0) { showNotification('Введите количество', 'error'); return; }
                saveInventoryData({ totalBirds: revTotalBirds, birdsByPrice: revBirdsByPrice, items: revItems }, invPhotoUrl);
                setInvPhotoUrl(null);
              }} disabled={(revTotalBirds || revBirdCount) === 0 && revItemCount === 0}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
              ✅ Сохранить
            </button>
          </div>
        </div>
      );
    }
    
    // Edit mode
    if (revEditMode) {
      if (revTextMode) {
        return <RevisionTextInput onSave={(parsed) => { saveInventoryData(parsed, null); setRevEditMode(false); setRevTextMode(false); }} onCancel={() => setRevTextMode(false)} />;
      }
      return (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
            <p className="font-bold text-purple-700 text-sm">✏️ Редактирование ревизии</p>
            {((revTotalBirds||revBirdCount) + revItemCount) > 0 && <span className="text-xs text-purple-500">{(revTotalBirds||revBirdCount) + revItemCount} шт</span>}
          </div>
          <BirdPriceEditor birdsByPrice={revBirdsByPrice} setBirdsByPrice={setRevBirdsByPrice} totalBirds={revTotalBirds} setTotalBirds={setRevTotalBirds} birdPriceTiers={birdPriceTiers} darkMode={darkMode} isAdmin={isAdmin} />
          <ItemsEditor items={revItems} setItems={setRevItems} otherProducts={otherProducts} darkMode={darkMode} />
          <div className="flex gap-2">
            <button onClick={() => setRevTextMode(true)} className="py-3 px-3 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600">📝</button>
            <button onClick={() => setRevEditMode(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
            <button onClick={() => { saveInventoryData({ totalBirds: revTotalBirds, birdsByPrice: revBirdsByPrice, items: revItems }, null); setRevEditMode(false); }}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold">💾 Сохранить</button>
          </div>
        </div>
      );
    }
    
    // View mode
    const inv = inventory;
    if (!inv) return null;
    const invBirdCount = Object.values(inv.birdsByPrice || {}).reduce((s,c)=>s+c, 0);
    const invItemCount = (inv.items || []).reduce((s,i)=>s+i.qty, 0);
    
    return (
      <div className="space-y-3">
        {/* Summary */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-4 shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-white/70 text-xs">На витрине</p>
              <p className="font-bold text-2xl">{inv.totalCount || 0} шт</p>
            </div>
            {isAdmin && inv.birdValue > 0 && (
              <div className="text-right">
                <p className="text-white/70 text-xs">Стоимость птиц</p>
                <p className="font-bold text-lg">{inv.birdValue.toLocaleString()}₽</p>
              </div>
            )}
          </div>
          {inv.updatedAt && <p className="text-white/60 text-xs mt-2">Обновлено: {new Date(inv.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        
        {/* Birds */}
        {inv.totalBirds > 0 && (
          <div className={`rounded-xl p-3 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm">🐦 Птицы</h4>
              <span className="text-amber-600 font-bold text-sm">{inv.totalBirds} шт</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(inv.birdsByPrice || {}).filter(([,c])=>c>0).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([price, count]) => (
                <div key={price} className="bg-amber-50 rounded-lg px-3 py-1.5 text-center">
                  <span className="font-bold text-sm">{count}</span>
                  <span className="text-xs text-amber-600 ml-1">× {parseInt(price,10)}₽</span>
                </div>
              ))}
            </div>
            {isAdmin && (
              <p className="text-right text-xs text-gray-400 mt-1">💰 {Object.entries(inv.birdsByPrice||{}).reduce((s,[p,c])=>s+parseInt(p,10)*c, 0).toLocaleString()}₽</p>
            )}
          </div>
        )}
        
        {/* Items */}
        {(inv.items || []).length > 0 && (() => {
          const grouped = {};
          inv.items.forEach(item => {
            const prod = otherProducts.find(p => p.name === item.name);
            const cat = prod?.category || 'Другое';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push({ ...item, emoji: prod?.emoji || '📦' });
          });
          return (
            <div className={`rounded-xl p-3 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">🎮 Другие товары</h4>
                <span className="text-purple-600 font-bold text-sm">{invItemCount} шт</span>
              </div>
              {Object.entries(grouped).map(([cat, catItems]) => (
                <div key={cat} className="mb-2 last:mb-0">
                  <p className="text-[10px] font-semibold text-gray-400 mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {catItems.map((item, i) => (
                      <span key={i} className="bg-gray-50 rounded-lg px-2.5 py-1 text-sm">{item.emoji} {item.qty > 1 ? item.qty + '× ' : ''}{item.name}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        
        {/* Photos */}
        {(inv.photos || []).length > 0 && (
          <div className={`rounded-xl p-3 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <h4 className="font-bold text-sm mb-2">📷 Фото витрины</h4>
            <div className="flex gap-2 flex-wrap">
              {inv.photos.map((photo, i) => <img key={i} src={photo} alt={`Витрина ${i+1}`} className="w-20 h-20 object-cover rounded-lg" />)}
            </div>
          </div>
        )}
        
        {/* History */}
        {(inv.history || []).length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-gray-500 text-sm font-semibold flex items-center gap-1">
              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" /> История ({inv.history.length})
            </summary>
            <div className="mt-2 space-y-1">
              {inv.history.map((h, i) => (
                <div key={i} className="bg-gray-50 rounded px-3 py-1 text-xs flex justify-between">
                  <span>{h.action}</span><span className="text-gray-400">{h.time} · {h.by}</span>
                </div>
              ))}
            </div>
          </details>
        )}
        
        {/* Add photo */}
        <label className="flex items-center justify-center h-12 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50">
          <Camera className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">📷 Добавить фото</span>
          <input type="file" accept="image/*" capture="environment" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            try { const c = await compressImage(file, 800, 0.6); if (c) {
              const upd = { ...inv, photos: [...(inv.photos||[]), c], updatedAt: Date.now(), history: [...(inv.history||[]), { time: new Date().toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'}), action: 'Добавлено фото', by: employeeName }] };
              updateShiftsData({ ...shiftsData, [shiftKey]: { ...myShift, inventory: upd } });
              showNotification('📷 Фото добавлено');
            }} catch { /* silent */ }
          }} className="hidden" />
        </label>
        
        <button onClick={() => {
          setRevTotalBirds(inv.totalBirds || 0);
          setRevBirdsByPrice(inv.birdsByPrice ? {...inv.birdsByPrice} : {});
          setRevItems(inv.items ? [...inv.items] : []);
          setRevEditMode(true);
        }} className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
          <Edit3 className="w-4 h-4" /> Обновить ревизию
        </button>
      </div>
    );
  };

  const [shiftElapsed, setShiftElapsed] = useState('');
  useEffect(() => {
    if (!myShift?.openTime || myShift?.status !== 'open') { setShiftElapsed(''); return; }
    const calc = () => { try { const [h,m] = myShift.openTime.split(':'); const o = new Date(); o.setHours(parseInt(h,10),parseInt(m,10),0,0); let d = Date.now() - o.getTime(); if (d < 0) d += 86400000; if (d > 86400000) { setShiftElapsed(''); return; } setShiftElapsed(Math.floor(d/3600000) + 'ч ' + Math.floor((d%3600000)/60000) + 'м'); } catch { /* silent */ } };
    calc(); const t = setInterval(calc, 60000); return () => clearInterval(t);
  }, [myShift?.openTime, myShift?.status]);

  const openShift = async (time) => {
    if (myShift?.status === 'open') { showNotification('Смена уже открыта', 'error'); return; }
    const t = time || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    let geo = null; try { geo = await getGeoLocation(); } catch { /* silent */ }
    const updated = { ...shiftsData, [shiftKey]: { openTime: t, status: 'open', openedAt: Date.now(), openGeo: geo } };
    updateShiftsData(updated);
    setShowTimeModal(null);
    // Предлагаем сделать фото стола
    setShiftPhotoMode('open');
    showNotification(`Смена открыта в ${t}${geo ? ' 📍' : ''}`);
  };

  const handleShiftPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400, 0.5);
    if (compressed) {
      const photoKey = shiftKey + '_' + (shiftPhotoMode || 'open');
      saveShiftPhoto(photoKey, compressed);
      // Сохраняем ссылку в данных смены
      const updShift = { ...shiftsData[shiftKey], [shiftPhotoMode === 'open' ? 'openPhoto' : 'closePhoto']: photoKey };
      updateShiftsData({ ...shiftsData, [shiftKey]: updShift });
      showNotification('📷 Фото стола сохранено');
    }
    setShiftPhotoMode(null);
  };

  const closeShift = (time) => {
    if (myShift?.status !== 'open') { showNotification('Смена не открыта', 'error'); return; }
    const t = time || new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    // Валидация: closeTime не раньше openTime (кроме ночных смен)
    if (myShift?.openTime && t < myShift.openTime) {
      const isNightShift = parseInt(myShift.openTime.split(':')[0], 10) >= 18;
      if (!isNightShift) { showNotification('Время закрытия не может быть раньше открытия', 'error'); return; }
    }
    // Показываем сводку перед закрытием
    const topProduct = myTodayReports.reduce((acc, r) => {
      const name = getProductName(r.product);
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    const topEntry = Object.entries(topProduct).sort((a, b) => b[1] - a[1])[0];
    const summary = `Закрыть смену в ${t}?\n\n📊 Сводка:\n• Продаж: ${myTodayReports.length}\n• Выручка: ${myTotal.toLocaleString()}₽\n• Топ-товар: ${topEntry ? `${topEntry[0]} (${topEntry[1]} шт)` : '—'}`;
    showConfirm(summary, async () => {
      const geo = await getGeoLocation();
      const updated = { ...shiftsData, [shiftKey]: { ...myShift, closeTime: t, status: 'closed', closedAt: Date.now(), closeGeo: geo } };
      updateShiftsData(updated);
      showNotification(`Смена закрыта в ${t}`);
      setShiftPhotoMode('close');
    });
    setShowTimeModal(null);
  };

  // Модалка для фото стола при открытии/закрытии смены
  const ShiftPhotoPrompt = () => shiftPhotoMode ? (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShiftPhotoMode(null)}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-2">📷 Фото рабочего стола</h3>
        <p className="text-gray-500 text-sm mb-4">
          {shiftPhotoMode === 'open' ? 'Сфотографируйте рабочее место перед началом смены' : 'Сфотографируйте рабочее место после завершения'}
        </p>
        {shiftPhotos[shiftKey + '_' + shiftPhotoMode] ? (
          <div className="relative mb-4">
            <img src={shiftPhotos[shiftKey + '_' + shiftPhotoMode]} alt="Фото стола" className="w-full h-48 object-cover rounded-xl" />
            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">✓ Загружено</span>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50 mb-4">
            <Camera className="w-10 h-10 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Нажмите для съёмки</span>
            <input type="file" accept="image/*" capture="environment" onChange={handleShiftPhoto} className="hidden" />
          </label>
        )}
        <button onClick={() => { const wasOpen = shiftPhotoMode === 'open'; setShiftPhotoMode(null); if (wasOpen && !myShift?.inventory) openInventoryModal(); }} className="w-full bg-gray-200 py-2 rounded-xl font-semibold hover:bg-gray-300">
          {shiftPhotos[shiftKey + '_' + shiftPhotoMode] ? 'Готово' : 'Пропустить'}
        </button>
      </div>
    </div>
  ) : null;

  const submitMyReport = () => {
    if (draftReports.length === 0) { showNotification('Нет продаж для подтверждения', 'error'); return; }
    showConfirm(`Подтвердить отчёт за ${todayStr}? После этого он уйдёт на проверку администратору.`, () => {
      const ids = draftReports.map(r => r.id);
      const updated = reports.map(r => ids.includes(r.id) ? { ...r, reviewStatus: 'submitted', submittedAt: Date.now() } : r);
      updateReports(updated);
      const shiftUpd = { ...shiftsData, [shiftKey]: { ...myShift, reportSubmittedAt: Date.now() } };
      updateShiftsData(shiftUpd);
      showNotification('Отчёт отправлен на проверку ✓');
      setShiftTab('main');
    });
  };

  const startEditReport = (r) => {
    setEditingReport(r.id);
    setEditForm({ product: r.product, salePrice: String(r.salePrice), tips: String(r.tips || 0), paymentType: r.paymentType });
  };

  const saveEditReport = (r) => {
    const priceNum = parseInt(editForm.salePrice) || r.salePrice;
    const tipsNum = parseInt(editForm.tips) || 0;
    const prod = DYNAMIC_ALL_PRODUCTS.find(p => p.name === editForm.product) || { name: editForm.product, price: r.basePrice, category: r.category };
    // FIX: Используем цену найденного товара как basePrice (ранее всегда использовал старый r.basePrice)
    const newBase = prod.price || r.basePrice;
    const newCategory = prod.category || r.category;
    const newSalary = calculateSalary(newBase, priceNum, newCategory, tipsNum, 'normal', salarySettings);
    let cashAmt = 0, cashlessAmt = 0;
    if (editForm.paymentType === 'cash') cashAmt = priceNum;
    else if (editForm.paymentType === 'cashless') cashlessAmt = priceNum;
    else { cashAmt = r.cashAmount; cashlessAmt = r.cashlessAmount; }
    const editLog = { by: employeeName, at: new Date().toLocaleString('ru-RU'), prev: { product: r.product, price: r.salePrice, tips: r.tips } };
    const updated = reports.map(rep => rep.id === r.id
      ? { ...rep, product: editForm.product, basePrice: newBase, category: newCategory, salePrice: priceNum, total: priceNum, tips: tipsNum, salary: newSalary, paymentType: editForm.paymentType, cashAmount: cashAmt, cashlessAmount: cashlessAmt, isBelowBase: priceNum < newBase, editHistory: [...(rep.editHistory || []), editLog] }
      : rep
    );
    updateReports(updated);
    setEditingReport(null);
    showNotification('Продажа обновлена');
  };

  const deleteMyReport = (id) => {
    showConfirm('Удалить эту продажу?', () => {
      // FIX: Восстанавливаем склад при удалении (ранее не возвращался)
      const r = reports.find(x => x.id === id);
      const productName = r ? getProductName(r.product) : null;
      if (r && !r.isUnrecognized && productName && stock[productName]) {
        const newStock = {...stock};
        newStock[productName] = {...newStock[productName], count: newStock[productName].count + (r.quantity || 1)};
        updateStock(newStock);
        addStockHistoryEntry(productName, 'return', (r.quantity || 1), `Удалена продажа ${employeeName}`);
      }
      // Удаляем решения по зарплате
      const nd = {...salaryDecisions}; delete nd[id]; setSalaryDecisions(nd); save('likebird-salary-decisions', nd);
      updateReports(reports.filter(x => x.id !== id));
      showNotification('Удалено');
    });
  };

  const TABS = [
    { id: 'main', label: '📋 Смена' },
    { id: 'revision', label: '📦 Ревизия' },
    { id: 'report', label: '✏️ Мой отчёт' },
    { id: 'history', label: '📜 История' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 pb-8">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">🔄 Смена</h2>
            <p className="text-white/70 text-sm">{todayStr} · {employeeName}</p>
          </div>
          {myShift.status === 'open' && (
            <><span className="bg-green-400 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">● Открыта</span>{shiftElapsed && <span className="text-purple-600 text-sm font-semibold ml-2">⏱ {shiftElapsed}</span>}</>
          )}
          {myShift.status === 'closed' && (
            <span className="bg-gray-400 text-white text-xs px-3 py-1 rounded-full font-bold">■ Закрыта</span>
          )}
        </div>
      </div>

      {/* Табы */}
      <div className="flex bg-white shadow-sm sticky top-[76px] z-10">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setShiftTab(t.id)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-all ${shiftTab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">

        {/* ── ВКЛАДКА: СМЕНА (главная) ── */}
        {shiftTab === 'main' && (
          <>
            {/* Статус смены */}
            <div className={`rounded-2xl p-5 shadow-lg ${myShift.status === 'open' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : myShift.status === 'closed' ? 'bg-gradient-to-r from-gray-400 to-gray-500' : 'bg-gradient-to-r from-blue-400 to-indigo-500'} text-white`}>
              {!myShift.status && (
                <div className="text-center py-2">
                  <p className="text-3xl mb-2">🌅</p>
                  <p className="text-xl font-black">Смена не открыта</p>
                  <p className="text-white/70 text-sm mt-1">Нажмите кнопку чтобы начать работу</p>
                </div>
              )}
              {myShift.status === 'open' && (
                <div>
                  <p className="text-white/70 text-sm">Смена открыта</p>
                  <p className="text-3xl font-black">{myShift.openTime}</p>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                    <div><p className="text-white/60 text-xs">Продаж</p><p className="font-bold text-lg">{myTodayReports.length}</p></div>
                    <div><p className="text-white/60 text-xs">Выручка</p><p className="font-bold text-lg">{myTotal.toLocaleString()}₽</p></div>
                    <div><p className="text-white/60 text-xs">Моя ЗП</p><p className="font-bold text-lg">{mySalary.toLocaleString()}₽</p></div>
                  </div>
                  {(myCash > 0 || myCashless > 0) && (
                    <div className="flex gap-4 mt-2 text-sm text-white/80 justify-center">
                      {myCash > 0 && <span className="bg-white/20 rounded-lg px-3 py-1">💵 {myCash.toLocaleString()}₽</span>}
                      {myCashless > 0 && <span className="bg-white/20 rounded-lg px-3 py-1">💳 {myCashless.toLocaleString()}₽</span>}
                    </div>
                  )}
                  {inventory && (
                    <button onClick={() => setShiftTab('revision')} className="mt-2 bg-white/15 rounded-lg px-3 py-1.5 text-xs text-white/90 w-full text-center hover:bg-white/25">
                      📦 Ревизия: {inventory.totalCount || 0} шт{isAdmin && inventory.birdValue ? ` · ${inventory.birdValue.toLocaleString()}₽` : ''}
                    </button>
                  )}
                  {!inventory && myShift.status === 'open' && (
                    <button onClick={() => openInventoryModal()} className="mt-2 bg-yellow-500/30 border border-yellow-300/50 rounded-lg px-3 py-1.5 text-xs text-white w-full text-center hover:bg-yellow-500/40 animate-pulse">
                      ⚠️ Ревизия не проведена — нажмите чтобы заполнить
                    </button>
                  )}
                </div>
              )}
              {myShift.status === 'closed' && (
                <div>
                  <p className="text-white/70 text-sm">Смена закрыта</p>
                  <p className="text-2xl font-black">{myShift.openTime} → {myShift.closeTime}</p>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-center">
                    <div><p className="text-white/60 text-xs">Продаж</p><p className="font-bold">{myTodayReports.length}</p></div>
                    <div><p className="text-white/60 text-xs">Выручка</p><p className="font-bold">{myTotal.toLocaleString()}₽</p></div>
                    <div><p className="text-white/60 text-xs">ЗП</p><p className="font-bold">{mySalary.toLocaleString()}₽</p></div>
                  </div>
                </div>
              )}
            </div>

            {/* Кнопки смены */}
            <div className="grid grid-cols-2 gap-3">
              {!myShift.status && (
                <button onClick={() => setShowTimeModal('open')}
                  className="col-span-2 py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                  🟢 Открыть смену
                </button>
              )}
              {myShift.status === 'open' && (
                <>
                  <button onClick={() => setCurrentView('new-report')}
                    className="py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> Новая продажа
                  </button>
                  <button onClick={() => setCurrentView('text-import')}
                    className="py-4 bg-white text-blue-600 border-2 border-blue-300 rounded-2xl font-bold shadow hover:shadow-md transition-all flex items-center justify-center gap-2">
                    <FileInput className="w-5 h-5" /> Импорт
                  </button>
                  <button onClick={() => setShiftTab('report')}
                    className="py-3 bg-white text-indigo-600 border-2 border-indigo-300 rounded-xl font-bold shadow hover:shadow-md transition-all flex items-center justify-center gap-2">
                    <Edit3 className="w-4 h-4" /> Мой отчёт
                  </button>
                  <button onClick={() => setShiftTab('revision')}
                    className="py-3 bg-white text-purple-600 border-2 border-purple-300 rounded-xl font-bold shadow hover:shadow-md transition-all flex items-center justify-center gap-2">
                    <Package className="w-4 h-4" /> Ревизия
                  </button>
                  <button onClick={() => setShowTimeModal('close')}
                    className="py-3 bg-white text-red-500 border-2 border-red-300 rounded-xl font-bold shadow hover:shadow-md transition-all flex items-center justify-center gap-2">
                    🔴 Закрыть смену
                  </button>
                </>
              )}
              {myShift.status === 'closed' && (
                <>
                  <button onClick={() => setShiftTab('report')}
                    className="py-3 bg-indigo-500 text-white rounded-xl font-bold shadow hover:shadow-md transition-all flex items-center justify-center gap-2">
                    <Edit3 className="w-4 h-4" /> Отчёт
                  </button>
                  <button onClick={() => {
                      showConfirm(`Смена уже была закрыта (${myShift.openTime} → ${myShift.closeTime}). Переоткрыть? Время закрытия будет сброшено.`, () => {
                        // FIX: Напрямую обновляем parent state вместо setShowTimeModal (которая теряется при remount)
                        const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                        const updated = { ...shiftsData, [shiftKey]: { openTime: t, status: 'open', openedAt: Date.now() } };
                        updateShiftsData(updated);
                        showNotification(`Смена переоткрыта в ${t}`);
                      });
                    }}
                    className="py-3 bg-white text-green-600 border-2 border-green-300 rounded-xl font-bold shadow hover:shadow-md transition-all">
                    Переоткрыть
                  </button>
                </>
              )}
            </div>

            {/* Последние продажи */}
            {myTodayReports.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-700 mb-2 text-sm">Последние продажи ({myTodayReports.length})</h3>
                <div className="space-y-2">
                  {myTodayReports.slice(0, 5).map(r => (
                    <div key={r.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                      <div className="text-2xl">{DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product)?.emoji || '🐦'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{r.product}</p>
                        <p className="text-xs text-gray-400">{(r.date||'').split(',')[1]?.trim()} · {r.paymentType === 'cashless' ? '💳' : '💵'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">{r.total.toLocaleString()}₽</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${r.reviewStatus === 'submitted' ? 'bg-blue-100 text-blue-600' : r.reviewStatus === 'approved' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {r.reviewStatus === 'submitted' ? '📤' : r.reviewStatus === 'approved' ? '✅' : '📝'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {myTodayReports.length > 5 && (
                    <button onClick={() => setShiftTab('history')} className="w-full text-center text-blue-500 text-sm py-2 font-semibold">
                      Показать все ({myTodayReports.length}) →
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── ВКЛАДКА: РЕВИЗИЯ ── */}
        {shiftTab === 'revision' && (
          renderRevisionTab()
        )}

        {/* ── ВКЛАДКА: МОЙ ОТЧЁТ (редактирование перед отправкой) ── */}
        {shiftTab === 'report' && (
          <>
            {/* Сводка */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-4 text-white shadow-lg">
              <p className="text-white/70 text-sm">Итог за {todayStr}</p>
              <p className="text-3xl font-black">{myTotal.toLocaleString()} ₽</p>
              <div className="flex gap-4 mt-1 text-sm text-white/80">
                <span>{myTodayReports.length} продаж</span>
                {myCash > 0 && <span>💵 {myCash.toLocaleString()}₽</span>}
                {myCashless > 0 && <span>💳 {myCashless.toLocaleString()}₽</span>}
                <span>ЗП: {mySalary.toLocaleString()}₽</span>
              </div>
            </div>

            {/* Статус отчёта */}
            {myTodayReports.some(r => r.reviewStatus === 'submitted') && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 text-center">
                <p className="text-blue-700 font-bold">📤 Отчёт отправлен на проверку</p>
                <p className="text-blue-500 text-sm mt-0.5">Ожидайте проверки администратора</p>
              </div>
            )}
            {myTodayReports.some(r => r.reviewStatus === 'approved') && !myTodayReports.some(r => r.reviewStatus === 'submitted') && (
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-3 text-center">
                <p className="text-green-700 font-bold">✅ Отчёт подтверждён администратором</p>
              </div>
            )}

            {/* Список для редактирования */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700 text-sm">Продажи сегодня</h3>
                <button onClick={() => setCurrentView('new-report')}
                  className="flex items-center gap-1 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-amber-600">
                  <Plus className="w-4 h-4" /> Добавить
                </button>
              </div>
              {myTodayReports.length === 0 && (
                <div className="bg-white rounded-xl p-8 text-center shadow">
                  <p className="text-4xl mb-2">📋</p>
                  <p className="text-gray-400">Нет продаж за сегодня</p>
                </div>
              )}
              {myTodayReports.map(r => (
                <div key={r.id} className={`bg-white rounded-xl shadow overflow-hidden ${editingReport === r.id ? 'ring-2 ring-blue-400' : ''}`}>
                  {editingReport === r.id ? (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl">{DYNAMIC_ALL_PRODUCTS.find(p => p.name === editForm.product)?.emoji || '🐦'}</div>
                        <p className="font-bold text-gray-700">{r.product}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 font-semibold">Цена ₽</label>
                          <input type="number" value={editForm.salePrice} onChange={e => setEditForm({...editForm, salePrice: e.target.value})}
                            className="w-full p-2.5 border-2 border-blue-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none mt-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-semibold">Чаевые ₽</label>
                          <input type="number" value={editForm.tips} onChange={e => setEditForm({...editForm, tips: e.target.value})}
                            className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {['cash', 'cashless', 'mixed'].map(pt => (
                          <button key={pt} onClick={() => setEditForm({...editForm, paymentType: pt})}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${editForm.paymentType === pt ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
                            {pt === 'cash' ? '💵 Нал' : pt === 'cashless' ? '💳 Безнал' : '💵💳 Смеш'}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEditReport(r)} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 text-sm">✅ Сохранить</button>
                        <button onClick={() => setEditingReport(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm">Отмена</button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 flex items-center gap-3">
                      <div className="text-2xl flex-shrink-0">{DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product)?.emoji || '🐦'}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{r.product}</p>
                        <p className="text-xs text-gray-400">{(r.date||'').split(',')[1]?.trim()} · {r.paymentType === 'cashless' ? '💳' : '💵'} · ЗП: {getEffectiveSalary(r)}₽</p>
                      </div>
                      <p className="font-bold text-gray-800">{r.total.toLocaleString()}₽</p>
                      {(r.reviewStatus === 'pending' || r.reviewStatus === 'draft') && (
                        <div className="flex gap-1">
                          <button onClick={() => startEditReport(r)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteMyReport(r.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                      {r.reviewStatus === 'submitted' && <span className="text-xs text-blue-500 font-semibold">📤</span>}
                      {r.reviewStatus === 'approved' && <span className="text-xs text-green-500 font-semibold">✅</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Кнопка отправить отчёт */}
            {draftReports.length > 0 && (
              <button onClick={submitMyReport}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all">
                📤 Отправить отчёт на проверку ({draftReports.length} продаж)
              </button>
            )}
          </>
        )}

        {/* ── ВКЛАДКА: ИСТОРИЯ ── */}
        {shiftTab === 'history' && (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700">Все мои продажи сегодня</h3>
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold">{myTodayReports.length}</span>
            </div>
            {myTodayReports.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow">
                <p className="text-4xl mb-2">📜</p>
                <p className="text-gray-400">Нет продаж за сегодня</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myTodayReports.map(r => (
                  <div key={r.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                    <div className="text-2xl flex-shrink-0">{DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product)?.emoji || '🐦'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r.product}</p>
                      <p className="text-xs text-gray-400">
                        {(r.date||'').split(',')[1]?.trim()} · {r.paymentType === 'cashless' ? '💳 Безнал' : '💵 Нал'}
                        {r.location && ` · 📍 ${r.location.split(' - ').pop()}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold">{r.total.toLocaleString()}₽</p>
                      <p className="text-xs text-amber-600">ЗП: {getEffectiveSalary(r)}₽</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        r.reviewStatus === 'approved' ? 'bg-green-100 text-green-600' :
                        r.reviewStatus === 'submitted' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {r.reviewStatus === 'approved' ? '✅ Принято' : r.reviewStatus === 'submitted' ? '📤 Отправлено' : '📝 Черновик'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      <ShiftPhotoPrompt />
      {/* FIX: InventoryModal inlined — state lifted to ShiftView to prevent re-mount */}
      {showInventoryModal && (mTextMode ? (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInventoryModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">📋 Текстовый ввод</h3>
            <RevisionTextInput onSave={(parsed) => {
              saveInventoryData(parsed, invPhotoUrl);
              setShowInventoryModal(false); setInvPhotoUrl(null);
            }} onCancel={() => setMTextMode(false)} />
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInventoryModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">📋 Ревизия при открытии</h3>
                  <p className="text-white/70 text-sm">Укажите количество товара</p>
                </div>
                {mTotalCount > 0 && <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{mTotalCount} шт</span>}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <BirdPriceEditor birdsByPrice={mBirdsByPrice} setBirdsByPrice={setMBirdsByPrice} totalBirds={mTotalBirds} setTotalBirds={setMTotalBirds} birdPriceTiers={birdPriceTiers} darkMode={darkMode} isAdmin={isAdmin} />
              <ItemsEditor items={mItems} setItems={setMItems} otherProducts={otherProducts} darkMode={darkMode} />
              
              {invPhotoUrl ? (
                <div className="relative">
                  <img src={invPhotoUrl} alt="Витрина" className="w-full h-28 object-cover rounded-xl" />
                  <button onClick={() => setInvPhotoUrl(null)} className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center">✕</button>
                </div>
              ) : (
                <label className="flex items-center justify-center h-12 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50">
                  <Camera className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">📷 Фото витрины</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleInvPhoto} className="hidden" />
                </label>
              )}
              
              <div className="flex gap-2">
                <button onClick={() => setMTextMode(true)} className="py-3 px-4 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-200">📝 Текстом</button>
                <button onClick={() => setShowInventoryModal(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Пропустить</button>
                <button onClick={() => {
                    saveInventoryData({ totalBirds: mTotalBirds, birdsByPrice: mBirdsByPrice, items: mItems }, invPhotoUrl);
                    setShowInventoryModal(false); setInvPhotoUrl(null);
                  }} disabled={mTotalCount === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                  ✅ Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {/* Модал выбора времени */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-auto shadow-2xl">
            <h3 className="text-xl font-black mb-4">
              {showTimeModal === 'open' ? '🟢 Открыть смену' : '🔴 Закрыть смену'}
            </h3>
            <p className="text-gray-500 text-sm mb-4">Укажите время или нажмите «Сейчас»</p>
            <input type="time" value={timeInput}
              onChange={e => setTimeInput(e.target.value)}
              className="w-full p-4 border-2 border-blue-200 rounded-xl text-2xl text-center font-bold focus:border-blue-500 focus:outline-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setShowTimeModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">Отмена</button>
              <button onClick={() => showTimeModal === 'open' ? openShift(timeInput || null) : closeShift(timeInput || null)}
                className={`flex-1 py-3 text-white rounded-xl font-bold ${showTimeModal === 'open' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                {timeInput ? `В ${timeInput}` : 'Сейчас'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
