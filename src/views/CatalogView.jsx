/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, no-shadow */
// FIX (merge admin → catalog): в Каталог перенесён функционал, ранее живший в
// «Админ-панель → Склад+»: CRUD товаров (включая цены/эмодзи/фото/архив/алиасы),
// Ревизия, История движения, Списания, Автозаказ. Все админ-блоки видны
// только пользователю с правами админа (isAdmin). Логика и стейт идентичны
// исходному коду в AdminView — это перенос, а не доработка.
// «Себестоимость» и «Точки» сознательно НЕ перенесены и остаются в админ-панели.
import React, { useState } from 'react';
import {
  ArrowLeft, Search, X, ChevronRight, Camera, Plus, Edit3, Trash2,
  Package, Bell, Shield,
} from 'lucide-react';
import { PRODUCTS, CAT_ICONS } from '../data/products.js';
import { useApp } from '../context/AppContext';

export default function CatalogView() {
  const {
    setCurrentView, customProducts, darkMode, productPhotos,
    compressImage, showNotification, updateProductPhotos,
    DYNAMIC_ALL_PRODUCTS, CUSTOM_ALIASES,
    // admin-only data
    currentUser, customAliases, archivedProducts, stock, stockHistory,
    writeOffs, autoOrderList, totalBirds, employeeName,
    // admin-only fns
    addCustomProduct, removeCustomProduct, setCustomProducts,
    toggleArchiveProduct, saveAlias, removeAlias,
    deleteMediaPhoto, save,
    addStockHistoryEntry, addWriteOff,
    updateStock, getLowStockItems,
    generateAutoOrder, getAutoOrderText, updateAutoOrderList,
    setTotalBirds, showConfirm, logAction,
  } = useApp();

  const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin';

  // ── Базовый стейт каталога (как раньше) ─────────────────────────────
  const [activeCategory, setActiveCategory] = useState(null);
  const [localSearch, setLocalSearch] = useState('');

  // ── Стейт админских подвкладок ─────────────────────────────────────
  const [catalogAdminTab, setCatalogAdminTab] = useState('catalog');

  // ── Стейт CRUD товаров (перенесено из AdminView) ───────────────────
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Птички-свистульки', emoji: '🎁' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductData, setEditProductData] = useState({ name: '', price: '', emoji: '', category: '' });
  const [productPhoto, setProductPhoto] = useState(null);
  const [showAddProductForm, setShowAddProductForm] = useState(false);

  // ── Стейт списаний/истории (перенесено из AdminView) ───────────────
  const [historyLimit] = useState(50);
  const [newWriteOff, setNewWriteOff] = useState({ product: '', quantity: '', reason: '' });

  // ── Стейт ревизии (перенесено из AdminView) ────────────────────────
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

  // ── Список админских вкладок ──────────────────────────────────────
  const adminTabs = [
    { id: 'catalog', label: '📋 Каталог' },
    { id: 'revision', label: '📋 Ревизия' },
    { id: 'history', label: '📜 История' },
    { id: 'writeoff', label: '🗑️ Списания' },
    { id: 'autoorder', label: '📦 Автозаказ' },
  ];

  // ────────────────────────────────────────────────────────────────────
  // РЕНДЕР: основной каталог (видят все; админу — c кнопками CRUD)
  // ────────────────────────────────────────────────────────────────────
  const renderCatalog = () => (
    <>
      {/* Админ: форма добавления товара (раскрывается по кнопке) */}
      {isAdmin && (
        <div className={`rounded-xl p-4 shadow mb-3 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <button onClick={() => setShowAddProductForm(v => !v)}
            className="w-full flex items-center justify-between font-bold text-purple-700">
            <span className="flex items-center gap-2"><Plus className="w-5 h-5" />Добавить товар</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showAddProductForm ? 'rotate-90' : ''}`} />
          </button>
          {showAddProductForm && (
            <div className="space-y-2 mt-3">
              <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} placeholder="Название" className="w-full p-2 border rounded" />
              <div className="flex gap-2">
                <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} placeholder="Цена" className="flex-1 p-2 border rounded" />
                <input type="text" value={newProduct.emoji} onChange={(e) => setNewProduct({...newProduct, emoji: e.target.value})} placeholder="🎁" className="w-16 p-2 border rounded text-center" />
              </div>
              <select value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border rounded">
                {Object.keys(PRODUCTS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
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
          )}
        </div>
      )}

      {/* Админ: алиасы товаров */}
      {isAdmin && (
        <div className={`rounded-xl p-4 shadow mb-3 ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <details className="group">
            <summary className="cursor-pointer font-bold flex items-center gap-2 text-sm">
              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />📝 Алиасы товаров ({Object.keys(customAliases || {}).length})
            </summary>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-500">Алиасы позволяют распознавать товары по альтернативным названиям (из отчётов, ревизий)</p>
              {Object.entries(customAliases || {}).length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(customAliases || {}).map(([alias, prod]) => (
                    <div key={alias} className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-1.5 text-sm">
                      <span>«{alias}» → <strong>{prod}</strong></span>
                      <button onClick={() => { removeAlias(alias); showNotification('Алиас удалён'); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" id="catalog-alias-input" placeholder="Алиас (как пишут)" className="flex-1 p-2 border rounded-lg text-sm" />
                <input type="text" id="catalog-alias-product" placeholder="Товар из каталога" className="flex-1 p-2 border rounded-lg text-sm" list="catalog-alias-prodlist" />
                <datalist id="catalog-alias-prodlist">{DYNAMIC_ALL_PRODUCTS.map(p => <option key={p.name} value={p.name}>{p.emoji} {p.name}</option>)}</datalist>
                <button onClick={() => {
                  const al = document.getElementById('catalog-alias-input')?.value;
                  const pr = document.getElementById('catalog-alias-product')?.value;
                  if (al && pr && DYNAMIC_ALL_PRODUCTS.find(p => p.name === pr)) {
                    saveAlias(al, pr);
                    document.getElementById('catalog-alias-input').value = '';
                    document.getElementById('catalog-alias-product').value = '';
                  } else { showNotification('Укажите алиас и выберите товар из каталога', 'error'); }
                }} className="bg-purple-500 text-white px-3 rounded-lg text-sm font-bold">+</button>
              </div>
            </div>
          </details>
        </div>
      )}

      {/* Сам каталог */}
      {!activeCategory && !localSearch ? (
        <div className="space-y-3">{Object.keys(PRODUCTS).map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><span className="text-3xl">{CAT_ICONS[cat]}</span><div className="text-left"><h3 className="font-bold">{cat}</h3><p className="text-gray-400 text-xs">{PRODUCTS[cat].length} товаров</p></div><ChevronRight className="w-5 h-5 text-gray-400 ml-auto" /></button>))}</div>
      ) : (<>
        {activeCategory && !localSearch && <button onClick={() => setActiveCategory(null)} className="mb-3 text-amber-600 font-semibold flex items-center gap-1 text-sm hover:text-amber-700"><ArrowLeft className="w-4 h-4" /> Назад</button>}
        {localSearch && <p className="mb-3 text-gray-500 text-sm">Результаты поиска: "{localSearch}"</p>}
        {(() => {
          const prods = localSearch
            ? DYNAMIC_ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(localSearch.toLowerCase()) || p.aliases.some(a => a.includes(localSearch.toLowerCase())))
            : (PRODUCTS[activeCategory] || []).map(p => ({...p, category: activeCategory, isBase: true}))
                .concat(customProducts.filter(cp => cp.category === activeCategory).map(p => ({...p, isBase: false})));
          if (prods.length === 0) return <div className="text-center py-10 text-gray-400"><Search className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Ничего не найдено</p></div>;
          const grouped = prods.reduce((acc, p) => { if (!acc[p.price]) acc[p.price] = []; acc[p.price].push(p); return acc; }, {});
          return Object.keys(grouped).map(Number).sort((a,b) => a-b).map(price => (
            <div key={price} className="mb-4">
              <div className="bg-amber-500 rounded-lg p-2 mb-2 shadow"><span className="text-white text-lg font-bold">{price}₽</span></div>
              <div className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>{grouped[price].map((p, i) => {
                const photo = productPhotos[p.name];
                // Для localSearch у элементов нет isBase — определим через customProducts
                const isBase = p.isBase !== undefined ? p.isBase : !customProducts.find(cp => cp.name === p.name);
                const isEditingThis = isAdmin && editingProduct === p.name;
                return (
                  <div key={i} className="p-3 border-b last:border-0 flex items-center gap-3 text-sm">
                    {photo ? <img src={photo} alt={p.name} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm" /> : <span className="text-2xl flex-shrink-0 w-24 h-24 bg-amber-50 rounded-xl flex items-center justify-center text-4xl">{p.emoji}</span>}

                    {isEditingThis ? (
                      <div className="flex-1 flex gap-1 items-center flex-wrap">
                        <input type="text" value={editProductData.emoji} onChange={(e) => setEditProductData({...editProductData, emoji: e.target.value})} className="w-10 p-1 border rounded text-center text-xs" />
                        <input type="number" value={editProductData.price} onChange={(e) => setEditProductData({...editProductData, price: e.target.value})} className="w-16 p-1 border rounded text-xs" placeholder="Цена" />
                        <button onClick={() => {
                          if (!isBase) {
                            const updated = customProducts.map(cp => cp.name === p.name ? {...cp, emoji: editProductData.emoji, price: parseInt(editProductData.price) || cp.price} : cp);
                            setCustomProducts(updated);
                            save('likebird-custom-products', updated);
                          }
                          setEditingProduct(null);
                          showNotification('Сохранено');
                        }} className="px-2 py-1 bg-green-500 text-white rounded text-xs">✓</button>
                        <button onClick={() => setEditingProduct(null)} className="px-2 py-1 bg-gray-300 rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1">{p.name}</span>
                        {localSearch && <span className="text-xs text-gray-400">{CAT_ICONS[p.category]}</span>}

                        {/* Кнопка фото — доступна всем (как раньше) */}
                        <label className="cursor-pointer p-1 text-gray-300 hover:text-amber-500">
                          <Camera className="w-4 h-4" />
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            try { const compressed = await compressImage(file, 400, 0.6); if (!compressed) { showNotification('Формат не поддерживается', 'error'); return; } updateProductPhotos({...productPhotos, [p.name]: compressed}); showNotification('📷 Фото добавлено'); } catch { showNotification('Ошибка сохранения', 'error'); }
                          }} />
                        </label>

                        {/* Админские кнопки */}
                        {isAdmin && (
                          <div className="flex gap-1 items-center">
                            {!isBase && <button onClick={() => { setEditingProduct(p.name); setEditProductData({ name: p.name, price: p.price, emoji: p.emoji, category: p.category }); }} className="text-gray-400 hover:text-blue-500" title="Изменить цену/эмодзи"><Edit3 className="w-3.5 h-3.5" /></button>}
                            {!isBase && <button onClick={() => {
                              const target = customProducts.find(cp => cp.name === p.name);
                              if (target) showConfirm(`Удалить ${p.name}?`, () => removeCustomProduct(target.id));
                            }} className="text-gray-400 hover:text-red-500" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>}
                            <button onClick={() => { toggleArchiveProduct(p.name); showNotification(archivedProducts.includes(p.name) ? 'Товар восстановлен' : 'Товар в архиве'); }} className={`text-xs ${archivedProducts.includes(p.name) ? 'text-green-500' : 'text-gray-400 hover:text-amber-500'}`} title={archivedProducts.includes(p.name) ? 'Восстановить' : 'Архивировать'}>{archivedProducts.includes(p.name) ? '♻️' : '📦'}</button>
                            <button onClick={() => {
                              const alias = prompt(`Добавить алиас для «${p.name}»:\n(как товар называют в отчёте/ревизии)`);
                              if (alias?.trim()) saveAlias(alias.trim(), p.name);
                            }} className="text-gray-400 hover:text-purple-500" title="Добавить алиас">📝</button>
                            {productPhotos[p.name] && <button onClick={() => { deleteMediaPhoto(p.name); showNotification('Фото удалено'); }} className="text-gray-400 hover:text-red-500 text-xs" title="Удалить фото">🗑️</button>}
                            {!isBase && <span className="text-gray-500 text-xs">{p.price}₽</span>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}</div>
            </div>
          ));
        })()}
      </>)}
    </>
  );

  // ────────────────────────────────────────────────────────────────────
  // РЕНДЕР: ревизия (админ) — перенесено из AdminView без изменений логики
  // ────────────────────────────────────────────────────────────────────
  const renderRevision = () => {
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

        if (/^период/i.test(line)) { period = line.replace(/^период:\s*/i, ''); continue; }

        if (/^вид товар/i.test(line)) {
          const catMatch = line.match(/:\s*(.+)/);
          if (catMatch) category = catMatch[1].trim();
          if (/птиц/i.test(line)) {
            if (!birdSection) birdSection = { totalNow: 0, startCount: 0, arrivals: [], salesCount: 0, writeoffs: [], shortage: 0, found: 0 };
            if (currentItem) { items.push(currentItem); currentItem = null; }
          }
          continue;
        }

        if (/^\d+\)\s*\d+\s*[-+]/.test(line)) continue;

        const currentMatch = line.match(/на данный момент:\s*(\d+)/i);
        if (currentMatch) {
          const count = parseInt(currentMatch[1], 10);
          if (currentItem) { currentItem.currentCount = count; }
          else if (birdSection) { birdSection.totalNow = count; }
          continue;
        }

        const salesCountMatch = line.match(/количество продаж:\s*(\d+)/i);
        if (salesCountMatch) {
          const cnt = parseInt(salesCountMatch[1], 10);
          if (currentItem) currentItem.salesCount = cnt;
          else if (birdSection) birdSection.salesCount = cnt;
          continue;
        }

        const foundMatch = lower.match(/найден[а-яё]*.*?(\d+)/i);
        if (foundMatch && birdSection && !currentItem) {
          birdSection.found = parseInt(foundMatch[1], 10);
          continue;
        }

        const shortageExactMatch = line.match(/итоговая недосдач.*?(\d+)/i);
        if (shortageExactMatch && birdSection) { birdSection.shortage = parseInt(shortageExactMatch[1], 10); continue; }
        const shortageMatch = line.match(/(\d+)\s*недосдач/i);
        if (shortageMatch && birdSection && !currentItem) { birdSection.shortage = parseInt(shortageMatch[1], 10); continue; }

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

        const saleMatch = line.match(/^(\d+)\s+([А-Яа-яЁёA-Za-z]+)\s+(\d{1,2}\.\d{1,2})/);
        if (saleMatch) {
          if (currentItem) currentItem.sales.push({ qty: parseInt(saleMatch[1], 10), employee: saleMatch[2], date: saleMatch[3] });
          continue;
        }

        if (birdSection && !currentItem) {
          const woMatch = line.match(/^(.+?):\s*(\d+)\s*(.*?)(?:\[.*\])?$/);
          if (woMatch) {
            const reason = woMatch[1].trim();
            if (/брак|разб|списан|отдал|подарок|забрал|зп|потер|украд|слом/i.test(reason) && !/найден|недосдач|итогов/i.test(reason)) {
              birdSection.writeoffs.push({ reason, count: parseInt(woMatch[2], 10), note: woMatch[3]?.trim() || '' });
              continue;
            }
          }
        }

        const specialMatch = line.match(/(\d+)\s*(?:шт|штук)/i);
        if (specialMatch && currentItem) {
          const cnt = parseInt(specialMatch[1], 10);
          if (currentItem.currentCount === 0) currentItem.currentCount = cnt;
          if (currentItem.startCount === 0) currentItem.startCount = cnt;
          continue;
        }

        if (/^(мелкие|крупные|средние|большие|другие)\s*:?\s*$/i.test(line)) continue;

        const itemLine = line.replace(/[✅✔️☑️]/g, '').trim();
        if (itemLine.length > 1 && !/^[\d(]/.test(itemLine) && !/количество|на данный|период|вид товар|итого/i.test(itemLine)) {
          let isItem = false;
          for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (/на данный момент|количество продаж/i.test(nextLine)) { isItem = true; break; }
            if (/^\d{1,2}\.\d{1,2}.*:\s*\d/.test(nextLine)) { isItem = true; break; }
          }
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

      items.forEach(item => {
        const nameLow = item.name.toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        for (const [alias, productName] of Object.entries(CUSTOM_ALIASES)) {
          if (nameLow === alias.toLowerCase() || nameLow.includes(alias.toLowerCase())) {
            const found = DYNAMIC_ALL_PRODUCTS.find(p => p.name === productName);
            if (found) { bestMatch = found; bestScore = 95; break; }
          }
        }

        if (!bestMatch) {
          DYNAMIC_ALL_PRODUCTS.forEach(p => {
            const pLow = p.name.toLowerCase();
            if (pLow === nameLow) { bestMatch = p; bestScore = 100; return; }
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

        item.matchedProduct = bestScore >= 30 ? bestMatch : null;
        item.matchScore = bestScore;
      });

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

    const applyRevision = (parsed) => {
      const newStock = { ...stock };
      let updatedCount = 0;
      let createdWriteoffs = 0;

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
        if (item.startCount > 0 && item.salesCount >= 0) {
          const expected = item.startCount + item.arrivals.reduce((s, a) => s + a.count, 0) - item.salesCount;
          const diff = expected - item.currentCount;
          if (diff > 0) {
            addWriteOff(item.matchedProduct.name, diff, `Ревизия: недосдача (ожидалось ${expected}, факт ${item.currentCount})`);
            createdWriteoffs++;
          }
        }
      });

      if (parsed.birdSection) {
        parsed.birdSection.writeoffs.forEach(wo => {
          const reason = `${wo.reason}: ${wo.count} шт${wo.note ? ' ' + wo.note : ''}`;
          addWriteOff('Попугай', wo.count, reason);
          createdWriteoffs++;
        });
      }

      updateStock(newStock);

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
      try { localStorage.setItem('likebird-revision-history', JSON.stringify(hist)); } catch { /* silent */ }
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

        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-2">🐦 Птицы по ревизии</h3>
          <div className="flex gap-2">
            <input type="number" defaultValue={totalBirds || ''} onBlur={(e) => { const v = parseInt(e.target.value) || 0; setTotalBirds(v); save('likebird-totalbirds', v); }} placeholder="Кол-во" className="flex-1 p-3 border rounded-lg" />
            <button onClick={() => showNotification('✅ Сохранено')} className="bg-amber-500 text-white px-4 rounded-lg hover:bg-amber-600">💾</button>
          </div>
        </div>

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

      const addNewFromRevision = (item) => {
        if (!newProdPrice) { showNotification('Укажите цену', 'error'); return; }
        const prod = { name: item.name, price: parseInt(newProdPrice, 10), category: newProdCat, emoji: '📦', aliases: [item.name.toLowerCase()] };
        addCustomProduct(prod);
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
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-2xl p-4">
            <h3 className="font-bold text-lg">📋 Результат распознавания</h3>
            {p.period && <p className="text-white/70 text-sm mt-1">{p.period}</p>}
            <div className="flex gap-4 mt-2 text-sm">
              <span className="bg-white/20 px-2 py-0.5 rounded">✅ {matched.length} распознано</span>
              {unmatched.length > 0 && <span className="bg-red-400/30 px-2 py-0.5 rounded">❓ {unmatched.length} не найдено</span>}
            </div>
          </div>

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
                            }} className="flex-1 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold">
                              🗑️ Отвязать
                            </button>
                          )}
                          {!isMatched && (
                            <button onClick={() => setAddingProduct(item)} className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-semibold">
                              ➕ Добавить как новый
                            </button>
                          )}
                          <button onClick={() => setEditingItem(null)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">Отмена</button>
                        </div>
                      </div>
                    )}

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
  };

  // ────────────────────────────────────────────────────────────────────
  // РЕНДЕР: история движения (админ)
  // ────────────────────────────────────────────────────────────────────
  const renderHistory = () => (
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
  );

  // ────────────────────────────────────────────────────────────────────
  // РЕНДЕР: списания (админ)
  // ────────────────────────────────────────────────────────────────────
  const renderWriteoff = () => (
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
  );

  // ────────────────────────────────────────────────────────────────────
  // РЕНДЕР: автозаказ (админ)
  // ────────────────────────────────────────────────────────────────────
  const renderAutoorder = () => (
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
  );

  // ────────────────────────────────────────────────────────────────────
  // ИТОГОВЫЙ РЕНДЕР
  // ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      {/* Шапка */}
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-20 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2">📋 Каталог{isAdmin && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="w-3 h-3" />админ</span>}</h2>
        {/* Поиск показываем только на вкладке «Каталог» */}
        {(!isAdmin || catalogAdminTab === 'catalog') && (
          <div className="relative"><Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" /><input type="text" placeholder="Поиск товара..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl text-gray-800 focus:outline-none" />{localSearch && <button onClick={() => setLocalSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}</div>
        )}
      </div>

      {/* Админские вкладки */}
      {isAdmin && (
        <div className="sticky top-[120px] z-10 bg-white shadow-sm">
          <div className="flex overflow-x-auto px-2 py-2 gap-1" style={{scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch'}}>
            {adminTabs.map(t => (
              <button key={t.id} onClick={() => setCatalogAdminTab(t.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 ${catalogAdminTab === t.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Контент */}
      <div className="max-w-md mx-auto px-4 mt-4">
        {(!isAdmin || catalogAdminTab === 'catalog') && renderCatalog()}
        {isAdmin && catalogAdminTab === 'revision' && renderRevision()}
        {isAdmin && catalogAdminTab === 'history' && renderHistory()}
        {isAdmin && catalogAdminTab === 'writeoff' && renderWriteoff()}
        {isAdmin && catalogAdminTab === 'autoorder' && renderAutoorder()}
      </div>
    </div>
  );
}
