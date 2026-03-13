/* eslint-disable no-unused-vars */
import React, { useState } from 'react';

const ItemsEditor = React.memo(function ItemsEditor({ items, setItems, otherProducts, darkMode }) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');
  const filteredProducts = search.length >= 1
    ? otherProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.emoji.includes(search)).slice(0, 10) : [];
  const catOrder = ['3D игрушки', 'Меховые игрушки'];
  const grouped = {};
  items.forEach((item, i) => { const prod = otherProducts.find(p => p.name === item.name); const cat = prod?.category || 'Другое'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push({ ...item, idx: i, emoji: prod?.emoji || '📦' }); });
  const updateQty = (idx, delta) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(0, x.qty + delta) } : x).filter(x => x.qty > 0));
  return (
    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
      <h4 className="font-bold text-sm mb-3 flex items-center gap-2">🎮 3D, Мех и другие</h4>
      {catOrder.concat(['Другое']).map(cat => {
        const catItems = grouped[cat]; if (!catItems || catItems.length === 0) return null;
        const catIcon = cat === '3D игрушки' ? '🎮' : cat === 'Меховые игрушки' ? '🧸' : '📦';
        return (<div key={cat} className="mb-3"><p className="text-xs font-semibold text-gray-400 mb-1">{catIcon} {cat}</p><div className="space-y-1">{catItems.map(item => (
          <div key={item.idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-sm">{item.emoji} {item.name}</span><div className="flex items-center gap-1 shrink-0">
            <button onClick={() => updateQty(item.idx, -1)} className="w-7 h-7 bg-gray-200 rounded text-sm font-bold active:bg-red-100">−</button>
            <span className="font-bold w-6 text-center text-sm">{item.qty}</span>
            <button onClick={() => updateQty(item.idx, 1)} className="w-7 h-7 bg-gray-200 rounded text-sm font-bold active:bg-green-100">+</button>
          </div></div>))}</div></div>);
      })}
      <div className="relative mt-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Найти товар из каталога..." className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
        {filteredProducts.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {filteredProducts.map(p => {
              const existing = items.find(i => i.name === p.name);
              return (<button key={p.name} onClick={() => { if (existing) { setItems(prev => prev.map(i => i.name === p.name ? { ...i, qty: i.qty + 1 } : i)); } else { setItems(prev => [...prev, { name: p.name, qty: 1 }]); } setSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm flex justify-between border-b last:border-0">
                <span>{p.emoji} {p.name}</span><span className="text-gray-400">{existing ? `(уже ${existing.qty})` : ''}</span></button>);
            })}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-2">
        <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} className="w-12 p-1.5 border rounded-lg text-sm text-center" placeholder="1" />
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Или вручную..."
          className="flex-1 p-1.5 border rounded-lg text-sm"
          onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { setItems(prev => [...prev, { name: newName.trim(), qty: parseInt(newQty,10)||1 }]); setNewName(''); setNewQty('1'); }}} />
        <button onClick={() => { if (newName.trim()) { setItems(prev => [...prev, { name: newName.trim(), qty: parseInt(newQty,10)||1 }]); setNewName(''); setNewQty('1'); }}}
          className="bg-purple-500 text-white px-3 rounded-lg text-sm font-bold">+</button>
      </div>
    </div>
  );
});

export default ItemsEditor;
