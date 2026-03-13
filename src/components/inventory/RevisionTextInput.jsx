/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { parseRevisionText } from '../../utils/revisionParser.js';

const RevisionTextInput = React.memo(function RevisionTextInput({ onSave, onCancel }) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseRevisionText(text) : null;
  const birdCount = parsed ? Object.values(parsed.birdsByPrice).reduce((s,c)=>s+c, 0) : 0;
  return (
    <div className="space-y-3">
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder={"Птиц: 62\n30х300\n20х400\n10х500\n2х600\n\n3д\n6 птиц\n1 коала\n2 собаки\n3 хомяка"}
        className="w-full h-48 p-3 border-2 border-gray-200 rounded-xl text-sm font-mono focus:border-purple-500 focus:outline-none resize-none" autoFocus />
      {parsed && (birdCount > 0 || parsed.items.length > 0) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm space-y-1">
          {parsed.totalBirds > 0 && (<div><p className="font-semibold">🐦 Птицы: {parsed.totalBirds} шт</p><div className="flex flex-wrap gap-1 mt-1">{Object.entries(parsed.birdsByPrice).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([p,c])=>(<span key={p} className="bg-white px-2 py-0.5 rounded text-xs border">{c}×{p}₽</span>))}</div></div>)}
          {parsed.items.length > 0 && (<div className="mt-1"><p className="font-semibold">🎮 Другие: {parsed.items.reduce((s,i)=>s+i.qty, 0)} шт</p><div className="flex flex-wrap gap-1 mt-1">{parsed.items.map((item, i) => <span key={i} className="bg-white px-2 py-0.5 rounded text-xs border">{item.qty}× {item.name}</span>)}</div></div>)}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Назад</button>
        <button onClick={() => { if (!text.trim()) return; onSave(parseRevisionText(text)); }}
          disabled={!text.trim()} className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
          ✅ Сохранить
        </button>
      </div>
    </div>
  );
});

export default RevisionTextInput;
