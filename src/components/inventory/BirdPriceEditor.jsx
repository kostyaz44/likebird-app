/* eslint-disable no-unused-vars */
import React, { useState } from 'react';

const BirdPriceEditor = React.memo(function BirdPriceEditor({ birdsByPrice, setBirdsByPrice, totalBirds, setTotalBirds, birdPriceTiers, darkMode, isAdmin }) {
  const [newCount, setNewCount] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const sortedPrices = Object.keys(birdPriceTiers).sort((a, b) => parseInt(a) - parseInt(b));
  const birdCount = Object.values(birdsByPrice).reduce((s, c) => s + c, 0);
  return (
    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm flex items-center gap-2">🐦 Птицы-свистульки</h4>
      </div>
      <div className="flex items-center gap-3 mb-3 bg-amber-50 rounded-lg p-2.5">
        <span className="text-sm font-semibold text-amber-700">Всего птиц:</span>
        <input type="number" value={totalBirds || ''} onChange={e => setTotalBirds(parseInt(e.target.value, 10) || 0)}
          className="w-20 text-center border-2 border-amber-300 rounded-lg p-1.5 font-bold text-lg focus:border-amber-500 focus:outline-none" placeholder="0" />
        {birdCount > 0 && birdCount !== totalBirds && (
          <span className="text-xs text-orange-500">по ценам: {birdCount}</span>
        )}
      </div>
      <div className="space-y-1.5">
        {sortedPrices.map(price => {
          const count = birdsByPrice[price] || 0;
          const names = birdPriceTiers[price];
          return (
            <div key={price} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm">{parseInt(price, 10)}₽</span>
                <p className="text-[10px] text-gray-400 truncate">{names.join(', ')}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setBirdsByPrice(prev => ({...prev, [price]: Math.max(0, (prev[price]||0) - 1)}))}
                  className="w-8 h-8 bg-gray-200 rounded-lg font-bold text-lg leading-none hover:bg-red-100 active:bg-red-200">−</button>
                <input type="number" value={count || ''} onChange={e => setBirdsByPrice(prev => ({...prev, [price]: Math.max(0, parseInt(e.target.value,10)||0)}))}
                  className="w-12 h-8 text-center border rounded-lg text-sm font-bold focus:border-amber-500 focus:outline-none" placeholder="0" />
                <button onClick={() => setBirdsByPrice(prev => ({...prev, [price]: (prev[price]||0) + 1}))}
                  className="w-8 h-8 bg-gray-200 rounded-lg font-bold text-lg leading-none hover:bg-green-100 active:bg-green-200">+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2 items-center">
        <input type="number" value={newCount} onChange={e => setNewCount(e.target.value)} placeholder="Кол" className="w-14 p-1.5 border rounded-lg text-sm text-center" />
        <span className="text-gray-400 text-sm">×</span>
        <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Цена" className="flex-1 p-1.5 border rounded-lg text-sm" />
        <button onClick={() => {
          const c = parseInt(newCount,10), p = parseInt(newPrice,10);
          if (c > 0 && p > 0) { setBirdsByPrice(prev => ({...prev, [p]: (prev[p]||0) + c})); setNewCount(''); setNewPrice(''); }
        }} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold">+</button>
      </div>
      {isAdmin && birdCount > 0 && (
        <div className="mt-2 pt-2 border-t text-right text-xs text-gray-400">
          💰 {Object.entries(birdsByPrice).reduce((s, [p, c]) => s + parseInt(p,10) * c, 0).toLocaleString()}₽
        </div>
      )}
    </div>
  );
});

export default BirdPriceEditor;
