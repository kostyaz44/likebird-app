import React, { useState } from 'react';
import { ArrowLeft, Search, X, ChevronRight, Camera } from 'lucide-react';
import { PRODUCTS, CAT_ICONS } from '../data/products.js';
import { useApp } from '../context/AppContext';

export default function CatalogView() {
  const {
    setCurrentView, customProducts, darkMode, productPhotos,
    compressImage, showNotification, updateProductPhotos,
    DYNAMIC_ALL_PRODUCTS,
  } = useApp();

  const [activeCategory, setActiveCategory] = useState(null);
  const [localSearch, setLocalSearch] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold mb-3">📋 Каталог</h2>
        <div className="relative"><Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" /><input type="text" placeholder="Поиск товара..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-xl text-gray-800 focus:outline-none" />{localSearch && <button onClick={() => setLocalSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}</div>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4">
        {!activeCategory && !localSearch ? (
          <div className="space-y-3">{Object.keys(PRODUCTS).map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><span className="text-3xl">{CAT_ICONS[cat]}</span><div className="text-left"><h3 className="font-bold">{cat}</h3><p className="text-gray-400 text-xs">{PRODUCTS[cat].length} товаров</p></div><ChevronRight className="w-5 h-5 text-gray-400 ml-auto" /></button>))}</div>
        ) : (<>
          {activeCategory && !localSearch && <button onClick={() => setActiveCategory(null)} className="mb-3 text-amber-600 font-semibold flex items-center gap-1 text-sm hover:text-amber-700"><ArrowLeft className="w-4 h-4" /> Назад</button>}
          {localSearch && <p className="mb-3 text-gray-500 text-sm">Результаты поиска: "{localSearch}"</p>}
          {(() => {
            const prods = localSearch ? DYNAMIC_ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(localSearch.toLowerCase()) || p.aliases.some(a => a.includes(localSearch.toLowerCase()))) : (PRODUCTS[activeCategory] || []).map(p => ({...p, category: activeCategory})).concat(customProducts.filter(cp => cp.category === activeCategory));
            if (prods.length === 0) return <div className="text-center py-10 text-gray-400"><Search className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Ничего не найдено</p></div>;
            const grouped = prods.reduce((acc, p) => { if (!acc[p.price]) acc[p.price] = []; acc[p.price].push(p); return acc; }, {});
            return Object.keys(grouped).map(Number).sort((a,b) => a-b).map(price => (
              <div key={price} className="mb-4">
                <div className="bg-amber-500 rounded-lg p-2 mb-2 shadow"><span className="text-white text-lg font-bold">{price}₽</span></div>
                <div className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>{grouped[price].map((p, i) => { const photo = productPhotos[p.name]; return (<div key={i} className="p-3 border-b last:border-0 flex items-center gap-3 text-sm">
                  {photo ? <img src={photo} alt={p.name} className="w-24 h-24 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm" /> : <span className="text-2xl flex-shrink-0 w-24 h-24 bg-amber-50 rounded-xl flex items-center justify-center text-4xl">{p.emoji}</span>}
                  <span className="flex-1">{p.name}</span>
                  {localSearch && <span className="text-xs text-gray-400">{CAT_ICONS[p.category]}</span>}
                  <label className="cursor-pointer p-1 text-gray-300 hover:text-amber-500">
                    <Camera className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      try { const compressed = await compressImage(file, 400, 0.6); if (!compressed) { showNotification('Формат не поддерживается', 'error'); return; } updateProductPhotos({...productPhotos, [p.name]: compressed}); showNotification('📷 Фото добавлено'); } catch { showNotification('Ошибка сохранения', 'error'); }
                    }} />
                  </label>
                </div>); })}</div>
              </div>
            ));
          })()}
        </>)}
      </div>
    </div>
  );
}
