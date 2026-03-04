/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps, no-shadow, eqeqeq, no-fallthrough, no-unreachable, no-redeclare */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ShoppingBag, FileText, BarChart3, Plus, Search, ArrowLeft, Trash2, X, FileInput, AlertTriangle, Check, AlertCircle, ChevronLeft, ChevronRight, Edit3, Clock, Package, Bell, RefreshCw, Download, Upload, Copy, Settings, Calendar, RotateCcw, Info, CheckCircle, Shield, DollarSign, Users, Lock, TrendingUp, Award, MapPin, Archive, MessageCircle, Star, Camera, Image, LogOut, Key, Wifi, WifiOff, Eye, EyeOff, Smartphone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { fbSave, fbSubscribe, fbGet, fbSetPresence, fbSubscribePresence, SYNC_KEYS } from './firebase.js';

// ===== ВЕРСИЯ ПРИЛОЖЕНИЯ =====
const APP_VERSION = '3.0';
const DATA_VERSION = 2; // Increment when data structure changes

// ===== УТИЛИТЫ: Хэширование пароля =====
const hashPassword = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'likebird-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// ===== УТИЛИТЫ: Синхронизация =====
const SyncManager = {
  getSyncId: () => {
    let id; try { id = localStorage.getItem('likebird-sync-id'); } catch { return 'lb-fallback-' + Date.now().toString(36); }
    if (!id) { id = 'lb-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6); localStorage.setItem('likebird-sync-id', id); }
    return id;
  },
  getLastSync: () => { try { return localStorage.getItem('likebird-last-sync') || null; } catch { return null; } },
  setLastSync: () => localStorage.setItem('likebird-last-sync', new Date().toISOString()),
  
  // Все ключи localStorage приложения
  ALL_KEYS: [
    'likebird-reports', 'likebird-expenses', 'likebird-stock', 'likebird-given',
    'likebird-salary-decisions', 'likebird-owncard', 'likebird-partners',
    'likebird-totalbirds', 'likebird-schedule', 'likebird-events',
    'likebird-manuals', 'likebird-salary-settings', 'likebird-admin-password',
    'likebird-employees', 'likebird-sales-plan', 'likebird-audit-log',
    'likebird-custom-products', 'likebird-locations', 'likebird-cost-prices',
    'likebird-penalties', 'likebird-bonuses', 'likebird-timeoff',
    'likebird-ratings', 'likebird-chat', 'likebird-stock-history',
    'likebird-writeoffs', 'likebird-autoorder', 'likebird-kpi',
    'likebird-auth', 'likebird-sync-id', 'likebird-last-sync',
    'likebird-sync-url', 'likebird-employee',
    // FIX: Ранее отсутствовали — не экспортировались, не очищались, не синхронизировались
    'likebird-invite-codes', 'likebird-custom-achievements',
    'likebird-achievements-granted', 'likebird-shifts', 'likebird-profiles',
    'likebird-users', 'likebird-notifications', 'likebird-product-photos',
    'likebird-system-notifications',
    'likebird-custom-aliases', 'likebird-notif-settings',
    'likebird-challenges', 'likebird-dark-mode', 'likebird-sync-queue', 'likebird-product-photos-data',
  ],

  // Экспорт всех данных
  exportAll: () => {
    const data = { _version: 2, _appVersion: APP_VERSION, _exportDate: new Date().toISOString(), _syncId: SyncManager.getSyncId(), _mediaPhotos: productPhotos, _shiftPhotos: shiftPhotos, _mediaIndex: [...(mediaKeysRef.current || [])] };
    SyncManager.ALL_KEYS.forEach(key => {
      try { const v = localStorage.getItem(key); if (v) data[key] = JSON.parse(v); } catch { const v = localStorage.getItem(key); if (v) data[key] = v; }
    });
    return data;
  },

  // Импорт всех данных
  importAll: (data) => {
    if (!data || !data._version) throw new Error('Неверный формат данных');
    let imported = 0;
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('_') || !key.startsWith('likebird-')) return;
      try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); imported++; } catch (e) { console.warn(`Failed to import ${key}:`, e); }
    });
    return imported;
  },

  // Синхронизация с удалённым сервером (если настроен)
  syncWithServer: async (url) => {
    if (!url) return { success: false, error: 'URL не настроен' };
    try {
      const data = SyncManager.exportAll();
      const response = await fetch(url + '/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncId: SyncManager.getSyncId(), data, timestamp: Date.now() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.data) { SyncManager.importAll(result.data); }
      SyncManager.setLastSync();
      return { success: true, message: 'Синхронизировано' };
    } catch (e) { return { success: false, error: e.message }; }
  },
};

// ===== PWA: Регистрация Service Worker =====
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}


const PRODUCTS = {
  'Птички-свистульки': [
    { name: 'Снегирь', price: 600, emoji: '🐦', aliases: ['снегирь', 'снегир', 'снигирь'] },
    { name: 'Воробей', price: 600, emoji: '🐦', aliases: ['воробей', 'воробь', 'вообей'] },
    { name: 'Дракон птичка', price: 800, emoji: '🐉', aliases: ['дракон птичка', 'дакон птичка'] },
    { name: 'Дельфины', price: 700, emoji: '🐬', aliases: ['дельфин', 'дельфины'] },
    { name: 'Пластик птичка', price: 600, emoji: '🐥', aliases: ['пластик птичка', 'пластик', 'белый пластик'] },
    { name: 'Мини снегирь', price: 500, emoji: '🐦', aliases: ['мини снегирь', 'мини снегир', 'мини снегр'] },
    { name: 'Гомункул', price: 500, emoji: '🐵', aliases: ['гомункул', 'обезьянка'] },
    { name: 'Собака птичка', price: 500, emoji: '🐕', aliases: ['собака птичка'] },
    { name: 'Крокодил', price: 500, emoji: '🐊', aliases: ['крокодил'] },
    { name: 'Мини воробей', price: 500, emoji: '🐦', aliases: ['мини воробей', 'мини вообей'] },
    { name: 'Перевёртыш', price: 400, emoji: '🔄', aliases: ['перевёртыш', 'перевертыш', 'пеевёртыш', 'переветыш', 'перевртыш'] },
    { name: 'Стёпа', price: 400, emoji: '🦜', aliases: ['стёпа', 'степа'] },
    { name: 'Клювастый дятел', price: 400, emoji: '🦤', aliases: ['клювастый', 'дятел'] },
    { name: 'Армянский попугай', price: 400, emoji: '🦜', aliases: ['армянский попугай', 'армянский', 'аармянский'] },
    { name: 'Тукан', price: 400, emoji: '🦜', aliases: ['тукан'] },
    { name: 'Соловей', price: 500, emoji: '🐦', aliases: ['соловей', 'солвоей', 'соловй', 'словей'] },
    { name: 'Волнистый попугай', price: 400, emoji: '🦜', aliases: ['волнистый'] },
    { name: 'Русский попугай', price: 400, emoji: '🦜', aliases: ['русский попугай', 'русский', 'усский попугай', 'усский', 'триколор'] },
    { name: 'Попугай', price: 300, emoji: '🦜', aliases: ['попугай'] },
    { name: 'Петушок', price: 300, emoji: '🐓', aliases: ['петушок', 'петух'] },
    { name: 'Глина', price: 300, emoji: '🏺', aliases: ['глина'] },
    { name: 'Курочка', price: 300, emoji: '🐔', aliases: ['курочка', 'курица', 'куочка'] },
    { name: 'Уточка', price: 400, emoji: '🦆', aliases: ['уточка', 'утка'] },
    { name: 'Канареечка', price: 400, emoji: '🐤', aliases: ['канареечка', 'канарейка', 'канаейка', 'кснареечка', 'конорейка', 'конарейка'] },
    { name: 'Золотой соловей', price: 700, emoji: '✨', aliases: ['золотой соловей', 'золотой'] },
    { name: 'Серебряный соловей', price: 700, emoji: '🌟', aliases: ['серебряный соловей', 'серебряный'] },
    { name: 'Дрозд', price: 500, emoji: '🐦', aliases: ['дрозд', 'дозд'] },
    { name: 'Роспись', price: 700, emoji: '🎨', aliases: ['роспись', 'оспись'] },
    { name: 'Филимоновская', price: 1000, emoji: '🎨', aliases: ['филимоновская'] },
    { name: 'Далматинец', price: 400, emoji: '🐕', aliases: ['далматинец'] },
    { name: 'Сова', price: 500, emoji: '🦉', aliases: ['сова'] },
    { name: 'Филин', price: 500, emoji: '🦉', aliases: ['филин'] },
    { name: 'Утенок', price: 400, emoji: '🦆', aliases: ['утенок', 'утёнок'] },
    { name: 'Пеликан', price: 700, emoji: '🦢', aliases: ['пеликан'] },
    { name: 'Лошадь птичка', price: 500, emoji: '🐴', aliases: ['лошадь птичка'] },
    { name: 'Голубь', price: 500, emoji: '🕊️', aliases: ['голубь', 'голуб'] },
    { name: 'Мышь птичка', price: 500, emoji: '🐭', aliases: ['мышь птичка'] },
    { name: 'Свинка', price: 400, emoji: '🐷', aliases: ['свинка'] },
    { name: 'Цыпленок птичка', price: 500, emoji: '🐣', aliases: ['цыпленок птичка'] },
    { name: 'Баран', price: 500, emoji: '🐏', aliases: ['баран', 'баан'] },
    { name: 'Окарина', price: 500, emoji: '🎵', aliases: ['окарина', 'окаина'] },
  ],
  'Меховые игрушки': [
    { name: 'Цыплёнок поющий', price: 500, emoji: '🐤', aliases: ['цыплёнок поющий', 'поющий цыпленок', 'цыпленок поющий'] },
    { name: 'Шпиц', price: 1800, emoji: '🐕', aliases: ['шпиц'] },
    { name: 'Хаски', price: 1000, emoji: '🐺', aliases: ['хаски'] },
    { name: 'Котята мех', price: 500, emoji: '🐱', aliases: ['котята мех', 'котенок мех'] },
    { name: 'Кролик', price: 800, emoji: '🐰', aliases: ['кролик', 'колик'] },
    { name: 'Лошадь маленькая', price: 600, emoji: '🐴', aliases: ['лошадь мал', 'лошадка', 'лошадь маленькая'] },
    { name: 'Собака мех', price: 1000, emoji: '🐕', aliases: ['собака мех'] },
    { name: 'Кот мех', price: 1000, emoji: '🐱', aliases: ['кот мех'] },
  ],
  '3D игрушки': [
    { name: 'Белая птица 3D', price: 1000, emoji: '🕊️', aliases: ['белая птица', 'белых птиц', 'белая птица 3d', 'птица белая', 'птичка белая', 'белая птичка', 'птица белая 3d', 'птичка белая 3d'] },
    { name: 'Цветная птица 3D', price: 1500, emoji: '🦜', aliases: ['цвет птица', 'цветная птица', 'цветных птиц'] },
    { name: 'Рыба молот', price: 500, emoji: '🦈', aliases: ['рыба молот', 'акула молот', 'акулы молот'] },
    { name: 'Хомяк', price: 300, emoji: '🐹', aliases: ['хомяк', 'хомяка'] },
    { name: 'Лабубу', price: 1500, emoji: '👹', aliases: ['лабубу'] },
    { name: 'Магнит Лабубу', price: 600, emoji: '🧲', aliases: ['магнит лабубу', 'лабубу магнит'] },
    { name: 'Змейка', price: 1300, emoji: '🐍', aliases: ['змейка', 'змея', 'змей'] },
    { name: 'Косатка', price: 500, emoji: '🐋', aliases: ['косатка', 'касатка', 'касатки', 'косатки'] },
    { name: 'Динозавр', price: 300, emoji: '🦕', aliases: ['динозавр', 'динозавра', 'динозав'] },
    { name: 'Паук', price: 500, emoji: '🕷️', aliases: ['паук', 'павук', 'павук огромный', 'паук огромный'] },
    { name: 'Брелок', price: 200, emoji: '🔑', aliases: ['брелок', 'брелоков'] },
    { name: 'Брелок Кальмар', price: 200, emoji: '🦑', aliases: ['брелок игра в кальмара', 'кальмар'] },
    { name: 'Брелок Брейнрот', price: 200, emoji: '🧠', aliases: ['брелок брейнрот', 'брейнрот', 'бейнрот'] },
    { name: 'Акула', price: 500, emoji: '🦈', aliases: ['акула', 'акулы', 'акла'] },
    { name: 'Кот 3D', price: 500, emoji: '🐱', aliases: ['кот 3d'] },
    { name: 'Снеговик большой', price: 600, emoji: '⛄', aliases: ['снеговик', 'большой снеговик'] },
    { name: 'Снеговик маленький', price: 400, emoji: '☃️', aliases: ['маленький снеговик'] },
    { name: 'Лягушка', price: 500, emoji: '🐸', aliases: ['лягушка', 'лягушки'] },
    { name: 'Тюлень', price: 500, emoji: '🦭', aliases: ['тюлень', 'морж'] },
    { name: 'Крыса', price: 300, emoji: '🐀', aliases: ['крыса', 'крысы'] },
    { name: 'Дракон 3D', price: 1300, emoji: '🐉', aliases: ['дракон 3d', 'дракон', 'дакон'] },
    { name: 'Собака 3D', price: 500, emoji: '🐕', aliases: ['собака 3d'] },
    { name: 'Мышь фиолетовая', price: 300, emoji: '🐭', aliases: ['фиолетовая мышь'] },
    { name: 'Череп', price: 200, emoji: '💀', aliases: ['череп', 'черепа'] },
    { name: 'Сахур', price: 500, emoji: '🎭', aliases: ['сахур', 'саху'] },
    { name: 'Магнит', price: 300, emoji: '🧲', aliases: ['магнит', 'магнита'] },
  ],
};

const AMBIGUOUS_PRODUCTS = {
  'собака': { below: 800, category: 'Птички-свистульки', name: 'Собака птичка', above: 800, categoryAbove: 'Меховые игрушки', nameAbove: 'Собака мех' },
  'кот': { below: 800, category: '3D игрушки', name: 'Кот 3D', above: 800, categoryAbove: 'Меховые игрушки', nameAbove: 'Кот мех' },
  'лошадь': { below: 600, category: 'Птички-свистульки', name: 'Лошадь птичка', above: 600, categoryAbove: 'Меховые игрушки', nameAbove: 'Лошадь маленькая' },
  'мышь': { below: 400, category: '3D игрушки', name: 'Мышь фиолетовая', above: 400, categoryAbove: 'Птички-свистульки', nameAbove: 'Мышь птичка' },
};

const ALL_PRODUCTS = Object.entries(PRODUCTS).flatMap(([cat, prods]) => prods.map(p => ({ ...p, category: cat })));
const CAT_ICONS = { 'Птички-свистульки': '🐦', 'Меховые игрушки': '🧸', '3D игрушки': '🎮' };

// Динамический список всех товаров (включая кастомные) - будет обновляться в компоненте
let DYNAMIC_ALL_PRODUCTS = [...ALL_PRODUCTS];

const calculateSalary = (basePrice, salePrice, category, tips = 0, adj = 'normal', salarySettings = null) => {
  if (adj === 'none') return 0;
  if (isNaN(salePrice) || salePrice == null) return 0;
  if (isNaN(basePrice)) basePrice = 0;
  
  // Используем переданные настройки или значения по умолчанию
  const defaultRanges = [
    { min: 2001, max: 99999, base: 300 },
    { min: 1400, max: 2000, base: 300 },
    { min: 1000, max: 1399, base: 200 },
    { min: 300, max: 999, base: 100 },
    { min: 100, max: 299, base: 50 },
    { min: 0, max: 99, base: 50 },
  ];
  
  const ranges = salarySettings?.ranges || defaultRanges;
  const bonusForBirds = salarySettings?.bonusForBirds ?? true;
  
  let base = 50; // Значение по умолчанию
  
  // Находим подходящий диапазон
  for (const range of ranges) {
    if (salePrice >= range.min && salePrice <= range.max) {
      base = range.base;
      break;
    }
  }
  
  // Бонус за птичек (если включен) — фиксированные 50₽ за каждую продажу птички
  if (bonusForBirds && category === 'Птички-свистульки') {
    base += 50;
  }
  
  // Вычет при продаже ниже базовой цены
  if (adj === 'deduct') {
    const diff = salePrice - basePrice;
    if (diff < 0) base = Math.max(0, base + diff);
  }
  
  return Math.max(0, base) + tips;
};

const isBelowBasePrice = (basePrice, salePrice) => salePrice < basePrice;
const checkCashless = (line) => {
  const l = line.toLowerCase();
  // Проверка на "п" в конце или отдельно
  if (/\s+п\s*$|\s+п\s+|\(п\)|\sп,|\sп\./i.test(l)) return true;
  // Проверка на "пер", "перевод", "перево", "безнал", "бн"
  if (/\sпер\s|\sпер$|\sпер,|\sпер\.|\(пер\)/i.test(l)) return true;
  if (/перевод|перево/i.test(l)) return true;
  if (/безнал/i.test(l)) return true;
  if (/\sбн\s|\sбн$|\sбн,|\sбн\.|\(бн\)/i.test(l)) return true;
  return false;
};
const parseWorkTime = (text) => {
  let open = null, close = null;
  const oM = text.match(/открыл[аси]*[ья]?\s*(?:в\s*)?(\d{1,2})[:\.]?(\d{2})?/i);
  if (oM) open = oM[1].padStart(2, '0') + ':' + (oM[2] || '00');
  const cM = text.match(/(?:закрыл[аси]*|передал[аи]?\s*смену)[ья]?\s*(?:в\s*)?(\d{1,2})[:\.]?(\d{2})?/i);
  if (cM) close = cM[1].padStart(2, '0') + ':' + (cM[2] || '00');
  let hours = null;
  if (open && close) { const [oh, om] = open.split(':').map(Number); const [ch, cm] = close.split(':').map(Number); hours = (ch + cm/60) - (oh + om/60); if (hours < 0) hours += 24; }
  return { openTime: open, closeTime: close, workHours: hours };
};

// Загружаем кастомные алиасы при инициализации
let CUSTOM_ALIASES = {};
try {
  const saved = localStorage.getItem('likebird-custom-aliases');
  if (saved) CUSTOM_ALIASES = JSON.parse(saved);
} catch { /* silent */ }

const findProductByPrice = (text, price) => {
  const l = text.toLowerCase().trim();
  // Сначала проверяем кастомные алиасы
  for (const [alias, productName] of Object.entries(CUSTOM_ALIASES)) {
    if (l.includes(alias.toLowerCase())) {
      const found = DYNAMIC_ALL_PRODUCTS.find(p => p.name === productName);
      if (found) return found;
    }
  }
  for (const [keyword, rule] of Object.entries(AMBIGUOUS_PRODUCTS)) {
    if (l.includes(keyword)) {
      if (price >= rule.above) return DYNAMIC_ALL_PRODUCTS.find(p => p.name === rule.nameAbove);
      return DYNAMIC_ALL_PRODUCTS.find(p => p.name === rule.name);
    }
  }
  let found = null, best = 0;
  for (const p of DYNAMIC_ALL_PRODUCTS) { for (const a of p.aliases) { if (l.includes(a) && a.length > best) { found = p; best = a.length; } } }
  return found;
};

const parseExpenses = (text) => {
  const expenses = [];
  text.split('\n').forEach(line => {
    const l = line.toLowerCase();
    if (l.includes('расход') || l.includes('аренда')) {
      const match = line.match(/(\d+)/);
      if (match) expenses.push({ amount: parseInt(match[1]), description: line.trim() });
    }
  });
  return expenses;
};

const parseInventory = (text) => {
  const inventory = { start: {}, end: {} };
  let section = null;
  text.split('\n').forEach(line => {
    const l = line.toLowerCase().trim();
    if (!l) return;
    if (l.includes('открыл') || l.includes('начало') || l.includes('приня')) { section = 'start'; return; }
    if (l.includes('закрыл') || l.includes('конец') || l.includes('передал')) { section = 'end'; return; }
    if (/^\d+\s*[).,:]/i.test(l) && /\d+\s*р|\(\d+\)/.test(l)) return;
    const countMatch = l.match(/^(.+?)\s*[-:]*\s*(\d+)\s*(?:шт)?\.?\s*$/);
    if (countMatch && section) {
      const product = findProductByPrice(countMatch[1].trim(), 500);
      if (product) inventory[section][product.name] = parseInt(countMatch[2]);
    }
  });
  return inventory;
};

const countSoldProducts = (recognized) => {
  const sold = {};
  recognized.forEach(s => { if (s.product?.name) sold[s.product.name] = (sold[s.product.name] || 0) + 1; });
  return sold;
};

const compareInventory = (inventory, sold) => {
  const discrepancies = [];
  const allProducts = new Set([...Object.keys(inventory.start), ...Object.keys(inventory.end), ...Object.keys(sold)]);
  allProducts.forEach(name => {
    const start = inventory.start[name] || 0, end = inventory.end[name] || 0, soldCount = sold[name] || 0, expected = start - end;
    if ((start > 0 || end > 0) && expected !== soldCount) {
      const p = DYNAMIC_ALL_PRODUCTS.find(x => x.name === name);
      discrepancies.push({ name, emoji: p?.emoji || '❓', startCount: start, endCount: end, expectedSold: expected, actualSold: soldCount, difference: soldCount - expected });
    }
  });
  return discrepancies;
};

const parseTextReport = (text) => {
  const recognized = [], unrecognized = [];
  const workTime = parseWorkTime(text);
  const parsedExpenses = parseExpenses(text);
  text.split('\n').forEach(line => {
    const t = line.trim();
    if (!t) return;
    if (/^(птиц|3d|мех|открыл|закрыл|передал|итог|нал|безнал|зп|чай|расход|аренда|отдал)/i.test(t.toLowerCase())) return;
    const saleMatch = t.match(/^(\d+)\s*[).,:]*\s*/);
    if (!saleMatch) return;
    let rest = t.replace(/^\d+\s*[).,:]*\s*/, '').trim();
    let price = 0, tips = 0;
    const f1 = rest.match(/\((\d+)\)\s*\((\d+)\)/), f2 = rest.match(/(\d+)\s*р?\s*\((\d+)\)/), f3 = rest.match(/\((\d+)\)/), f4 = rest.match(/(\d+)\s*р?(?:\s|$|,|\))/);
    if (f1) { price = parseInt(f1[1]); tips = parseInt(f1[2]); }
    else if (f2) { price = parseInt(f2[1]); tips = parseInt(f2[2]); }
    else if (f3) { price = parseInt(f3[1]); }
    else if (f4) { price = parseInt(f4[1]); }
    if (!price || price < 50) return;
    const isCashless = checkCashless(rest);
    const paymentType = isCashless ? 'cashless' : 'cash';
    const productText = rest.toLowerCase().replace(/\(\d+\)\s*\(\d+\)/g, ' ').replace(/\d+\s*р?\s*\(\d+\)/g, ' ').replace(/\(\d+\)/g, ' ').replace(/\d+\s*р?/g, ' ').replace(/\s+(нал|пер|п|безнал|бн)\b/gi, ' ').replace(/[().,;:!?]/g, ' ').replace(/\s+/g, ' ').trim();
    const product = findProductByPrice(productText, price);
    if (product) {
      const salary = calculateSalary(product.price, price, product.category, tips, 'normal', null);
      recognized.push({ price, tips, paymentType, cashAmount: isCashless ? 0 : price, cashlessAmount: isCashless ? price : 0, product, category: product.category, isUnrecognized: false, salary, originalLine: t });
    } else {
      unrecognized.push({ price, tips, paymentType, cashAmount: isCashless ? 0 : price, cashlessAmount: isCashless ? price : 0, extractedName: productText || t, isUnrecognized: true, salary: tips, originalText: t });
    }
  });
  return { recognized, unrecognized, workTime, expenses: parsedExpenses, inventory: parseInventory(text) };
};

const getInitialStock = () => {
  const stock = {};
  ALL_PRODUCTS.forEach(p => { stock[p.name] = { count: 0, minStock: 3, category: p.category, emoji: p.emoji, price: p.price }; });
  return stock;
};

const formatDate = (date) => typeof date === 'string' ? date : date.toLocaleDateString('ru-RU');

// ИСПРАВЛЕНИЕ: Безопасный парсинг года (поддержка и 2-х и 4-х значных форматов)
const logErr = (ctx, e) => { try { console.warn('[LikeBird]', ctx, e?.message || e); } catch { /* silent */ } };

const useDebounce = (value, delay = 300) => {
  const [deb, setDeb] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
};

const parseRuDate = (dateStr) => {
  if (!dateStr) return new Date(0);
  if (typeof dateStr === 'number') return new Date(dateStr);
  try {
    const [datePart, timePart] = String(dateStr).split(',');
    const [d, m, y] = datePart.trim().split('.');
    if (!d || !m || !y) return new Date(0);
    const fullYear = y.length === 4 ? parseInt(y, 10) : 2000 + parseInt(y, 10);
    if (timePart) {
      const [h, min] = timePart.trim().split(':');
      return new Date(fullYear, parseInt(m, 10) - 1, parseInt(d, 10), parseInt(h, 10) || 0, parseInt(min, 10) || 0);
    }
    return new Date(fullYear, parseInt(m, 10) - 1, parseInt(d, 10));
  } catch { return new Date(0); }
};

const parseYear = (y) => {
  if (!y) return new Date().getFullYear().toString();
  if (y.length === 4) return y;
  return `20${y}`;
};

// ════════════════════════════════════════════════════════════════════════
// KpiGoalsPanel — стабильный компонент для целей сотрудников
// Определён вне LikeBirdApp чтобы React не пересоздавал его при каждом рендере
// ════════════════════════════════════════════════════════════════════════
const KpiGoalRow = ({ label, progress, goalType, empId, setEmployeeGoal, showNotification }) => {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState('');
  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1">
        <span className="font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">
            {progress
              ? (goalType === 'revenue'
                  ? `${progress.current.toLocaleString()}₽ / ${progress.goal.toLocaleString()}₽`
                  : `${progress.current} / ${progress.goal} шт`)
              : 'Цель не задана'}
          </span>
          <button
            onClick={() => { setEditing(e => !e); setVal(progress?.goal?.toString() || ''); }}
            className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-50 rounded-lg font-semibold border border-purple-200"
          >
            {progress ? '✏️ Изменить' : '+ Задать'}
          </button>
        </div>
      </div>
      {editing && (
        <div className="flex gap-2 mt-2 mb-3 items-center">
          <input
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder={goalType === 'sales' ? 'Кол-во продаж' : 'Сумма в ₽'}
            className="flex-1 p-2 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
            autoFocus
          />
          <span className="text-gray-400 text-sm">{goalType === 'sales' ? 'шт' : '₽'}</span>
          <button
            onClick={() => {
              const v = parseInt(val);
              if (v > 0) {
                setEmployeeGoal(empId, goalType, v, 'month');
                showNotification('Цель сохранена ✓');
                setEditing(false);
              } else {
                showNotification('Введите значение > 0', 'error');
              }
            }}
            className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-bold hover:bg-purple-600"
          >✓</button>
          <button onClick={() => setEditing(false)} className="px-2 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">✕</button>
        </div>
      )}
      {progress && (
        <div className="mt-1">
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progress.percentage >= 100 ? 'bg-green-500' : progress.percentage >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
              style={{ width: `${Math.min(100, progress.percentage)}%` }}
            />
          </div>
          <p className="text-xs text-right mt-0.5 text-gray-400">{progress.percentage}%</p>
        </div>
      )}
    </div>
  );
}

export default function LikeBirdApp() {
  return React.createElement(LikeBirdErrorBoundary, null, React.createElement(LikeBirdAppInner));
};

const KpiGoalsPanel = ({ employees, employeeKPI, setEmployeeGoal, showNotification, getEmployeeProgress }) => {
  const activeEmps = employees.filter(e => e.active);
  if (activeEmps.length === 0) {
    return (
      <div className="text-center py-10 bg-white rounded-xl shadow">
        <p className="text-4xl mb-3">👥</p>
        <p className="text-gray-500">Нет активных сотрудников</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {activeEmps.map(emp => (
        <div key={emp.id} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-800">{emp.name}</h4>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Месяц</span>
          </div>
          <div className="space-y-4">
            <KpiGoalRow
              label="🎯 Продажи"
              progress={getEmployeeProgress(emp.id, 'sales', 'month')}
              goalType="sales"
              empId={emp.id}
              setEmployeeGoal={setEmployeeGoal}
              showNotification={showNotification}
            />
            <KpiGoalRow
              label="💰 Выручка"
              progress={getEmployeeProgress(emp.id, 'revenue', 'month')}
              goalType="revenue"
              empId={emp.id}
              setEmployeeGoal={setEmployeeGoal}
              showNotification={showNotification}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Error Boundary для перехвата крашей
class LikeBirdErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { try { console.error('[LikeBird] Crash:', error, info); } catch { /* silent */ } }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 40, textAlign: 'center', fontFamily: 'system-ui' } },
        React.createElement('h2', null, '😔 Приложение столкнулось с ошибкой'),
        React.createElement('p', { style: { color: '#666', margin: '16px 0' } }, String(this.state.error?.message || 'Неизвестная ошибка')),
        React.createElement('button', {
          onClick: () => { this.setState({ hasError: false, error: null }); },
          style: { padding: '12px 24px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, cursor: 'pointer' }
        }, '🔄 Перезагрузить'),
        React.createElement('button', {
          onClick: () => { localStorage.clear(); window.location.reload(); },
          style: { padding: '12px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, cursor: 'pointer', marginLeft: 12 }
        }, '🗑️ Сбросить данные')
      );
    }
    return this.props.children;
  }
}

function LikeBirdAppInner() {
  // ===== АВТОРИЗАЦИЯ =====
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // полный объект user из likebird-users
  const [authLoading, setAuthLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'register', 'forgot'
  const [authPin, setAuthPin] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // ===== PWA =====
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  
  // ===== SYNC =====

  
  // ===== Состояния перенесённые на уровень компонента (FIX: useState в IIFE) =====
  const [analyticsPeriod, setAnalyticsPeriod] = useState(7);
  const [manualFilter, setManualFilter] = useState('all');

  const [currentView, _setCurrentView] = useState('menu');
  const [chatLimit, setChatLimit] = useState(50);
  const setCurrentView = (v) => { _setCurrentView(v); try { window.scrollTo(0, 0); } catch { /* silent */ } };
  const [reports, setReports] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stock, setStock] = useState(getInitialStock);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [salePrice, setSalePrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [employeeName, setEmployeeName] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [tipsAmount, setTipsAmount] = useState('');
  const [textReport, setTextReport] = useState('');
  const [parsedSales, setParsedSales] = useState([]);
  const [unrecognizedSales, setUnrecognizedSales] = useState([]);
  const [parsedWorkTime, setParsedWorkTime] = useState(null);
  const [parsedExpenses, setParsedExpenses] = useState([]);
  const [parsedInventory, setParsedInventory] = useState({ start: {}, end: {} });
  const [inventoryDiscrepancies, setInventoryDiscrepancies] = useState([]);
  const [calculatedTotals, setCalculatedTotals] = useState(null);
  const [givenToAdmin, setGivenToAdmin] = useState({});
  const [salaryDecisions, setSalaryDecisions] = useState({});
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [ownCardTransfers, setOwnCardTransfers] = useState({});
  const [stockCategory, setStockCategory] = useState('Птички-свистульки');
  const [mixedCash, setMixedCash] = useState('');
  const [mixedCashless, setMixedCashless] = useState('');
  const [salePhotoGlobal, setSalePhotoGlobal] = useState(null);
  const [saleLocationGlobal, setSaleLocationGlobal] = useState('');
  // FIX #56: Notification через useRef + DOM, НЕ через useState.
  // Причина: showNotification вызывала setNotification → parent re-render → 
  // все inner-компоненты (ShiftView, StockView, AdminView и др.) пересоздавались → 
  // их локальный useState терялся. Это корневая причина ~80% багов с потерей данных.
  const notificationRef = useRef(null);
  const notificationTimerRef = useRef(null);
  // FIX #56b: ConfirmDialog тоже через ref + DOM (та же проблема что и с notification)
  const confirmDialogRef = useRef(null);
  const confirmCallbackRef = useRef(null);
  // FIX: React-стейт для модала расходов (заменяет DOM-манипуляцию)
  const [expenseModal, setExpenseModal] = useState(null); // { employee: string }
  const [partnerStock, setPartnerStock] = useState({});
  const [totalBirds, setTotalBirds] = useState(0);
  const [scheduleData, setScheduleData] = useState({});
  const [eventsCalendar, setEventsCalendar] = useState({});
  
  // Мануалы и обучающие материалы
  const [manuals, setManuals] = useState([
    {
      id: 1,
      title: '🐦 Методичка по продаже птичек-свистулек',
      category: 'sales',
      content: `МЕТОДИЧКА ПО ПРОДАЖЕ ПТИЧКИ-СВИСТУЛЬКИ

📋 ПОДГОТОВКА К РАБОТЕ

[1.] Самое важное: опрятный вид, чистый стол, салфетки на столе (если нету — покупаем, с кассы берём потом).

С вечера нужно воду набрать, птиц посчитать, чтобы утром нужно было только покушать и обуться.

⚠️ На точке важно стоять одному! Причины:
• Понижается концентрация на работе (редко свистишь, много разговариваешь)
• Снижается эффективность КПД продавца
• Вдвоём на одной точке продадите 35-40, на двух по 30 на стол и больше

❌ ЧТО НЕЛЬЗЯ ДЕЛАТЬ НА РАБОЧЕМ МЕСТЕ:
• Материться
• Курить (в т.ч вейпы, для этого можно отойти)
• Залипать/болтать в телефоне (внимание направляем на проходящих людей)
• Кушать на столе с товаром
• Уходить не предупредив
• Стоять совместно с друзьями/проходимцами

💬 ДИАЛОГ С КЛИЕНТОМ

Первым делом ловим взгляды и внимание, которые привлекаем чудным пением птиц.

Когда замечаешь взгляд 2 раза (идут смотрят, потом обернулись, или обсудили и посмотрели ещё раз) — вступаем в диалог:

"Добрый день! Подходите, почирикаем! Научу вас 3-м интересным трюкам на этой птичке"

➡️ Красиво свистишь чередуя ноты, выполняешь 2 простых трюка максимально правдоподобно изобразить звук настоящей птицы.

❓ "Ой что это у вас?"
✅ "Птички свистульки ручной работы, это полноценный одно-нотный музыкальный инструмент."

💡 Часто на этом моменте спрашивают цену — если не спрашивают, не говорите сразу, постарайтесь сначала максимально заинтересовать. (если повторяет вопрос — от 300 и выше)

🎯 ДЕМОНСТРАЦИЯ

Протягиваешь клиенту птичку объясняя как пользоваться:
"Дуете в самый край хвостика — в кружочек, не закрывая свисток (треугольник на кончике)"

❗ Важно прям вручить птицу как можно большему количеству людей из подошедших!

После того как человек свистнул:
"Отлично! Молодцом, а теперь я покажу вам 3 упражнения, которые развивают дыхательную систему:"

1️⃣ Глубоко вдыхаем, и плавно выдыхаем перебирая ноту — это разминка на объем легких

2️⃣ На выдохе произносим букву РРрр в свистульку — развивает мышцы языка! (для картавых — можно гортанным способом)

3️⃣ Гудим в птицу, произносим букву О/А/Ы — укрепляем голосовые связки, так музыканты распеваются перед сценой

🛒 ЗАКРЫТИЕ СДЕЛКИ

"Прекрасная птичка, мало того интересная и привлекает много внимания, так ещё и полезная! Какая понравилась?"

При раздумьях клиента используйте эпитеты:
• Соловей громко свистит и более прочный
• Снегирь более крутой и заливистый
• Собаки певчие, канарейки свистящие

💰 РАБОТА С ВОЗРАЖЕНИЯМИ

❓ "Ой а это дорого"
✅ "Это ручная работа, труд лепщика, скульптора, художника, а так же продавца. Полезный и красивый сувенир который точно порадует получателя"

❓ "Сделайте скидку"
✅ "Конкретно этот предмет — маленькая принцесса, заточённая злой колдуньей в птичку и поэтому я не снижу цену ни на копеечку!"

😄 Если серьёзно — мы получаем с птицы по 100 рублей и очень любим кушать пельмени и к ним ещё и майонез покупать.

❓ "Мне не хватает"
✅ Могу уступить 50-100р если совсем нет денег (но лучше сделать наценку заранее и её использовать в качестве скидки)

✅ "Ладно беру"
✅ "Чаевые приветствуются!"

⭐ ВАЖНО: Никогда не скупитесь на ценник! Лучше клиент купит без выгоды для вас, но это добавит вам +продажу к плану на бонусы — лучше чем ничего!

У каждого индивидуальный подход, но советую ознакомиться с этим текстом и изучив базу брать лучшее, вырабатывая свою собственную стратегию продаж.`,
      isPinned: true
    },
    {
      id: 2,
      title: '💰 Расчёт зарплаты',
      category: 'info',
      content: `КАК РАССЧИТЫВАЕТСЯ ЗАРПЛАТА

📊 Базовая ставка зависит от цены продажи:
• от 2001₽ и выше — 300₽
• от 1400₽ до 2000₽ — 300₽
• от 1000₽ до 1399₽ — 200₽
• от 300₽ до 999₽ — 100₽
• от 100₽ до 299₽ — 50₽
• до 99₽ — 50₽

🎁 Чаевые — 100% ваши!

🐦 Бонус за птичек-свистулек — +50₽ за каждую продажу!

💡 Формула: Базовая ставка + Чаевые + Бонус за птичек (50₽)

Пример:
Снегирь продан за 600₽ + чаевые от клиента 100₽ = 100₽ (база) + 100₽ (чаевые) + 50₽ (птичка) = 250₽`,
      isPinned: false
    },
    {
      id: 3,
      title: '❓ Частые вопросы',
      category: 'faq',
      content: `ЧАСТЫЕ ВОПРОСЫ (FAQ)

❓ Как заполнять отчёт?
✅ Используйте "Импорт отчёта" — введите текст в свободной форме, система сама распознает продажи.

❓ Что делать если товара нет в каталоге?
✅ Продажа запишется как "нераспознанная". Админ может добавить товар или исправить запись.

❓ Как работает время редактирования?
✅ После сохранения продажи у вас есть 20 минут на редактирование. После — только админ может изменить.

❓ Что значит "переводы на свою карту"?
✅ Если клиент переводит на вашу личную карту — отметьте это галочкой, чтобы сумма учлась в расчёте "К выдаче".

❓ Как узнать свой график?
✅ Раздел "Команда" → вкладка "График"

❓ Куда писать расходы?
✅ В "Итог дня" есть кнопка "Добавить расход" — укажите описание и сумму.`,
      isPinned: false
    }
  ]);
  
  // ИСПРАВЛЕНИЕ #1: Состояние для настроек зарплаты (теперь работает!)
  const [salarySettings, setSalarySettings] = useState({
    ranges: [
      { min: 2001, max: 99999, base: 300 },
      { min: 1400, max: 2000, base: 300 },
      { min: 1000, max: 1399, base: 200 },
      { min: 300, max: 999, base: 100 },
      { min: 100, max: 299, base: 50 },
      { min: 0, max: 99, base: 50 },
    ],
    bonusForBirds: true,
    adminSalaryPercentage: 10,
  });

  // НОВОЕ: Расширенные состояния для админ-панели
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminTab, setAdminTab] = useState('today');
  const [challengeForm, setChallengeForm] = useState({ title: '', icon: '🏆', type: 'daily', metric: 'sales_count', target: 10, product: '', reward: '' });
  const [teamTab, setTeamTab] = useState('online');
  const [employees, setEmployees] = useState([
    { id: 1, name: 'Лена', role: 'seller', salaryMultiplier: 1.0, active: true },
    { id: 2, name: 'Лиза', role: 'seller', salaryMultiplier: 1.0, active: true },
    { id: 3, name: 'Даша', role: 'seller', salaryMultiplier: 1.0, active: true },
    { id: 4, name: 'Сергей', role: 'senior', salaryMultiplier: 1.1, active: true },
  ]);
  const [expenseCategories] = useState([
    { id: 'supplies', name: 'Закупка товара', emoji: '📦' },
    { id: 'rent', name: 'Аренда', emoji: '🏠' },
    { id: 'ads', name: 'Реклама', emoji: '📣' },
    { id: 'transport', name: 'Транспорт', emoji: '🚗' },
    { id: 'other', name: 'Прочее', emoji: '📝' },
  ]);
  const [salesPlan, setSalesPlan] = useState({ daily: 10000, weekly: 70000, monthly: 300000 });
  const [auditLog, setAuditLog] = useState([]);
  const [customProducts, setCustomProducts] = useState([]);
  const [archivedProducts, setArchivedProducts] = useState(() => { try { return JSON.parse(localStorage.getItem('likebird-archived-products') || '[]'); } catch { return []; } });
  const toggleArchiveProduct = (name) => { const isArch = archivedProducts.includes(name); const upd = isArch ? archivedProducts.filter(n => n !== name) : [...archivedProducts, name]; setArchivedProducts(upd); save('likebird-archived-products', upd); };

  // ===== НОВЫЕ СОСТОЯНИЯ v2.4 =====
  
  // Мультиточки и локации
  const [locations, setLocations] = useState([
    { id: 1, city: 'Ростов-на-Дону', name: 'Пушкинская улица (пить кофе)', active: true },
    { id: 2, city: 'Ростов-на-Дону', name: 'Соборный переулок (Университет)', active: true },
    { id: 3, city: 'Ейск', name: 'Набережная', active: true },
    { id: 4, city: 'Ейск', name: 'Центр', active: true },
  ]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  
  // Себестоимость товаров (только для админа)
  const [costPrices, setCostPrices] = useState({});
  
  // Штрафы и бонусы
  const [penalties, setPenalties] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  
  // Больничные и отпуска
  const [timeOff, setTimeOff] = useState([]);
  
  // Рейтинг сотрудников
  const [employeeRatings, setEmployeeRatings] = useState({});
  
  // Чат/комментарии
  const [chatMessages, setChatMessages] = useState([]);
  
  // История движения товара
  const [stockHistory, setStockHistory] = useState([]);
  
  // Брак и списания
  const [writeOffs, setWriteOffs] = useState([]);
  
  // Автозаказ (список для заказа)
  const [autoOrderList, setAutoOrderList] = useState([]);
  
  // KPI и цели сотрудников
  const [employeeKPI, setEmployeeKPI] = useState({});
  // Пользовательские алиасы для распознавания товаров
  const [customAliases, setCustomAliases] = useState({});
  // Онлайн-присутствие сотрудников { login: { displayName, lastSeen, online } }
  const [presenceData, setPresenceData] = useState({});

  // Системные уведомления для пользователей (Firebase-synced)
  const [userNotifications, setUserNotifications] = useState([]);
  
  // Настройки умных уведомлений
  const [notifSettings, setNotifSettings] = useState({
    shiftReminder: true,
    lowStockAlert: true,
    stockThreshold: 3,
  });

  // FIX: Коды приглашения — перенесено из AdminView в глобальное состояние для Firebase-синхронизации
  const [inviteCodes, setInviteCodes] = useState([]);

  // Кастомные достижения (созданные администратором)
  const [customAchievements, setCustomAchievements] = useState([]);
  // Смены сотрудников: { 'login_date': { openTime, closeTime, status, confirmedAt } }
  const [shiftsData, setShiftsData] = useState({});
  // Выданные вручную достижения { achievementId: [login1, login2, ...] }
  const [achievementsGranted, setAchievementsGranted] = useState({});
  
  // ===== Профили сотрудников (аватар, bio, синхронизируется) =====
  const [profilesData, setProfilesData] = useState({});
  
  // Уведомления системы
  const [systemNotifications, setSystemNotifications] = useState([]);
  
  // Фильтры для поиска
  const [searchFilters, setSearchFilters] = useState({ query: '', dateFrom: '', dateTo: '', employee: '', location: '' });
  
  // Аналитика - кэш данных
  const [analyticsCache, setAnalyticsCache] = useState(null);

  // === BLOCK 9: Dark Theme ===
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('likebird-dark-mode') === 'true'; } catch { return false; }
  });

  // === BLOCK 7: Gamification — Challenges ===
  const [challenges, setChallenges] = useState([]);

  // === BLOCK 4: Product Photos (MediaStore — per-photo Firebase keys) ===
  const [productPhotos, setProductPhotos] = useState({});
  const [shiftPhotos, setShiftPhotos] = useState({});
  const mediaKeysRef = useRef(new Set());

  // === BLOCK 11: Offline Queue (placeholder for future use) ===
  // syncQueue data is loaded from localStorage on demand


  // === BLOCK 9: Dark Theme CSS injection ===
  useEffect(() => {
    const styleId = 'likebird-dark-theme';
    let styleEl = document.getElementById(styleId);
    if (darkMode) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        .dark-theme { --bg-primary: #1a1a2e; --bg-card: #16213e; --text-primary: #e0e0e0; --text-secondary: #a0a0a0; --border: #2a2a4a; }
        .dark-theme .bg-white { background: var(--bg-card) !important; color: var(--text-primary) !important; }
        .dark-theme .bg-gradient-to-b, .dark-theme .min-h-screen { background: var(--bg-primary) !important; }
        .dark-theme .bg-gradient-to-br { background: linear-gradient(135deg, #1a1a2e, #16213e) !important; }
        .dark-theme .from-amber-50, .dark-theme .via-orange-50, .dark-theme .to-amber-100 { --tw-gradient-from: #1a1a2e !important; --tw-gradient-to: #16213e !important; }
        .dark-theme .text-gray-600, .dark-theme .text-gray-500, .dark-theme .text-gray-400, .dark-theme .text-gray-700, .dark-theme .text-gray-800 { color: var(--text-secondary) !important; }
        .dark-theme .bg-gray-100, .dark-theme .bg-gray-50, .dark-theme .bg-amber-50, .dark-theme .bg-orange-50 { background: #1e2a3a !important; }
        .dark-theme .border-gray-200, .dark-theme .border-gray-100 { border-color: var(--border) !important; }
        .dark-theme input, .dark-theme textarea, .dark-theme select { background: #1e2a3a !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .dark-theme .shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.4) !important; }
        .dark-theme .bg-amber-100, .dark-theme .bg-orange-100, .dark-theme .bg-blue-50, .dark-theme .bg-green-50 { background: #1e2a3a !important; }
        .dark-theme .text-amber-600 { color: #fbbf24 !important; }
        .dark-theme h3, .dark-theme h2, .dark-theme h1 { color: #e0e0e0 !important; }
        .dark-theme .bg-gradient-to-r.from-amber-400, .dark-theme .sticky { background: linear-gradient(to right, #d97706, #ea580c) !important; }
      `;
      localStorage.setItem('likebird-dark-mode', 'true');
    } else {
      if (styleEl) styleEl.textContent = '';
      localStorage.setItem('likebird-dark-mode', 'false');
    }
  }, [darkMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadJson = (key, setter, def) => { try { const s = localStorage.getItem(key); if (s) setter(JSON.parse(s)); else if (def) setter(def); } catch { if (def) setter(def); } };
    
    // ===== АВТОРИЗАЦИЯ: проверка сохранённой сессии =====
    try {
      const authData = localStorage.getItem('likebird-auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.authenticated && parsed.expiry > Date.now()) {
          setIsAuthenticated(true);
          setAuthName(parsed.name || '');
          // Загружаем полный объект пользователя
          try {
            const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
            const foundUser = users.find(u => u.login === parsed.login);
            if (foundUser) setCurrentUser(foundUser);
          } catch { /* silent */ }
        }
      }
    } catch { /* silent */ }
    setAuthLoading(false);
    
    // ===== PWA: Перехватываем событие установки =====
    const handleBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // ===== Онлайн/оффлайн =====
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    const flushOfflineQueue = () => {
      try {
        const q = JSON.parse(localStorage.getItem('likebird-offline-queue') || '[]');
        if (q.length === 0) return;
        q.forEach(key => { try { const data = JSON.parse(localStorage.getItem(key)); if (data != null) fbSave(key, data); } catch { /* silent */ } });
        localStorage.removeItem('likebird-offline-queue');
      } catch { /* silent */ }
    };
    window.addEventListener('online', flushOfflineQueue);
    window.addEventListener('offline', handleOffline);
    
    // Загрузка reports с миграцией старых данных
    try {
      const savedReports = localStorage.getItem('likebird-reports');
      if (savedReports) {
        const parsed = JSON.parse(savedReports);
        // Миграция: если product - объект, преобразуем в строку
        let migrated = parsed.map(r => {
          if (r.product && typeof r.product === 'object' && r.product.name) {
            return { ...r, product: r.product.name };
          }
          return r;
        });
        // FIX: Миграция v2 — обнуляем auto-tips (старая модель записывала наценку как чаевые)
        // В старой модели: tips = salePrice - basePrice (автоматически), cashAmount = salePrice
        // В новой модели: tips = только реальные чаевые (вводятся вручную)
        migrated = migrated.map(r => {
          if (!r.tipsModel && r.tips > 0 && r.basePrice > 0 && r.tips === r.salePrice - r.basePrice) {
            // Это автоматически рассчитанные «чаевые» = наценка, обнуляем
            const newSalary = r.salary - r.tips; // Убираем tips из salary (salary = base + tips)
            return { ...r, tips: 0, salary: Math.max(0, newSalary), tipsModel: 'v2' };
          }
          return { ...r, tipsModel: r.tipsModel || 'v2' };
        });
        setReports(migrated);
        // Сохраняем миграцию
        if (JSON.stringify(parsed) !== JSON.stringify(migrated)) {
          localStorage.setItem('likebird-reports', JSON.stringify(migrated));
        }
      }
    } catch { setReports([]); }
    
    loadJson('likebird-expenses', setExpenses, []);
    const savedName = localStorage.getItem('likebird-employee');
    if (savedName) setEmployeeName(savedName);
    loadJson('likebird-given', setGivenToAdmin, {});
    loadJson('likebird-salary-decisions', setSalaryDecisions, {});
    loadJson('likebird-stock', setStock, getInitialStock());
    loadJson('likebird-owncard', setOwnCardTransfers, {});
    loadJson('likebird-partners', setPartnerStock, {});
    loadJson('likebird-totalbirds', setTotalBirds, 0);
    loadJson('likebird-schedule', setScheduleData, {});
    // Загрузка событий с миграцией: старый формат { date: eventObj } → новый { date: [eventObj, ...] }
    try {
      const savedEvents = localStorage.getItem('likebird-events');
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        let migrated = false;
        const result = {};
        Object.entries(parsed).forEach(([key, val]) => {
          if (Array.isArray(val)) {
            result[key] = val;
          } else if (val && typeof val === 'object') {
            result[key] = [val];
            migrated = true;
          }
        });
        setEventsCalendar(result);
        if (migrated) localStorage.setItem('likebird-events', JSON.stringify(result));
      }
    } catch { setEventsCalendar({}); }
    // Загружаем мануалы (если есть кастомные)
    try {
      const savedManuals = localStorage.getItem('likebird-manuals');
      if (savedManuals) {
        const parsed = JSON.parse(savedManuals);
        if (parsed.length > 0) setManuals(parsed);
      }
    } catch { /* silent */ }
    // ИСПРАВЛЕНИЕ #1: Загружаем настройки зарплаты
    loadJson('likebird-salary-settings', setSalarySettings, {
      ranges: [
        { min: 2001, max: 99999, base: 300 },
        { min: 1400, max: 2000, base: 300 },
        { min: 1000, max: 1399, base: 200 },
        { min: 300, max: 999, base: 100 },
        { min: 100, max: 299, base: 50 },
        { min: 0, max: 99, base: 50 },
      ],
      bonusForBirds: true,
      adminSalaryPercentage: 10,
    });
    // НОВОЕ: Загружаем данные админ-панели
    loadJson('likebird-admin-password', setAdminPassword, '');
    loadJson('likebird-employees', setEmployees, [
      { id: 1, name: 'Лена', role: 'seller', salaryMultiplier: 1.0, active: true },
      { id: 2, name: 'Лиза', role: 'seller', salaryMultiplier: 1.0, active: true },
      { id: 3, name: 'Даша', role: 'seller', salaryMultiplier: 1.0, active: true },
      { id: 4, name: 'Сергей', role: 'senior', salaryMultiplier: 1.1, active: true },
    ]);
    loadJson('likebird-sales-plan', setSalesPlan, { daily: 10000, weekly: 70000, monthly: 300000 });
    loadJson('likebird-audit-log', setAuditLog, []);
    loadJson('likebird-custom-products', setCustomProducts, []);
    
    // ===== ЗАГРУЗКА НОВЫХ ДАННЫХ v2.4 =====
    loadJson('likebird-locations', setLocations, [
      { id: 1, city: 'Ростов-на-Дону', name: 'Пушкинская улица (пить кофе)', active: true },
      { id: 2, city: 'Ростов-на-Дону', name: 'Соборный переулок (Университет)', active: true },
      { id: 3, city: 'Ейск', name: 'Набережная', active: true },
      { id: 4, city: 'Ейск', name: 'Центр', active: true },
    ]);
    loadJson('likebird-cost-prices', setCostPrices, {});
    loadJson('likebird-penalties', setPenalties, []);
    loadJson('likebird-bonuses', setBonuses, []);
    loadJson('likebird-timeoff', setTimeOff, []);
    loadJson('likebird-ratings', setEmployeeRatings, {});
    loadJson('likebird-chat', setChatMessages, []);
    loadJson('likebird-stock-history', setStockHistory, []);
    loadJson('likebird-writeoffs', setWriteOffs, []);
    loadJson('likebird-autoorder', setAutoOrderList, []);
    loadJson('likebird-kpi', setEmployeeKPI, {});
    // Загрузка пользовательских алиасов
    try {
      const savedAliases = localStorage.getItem('likebird-custom-aliases');
      if (savedAliases) setCustomAliases(JSON.parse(savedAliases));
    } catch { /* silent */ }
    loadJson('likebird-invite-codes', setInviteCodes, []);
    loadJson('likebird-notif-settings', setNotifSettings, { shiftReminder: true, lowStockAlert: true, stockThreshold: 3 });
    loadJson('likebird-notifications', setUserNotifications, []);
    loadJson('likebird-custom-achievements', setCustomAchievements, []);
    loadJson('likebird-shifts', setShiftsData, {});
    loadJson('likebird-achievements-granted', setAchievementsGranted, {});
    loadJson('likebird-challenges', setChallenges, []);
    // Загрузка фото из MediaStore (per-photo ключи)
    loadJson('likebird-product-photos-data', (legacy) => {
      // Загружаем индекс
      let idx = [];
      try { idx = JSON.parse(localStorage.getItem('likebird-media-index') || '[]'); } catch { /* silent */ }
      const photos = {};
      // Сначала загружаем из per-photo ключей
      for (const name of idx) {
        try {
          const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
          const v = localStorage.getItem(k);
          if (v && v.startsWith('data:')) photos[name] = v;
        } catch { /* silent */ }
      }
      // Дополняем из legacy (если per-photo ключа нет)
      if (legacy && typeof legacy === 'object') {
        for (const [name, val] of Object.entries(legacy)) {
          if (val && !photos[name]) photos[name] = val;
        }
      }
      setProductPhotos(photos);
      // Обновляем mediaKeysRef
      mediaKeysRef.current = new Set(Object.keys(photos));
    }, {});
    // Загрузка фото смен
    loadJson('likebird-shift-photos', setShiftPhotos, {});
    // likebird-sync-queue loaded on demand
    
    // ===== Cleanup =====
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', flushOfflineQueue);
    };
  }, []);


  // ===== FIREBASE: Realtime синхронизация между устройствами =====
  useEffect(() => {
    // Маппинг: ключ localStorage → React-setter
    // Firebase уведомляет нас об изменениях от ДРУГИХ устройств
    // FIX: Обёртка для подписок — игнорирует обновления для ключей, которые мы сейчас сами записываем
    const guardedSubscribe = (key, callback) => fbSubscribe(key, (val) => {
      if (fbWriteKeys.current.has(key)) return; // Игнорируем echo от нашей же записи
      callback(val);
    });

    const subscriptions = [
      // Отчёты (с миграцией старого формата)
      guardedSubscribe('likebird-reports', (val) => {
        let migrated = Array.isArray(val) ? val.map(r => {
          if (r.product && typeof r.product === 'object' && r.product.name) return { ...r, product: r.product.name };
          return r;
        }) : [];
        // FIX: Миграция v2 для данных от Firebase (auto-tips → 0)
        migrated = migrated.map(r => {
          if (!r.tipsModel && r.tips > 0 && r.basePrice > 0 && r.tips === r.salePrice - r.basePrice) {
            return { ...r, tips: 0, salary: Math.max(0, (r.salary || 0) - r.tips), tipsModel: 'v2' };
          }
          return { ...r, tipsModel: r.tipsModel || 'v2' };
        });
        setReports(migrated);
        localStorage.setItem('likebird-reports', JSON.stringify(migrated));
      }),
      guardedSubscribe('likebird-expenses', (val) => { setExpenses(val); try { try { localStorage.setItem('likebird-expenses', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-stock', (val) => { setStock(val); try { try { localStorage.setItem('likebird-stock', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-given', (val) => { setGivenToAdmin(val); try { try { localStorage.setItem('likebird-given', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-salary-decisions', (val) => { setSalaryDecisions(val); try { try { localStorage.setItem('likebird-salary-decisions', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-owncard', (val) => { setOwnCardTransfers(val); try { try { localStorage.setItem('likebird-owncard', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-partners', (val) => { setPartnerStock(val); try { try { localStorage.setItem('likebird-partners', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-totalbirds', (val) => { setTotalBirds(val); try { try { localStorage.setItem('likebird-totalbirds', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-schedule', (val) => { setScheduleData(val); try { try { localStorage.setItem('likebird-schedule', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-events', (val) => {
        // Миграция: старый формат { date: eventObj } → новый { date: [eventObj, ...] }
        if (val && typeof val === 'object') {
          const migrated = {};
          Object.entries(val).forEach(([key, v]) => {
            if (Array.isArray(v)) migrated[key] = v;
            else if (v && typeof v === 'object') migrated[key] = [v];
          });
          setEventsCalendar(migrated);
          localStorage.setItem('likebird-events', JSON.stringify(migrated));
        }
      }),
      guardedSubscribe('likebird-manuals', (val) => { if (Array.isArray(val) && val.length > 0) { setManuals(val); try { try { localStorage.setItem('likebird-manuals', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-salary-settings', (val) => { setSalarySettings(val); try { try { localStorage.setItem('likebird-salary-settings', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-admin-password', (val) => { setAdminPassword(val); try { try { localStorage.setItem('likebird-admin-password', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-employees', (val) => {
        if (!Array.isArray(val)) return;
        // Синхронизируем employees с registered users: добавляем недостающих
        const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
        let merged = [...val];
        regUsers.forEach(u => {
          const name = u.name || u.login;
          if (!merged.find(e => e.name === name)) {
            merged.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), name, role: u.role || 'seller', salaryMultiplier: 1.0, active: true });
          }
        });
        setEmployees(merged);
        localStorage.setItem('likebird-employees', JSON.stringify(merged));
      }),
      guardedSubscribe('likebird-sales-plan', (val) => { setSalesPlan(val); try { try { localStorage.setItem('likebird-sales-plan', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-audit-log', (val) => { setAuditLog(val); try { try { localStorage.setItem('likebird-audit-log', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-custom-products', (val) => { setCustomProducts(val); try { try { localStorage.setItem('likebird-custom-products', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-locations', (val) => { setLocations(val); try { try { localStorage.setItem('likebird-locations', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-cost-prices', (val) => { setCostPrices(val); try { try { localStorage.setItem('likebird-cost-prices', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-penalties', (val) => { setPenalties(val); try { try { localStorage.setItem('likebird-penalties', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-bonuses', (val) => { setBonuses(val); try { try { localStorage.setItem('likebird-bonuses', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-timeoff', (val) => { setTimeOff(val); try { try { localStorage.setItem('likebird-timeoff', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-ratings', (val) => { setEmployeeRatings(val); try { try { localStorage.setItem('likebird-ratings', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-chat', (val) => {
        if (Array.isArray(val) && val.length > 0) {
          const last = val[val.length - 1];
          const myL = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
          if (last.fromLogin && last.fromLogin !== myL && last.date && Date.now() - last.date < 10000) {
            try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.frequency.setValueAtTime(660, ctx.currentTime); o.frequency.setValueAtTime(880, ctx.currentTime + 0.1); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.start(); o.stop(ctx.currentTime + 0.3); } catch { /* silent */ }
          }
        }
        setChatMessages(val); try { try { localStorage.setItem('likebird-chat', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-stock-history', (val) => { setStockHistory(val); try { try { localStorage.setItem('likebird-stock-history', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-writeoffs', (val) => { setWriteOffs(val); try { try { localStorage.setItem('likebird-writeoffs', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-autoorder', (val) => { setAutoOrderList(val); try { try { localStorage.setItem('likebird-autoorder', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-kpi', (val) => { setEmployeeKPI(val); try { try { localStorage.setItem('likebird-kpi', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-custom-achievements', (val) => { if (Array.isArray(val)) { setCustomAchievements(val); try { try { localStorage.setItem('likebird-custom-achievements', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-archived-products', (val) => { if (Array.isArray(val)) setArchivedProducts(val); }),
      guardedSubscribe('likebird-system-notifications', (val) => { if (Array.isArray(val)) { try { localStorage.setItem('likebird-system-notifications', JSON.stringify(val)); } catch { /* silent */ } } }),
      guardedSubscribe('likebird-challenges', (val) => { if (Array.isArray(val)) { setChallenges(val); try { try { localStorage.setItem('likebird-challenges', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      // MediaStore: подписка на индекс фото → загрузка каждого фото отдельно
      guardedSubscribe('likebird-media-index', (idx) => {
        if (!Array.isArray(idx)) return;
        try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
        mediaKeysRef.current = new Set(idx);
        // Загружаем каждое фото по отдельному ключу
        idx.forEach(name => {
          const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
          fbSubscribe(k, (val) => {
            if (val && typeof val === 'string') {
              setProductPhotos(prev => {
                const next = { ...prev, [name]: val };
                try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
                return next;
              });
              try { localStorage.setItem(k, val); } catch { /* silent */ }
            }
          });
        });
      }),
      // Легаси подписка (для обратной совместимости)
      guardedSubscribe('likebird-product-photos-data', (val) => {
        if (val && typeof val === 'object') {
          setProductPhotos(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(val)) { if (v && !merged[k]) merged[k] = v; }
            return merged;
          });
        }
      }),
      guardedSubscribe('likebird-notifications', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-notifications', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        setUserNotifications(val);
        // Показать push-уведомления для НОВЫХ непрочитанных (но НЕ помечаем read автоматически)
        try {
          const authRaw = localStorage.getItem('likebird-auth');
          if (!authRaw) return;
          const auth = JSON.parse(authRaw);
          // Ищем уведомления которые ещё не показывали (по shownLocally флагу)
          const myNew = val.filter(n => n.targetLogin === auth.login && !n.read && !n.shownLocally);
          myNew.forEach(n => {
            showNotification(n.body || n.title, 'achievement');
            // Web Notification API (push на телефон)
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification(n.title || 'LikeBird', { body: n.body, icon: '/favicon.ico', badge: '/favicon.ico' }); } catch { /* silent */ }
            }
            // Звук
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
              osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.2);
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
              osc.start(ctx.currentTime);
              osc.stop(ctx.currentTime + 0.5);
            } catch { /* silent */ }
          });
          // Помечаем shownLocally чтобы не показывать toast повторно (но НЕ read!)
          if (myNew.length > 0) {
            const updatedVal = val.map(n => (n.targetLogin === auth.login && !n.shownLocally) ? { ...n, shownLocally: true } : n);
            localStorage.setItem('likebird-notifications', JSON.stringify(updatedVal));
            setUserNotifications(updatedVal);
            fbSave('likebird-notifications', updatedVal);
          }
        } catch { /* silent */ }
      }),
      guardedSubscribe('likebird-achievements-granted', (val) => { if (val && typeof val === 'object') { setAchievementsGranted(val); try { try { localStorage.setItem('likebird-achievements-granted', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } } }),
      guardedSubscribe('likebird-profiles', (val) => { setProfilesData(val); try { try { localStorage.setItem('likebird-profiles', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }),
      guardedSubscribe('likebird-users', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-users', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        // Обновляем currentUser если его данные изменились (например роль)
        try {
          const authRaw = localStorage.getItem('likebird-auth');
          if (authRaw) {
            const auth = JSON.parse(authRaw);
            const me = val.find(u => u.login === auth.login);
            if (me) setCurrentUser(me);
          }
        } catch { /* silent */ }
      }),
      guardedSubscribe('likebird-shifts', (val) => {
        if (val && typeof val === 'object') { setShiftsData(val); try { try { localStorage.setItem('likebird-shifts', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ } }
      }),
      guardedSubscribe('likebird-invite-codes', (val) => {
        if (!Array.isArray(val)) return;
        try { try { localStorage.setItem('likebird-invite-codes', JSON.stringify(val)); } catch { /* silent */ } } catch { /* silent */ }
        setInviteCodes(val); // FIX: обновляем глобальное состояние
      }),
    ];

    // Подписка на онлайн-присутствие всех пользователей
    const unsubPresence = fbSubscribePresence(setPresenceData);

    // Отписываемся при размонтировании компонента
    return () => {
      subscriptions.forEach(unsub => { if (typeof unsub === 'function') unsub(); });
      if (unsubPresence) unsubPresence();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Запросить разрешение на уведомления
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);



  // Heartbeat presence — отдельный useEffect зависящий от currentUser
  useEffect(() => {
    if (!currentUser?.login) return;
    const sendPresence = () => {
      const dispName = profilesData[currentUser.login]?.displayName || currentUser.name || currentUser.login;
      fbSetPresence(currentUser.login, dispName);
    };
    sendPresence(); // сразу при входе
    const interval = setInterval(sendPresence, 60000); // каждую минуту
    return () => clearInterval(interval);
  }, [currentUser?.login]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Интеграция кастомных товаров в поиск =====
  useEffect(() => {
    DYNAMIC_ALL_PRODUCTS = [
      ...ALL_PRODUCTS,
      ...customProducts.map(p => ({
        name: p.name, price: p.price, emoji: p.emoji || '📦',
        aliases: p.aliases || [p.name.toLowerCase()],
        category: p.category || '3D игрушки', isCustom: true,
      })),
    ];
    // FIX: Дозаполняем stock для кастомных товаров без записей (миграция)
    if (customProducts.length > 0) {
      let needUpdate = false;
      const newStock = {...stock};
      customProducts.forEach(p => {
        if (!newStock[p.name]) {
          newStock[p.name] = { count: 0, minStock: 3, category: p.category || '3D игрушки', emoji: p.emoji || '📦', price: p.price };
          needUpdate = true;
        }
      });
      if (needUpdate) updateStock(newStock);
    }
  }, [customProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== Проверка низкого остатка при изменении склада =====
  useEffect(() => {
    const lowItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock);
    if (lowItems.length > 0 && reports.length > 0) {
      // Проверяем не слишком ли часто уведомляем
      const lastNotif = localStorage.getItem('likebird-last-low-stock-notif');
      const now = Date.now();
      if (!lastNotif || now - parseInt(lastNotif) > 3600000) { // Не чаще раза в час
        addSystemNotification('stock', `Низкий остаток: ${lowItems.slice(0, 3).map(([n]) => n).join(', ')}${lowItems.length > 3 ? ` и ещё ${lowItems.length - 3}` : ''}`, 'high');
        localStorage.setItem('likebird-last-low-stock-notif', now.toString());
      }
    }
  }, [stock]);

  // ===== Автоматическое начисление достижений при изменении отчётов =====
  useEffect(() => {
    if (!currentUser?.login || !customAchievements.length) return;
    // Для каждого активного пользователя проверяем автоматические достижения
    const allUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
    let anyGranted = false;
    const newGranted = { ...achievementsGranted };

    allUsers.forEach(u => {
      const login = u.login;
      const empName = u.name || u.login;
      const empDisplayName = profilesData[login]?.displayName;
      // FIX: Ищем отчёты по login И по displayName (отчёты сохраняются под login, но displayName мог измениться)
      const userReports = reports.filter(r => (r.employee === empName || r.employee === login || (empDisplayName && r.employee === empDisplayName)) && !r.isUnrecognized);
      const totalRevenue = userReports.reduce((s, r) => s + r.total, 0);

      customAchievements.forEach(ach => {
        if (ach.condType === 'manual') return; // ручные — только через админ
        const val = Number(ach.condValue) || 0;
        const alreadyGranted = (newGranted[ach.id] || []).includes(login);
        if (alreadyGranted) return;

        let done = false;
        if (ach.condType === 'sales_count') done = userReports.length >= val;
        else if (ach.condType === 'revenue') done = totalRevenue >= val;
        else if (ach.condType === 'big_sale') done = userReports.some(r => r.salePrice >= val);
        else if (ach.condType === 'tips_count') done = userReports.filter(r => r.tips > 0).length >= val;

        if (done) {
          newGranted[ach.id] = [...(newGranted[ach.id] || []), login];
          anyGranted = true;
          // Уведомление сотруднику
          const notifKey = 'likebird-notifications';
          const existing = (() => { try { return JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch { return []; } })();
          const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'achievement', targetLogin: login, title: `🏆 Новое достижение: ${ach.title}`, body: ach.desc || '', icon: ach.icon || '🏆', timestamp: Date.now(), read: false };
          const updated = [notif, ...existing.slice(0, 49)];
          localStorage.setItem(notifKey, JSON.stringify(updated));
          // Сохраняем в Firebase чтобы уведомление дошло до устройства сотрудника
          fbSave(notifKey, updated);
          // Бонус если задан
          if (ach.bonusAmount) {
            const matchedEmp = employees.find(e => e.name === empName);
            const empId = matchedEmp ? matchedEmp.id : login;
            const bonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), employeeId: empId, employeeName: empName, employeeLogin: login, achievementId: ach.id, amount: Number(ach.bonusAmount), reason: `Достижение: ${ach.title}`, date: new Date().toISOString(), createdAt: Date.now() };
            const newBonuses = [...bonuses, bonus];
            setBonuses(newBonuses);
            save('likebird-bonuses', newBonuses);
          }
        }
      });
    });

    if (anyGranted) {
      setAchievementsGranted(newGranted);
      save('likebird-achievements-granted', newGranted);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, customAchievements]);

  // ===== УМНЫЕ УВЕДОМЛЕНИЯ: Проверка смены и остатков =====
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkShiftReminder = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('likebird-notif-settings') || '{}');
        if (!settings.shiftReminder) return;
        const now = new Date();
        if (now.getHours() < 10) return; // До 10:00 не проверяем
        const login = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
        if (!login) return;
        const todayStr = formatDate(now);
        const shiftKey = `${login}_${todayStr}`;
        const shifts = JSON.parse(localStorage.getItem('likebird-shifts') || '{}');
        if (!shifts[shiftKey] || !shifts[shiftKey].status) {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification('LikeBird 🐦', { body: '⏰ Смена ещё не открыта! Не забудьте начать работу.', icon: '/favicon.ico' }); } catch { /* silent */ }
          }
        }
      } catch { /* silent */ }
    };
    // Проверяем сразу и каждый час
    const timer = setTimeout(checkShiftReminder, 5000);
    const interval = setInterval(checkShiftReminder, 60 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [isAuthenticated]);

  // ===== Реф для блокировки Firebase-обновлений пока мы сами пишем =====
  const fbWriting = useRef(false);
  const fbWriteKeys = useRef(new Set());

  // Сохраняет данные: локально + в Firebase (для всех устройств)
  // FIX: устанавливает guard чтобы подписки не перезаписывали данные обратно
  const save = (key, data) => {
    fbWriteKeys.current.add(key);
    fbWriting.current = true;
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { logErr('save:localStorage:' + key, e); }
    if (navigator.onLine !== false) {
      try { fbSave(key, data); } catch (e) { logErr('save:firebase', e); }
    } else {
      try { const q = JSON.parse(localStorage.getItem('likebird-offline-queue') || '[]'); if (!q.includes(key)) { q.push(key); localStorage.setItem('likebird-offline-queue', JSON.stringify(q)); } } catch { /* silent */ }
    }
    setTimeout(() => {
      fbWriteKeys.current.delete(key);
      if (fbWriteKeys.current.size === 0) fbWriting.current = false;
    }, 500);
  };
  const updateReports = (r) => {
    // Архивация: если >5000, удаляем старейшие
    let data = r;
    if (data.length > 5000) {
      data = data.slice(-5000);
      showNotification('Автоочистка: удалены старые записи');
    }
    setReports(data); save('likebird-reports', data); };
  const updateStock = (s) => { 
    setStock(s); 
    save('likebird-stock', s);
    try { checkLowStockAuto(s); } catch { /* silent */ }
    // Проверка низких остатков
    try {
      const settings = JSON.parse(localStorage.getItem('likebird-notif-settings') || '{}');
      if (settings.lowStockAlert) {
        const threshold = settings.stockThreshold || 3;
        Object.entries(s).forEach(([name, data]) => {
          if (data.count > 0 && data.count <= threshold && data.count <= (data.minStock || threshold)) {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try { new Notification('LikeBird — Низкий остаток', { body: `⚠️ ${name}: осталось ${data.count} шт`, icon: '/favicon.ico' }); } catch { /* silent */ }
            }
          }
        });
      }
    } catch { /* silent */ }
  };
  const updateSalaryDecision = (id, dec) => { const u = {...salaryDecisions, [id]: dec}; setSalaryDecisions(u); save('likebird-salary-decisions', u); };
  const getEffectiveSalary = (r) => calculateSalary(r.basePrice, r.salePrice, r.category, r.tips || 0, salaryDecisions[r.id] || 'normal', salarySettings);
  // FIX #56: showNotification через DOM — НЕ вызывает parent re-render, 
  // inner-компоненты сохраняют свой локальный state.
  const showNotification = (message, type = 'success') => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    const el = notificationRef.current;
    if (!el) return;
    el.textContent = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    el.className = `fixed top-4 left-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white text-sm font-medium transition-opacity duration-300 ${type === 'error' ? 'bg-red-500' : type === 'achievement' ? 'bg-yellow-500' : 'bg-green-500'}`;
    el.style.transform = 'translateX(-50%)';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    notificationTimerRef.current = setTimeout(() => {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }, 3000);
  };
  // FIX #56b: showConfirm через DOM — НЕ вызывает parent re-render.
  const showConfirm = (message, onConfirm) => {
    confirmCallbackRef.current = onConfirm;
    const el = confirmDialogRef.current;
    if (!el) return;
    el.querySelector('[data-confirm-msg]').textContent = message;
    el.style.display = 'flex';
  };
  const hideConfirm = () => {
    const el = confirmDialogRef.current;
    if (el) el.style.display = 'none';
    confirmCallbackRef.current = null;
  };
  const handleConfirmClick = () => {
    const callback = confirmCallbackRef.current;
    hideConfirm();
    if (callback) callback();
  };
  
  // FIX #56c: InputModal тоже через ref + DOM (та же проблема)
  const inputModalRef = useRef(null);
  const inputModalInputRef = useRef(null);
  const [inputModalValue, setInputModalValue] = useState('');
  const inputModalCallbackRef = useRef(null);
  
  const showInputModal = ({ title, placeholder, defaultValue = '', onSave }) => {
    inputModalCallbackRef.current = onSave;
    const el = inputModalRef.current;
    if (!el) return;
    el.querySelector('[data-input-title]').textContent = title;
    const input = inputModalInputRef.current;
    if (input) { input.placeholder = placeholder; input.value = defaultValue; }
    el.style.display = 'flex';
    setTimeout(() => input && input.focus(), 50);
  };
  const hideInputModal = () => {
    const el = inputModalRef.current;
    if (el) el.style.display = 'none';
    inputModalCallbackRef.current = null;
  };
  const handleInputModalSave = () => {
    const val = inputModalInputRef.current?.value?.trim();
    const callback = inputModalCallbackRef.current;
    hideInputModal();
    if (val && callback) callback(val);
  };
  const updateOwnCard = (emp, date, value) => { const u = {...ownCardTransfers, [`${emp}_${date}`]: value}; setOwnCardTransfers(u); save('likebird-owncard', u); };
  const getOwnCard = (emp, date) => ownCardTransfers[`${emp}_${date}`] || false;

  // НОВОЕ: Функция аудита действий
  const logAction = (action, details) => {
    const entry = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), action, details, user: employeeName || 'Аноним' };
    const updated = [entry, ...auditLog].slice(0, 500); // Храним последние 500 записей
    setAuditLog(updated);
    save('likebird-audit-log', updated);
  };

  // Безопасное получение имени продукта (на случай если product - объект)
  const getProductName = (product) => {
    if (!product) return 'Неизвестно';
    if (typeof product === 'string') return product;
    if (typeof product === 'object' && product.name) return product.name;
    return String(product);
  };

  // НОВОЕ: Функции для управления сотрудниками
  const updateEmployees = (newEmployees) => { setEmployees(newEmployees); save('likebird-employees', newEmployees); };
  const addEmployee = (name, role = 'seller') => {
    const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name, role, salaryMultiplier: 1.0, active: true };
    updateEmployees([...employees, newEmp]);
    logAction('Добавлен сотрудник', name);
  };
  // === BLOCK 8: Enhanced audit for deletions ===
  // eslint-disable-next-line no-unused-vars
  const deleteReportWithAudit = (reportId) => {
    const report = reports.find(r => r.id === reportId);
    if (report) {
      showConfirm('Удалить отчёт о продаже ' + getProductName(report.product) + '?', () => {
        const updated = reports.filter(r => r.id !== reportId);
        updateReports(updated);
        logAction('delete-report', JSON.stringify({ product: getProductName(report.product), total: report.total, employee: report.employee }));
        showNotification('Отчёт удалён');
      });
    }
  };

  const removeEmployee = (id) => {
    const emp = employees.find(e => e.id === id);
    updateEmployees(employees.filter(e => e.id !== id));
    if (emp) logAction('Удалён сотрудник', emp.name);
  };
  const toggleEmployeeActive = (id) => {
    updateEmployees(employees.map(e => e.id === id ? { ...e, active: !e.active } : e));
  };

  // НОВОЕ: Функции для плана продаж
  const updateSalesPlan = (plan) => { setSalesPlan(plan); save('likebird-sales-plan', plan); };

  // НОВОЕ: Функции для пароля админа (с хэшированием)
  const setAdminPass = async (pass) => { 
    const hashed = await hashPassword(pass);
    setAdminPassword(hashed); 
    save('likebird-admin-password', hashed); 
    logAction('Изменён пароль админки', '***'); 
  };
  const checkAdminPassword = async (input) => {
    if (!adminPassword) return true;
    const hashed = await hashPassword(input);
    return hashed === adminPassword;
  };

  // НОВОЕ: Функции для кастомных товаров
  const updateCustomProducts = (products) => { setCustomProducts(products); save('likebird-custom-products', products); };
  const updateManuals = (newManuals) => { setManuals(newManuals); save('likebird-manuals', newManuals); };
  const addCustomProduct = (product) => {
    // Проверка дубликата
    const dup = DYNAMIC_ALL_PRODUCTS.find(p => p.name.toLowerCase() === product.name.toLowerCase());
    if (dup) { showNotification(`Товар "${product.name}" уже существует`, 'error'); return; }
    const newProd = { ...product, id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), isCustom: true };
    updateCustomProducts([...customProducts, newProd]);
    // FIX: Добавляем товар в склад (ранее кастомные не появлялись в остатках)
    if (!stock[product.name]) {
      const newStock = {...stock, [product.name]: { count: 0, minStock: 3, category: product.category || '3D игрушки', emoji: product.emoji || '📦', price: product.price }};
      updateStock(newStock);
    }
    logAction('Добавлен товар', product.name);
  };
  const removeCustomProduct = (id) => {
    const prod = customProducts.find(p => p.id === id);
    if (prod) {
      const usedIn = reports.filter(r => getProductName(r.product) === prod.name).length;
      if (usedIn > 0) { showNotification(`Товар используется в ${usedIn} отчётах. Лучше архивировать.`, 'error'); return; }
    }
    updateCustomProducts(customProducts.filter(p => p.id !== id));
    // FIX: Убираем запись из склада (ранее оставался «призрачный» товар)
    if (prod && stock[prod.name]) {
      const newStock = {...stock};
      delete newStock[prod.name];
      updateStock(newStock);
    }
    if (prod) logAction('Удалён товар', prod.name);
  };

  // ===== НОВЫЕ ФУНКЦИИ v2.4 =====
  
  // Локации
  const updateLocations = (locs) => { setLocations(locs); save('likebird-locations', locs); };
  const addLocation = (city, name) => {
    const newLoc = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), city, name, active: true };
    updateLocations([...locations, newLoc]);
    logAction('Добавлена точка', `${city} - ${name}`);
  };
  const removeLocation = (id) => {
    const loc = locations.find(l => l.id === id);
    updateLocations(locations.filter(l => l.id !== id));
    if (loc) logAction('Удалена точка', `${loc.city} - ${loc.name}`);
  };
  const toggleLocationActive = (id) => {
    updateLocations(locations.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };
  const getCities = () => [...new Set(locations.map(l => l.city))];
  const getLocationsByCity = (city) => locations.filter(l => l.city === city);
  
  // Себестоимость (только админ)
  const updateCostPrices = (prices) => { setCostPrices(prices); save('likebird-cost-prices', prices); };
  const setCostPrice = (productName, cost) => {
    updateCostPrices({ ...costPrices, [productName]: cost });
    logAction('Себестоимость установлена', `${productName}: ${cost}₽`);
  };
  const getCostPrice = (productName) => costPrices[productName] || 0;
  const getProfit = (productName, salePrice) => salePrice - getCostPrice(productName);
  
  // Штрафы и бонусы
  const updatePenalties = (p) => { setPenalties(p); save('likebird-penalties', p); };
  const updateBonuses = (b) => { setBonuses(b); save('likebird-bonuses', b); };
  const addPenalty = (employeeId, amount, reason, date = new Date().toISOString()) => {
    const penalty = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, amount, reason, date };
    updatePenalties([...penalties, penalty]);
    logAction('Штраф добавлен', `${employees.find(e => e.id === employeeId)?.name}: ${amount}₽ - ${reason}`);
  };
  const addBonus = (employeeId, amount, reason, date = new Date().toISOString()) => {
    const bonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, amount, reason, date };
    updateBonuses([...bonuses, bonus]);
    logAction('Бонус добавлен', `${employees.find(e => e.id === employeeId)?.name}: ${amount}₽ - ${reason}`);
  };
  // FIX: Безопасный парсинг дат (поддержка ISO и DD.MM.YYYY)
  const safeParseDateStr = (dateStr) => {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.split('.');
    if (parts.length === 3) return new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return new Date(0);
  };
  const getEmployeePenalties = (employeeId, period = 30) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
    return penalties.filter(p => p.employeeId === employeeId && safeParseDateStr(p.date) >= cutoff);
  };
  const getEmployeeBonuses = (employeeId, period = 30) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
    return bonuses.filter(b => b.employeeId === employeeId && safeParseDateStr(b.date) >= cutoff);
  };
  
  // Больничные и отпуска
  const updateTimeOff = (t) => { setTimeOff(t); save('likebird-timeoff', t); };
  const addTimeOff = (employeeId, type, startDate, endDate, note = '') => {
    const record = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId, type, startDate, endDate, note };
    updateTimeOff([...timeOff, record]);
    logAction(`${type === 'sick' ? 'Больничный' : 'Отпуск'} добавлен`, employees.find(e => e.id === employeeId)?.name);
  };
  const getActiveTimeOff = () => {
    const today = new Date().toISOString().split('T')[0];
    return timeOff.filter(t => t.startDate <= today && t.endDate >= today);
  };
  
  // Рейтинг сотрудников
  const updateEmployeeRatings = (r) => { setEmployeeRatings(r); save('likebird-ratings', r); };
  const rateEmployee = (employeeId, rating, comment = '') => {
    const key = `${employeeId}_${Date.now()}`;
    const updated = { ...employeeRatings, [key]: { employeeId, rating, comment, date: new Date().toISOString() } };
    updateEmployeeRatings(updated);
  };
  const getEmployeeAverageRating = (employeeId) => {
    const ratings = Object.values(employeeRatings).filter(r => r.employeeId === employeeId);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  };
  
  // Чат/комментарии
  const updateChatMessages = (m) => { setChatMessages(m); save('likebird-chat', m); };
  const sendMessage = (text, toEmployeeId = null) => {
    const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Админ', to: toEmployeeId, text, date: new Date().toISOString(), read: false };
    updateChatMessages([...chatMessages, msg]);
  };
  const getUnreadMessages = (forEmployee) => chatMessages.filter(m => !m.read && (m.to === forEmployee || m.to === null));
  const markAsRead = (messageId) => {
    updateChatMessages(chatMessages.map(m => m.id === messageId ? { ...m, read: true } : m));
  };
  
  // История склада
  const updateStockHistory = (h) => { setStockHistory(h); save('likebird-stock-history', h); };
  const addStockHistoryEntry = (productName, action, quantity, note = '') => {
    const entry = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), productName, action, quantity, note, date: new Date().toISOString(), user: employeeName || 'Система' };
    updateStockHistory([entry, ...stockHistory].slice(0, 1000));
  };
  
  // Брак и списания
  const updateWriteOffs = (w) => { setWriteOffs(w); save('likebird-writeoffs', w); };
  const checkLowStockAuto = (currentStock) => {
    try {
      const threshold = 3;
      const lastCheck = localStorage.getItem('likebird-last-low-stock-check');
      const now = Date.now();
      if (lastCheck && now - parseInt(lastCheck, 10) < 900000) return; // 15 мин
      const lowItems = [];
      Object.entries(currentStock).forEach(([name, data]) => {
        if (data.count > 0 && data.count <= (data.minStock || threshold)) lowItems.push(name + ': ' + data.count);
      });
      if (lowItems.length > 0) {
        showNotification('⚠️ Низкие остатки: ' + lowItems.slice(0, 3).join(', '));
        try { localStorage.setItem('likebird-last-low-stock-check', String(now)); } catch { /* silent */ }
      }
    } catch { /* silent */ }
  };

  const addWriteOff = (productName, quantity, reason) => {
    const writeOff = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), productName, quantity, reason, date: new Date().toISOString(), user: employeeName || 'Админ' };
    updateWriteOffs([...writeOffs, writeOff]);
    // Уменьшаем склад
    if (stock[productName]) {
      const newStock = { ...stock };
      newStock[productName] = { ...newStock[productName], count: Math.max(0, newStock[productName].count - quantity) };
      updateStock(newStock);
    }
    addStockHistoryEntry(productName, 'writeoff', -quantity, reason);
    logAction('Списание', `${productName}: ${quantity} шт - ${reason}`);
  };
  
  // Автозаказ
  const updateAutoOrderList = (list) => { setAutoOrderList(list); save('likebird-autoorder', list); };
  const generateAutoOrder = () => {
    const order = [];
    Object.entries(stock).forEach(([name, data]) => {
      // FIX: Не включаем товары с count=0, у которых никогда не было остатка (init state)
      if (data.count > 0 && data.count <= data.minStock) {
        const toOrder = (data.minStock * 2) - data.count; // Заказываем до двойного минимума
        order.push({ productName: name, currentStock: data.count, minStock: data.minStock, toOrder, selected: true });
      }
    });
    updateAutoOrderList(order);
    return order;
  };
  const getAutoOrderText = () => {
    return autoOrderList.filter(i => i.selected).map(i => `${i.productName}: ${i.toOrder} шт (сейчас: ${i.currentStock})`).join('\n');
  };
  
  // KPI и цели
  const updateEmployeeKPI = (kpi) => { setEmployeeKPI(kpi); save('likebird-kpi', kpi); };
  const updateShiftsData = (s) => { setShiftsData(s); save('likebird-shifts', s); };
  const updateCustomAchievements = (a) => { setCustomAchievements(a); save('likebird-custom-achievements', a); };
  const updateAchievementsGranted = (g) => { setAchievementsGranted(g); save('likebird-achievements-granted', g); };
  const updateProfilesData = (p) => { setProfilesData(p); save('likebird-profiles', p); };
  // === BLOCK 7: Challenges update ===
  const updateChallenges = (c) => { setChallenges(c); save('likebird-challenges', c); };

  // === BLOCK 4: Product Photos update ===
  // ═══ MediaStore: каждое фото — отдельный Firebase ключ ═══
  const mediaKeyEncode = (name) => 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
  const shiftMediaKey = (dateKey) => 'likebird-ms-' + dateKey.replace(/[^a-zA-Z0-9_.]/g, '_');

  const saveMediaPhoto = (productName, base64) => {
    const key = mediaKeyEncode(productName);
    // Сохраняем в state
    setProductPhotos(prev => {
      const next = { ...prev, [productName]: base64 };
      try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
    // Сохраняем ОТДЕЛЬНЫМ ключом в Firebase (маленький, ~3-5KB)
    try { localStorage.setItem(key, base64); } catch { /* silent */ }
    fbSave(key, base64);
    // Обновляем индекс (список ключей фото)
    mediaKeysRef.current.add(productName);
    const idx = [...mediaKeysRef.current];
    try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
    fbSave('likebird-media-index', idx);
  };

  const deleteMediaPhoto = (productName) => {
    const key = mediaKeyEncode(productName);
    setProductPhotos(prev => {
      const next = { ...prev };
      delete next[productName];
      try { localStorage.setItem('likebird-product-photos-data', JSON.stringify(next)); } catch { /* silent */ }
      return next;
    });
    try { localStorage.removeItem(key); } catch { /* silent */ }
    fbSave(key, null);
    mediaKeysRef.current.delete(productName);
    const idx = [...mediaKeysRef.current];
    try { localStorage.setItem('likebird-media-index', JSON.stringify(idx)); } catch { /* silent */ }
    fbSave('likebird-media-index', idx);
  };

  const saveShiftPhoto = (dateKey, base64) => {
    const key = shiftMediaKey(dateKey);
    setShiftPhotos(prev => ({ ...prev, [dateKey]: base64 }));
    try { localStorage.setItem(key, base64); } catch { /* silent */ }
    fbSave(key, base64);
  };

  const updateProductPhotos = (p) => {
    // Легаси обёртка — вызывает saveMediaPhoto для каждого нового фото
    const oldKeys = Object.keys(productPhotos);
    const newKeys = Object.keys(p);
    // Добавленные
    for (const k of newKeys) {
      if (p[k] && p[k] !== productPhotos[k]) {
        saveMediaPhoto(k, p[k]);
      }
    }
    // Удалённые
    for (const k of oldKeys) {
      if (!p[k]) {
        deleteMediaPhoto(k);
      }
    }
  };

  // === BLOCK 8: Role-based access ===
  const ROLE_ACCESS = {
    seller: ['catalog','shift','profile','game','chat','analytics-own','notifications'],
    manager: ['catalog','shift','profile','game','chat','analytics-own','reports','day-report','stock','team','analytics','notifications'],
    admin: ['*'],
  };
  const hasAccess = (action) => {
    const role = currentUser?.role || 'seller';
    if (role === 'admin' || currentUser?.isAdmin) return true;
    return ROLE_ACCESS[role]?.includes(action);
  };

  // === BLOCK 4: Image compression utility ===
  const compressImage = (file, maxSize = 800, quality = 0.7) => new Promise((resolve) => {
    const drawToCanvas = (img) => {
      try {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
        canvas.width = Math.round(w); canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let result = canvas.toDataURL('image/jpeg', quality);
        // Гарантируем < 50KB для Firebase. Пережимаем если нужно.
        let attempts = 0;
        while (result.length > 50000 && attempts < 3) {
          attempts++;
          const scale = 0.7;
          canvas.width = Math.round(canvas.width * scale);
          canvas.height = Math.round(canvas.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', Math.max(0.3, quality - attempts * 0.15));
        }
        resolve(result);
      } catch { resolve(''); }
    };
    try {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => { URL.revokeObjectURL(url); drawToCanvas(img); };
      img.onerror = () => { URL.revokeObjectURL(url); tryReader(); };
      img.src = url;
    } catch { tryReader(); }
    function tryReader() {
      const r = new FileReader();
      r.onload = () => { const img = new window.Image(); img.onload = () => drawToCanvas(img); img.onerror = () => resolve(''); img.src = r.result; };
      r.onerror = () => resolve('');
      r.readAsDataURL(file);
    }
  });

  // === BLOCK 10: Demand prediction ===
  const predictDemand = (productName, days = 7) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const recentReports = reports.filter(r => {
      try { const d = parseRuDate(r.date || r.timestamp); return d >= cutoff; } catch { return false; }
    });
    let totalSold = 0;
    recentReports.forEach(r => {
      if (getProductName(r.product) === productName) totalSold += (r.quantity || 1);
    });
    const daysSinceFirst = Math.max(1, Math.min(30, Math.ceil((Date.now() - (recentReports.length > 0 ? parseRuDate(recentReports[recentReports.length-1].date || recentReports[recentReports.length-1].timestamp).getTime() : Date.now())) / 86400000)));
    const avgDaily = totalSold / daysSinceFirst;
    const currentStock = stock[productName]?.count || 0;
    const daysRemaining = avgDaily > 0 ? currentStock / avgDaily : 999;
    return { avgDaily: Math.round(avgDaily * 100) / 100, daysRemaining: Math.round(daysRemaining), predictedNeed: Math.round(avgDaily * days) };
  };

  // === BLOCK 2: Auto notifications ===
  const checkAutoNotifications = useCallback(() => {
    try {
      const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
      const isAdminUser = currentUser?.isAdmin || currentUser?.role === 'admin';
      if (!isAdminUser) return;
      const todayStr = formatDate(new Date());
      const newNotifs = [];
      const existingToday = userNotifications.filter(n => {
        try { return formatDate(parseRuDate(n.timestamp)) === todayStr; } catch { return false; }
      });
      const isDuplicate = (type, title) => existingToday.some(n => n.type === type && n.title === title);

      // Low stock
      Object.entries(stock).forEach(([name, data]) => {
        const threshold = autoOrderList.find(a => a.productName === name)?.minStock || 3;
        if (data.count > 0 && data.count <= threshold) {
          const title = '📦 ' + name + ': осталось ' + data.count + ' шт';
          if (!isDuplicate('auto-stock', title)) {
            newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-stock', targetLogin: myLogin, title, body: 'Необходимо пополнить запас', icon: '📦', timestamp: Date.now(), read: false });
          }
        }
      });

      // Revenue below average
      const last30 = reports.filter(r => { try { const d = parseRuDate(r.date || r.timestamp); const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30); return d >= cutoff; } catch { return false; } });
      const dailyTotals = {};
      last30.forEach(r => { const d = r.date?.split(',')[0] || ''; dailyTotals[d] = (dailyTotals[d] || 0) + (r.total || 0); });
      const dailyValues = Object.values(dailyTotals);
      if (dailyValues.length > 7) {
        const avg = dailyValues.reduce((s, v) => s + v, 0) / dailyValues.length;
        const todayRevenue = dailyTotals[todayStr] || 0;
        const now = new Date();
        if (now.getHours() >= 18 && todayRevenue > 0 && todayRevenue < avg * 0.7) {
          const pct = Math.round((1 - todayRevenue / avg) * 100);
          const title = '📉 Выручка за ' + todayStr + ': ' + todayRevenue + '₽';
          if (!isDuplicate('auto-revenue', title)) {
            newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-revenue', targetLogin: myLogin, title, body: 'Ниже среднего на ' + pct + '%', icon: '📉', timestamp: Date.now(), read: false });
          }
        }
      }

      // Upcoming events
      Object.entries(eventsCalendar).forEach(([date, evArr]) => {
        try {
          const [d, m, y] = date.split('.');
          const eventDate = new Date(parseInt(y) < 100 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
          const daysUntil = Math.ceil((eventDate - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntil >= 0 && daysUntil <= 1) {
            const events = Array.isArray(evArr) ? evArr : [evArr];
            events.forEach(ev => {
              const title = '📅 Завтра: ' + (ev.title || ev.name || 'Событие');
              if (!isDuplicate('auto-event', title)) {
                newNotifs.push({ id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'auto-event', targetLogin: myLogin, title, body: date, icon: '📅', timestamp: Date.now(), read: false });
              }
            });
          }
        } catch { /* silent */ }
      });

      if (newNotifs.length > 0) {
        const updated = [...userNotifications, ...newNotifs];
        setUserNotifications(updated);
        save('likebird-notifications', updated);
      }
    } catch (e) { console.warn('Auto notifications error:', e); }
  }, [reports, stock, userNotifications, eventsCalendar, autoOrderList, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run auto notifications on mount and after report save
  useEffect(() => {
    if (isAuthenticated && (currentUser?.isAdmin || currentUser?.role === 'admin')) {
      const timer = setTimeout(checkAutoNotifications, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, checkAutoNotifications]);

  // === BLOCK 7: Check challenges ===
  // eslint-disable-next-line no-unused-vars
  const checkChallenges = useCallback(() => {
    try {
      if (!challenges.length) return;
      const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
      const now = new Date();
      const todayStr = formatDate(now);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

      challenges.filter(c => c.active).forEach(ch => {
        const periodReports = reports.filter(r => {
          if (r.employee !== employeeName) return false;
          try {
            const d = parseRuDate(r.date || r.timestamp);
            if (ch.type === 'daily') return formatDate(d) === todayStr;
            if (ch.type === 'weekly') return d >= weekAgo;
            return false;
          } catch { return false; }
        });

        let current = 0;
        if (ch.condition.metric === 'sales_count') current = periodReports.length;
        else if (ch.condition.metric === 'revenue') current = periodReports.reduce((s, r) => s + (r.total || 0), 0);
        else if (ch.condition.metric === 'product_sales') current = periodReports.filter(r => getProductName(r.product) === ch.condition.product).reduce((s, r) => s + (r.quantity || 1), 0);
        else if (ch.condition.metric === 'avg_check') { const total = periodReports.reduce((s, r) => s + (r.total || 0), 0); current = periodReports.length > 0 ? Math.round(total / periodReports.length) : 0; }

        if (current >= ch.condition.target) {
          const alreadyNotified = userNotifications.some(n => n.type === 'challenge-complete' && n.title?.includes(ch.title) && formatDate(parseRuDate(n.timestamp)) === todayStr);
          if (!alreadyNotified) {
            const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'challenge-complete', targetLogin: myLogin, title: '🏆 Челлендж выполнен: ' + ch.title, body: 'Результат: ' + current + ' / ' + ch.condition.target, icon: '🏆', timestamp: Date.now(), read: false };
            const updated = [...userNotifications, notif];
            setUserNotifications(updated);
            save('likebird-notifications', updated);
            showNotification('🏆 Челлендж выполнен: ' + ch.title, 'achievement');
          }
        }
      });
    } catch (e) { console.warn('Challenge check error:', e); }
  }, [challenges, reports, employeeName, userNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  // BLOCK 7: Run challenge checks when reports change
  useEffect(() => {
    if (isAuthenticated && challenges.length > 0) {
      const timer = setTimeout(checkChallenges, 2000);
      return () => clearTimeout(timer);
    }
  }, [reports.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // === BLOCK 11: Swipe navigation ===
  const swipeRef = useRef({ startX: 0, startY: 0 });
  const handleTouchStart = (e) => {
    let el = e.target;
    let inScrollable = false;
    while (el && el !== e.currentTarget) {
      if (el.classList && (el.classList.contains('overflow-x-auto') || el.scrollWidth > el.clientWidth + 2)) {
        inScrollable = true; break;
      }
      el = el.parentElement;
    }
    swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, inScrollable };
  };
  const handleTouchEnd = (e) => {
    if (swipeRef.current.inScrollable) return;
    const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.startY);
    if (dx > 80 && dy < 50 && currentView !== 'menu') setCurrentView('menu');
  };

  // === BLOCK 7: Leaderboard state (lifted from IIFE) ===
  const [lbPeriod, setLbPeriod] = useState('week');

  // === BLOCK 3: Chat state (lifted from IIFE) ===
  const [chatText, setChatText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const chatEndRef = useRef(null);

  // === BLOCK 11: Skeleton component ===
  // eslint-disable-next-line no-unused-vars
  const Skeleton = ({w = '100%', h = '1rem', r = '0.5rem'}) => (
    <div className="animate-pulse bg-gray-200 rounded" style={{width:w, height:h, borderRadius:r}} />
  );

  const setEmployeeGoal = (employeeId, goalType, target, period = 'month') => {
    const key = `${employeeId}_${goalType}_${period}`;
    updateEmployeeKPI({ ...employeeKPI, [key]: { employeeId, goalType, target, period, createdAt: new Date().toISOString() } });
  };
  const getEmployeeProgress = (employeeId, goalType, period = 'month') => {
    const key = `${employeeId}_${goalType}_${period}`;
    const goal = employeeKPI[key];
    if (!goal) return null;
    
    // Считаем прогресс
    let current = 0;
    const now = new Date();
    const periodStart = new Date();
    if (period === 'week') periodStart.setDate(now.getDate() - 7);
    else if (period === 'month') periodStart.setDate(now.getDate() - 30); // FIX: единообразно 30 дней
    
    const empReports = reports.filter(r => {
      const emp = employees.find(e => e.id === employeeId);
      if (!emp || r.employee !== emp.name) return false;
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= periodStart;
    });
    
    if (goalType === 'sales') current = empReports.length;
    else if (goalType === 'revenue') current = empReports.reduce((sum, r) => sum + r.total, 0);
    
    return { goal: goal.target, current, percentage: Math.min(100, Math.round((current / goal.target) * 100)) };
  };
  
  // Системные уведомления (с сохранением)
  const addSystemNotification = (type, message, priority = 'normal') => {
    const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), type, message, priority, date: new Date().toISOString(), read: false };
    const updated = [notif, ...systemNotifications].slice(0, 50);
    setSystemNotifications(updated);
    save('likebird-system-notifications', updated);
  };
  
  // Проверка низкого остатка и создание уведомлений
  const checkLowStock = () => {
    const lowItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock);
    if (lowItems.length > 0) {
      addSystemNotification('stock', `Низкий остаток: ${lowItems.map(([n]) => n).join(', ')}`, 'high');
    }
    return lowItems;
  };
  
  // Аналитика
  const getAnalytics = (period = 7) => {
    const now = new Date();
    const periodStart = new Date();
    periodStart.setDate(now.getDate() - period);
    
    const periodReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= periodStart && !r.isUnrecognized;
    });
    
    // По дням
    const byDay = {};
    periodReports.forEach(r => {
      const [datePart] = (r.date||'').split(',');
      if (!byDay[datePart]) byDay[datePart] = { sales: 0, revenue: 0, profit: 0 };
      byDay[datePart].sales += 1;
      byDay[datePart].revenue += r.total;
      byDay[datePart].profit += getProfit(r.product, r.total);
    });
    
    // По сотрудникам
    const byEmployee = {};
    periodReports.forEach(r => {
      if (!byEmployee[r.employee]) byEmployee[r.employee] = { sales: 0, revenue: 0 };
      byEmployee[r.employee].sales += 1;
      byEmployee[r.employee].revenue += r.total;
    });
    
    // По товарам
    const byProduct = {};
    periodReports.forEach(r => {
      if (!byProduct[r.product]) byProduct[r.product] = { sales: 0, revenue: 0 };
      byProduct[r.product].sales += 1;
      byProduct[r.product].revenue += r.total;
    });
    
    // По локациям
    const byLocation = {};
    periodReports.forEach(r => {
      const loc = r.location || 'Не указано';
      if (!byLocation[loc]) byLocation[loc] = { sales: 0, revenue: 0 };
      byLocation[loc].sales += 1;
      byLocation[loc].revenue += r.total;
    });
    
    // Общие метрики
    const totalSales = periodReports.length;
    const totalRevenue = periodReports.reduce((sum, r) => sum + r.total, 0);
    const totalProfit = periodReports.reduce((sum, r) => sum + getProfit(r.product, r.total), 0);
    const avgCheck = totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
    
    // Сравнение с предыдущим периодом
    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - period);
    const prevReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= prevStart && reportDate < periodStart && !r.isUnrecognized;
    });
    const prevRevenue = prevReports.reduce((sum, r) => sum + r.total, 0);
    const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    
    return { byDay, byEmployee, byProduct, byLocation, totalSales, totalRevenue, totalProfit, avgCheck, revenueChange, period };
  };
  
  // Точка безубыточности
  const getBreakEvenPoint = (fixedCosts = 0) => {
    const analytics = getAnalytics(30);
    if (analytics.totalRevenue === 0) return null;
    const avgMargin = analytics.totalProfit / analytics.totalRevenue;
    if (avgMargin <= 0) return null;
    return Math.round(fixedCosts / avgMargin);
  };

  const fixUnrecognizedReport = (reportId, productName) => {
    const report = reports.find(r => r.id === reportId);
    const product = findProductByPrice(productName, report?.salePrice || 0);
    if (!product) { showNotification('Товар не найден', 'error'); return false; }
    const updated = reports.map(r => r.id === reportId ? { ...r, product: product.name, category: product.category, basePrice: product.price, salary: calculateSalary(product.price, r.salePrice, product.category, r.tips || 0, 'normal', salarySettings), isUnrecognized: false } : r);
    updateReports(updated);
    showNotification('Товар исправлен');
    return true;
  };

  const saveReport = (params = {}) => {
    // Используем переданные параметры или глобальные состояния
    const empName = params.employeeName || employeeName;
    const price = params.salePrice || salePrice;
    const product = params.selectedProduct || selectedProduct;
    const category = params.selectedCategory || selectedCategory;
    const tips = params.tipsAmount || tipsAmount;
    const mixCash = params.mixedCash || mixedCash;
    const mixCashless = params.mixedCashless || mixedCashless;
    const photo = params.photo !== undefined ? params.photo : salePhotoGlobal;
    const location = params.location !== undefined ? params.location : saleLocationGlobal;
    const discountNote = params.discountReason || '';
    // paymentType и qty берём из params (localPaymentType/localQuantity из NewReportView)
    const pType = params.paymentType || 'cash';
    const qty = params.quantity ? parseInt(params.quantity) : 1;
    
    if (!product || !price || !empName) { showNotification('Заполните все поля', 'error'); return; }
    const priceNum = parseInt(price), tipsNum = parseInt(tips) || 0;
    const salary = calculateSalary(product.price, priceNum, category, tipsNum, 'normal', salarySettings);
    const now = Date.now();
    const dateStr = params.customDate || new Date().toLocaleString('ru-RU');
    // Каждая единица — отдельная запись
    const newReports = Array.from({ length: qty }, (_, i) => {
      let cashAmt = 0, cashlessAmt = 0;
      if (pType === 'cash') { cashAmt = priceNum; }
      else if (pType === 'cashless') { cashlessAmt = priceNum; }
      else if (pType === 'mixed') {
        // При смешанной и qty>1 делим пропорционально
        cashAmt = Math.round((parseInt(mixCash) || 0) / qty);
        cashlessAmt = Math.round((parseInt(mixCashless) || 0) / qty);
      }
      return {
        id: now + i, date: dateStr, product: product.name, category: category,
        basePrice: product.price, salePrice: priceNum, quantity: 1, employee: empName,
        total: priceNum, tips: tipsNum, salary: salary, tipsModel: 'v2',
        paymentType: pType, cashAmount: cashAmt, cashlessAmount: cashlessAmt, isUnrecognized: false,
        createdAt: now + i, reviewStatus: 'pending',
        photo: photo || null,
        location: location || null,
        discountReason: discountNote || null,
        isBelowBase: priceNum < product.price,
        ...(params.addedBy ? { addedBy: params.addedBy } : {}),
      };
    });
    updateReports([...newReports, ...reports]);
    addStockHistoryEntry(product.name, 'sale', -qty, `Продажа ${empName} x${qty}${discountNote ? ' (скидка: ' + discountNote + ')' : ''}`);
    if (stock[product.name]) {
      const newStock = {...stock};
      newStock[product.name] = {...newStock[product.name], count: Math.max(0, newStock[product.name].count - qty)};
      updateStock(newStock);
    }
    localStorage.setItem('likebird-employee', empName);
    setEmployeeName(empName);
    setSalePrice(''); setQuantity(1); setPaymentType('cash'); setTipsAmount(''); setSelectedProduct(null); setSelectedCategory(null); setMixedCash(''); setMixedCashless('');
    setSalePhotoGlobal(null); setSaleLocationGlobal('');
    showNotification(`Продажа сохранена: ${product.name}${qty > 1 ? ' x' + qty : ''}`);
    if (!params.noRedirect) setCurrentView('shift');
  };

  const saveParsedReports = (empNameParam) => {
    // Используем переданное имя или глобальное состояние
    const empName = empNameParam || employeeName;
    if (!empName) { showNotification('Введите имя сотрудника', 'error'); return; }
    if (parsedSales.length === 0 && unrecognizedSales.length === 0) { showNotification('Нет продаж для сохранения', 'error'); return; }
    const dateStr = new Date().toLocaleString('ru-RU');
    const now = Date.now();
    const newReports = [
      // FIX: добавлен tipsModel:'v2' чтобы миграция не обнулила реальные чаевые
      ...parsedSales.map((s, i) => ({ id: now + i, date: dateStr, product: s.product.name, category: s.category, basePrice: s.product.price, salePrice: s.price, quantity: 1, employee: empName, total: s.price, tips: s.tips || 0, salary: s.salary, tipsModel: 'v2', paymentType: s.paymentType, cashAmount: s.cashAmount, cashlessAmount: s.cashlessAmount, isUnrecognized: false, workTime: parsedWorkTime, createdAt: now, reviewStatus: 'pending', originalReportText: textReport })),
      ...unrecognizedSales.map((s, i) => ({ id: now + 10000 + i, date: dateStr, product: s.extractedName, category: 'Нераспознанный товар', basePrice: 0, salePrice: s.price, quantity: 1, employee: empName, total: s.price, tips: s.tips || 0, salary: s.salary, tipsModel: 'v2', paymentType: s.paymentType, cashAmount: s.cashAmount, cashlessAmount: s.cashlessAmount, isUnrecognized: true, originalText: s.originalText, workTime: parsedWorkTime, createdAt: now, reviewStatus: 'pending', originalReportText: textReport })),
    ];
    if (parsedExpenses.length > 0) {
      const newExpenses = parsedExpenses.map((e, i) => ({ id: now + 20000 + i, date: dateStr, amount: e.amount, description: e.description, employee: empName }));
      const updatedExpenses = [...newExpenses, ...expenses];
      setExpenses(updatedExpenses);
      save('likebird-expenses', updatedExpenses);
    }
    const newStock = {...stock};
    parsedSales.forEach(s => { if (newStock[s.product.name]) newStock[s.product.name] = {...newStock[s.product.name], count: Math.max(0, newStock[s.product.name].count - 1)}; });
    updateStock(newStock);
    updateReports([...newReports, ...reports]);
    localStorage.setItem('likebird-employee', empName);
    setEmployeeName(empName); // Сохраняем в глобальное состояние
    showNotification(`Сохранено ${parsedSales.length + unrecognizedSales.length} продаж`);
    setTextReport(''); setParsedSales([]); setUnrecognizedSales([]); setParsedWorkTime(null); setCalculatedTotals(null); setParsedExpenses([]); setParsedInventory({ start: {}, end: {} }); setInventoryDiscrepancies([]);
    setCurrentView('menu');
  };

  const deleteReport = (id) => {
    showConfirm('Удалить эту запись?', () => {
      const r = reports.find(x => x.id === id);
      const productName = r ? getProductName(r.product) : null;
      if (r && !r.isUnrecognized && productName && stock[productName]) {
        const qty = r.quantity || 1;
        const newStock = {...stock};
        newStock[productName] = {...newStock[productName], count: newStock[productName].count + qty};
        updateStock(newStock);
        addStockHistoryEntry(productName, 'return', qty, 'Удалена продажа');
      }
      updateReports(reports.filter(x => x.id !== id));
      const nd = {...salaryDecisions}; delete nd[id]; setSalaryDecisions(nd); save('likebird-salary-decisions', nd);
      logAction('delete-report', JSON.stringify({ product: productName, total: r?.total, employee: r?.employee, deletedBy: employeeName, date: r?.date }));
      showNotification('Запись удалена');
    });
  };

  const addExpense = (emp) => {
    // FIX: Используем React-стейт вместо DOM-манипуляции
    setExpenseModal({ employee: emp });
  };

  const deleteExpense = (id) => {
    showConfirm('Удалить этот расход?', () => {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated); save('likebird-expenses', updated);
      showNotification('Расход удалён');
    });
  };

  const updateGivenToAdmin = (emp, amount) => { const key = emp + '_' + selectedDate; const updated = {...givenToAdmin, [key]: amount}; setGivenToAdmin(updated); save('likebird-given', updated); };
  const getGivenToAdmin = (emp) => givenToAdmin[emp + '_' + selectedDate] || 0;
  const getReportsByDate = (date) => reports.filter(r => (r.date||'').split(',')[0] === date);
  const getExpensesByDate = (date) => expenses.filter(e => (e.date||'').split(',')[0] === date);
  const getAllDates = () => [...new Set(reports.map(r => (r.date||'').split(',')[0]))].sort((a, b) => { const [d1,m1,y1] = a.split('.'); const [d2,m2,y2] = b.split('.'); return new Date(y2,m2-1,d2) - new Date(y1,m1-1,d1); });
  const navigateDate = (dir) => { const dates = getAllDates(); const idx = dates.indexOf(selectedDate); if (dir === 'prev' && idx < dates.length - 1) setSelectedDate(dates[idx + 1]); else if (dir === 'next' && idx > 0) setSelectedDate(dates[idx - 1]); };

  const handleParseText = useCallback((inputText) => {
    // Используем переданный текст или глобальный textReport
    const text = inputText || textReport;
    if (!text.trim()) { showNotification('Введите текст отчёта', 'error'); return; }
    const { recognized, unrecognized, workTime, expenses: exp, inventory } = parseTextReport(text);
    // FIX: Пересчитываем salary по актуальным salarySettings (parseTextReport не имеет к ним доступа)
    const recalcRecognized = recognized.map(s => ({
      ...s,
      salary: calculateSalary(s.product.price, s.price, s.category, s.tips || 0, 'normal', salarySettings),
    }));
    setParsedSales(recalcRecognized); setUnrecognizedSales(unrecognized); setParsedWorkTime(workTime); setParsedExpenses(exp); setParsedInventory(inventory);
    const sold = countSoldProducts(recalcRecognized);
    setInventoryDiscrepancies(compareInventory(inventory, sold));
    const allSales = [...recalcRecognized, ...unrecognized];
    
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
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
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
    if (recognized.length > 0 || unrecognized.length > 0) showNotification(`Распознано: ${recognized.length}, нераспознано: ${unrecognized.length}`);
  }, [textReport, salarySettings]);

  // FIX: Условие count > 0 — при инициализации все count=0, не считаем их «низким остатком»
  const getLowStockItems = () => Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= data.minStock).map(([name, data]) => ({name, ...data}));
  
  const getWeekSales = () => { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); weekAgo.setHours(0,0,0,0); const sales = {}; reports.filter(r => { const [d, m, y] = (r.date||'').split(',')[0].split('.'); return new Date(y, m-1, d) >= weekAgo && !r.isUnrecognized; }).forEach(r => { const pName = getProductName(r.product); sales[pName] = (sales[pName] || 0) + (r.quantity || 1); }); return sales; };

  const exportData = async () => {
    showNotification('⏳ Получаем актуальные данные из Firebase...');
    try {
      // Тянем свежие данные из Firebase для всех ключей
      const fbData = {};
      const keys = [...SyncManager.ALL_KEYS];
      await Promise.all(keys.map(async (key) => {
        try {
          const val = await fbGet(key);
          if (val !== null && val !== undefined) fbData[key] = val;
        } catch { /* silent */ }
      }));
      // Мержим: Firebase приоритетнее localStorage
      const localData = SyncManager.exportAll();
      const merged = { ...localData, ...fbData, _version: 2, _appVersion: APP_VERSION, _exportDate: new Date().toISOString(), _source: 'firebase+local' };
      const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `likebird-backup-${formatDate(new Date())}.json`; a.click();
      URL.revokeObjectURL(url);
      showNotification('✅ Полный бэкап из Firebase сохранён');
    } catch (err) {
      // Fallback на localStorage
      const data = SyncManager.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `likebird-backup-${formatDate(new Date())}.json`; a.click();
      URL.revokeObjectURL(url);
      showNotification('⚠️ Бэкап из локального хранилища (Firebase недоступен)');
    }
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // 1. Записываем в localStorage
        const imported = SyncManager.importAll(data);
        // 2. Синхронизируем каждый ключ с Firebase
        let fbPushed = 0;
        // FIX: Используем SYNC_KEYS из firebase.js (ранее — неполный хардкод с дубликатом)
        for (const key of SYNC_KEYS) {
          if (data[key] !== undefined) {
            try {
              await fbSave(key, data[key]);
              fbPushed++;
            } catch { /* silent */ }
          }
        }
        showNotification(`✅ Импортировано ${imported} записей → Firebase (${fbPushed}). Перезагрузка...`);
        setTimeout(() => window.location.reload(), 2500);
      } catch (err) {
        showNotification('Ошибка импорта: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = () => {
    showConfirm('Очистить ВСЕ данные? Это действие нельзя отменить!', () => {
      logAction('Полная очистка данных', `Пользователь: ${employeeName || 'Неизвестен'}`);
      SyncManager.ALL_KEYS.forEach(k => localStorage.removeItem(k));
      // FIX: Очищаем и Firebase, иначе данные вернутся через подписки
      SYNC_KEYS.forEach(key => fbSave(key, null));
      setReports([]); setExpenses([]); setStock(getInitialStock()); setGivenToAdmin({}); setSalaryDecisions({}); setOwnCardTransfers({});
      setPartnerStock({}); setTotalBirds(0); setScheduleData({}); setEventsCalendar({});
      setAuditLog([]); setCustomProducts([]); setPenalties([]); setBonuses([]);
      setTimeOff([]); setEmployeeRatings({}); setChatMessages([]); setStockHistory([]);
      setWriteOffs([]); setAutoOrderList([]); setEmployeeKPI({}); setSystemNotifications([]);
      // FIX: Ранее не очищались
      setInviteCodes([]); setCustomAchievements([]); setAchievementsGranted({});
      setShiftsData({}); setProfilesData({}); setUserNotifications([]);
      showNotification('Все данные очищены');
    });
  };

  const copyDayReport = (emp, empReports, totals) => {
    const { cashTotal, cashlessTotal, totalTips, totalSalary, empExpenses, toGive } = totals;
    const byCat = empReports.filter(r => !r.isUnrecognized).reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + (r.quantity || 1); return acc; }, {});
    // Добавляем время смены
    let shiftLine = '';
    try {
      const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
      const u = users.find(u => (u.name || u.login) === emp);
      const login = u?.login || emp;
      const shift = shiftsData[`${login}_${selectedDate}`];
      if (shift?.openTime) {
        shiftLine = `⏱️ Смена: ${shift.openTime}`;
        if (shift.closeTime) {
          shiftLine += ` → ${shift.closeTime}`;
          const [oh, om] = shift.openTime.split(':').map(Number);
          const [ch, cm] = shift.closeTime.split(':').map(Number);
          let mins = (ch * 60 + cm) - (oh * 60 + om);
          if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
          if (mins > 0) {
            const h = Math.floor(mins / 60);
            const roundedH = h + Math.floor((mins % 60) / 15) * 0.25;
            shiftLine += ` (${Number.isInteger(roundedH) ? roundedH : roundedH.toFixed(2).replace(/0$/, '')} ч)`;
          }
        }
        shiftLine += '\n';
      }
    } catch { /* silent */ }
    let text = `📅 ${selectedDate} - ${emp}\n${shiftLine}📦 Продаж: ${empReports.length}\n`;
    Object.entries(byCat).forEach(([cat, cnt]) => { text += `${CAT_ICONS[cat]} ${cat}: ${cnt}\n`; });
    text += `\n💰 Итого: ${(cashTotal + cashlessTotal).toLocaleString()}₽\n💵 Наличные: ${cashTotal.toLocaleString()}₽\n💳 Безнал: ${cashlessTotal.toLocaleString()}₽\n🎁 Чаевые: ${totalTips.toLocaleString()}₽\n👛 ЗП: ${totalSalary.toLocaleString()}₽\n`;
    if (empExpenses > 0) text += `📝 Расходы: -${empExpenses}₽\n`;
    text += `\n💼 Отдаю: ${toGive.toLocaleString()}₽`;
    navigator.clipboard.writeText(text).then(() => showNotification('Скопировано в буфер обмена'));
  };

  const SalaryDecisionButtons = ({ report, compact }) => {
    const decision = salaryDecisions[report.id] || 'normal';
    const belowPrice = isBelowBasePrice(report.basePrice, report.salePrice);
    const priceDiff = report.basePrice - report.salePrice;
    if (!belowPrice || report.isUnrecognized) return null;
    const baseSalary = calculateSalary(report.basePrice, report.salePrice, report.category, report.tips || 0, 'normal', salarySettings);
    if (compact) return (
      <div className="flex gap-1 mt-1">
        <button onClick={() => updateSalaryDecision(report.id, 'normal')} className={`px-2 py-0.5 rounded text-xs ${decision === 'normal' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>ЗП {baseSalary}₽</button>
        <button onClick={() => updateSalaryDecision(report.id, 'none')} className={`px-2 py-0.5 rounded text-xs ${decision === 'none' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>0₽</button>
        <button onClick={() => updateSalaryDecision(report.id, 'deduct')} className={`px-2 py-0.5 rounded text-xs ${decision === 'deduct' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>-{priceDiff}₽</button>
      </div>
    );
    return (
      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-2 mt-2">
        <p className="text-xs text-yellow-700 mb-2">⚠️ Ниже базовой цены на {priceDiff}₽</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => updateSalaryDecision(report.id, 'normal')} className={`px-3 py-1 rounded text-sm ${decision === 'normal' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>✅ ЗП ({baseSalary}₽)</button>
          <button onClick={() => updateSalaryDecision(report.id, 'none')} className={`px-3 py-1 rounded text-sm ${decision === 'none' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>❌ Без ЗП</button>
          <button onClick={() => updateSalaryDecision(report.id, 'deduct')} className={`px-3 py-1 rounded text-sm ${decision === 'deduct' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}>💸 -{priceDiff}₽</button>
        </div>
      </div>
    );
  };

  const FixUnrecognizedButton = ({ report }) => {
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
  };

  // FIX #56b: ConfirmDialog теперь DOM-based через confirmDialogRef (см. showConfirm выше)
  // FIX #56: ToastNotification теперь DOM-based через notificationRef (см. showNotification выше)

  // FIX: React-компонент модала расходов (заменяет DOM-манипуляцию)
  const ExpenseModal = () => {
    const [desc, setDesc] = useState('');
    const [amt, setAmt] = useState('');
    if (!expenseModal) return null;
    const handleSave = () => {
      if (!desc.trim()) { showNotification('Введите описание', 'error'); return; }
      const amtNum = parseInt(amt, 10);
      if (!amtNum || isNaN(amtNum) || amtNum <= 0) { showNotification('Введите положительную сумму', 'error'); return; }
      const newExp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), date: new Date().toLocaleString('ru-RU'), amount: amtNum, description: desc.trim(), employee: expenseModal.employee };
      const updated = [newExp, ...expenses]; setExpenses(updated); save('likebird-expenses', updated);
      showNotification('Расход добавлен');
      setExpenseModal(null);
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <h3 className="text-lg font-bold mb-4">📝 Новый расход</h3>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание расхода" maxLength={200} className="w-full p-3 border-2 border-gray-200 rounded-xl mb-3 focus:border-amber-500 focus:outline-none" autoFocus />
          <input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Сумма" className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-amber-500 focus:outline-none" onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
          <div className="flex gap-3">
            <button onClick={() => setExpenseModal(null)} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
            <button onClick={handleSave} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">Сохранить</button>
          </div>
        </div>
      </div>
    );
  };

  // FIX #56c: InputModal теперь DOM-based через inputModalRef (см. showInputModal выше)


  // ════════════════════════════════════════════════════════════════════════
  // BLOCK 1: AnalyticsView — Визуальная аналитика
  // ════════════════════════════════════════════════════════════════════════
  const AnalyticsView = () => {
    const [tab, setTab] = useState('revenue');
    const [period, setPeriod] = useState(30);
    const [filterLoc, setFilterLoc] = useState('');
    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin';
    const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();

    const filteredReports = useMemo(() => {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - period);
      return reports.filter(r => {
        try {
          const d = parseRuDate(r.date || r.timestamp);
          if (d < cutoff) return false;
          if (!isAdmin) return r.employee === employeeName;
          if (filterLoc && r.location !== filterLoc) return false;
          return true;
        } catch { return false; }
      });
    }, [reports, period, isAdmin, employeeName]);

    // Revenue chart data
    const revenueData = useMemo(() => {
      const byDay = {};
      filteredReports.forEach(r => {
        const d = r.date?.split(',')[0] || formatDate(new Date(r.timestamp));
        if (!byDay[d]) byDay[d] = { date: d, total: 0, cash: 0, cashless: 0, count: 0 };
        byDay[d].total += r.total || 0;
        byDay[d].cash += r.cashAmount || 0;
        byDay[d].cashless += r.cashlessAmount || 0;
        byDay[d].count += 1;
      });
      return Object.values(byDay).sort((a, b) => {
        const [ad, am, ay] = a.date.split('.'); const [bd, bm, by_] = b.date.split('.');
        return new Date(2000 + parseInt(ay || 0), parseInt(am || 1) - 1, parseInt(ad || 1)) - new Date(2000 + parseInt(by_ || 0), parseInt(bm || 1) - 1, parseInt(bd || 1));
      });
    }, [filteredReports]);

    // KPI calculations
    const kpi = useMemo(() => {
      const totalRevenue = filteredReports.reduce((s, r) => s + (r.total || 0), 0);
      const avgCheck = filteredReports.length > 0 ? Math.round(totalRevenue / filteredReports.length) : 0;
      // Previous period comparison
      const prevCutoff = new Date(); prevCutoff.setDate(prevCutoff.getDate() - period * 2);
      const currentCutoff = new Date(); currentCutoff.setDate(currentCutoff.getDate() - period);
      const prevReports = reports.filter(r => {
        try { const d = parseRuDate(r.date || r.timestamp); return d >= prevCutoff && d < currentCutoff && (isAdmin || r.employee === employeeName); } catch { return false; }
      });
      const prevRevenue = prevReports.reduce((s, r) => s + (r.total || 0), 0);
      const change = prevRevenue > 0 ? Math.round((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
      return { totalRevenue, avgCheck, change, salesCount: filteredReports.length };
    }, [filteredReports, reports, period, isAdmin, employeeName]);

    // Products ABC analysis
    const abcData = useMemo(() => {
      const byProduct = {};
      filteredReports.forEach(r => {
        const name = getProductName(r.product);
        if (!byProduct[name]) byProduct[name] = { name, count: 0, revenue: 0 };
        byProduct[name].count += r.quantity || 1;
        byProduct[name].revenue += r.total || 0;
      });
      const sorted = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue);
      const totalRev = sorted.reduce((s, p) => s + p.revenue, 0);
      let cumPercent = 0;
      return sorted.map(p => {
        const pct = totalRev > 0 ? p.revenue / totalRev * 100 : 0;
        cumPercent += pct;
        return { ...p, percent: Math.round(pct * 10) / 10, grade: cumPercent <= 20 ? 'A' : cumPercent <= 50 ? 'B' : 'C' };
      });
    }, [filteredReports]);

    // Category pie data
    const categoryData = useMemo(() => {
      const byCat = {};
      filteredReports.forEach(r => {
        const cat = r.category || 'Другое';
        byCat[cat] = (byCat[cat] || 0) + (r.total || 0);
      });
      return Object.entries(byCat).map(([name, value]) => ({ name, value }));
    }, [filteredReports]);

    // Employee ranking (admin only)
    const employeeRanking = useMemo(() => {
      if (!isAdmin) return [];
      const byEmp = {};
      filteredReports.forEach(r => {
        const emp = r.employee || 'Неизвестно';
        if (!byEmp[emp]) byEmp[emp] = { name: emp, revenue: 0, count: 0 };
        byEmp[emp].revenue += r.total || 0;
        byEmp[emp].count += 1;
      });
      return Object.values(byEmp).sort((a, b) => b.revenue - a.revenue).map(e => ({ ...e, avgCheck: e.count > 0 ? Math.round(e.revenue / e.count) : 0 }));
    }, [filteredReports, isAdmin]);

    // Forecast
    const forecast = useMemo(() => {
      if (revenueData.length < 7) return null;
      const last = revenueData.slice(-14);
      const avgDaily = last.reduce((s, d) => s + d.total, 0) / last.length;
      const forecastDays = [];
      for (let i = 1; i <= 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i);
        forecastDays.push({ date: formatDate(d), total: Math.round(avgDaily), forecast: true });
      }
      // Stock forecast
      const stockForecast = [];
      Object.entries(stock).forEach(([name, data]) => {
        if (data.count > 0) {
          const pred = predictDemand(name, 7);
          if (pred.daysRemaining < 14) stockForecast.push({ name, ...pred, current: data.count });
        }
      });
      stockForecast.sort((a, b) => a.daysRemaining - b.daysRemaining);
      return { forecastDays, avgDaily: Math.round(avgDaily), stockForecast };
    }, [revenueData, stock]);

    const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const tabs = ['revenue', 'salary', 'products', ...(isAdmin ? ['employees'] : []), 'forecast'];
    const tabLabels = { revenue: 'Выручка', salary: 'Заработок', products: 'Товары', employees: 'Сотрудники', forecast: 'Прогноз' };

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 pb-6">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10">
          <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold">📊 Аналитика</h2>
        </div>
        <div className="max-w-lg mx-auto px-4 mt-4">
          {/* Location filter */}
          {isAdmin && (() => { const locs = [...new Set(reports.filter(r => r.location).map(r => r.location))]; return locs.length > 1 ? (<select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className="w-full p-2 bg-white rounded-xl shadow text-sm mb-3"><option value="">📍 Все точки</option>{locs.map(l => <option key={l} value={l}>{l}</option>)}</select>) : null; })()}
          {/* Period selector */}
          <div className="flex gap-2 mb-4">
            {[7, 30, 90].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${period === p ? 'bg-amber-500 text-white shadow' : 'bg-white text-gray-600'}`}>
                {p} дней
              </button>
            ))}
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 shadow">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>
                {tabLabels[t]}
              </button>
            ))}
          </div>

          {/* TAB: Revenue */}
          {tab === 'revenue' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-3">Выручка по дням</h3>
                {revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#f0f0f0"} />
                      <XAxis dataKey="date" tick={{fontSize: 10}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} />
                      <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} dot={{r: 3}} activeDot={{r: 5}} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-8">Нет данных за период</p>}
              </div>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow">
                  <p className="text-xs text-gray-500">Выручка за период</p>
                  <p className="text-xl font-bold text-green-600">{kpi.totalRevenue.toLocaleString()} ₽</p>
                  {kpi.change !== 0 && (
                    <p className={`text-xs font-semibold ${kpi.change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {kpi.change > 0 ? '↑' : '↓'} {Math.abs(kpi.change)}%
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-xl p-3 shadow">
                  <p className="text-xs text-gray-500">Средний чек</p>
                  <p className="text-xl font-bold text-amber-600">{kpi.avgCheck.toLocaleString()} ₽</p>
                  <p className="text-xs text-gray-400">Продаж: {kpi.salesCount}</p>
                </div>
              </div>
              {/* Cash vs Cashless */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-3">Нал / Безнал</h3>
                {revenueData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#f0f0f0"} />
                        <XAxis dataKey="date" tick={{fontSize: 9}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} />
                        <Bar dataKey="cash" stackId="a" fill="#22c55e" name="Нал" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="cashless" stackId="a" fill="#3b82f6" name="Безнал" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-6 mt-2">
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{backgroundColor: '#22c55e'}}></div><span className="text-xs text-gray-600">Наличные</span></div>
                      <div className="flex items-center gap-2"><div className="w-4 h-4 rounded" style={{backgroundColor: '#3b82f6'}}></div><span className="text-xs text-gray-600">Безнал</span></div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB: Salary */}
          {tab === 'salary' && (() => {
            const salaryByDay = {};
            filteredReports.forEach(r => {
              const d = (r.date||'').split(',')[0].trim();
              if (!salaryByDay[d]) salaryByDay[d] = 0;
              salaryByDay[d] += getEffectiveSalary(r);
            });
            const salaryData = Object.entries(salaryByDay).map(([date, sal]) => ({ date, salary: Math.round(sal) })).sort((a, b) => {
              const [ad,am,ay] = a.date.split('.'); const [bd,bm,by] = b.date.split('.');
              return ((ay||'')+(am||'')+(ad||'')).localeCompare((by||'')+(bm||'')+(bd||''));
            });
            const totalSalary = salaryData.reduce((s, d) => s + d.salary, 0);
            return (<div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-1">Заработок по дням</h3>
                <p className="text-2xl font-bold text-green-600 mb-3">{totalSalary.toLocaleString()} ₽</p>
                {salaryData.length > 0 ? (<ResponsiveContainer width="100%" height={200}><BarChart data={salaryData}><CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#f0f0f0"} /><XAxis dataKey="date" tick={{fontSize: 9}} /><YAxis tick={{fontSize: 10}} /><Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} /><Bar dataKey="salary" fill="#22c55e" radius={[4, 4, 0, 0]} name="ЗП" /></BarChart></ResponsiveContainer>) : <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow"><p className="text-xs text-gray-500">Средний/день</p><p className="text-lg font-bold text-green-600">{salaryData.length > 0 ? Math.round(totalSalary / salaryData.length).toLocaleString() : 0} ₽</p></div>
                <div className="bg-white rounded-xl p-3 shadow"><p className="text-xs text-gray-500">Рабочих дней</p><p className="text-lg font-bold text-purple-600">{salaryData.length}</p></div>
              </div>
            </div>);
          })()}

          {/* TAB: Products */}
          {tab === 'products' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-3">ABC-анализ товаров</h3>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {abcData.slice(0, 20).map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 py-1.5 border-b border-gray-50">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${p.grade === 'A' ? 'bg-green-100 text-green-700' : p.grade === 'B' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{p.grade}</span>
                      <span className="text-sm flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-gray-500">{p.count} шт</span>
                      <span className="text-sm font-semibold">{p.revenue.toLocaleString()}₽</span>
                      <span className="text-xs text-gray-400">{p.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {categoryData.length > 0 && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold text-sm mb-3">По категориям</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* TAB: Employees (admin only) */}
          {tab === 'employees' && isAdmin && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-3">Рейтинг по выручке</h3>
                {employeeRanking.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(150, employeeRanking.length * 40)}>
                    <BarChart data={employeeRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#f0f0f0"} />
                      <XAxis type="number" tick={{fontSize: 10}} />
                      <YAxis type="category" dataKey="name" tick={{fontSize: 11}} width={80} />
                      <Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} />
                      <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Выручка" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-gray-400 text-sm text-center py-4">Нет данных</p>}
              </div>
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold text-sm mb-3">Средний чек по сотруднику</h3>
                <div className="space-y-2">
                  {employeeRanking.map((e, i) => (
                    <div key={e.name} className="flex items-center gap-2">
                      <span className="text-sm font-medium w-20 truncate">{e.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 relative">
                        <div className="bg-amber-400 h-4 rounded-full" style={{width: `${Math.min(100, e.avgCheck / (employeeRanking[0]?.avgCheck || 1) * 100)}%`}}></div>
                      </div>
                      <span className="text-sm font-semibold w-16 text-right">{e.avgCheck}₽</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Plan/Fact */}
              {salesPlan && (
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold text-sm mb-3">План / Факт</h3>
                  {employeeRanking.map(e => {
                    const target = salesPlan.daily ? salesPlan.daily * period : salesPlan.monthly || 300000;
                    const pct = Math.round(e.revenue / target * 100);
                    return (
                      <div key={e.name} className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{e.name}</span>
                          <span className={pct >= 100 ? 'text-green-600 font-bold' : 'text-gray-500'}>{pct}%</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-3">
                          <div className={`h-3 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`} style={{width: `${Math.min(100, pct)}%`}}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Forecast */}
          {tab === 'forecast' && (
            <div className="space-y-4">
              {forecast ? (
                <>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold text-sm mb-3">Прогноз выручки (7 дней)</h3>
                    <p className="text-xs text-gray-500 mb-2">Среднедневная: {forecast.avgDaily.toLocaleString()} ₽</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={[...revenueData.slice(-7), ...forecast.forecastDays]}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#f0f0f0"} />
                        <XAxis dataKey="date" tick={{fontSize: 9}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip formatter={(v) => v.toLocaleString() + ' ₽'} />
                        <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} dot={{r: 3, fill: '#f59e0b'}} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Факт</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Прогноз</span>
                    </div>
                  </div>
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold text-sm mb-3">Прогноз остатков склада</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {forecast.stockForecast.map(s => (
                        <div key={s.name} className="flex items-center gap-2 py-1">
                          <span className={`w-2 h-8 rounded-full ${s.daysRemaining < 7 ? 'bg-red-500' : s.daysRemaining < 14 ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{s.name}</p>
                            <p className="text-xs text-gray-400">Осталось: {s.current} шт, ≈{s.avgDaily}/день</p>
                          </div>
                          <span className={`text-sm font-bold ${s.daysRemaining < 7 ? 'text-red-500' : s.daysRemaining < 14 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {s.daysRemaining} дн
                          </span>
                        </div>
                      ))}
                      {forecast.stockForecast.length === 0 && <p className="text-gray-400 text-sm text-center">Все товары в достаточном количестве</p>}
                    </div>
                  </div>
                  {forecast.stockForecast.filter(s => s.daysRemaining < 7).length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <h3 className="font-bold text-sm text-red-700 mb-2">⚠️ Рекомендация к заказу</h3>
                      {forecast.stockForecast.filter(s => s.daysRemaining < 7).map(s => (
                        <p key={s.name} className="text-sm text-red-600">{s.name} — заказать ~{Math.max(1, s.predictedNeed - s.current)} шт</p>
                      ))}
                    </div>
                  )}
                </>
              ) : <p className="text-gray-400 text-sm text-center py-8 bg-white rounded-xl shadow p-4">Недостаточно данных для прогноза (нужно минимум 7 дней)</p>}
            </div>
          )}
        </div>
      </div>
    );
  };

  const MenuView = () => {
    const todayAllReports = getReportsByDate(formatDate(new Date()));
    // Показываем только МОИ продажи
    const todayReports = todayAllReports.filter(r => r.employee === employeeName);
    const todayTotal = todayReports.reduce((s, r) => s + r.total, 0);
    const todayTips = todayReports.reduce((s, r) => s + (r.tips || 0), 0);
    const todayCash = todayReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
    const todayCashless = todayReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
    const hasUnrecognized = todayReports.some(r => r.isUnrecognized);
    const lowStock = getLowStockItems();
    const isAdmin = currentUser?.isAdmin || currentUser?.role === 'admin';
    
    // Подсчёт предстоящих событий
    const today = new Date();
    const upcomingEventsCount = Object.entries(eventsCalendar).reduce((count, [date, evArr]) => {
      const [d, m, y] = date.split('.');
      const eventDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0 && daysUntil <= 7) return count + (Array.isArray(evArr) ? evArr.length : 1);
      return count;
    }, 0);

    // Мои непрочитанные уведомления
    const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
    const myUnreadCount = userNotifications.filter(n => n.targetLogin === myLogin && !n.read).length;

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-amber-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6 relative">
            {/* Кнопка уведомлений — правый верхний угол */}
            <button onClick={() => setCurrentView('notifications')} className="absolute top-0 right-0 w-10 h-10 bg-white rounded-xl shadow flex items-center justify-center hover:shadow-md relative">
              <Bell className="w-5 h-5 text-amber-600" />
              {myUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">{myUnreadCount > 9 ? '9+' : myUnreadCount}</span>
              )}
            </button>
            <h1 className="text-3xl font-bold text-amber-600 mb-1">🐦 LikeBird</h1>
            <p className="text-gray-500 text-sm">Учёт продаж v{APP_VERSION}</p>
            {!isOnline && <p className="text-xs text-orange-500 mt-1 flex items-center justify-center gap-1"><WifiOff className="w-3 h-3" /> Оффлайн режим</p>}
            {todayReports.length > 0 && (
                <div className="mt-3 bg-white rounded-xl p-3 shadow">
                  <p className="text-xs text-gray-500 mb-1">Мои продажи сегодня: {todayReports.length}</p>
                  <p className="text-2xl font-bold text-green-600">{todayTotal.toLocaleString()} ₽{todayTips > 0 && <span className="text-amber-500 text-base"> +{todayTips}₽ ⭐</span>}</p>
                  <div className="flex gap-3 mt-1 text-sm font-semibold">
                    {todayCash > 0 && <span className="text-gray-700">💵 {todayCash.toLocaleString()}₽</span>}
                    {todayCashless > 0 && <span className="text-gray-700">💳 {todayCashless.toLocaleString()}₽</span>}
                  </div>
                  {hasUnrecognized && <p className="text-red-500 text-xs mt-1"><AlertTriangle className="w-3 h-3 inline" /> Есть нераспознанные</p>}
                </div>
              )}
            {isAdmin && lowStock.length > 0 && (<div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2"><p className="text-orange-600 text-xs font-semibold"><Bell className="w-3 h-3 inline" /> Дозаказать: {lowStock.length} позиций</p></div>)}
          </div>
          <div className="space-y-3">
            <button onClick={() => setCurrentView('catalog')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-amber-100 p-3 rounded-lg"><ShoppingBag className="w-6 h-6 text-amber-600" /></div><div className="text-left"><h3 className="font-bold">Каталог</h3><p className="text-xs text-gray-400">Просмотр товаров и цен</p></div></button>
            <button onClick={() => setCurrentView('shift')} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Clock className="w-6 h-6" /></div><div className="text-left flex-1"><h3 className="font-bold">Смена</h3><p className="text-xs text-white/80">Продажи, импорт, отчёт</p></div>{(() => { try { const login = JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; const key = login + '_' + formatDate(new Date()); const sh = shiftsData[key]; return sh?.status === 'open' ? <span className="bg-green-400 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">● Открыта</span> : null; } catch { return null; } })()}</button>
            {hasAccess('reports') && <button onClick={() => setCurrentView('reports')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-amber-100 p-3 rounded-lg"><FileText className="w-6 h-6 text-amber-600" /></div><div className="text-left"><h3 className="font-bold">История</h3><p className="text-xs text-gray-400">Все продажи по дням</p></div></button>}
            {hasAccess('day-report') && <button onClick={() => { setSelectedDate(formatDate(new Date())); setCurrentView('day-report'); }} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-orange-100 p-3 rounded-lg"><BarChart3 className="w-6 h-6 text-orange-600" /></div><div className="text-left flex-1"><h3 className="font-bold">Итог дня</h3><p className="text-xs text-gray-400">Сводка по сотрудникам</p></div>{(() => { const cnt = reports.filter(r => r.reviewStatus === 'submitted').length; return cnt > 0 ? <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">{cnt > 99 ? '99+' : cnt}</span> : null; })()}</button>}
            <button onClick={() => setCurrentView('analytics')} className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><TrendingUp className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Аналитика</h3><p className="text-xs text-white/80">Графики и тренды</p></div></button>
            {hasAccess('team') && <button onClick={() => setCurrentView('team')} className="w-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Users className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Команда</h3><p className="text-xs text-white/80">График, результаты, события</p></div>{upcomingEventsCount > 0 && <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{upcomingEventsCount}</span>}</button>}
            {hasAccess('admin') && <button onClick={() => setCurrentView('admin')} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg relative"><div className="bg-white/20 p-3 rounded-lg"><Shield className="w-6 h-6" /></div><div className="text-left"><h3 className="font-bold">Админ-панель</h3><p className="text-xs text-white/80">Управление и аналитика</p></div>{lowStock.length > 0 && <span className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{lowStock.length}</span>}</button>}
            <button onClick={() => setCurrentView('settings')} className="w-full bg-white rounded-xl p-4 shadow flex items-center gap-3 hover:shadow-md"><div className="bg-gray-100 p-3 rounded-lg"><Settings className="w-6 h-6 text-gray-600" /></div><div className="text-left"><h3 className="font-bold">Настройки</h3><p className="text-xs text-gray-400">Экспорт, бэкап, аккаунт</p></div></button>
            <button onClick={() => setCurrentView('profile')} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><span className="text-xl">{(profilesData[(() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })()]?.avatar) ? '🖼️' : '👤'}</span></div><div className="text-left flex-1"><h3 className="font-bold">Мой профиль</h3><p className="text-xs text-white/80">Зарплата, достижения, аккаунт</p></div><div className="text-right"><p className="text-white/80 text-sm font-semibold">{employeeName}</p></div></button>
            <button onClick={() => setCurrentView('game')} className="w-full bg-gradient-to-r from-cyan-400 to-sky-500 rounded-xl p-4 shadow flex items-center gap-3 text-white hover:shadow-lg"><div className="bg-white/20 p-3 rounded-lg"><span className="text-xl">🌊</span></div><div className="text-left flex-1"><h3 className="font-bold">Ветер на набережной</h3><p className="text-xs text-white/80">Мини-игра: лови товар!</p></div><div className="text-right"><p className="text-white/80 text-xs font-semibold">🏆 {(() => { try { return localStorage.getItem('likebird-game-highscore') || '0'; } catch { return '0'; } })()}</p></div></button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // NotificationsView — Уведомления пользователя
  // ════════════════════════════════════════════════════════════════════════
  const NotificationsView = () => {
    const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
    const myNotifs = userNotifications.filter(n => n.targetLogin === myLogin).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const unread = myNotifs.filter(n => !n.read);
    const read = myNotifs.filter(n => n.read);

    const markAsRead = (notifId) => {
      const updated = userNotifications.map(n => n.id === notifId ? { ...n, read: true } : n);
      setUserNotifications(updated);
      save('likebird-notifications', updated);
    };

    const markAllAsRead = () => {
      const updated = userNotifications.map(n => n.targetLogin === myLogin ? { ...n, read: true } : n);
      setUserNotifications(updated);
      save('likebird-notifications', updated);
    };

    const formatTime = (ts) => {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const diff = now - d;
      if (diff < 60000) return 'только что';
      if (diff < 3600000) return `${Math.floor(diff/60000)} мин. назад`;
      if (diff < 86400000) return `${Math.floor(diff/3600000)} ч. назад`;
      return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    };

    const NotifCard = ({ n, isUnread }) => (
      <div className={`rounded-xl p-3 shadow-sm border-l-4 ${isUnread ? 'bg-amber-50 border-amber-400' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{n.type === 'achievement' ? '🏆' : n.type === 'stock' ? '📦' : n.type === 'chat' ? '💬' : '🔔'}</span>
              <span className="font-bold text-sm truncate">{n.title || 'Уведомление'}</span>
            </div>
            <p className="text-sm text-gray-700">{n.body}</p>
            <p className="text-xs text-gray-400 mt-1">{formatTime(n.createdAt)}</p>
          </div>
          {isUnread && (
            <button onClick={() => markAsRead(n.id)} className="shrink-0 bg-amber-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-600">
              ✓ Прочитано
            </button>
          )}
        </div>
      </div>
    );

    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 pt-safe sticky top-0 z-10" style={{paddingTop: "max(1rem, env(safe-area-inset-top))"}}>
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('menu')} className="mr-3" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
            <h2 className="text-xl font-bold flex-1">🔔 Уведомления</h2>
            {unread.length > 0 && (
              <button onClick={markAllAsRead} className="text-xs bg-white/20 px-3 py-1.5 rounded-lg font-semibold">
                Прочитать все
              </button>
            )}
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 mt-4 space-y-3">
          {unread.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 mb-2 uppercase tracking-wider">Новые ({unread.length})</p>
              <div className="space-y-2">
                {unread.map(n => <NotifCard key={n.id} n={n} isUnread={true} />)}
              </div>
            </div>
          )}
          {read.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider mt-4">Прочитанные</p>
              <div className="space-y-2">
                {read.slice(0, 30).map(n => <NotifCard key={n.id} n={n} isUnread={false} />)}
              </div>
            </div>
          )}
          {myNotifs.length === 0 && (
            <div className="text-center py-16">
              <Bell className="w-16 h-16 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-lg">Нет уведомлений</p>
              <p className="text-gray-300 text-sm mt-1">Здесь будут достижения и важные события</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // GameView — «Ветер на набережной» — bulletproof Canvas game (v2)
  // ════════════════════════════════════════════════════════════════════════
  const GameView = () => {
    const containerRef = useRef(null);
    const gRef = useRef(null);

    const handleBack = useCallback(() => {
      if (gRef.current) gRef.current.running = false;
      setCurrentView('menu');
    }, []);

    useEffect(() => {
      const box = containerRef.current;
      if (!box) return;
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;user-select:none;-webkit-user-select:none;';
      box.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 2, 2);

      let W = 0, H = 0, GW = 0, GX = 0;
      // Pre-created gradients (performance: created once, not per-frame)
      let skyGrad = null, seaGrad = null;

      const doResize = () => {
        const r = box.getBoundingClientRect();
        W = canvas.width = Math.max(1, Math.round(r.width * dpr));
        H = canvas.height = Math.max(1, Math.round(r.height * dpr));
        // ★ BLOCK 1.2 — game field max width for desktop
        GW = Math.min(W, H * 0.6);
        GX = (W - GW) / 2;
        // Recreate gradients on resize
        skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.42);
        skyGrad.addColorStop(0, '#87CEEB');
        skyGrad.addColorStop(1, '#E0F4FF');
        seaGrad = ctx.createLinearGradient(0, H * 0.07, 0, H * 0.15);
        seaGrad.addColorStop(0, '#3a7bd5');
        seaGrad.addColorStop(1, '#5a9fd4');
      };
      doResize();

      // ═══ Game state — plain JS, zero React ═══
      const g = {
        phase: 'menu', tx: 0.5,
        items: [], fx: [], dust: [], stars: [], confetti: [],
        score: 0, lives: 3, lvl: 1,
        wind: 0.8, wdir: 1, wt: 0,
        st: 0, sr: 110, f: 0, run: true,
        hs: parseInt(localStorage.getItem('likebird-game-highscore') || '0'),
        nr: false, mb: null, rb: null, hb: null,
        // ★ Catcher animation state
        catchScale: 1, catchScaleT: 0,
        shakeX: 0, shakeT: 0,
        // ★ Miss vignette
        vignetteT: 0,
        // ★ Menu preview items
        menuItems: [],
        // ★ Leaderboard
        lb: null, lbLoading: false,
        // ★ Level select
        lbb: null, lvlb: null, backb: null,
        // ★ Hover state for desktop
        hoverBtn: null,
        // ★ Start level
        startLvl: 1,
      };
      gRef.current = g;

      // ★ BLOCK 3.1 — Load leaderboard once
      try {
        g.lbLoading = true;
        fbGet('likebird-game-leaderboard').then(function(data) {
          g.lb = data || {};
          g.lbLoading = false;
        }).catch(function() { g.lb = {}; g.lbLoading = false; });
      } catch(e) { g.lb = {}; }

      // ═══ Types ═══
      const TPS = [
        {t:'b',p:10,c:'#f59e0b',fc:'#f59e0b'},{t:'b',p:10,c:'#ef4444',fc:'#ef4444'},{t:'b',p:10,c:'#3b82f6',fc:'#3b82f6'},
        {t:'b',p:10,c:'#ec4899',fc:'#ec4899'},{t:'b',p:10,c:'#8b5cf6',fc:'#8b5cf6'},
        {t:'y',p:20,c:'#d5ccc2',fc:'#d97706'},{t:'s',p:15,c:'#6B7DB3',fc:'#3b82f6'},
        {t:'l',p:15,c:'#4ade80',fc:'#22c55e'},{t:'o',p:12,c:'#ec4899',fc:'#ec4899'},{t:'m',p:12,c:'#d97706',fc:'#d97706'},
      ];

      // ═══ Safe drawing helpers ═══
      const ellipse = (x,y,rx,ry,rot) => {
        if(rx<=0||ry<=0) return;
        try{ctx.ellipse(x,y,rx,ry,rot||0,0,6.28);}catch(e){ctx.arc(x,y,Math.max(rx,ry),0,6.28);}
      };

      // ═══ Draw bird ═══
      const drawBird = (x,y,s,c,rot) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
        ctx.fillStyle=c;ctx.beginPath();ellipse(0,0,s*0.52,s*0.62,0);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();ellipse(0,s*0.13,s*0.3,s*0.34,0);ctx.fill();
        var eo=s*0.17,ey=-s*0.13,er=s*0.16;
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-eo,ey,er,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo,ey,er,0,6.28);ctx.fill();
        ctx.fillStyle='#111';ctx.beginPath();ctx.arc(-eo+1,ey+2,er*0.45,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo+1,ey+2,er*0.45,0,6.28);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-eo-2,ey-2,er*0.15,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(eo-2,ey-2,er*0.15,0,6.28);ctx.fill();
        ctx.fillStyle='#ff9500';ctx.beginPath();ctx.moveTo(-s*0.08,0);ctx.lineTo(0,s*0.13);ctx.lineTo(s*0.08,0);ctx.closePath();ctx.fill();
        ctx.fillStyle=c;ctx.globalAlpha=0.5;ctx.beginPath();ellipse(-s*0.48,s*0.05,s*0.2,s*0.3,-0.3);ctx.fill();ctx.beginPath();ellipse(s*0.48,s*0.05,s*0.2,s*0.3,0.3);ctx.fill();ctx.globalAlpha=1;
        ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(0,-s*0.56);ctx.quadraticCurveTo(-s*0.15,-s*0.8,0,-s*0.72);ctx.stroke();
        ctx.beginPath();ctx.moveTo(s*0.05,-s*0.56);ctx.quadraticCurveTo(s*0.22,-s*0.82,s*0.08,-s*0.7);ctx.stroke();
        ctx.fillStyle='rgba(255,150,150,0.25)';ctx.beginPath();ctx.arc(-s*0.3,s*0.04,s*0.09,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.3,s*0.04,s*0.09,0,6.28);ctx.fill();
        ctx.restore();
      };

      const drawYeti = (x,y,s,rot) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
        ctx.fillStyle='#e8e0d8';ctx.beginPath();ellipse(0,0,s*0.54,s*0.63,0);ctx.fill();
        ctx.strokeStyle='#cfc4b8';ctx.lineWidth=1.5;for(var a=0;a<6.28;a+=0.4){ctx.beginPath();ctx.moveTo(Math.cos(a)*s*0.52,Math.sin(a)*s*0.61);ctx.lineTo(Math.cos(a+0.12)*s*0.63,Math.sin(a+0.12)*s*0.72);ctx.stroke();}
        ctx.fillStyle='#f5efe8';ctx.beginPath();ellipse(0,s*0.06,s*0.32,s*0.32,0);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.13,-s*0.05,s*0.12,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.13,-s*0.05,s*0.12,0,6.28);ctx.fill();
        ctx.fillStyle='#3a2a1a';ctx.beginPath();ctx.arc(-s*0.11,-s*0.03,s*0.06,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.15,-s*0.03,s*0.06,0,6.28);ctx.fill();
        ctx.strokeStyle='#8B7355';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,s*0.13,s*0.08,0.3,2.84);ctx.stroke();
        ctx.fillStyle='#c0aa90';ctx.beginPath();ctx.moveTo(-s*0.26,-s*0.46);ctx.lineTo(-s*0.36,-s*0.72);ctx.lineTo(-s*0.13,-s*0.52);ctx.fill();ctx.beginPath();ctx.moveTo(s*0.26,-s*0.46);ctx.lineTo(s*0.36,-s*0.72);ctx.lineTo(s*0.13,-s*0.52);ctx.fill();
        ctx.restore();
      };

      const drawShark = (x,y,s,rot) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
        ctx.fillStyle='#6B7DB3';ctx.beginPath();ellipse(0,0,s*0.58,s*0.36,0);ctx.fill();
        ctx.fillStyle='#dde';ctx.beginPath();ellipse(0,s*0.09,s*0.42,s*0.2,0);ctx.fill();
        ctx.fillStyle='#556699';ctx.beginPath();ctx.moveTo(0,-s*0.34);ctx.lineTo(-s*0.12,-s*0.6);ctx.lineTo(s*0.14,-s*0.34);ctx.fill();
        ctx.beginPath();ctx.moveTo(s*0.5,-s*0.05);ctx.lineTo(s*0.74,-s*0.27);ctx.lineTo(s*0.74,s*0.2);ctx.lineTo(s*0.5,s*0.05);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.28,-s*0.09,s*0.1,0,6.28);ctx.fill();
        ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.26,-s*0.07,s*0.05,0,6.28);ctx.fill();
        ctx.restore();
      };

      const drawLizard = (x,y,s,rot) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
        ctx.fillStyle='#4ade80';ctx.beginPath();ellipse(0,0,s*0.38,s*0.53,0);ctx.fill();
        ctx.fillStyle='#22c55e';for(var i=0;i<5;i++){ctx.beginPath();ctx.arc(Math.cos(i*1.2)*s*0.15,-s*0.2+i*s*0.12,s*0.055,0,6.28);ctx.fill();}
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.14,-s*0.3,s*0.11,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.14,-s*0.3,s*0.11,0,6.28);ctx.fill();
        ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.12,-s*0.28,s*0.055,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.16,-s*0.28,s*0.055,0,6.28);ctx.fill();
        ctx.strokeStyle='#22c55e';ctx.lineWidth=2.5;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(-s*0.3,-s*0.26);ctx.lineTo(-s*0.46,-s*0.4);ctx.stroke();ctx.beginPath();ctx.moveTo(s*0.3,-s*0.26);ctx.lineTo(s*0.46,-s*0.4);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-s*0.3,s*0.26);ctx.lineTo(-s*0.46,s*0.4);ctx.stroke();ctx.beginPath();ctx.moveTo(s*0.3,s*0.26);ctx.lineTo(s*0.46,s*0.4);ctx.stroke();
        ctx.restore();
      };

      const drawGenToy = (x,y,s,c,em,rot) => {
        ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);
        ctx.fillStyle=c;ctx.beginPath();ctx.arc(0,0,s*0.48,0,6.28);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.08)';ctx.lineWidth=1.5;ctx.stroke();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*0.14,-s*0.09,s*0.12,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.14,-s*0.09,s*0.12,0,6.28);ctx.fill();
        ctx.fillStyle='#222';ctx.beginPath();ctx.arc(-s*0.12,-s*0.07,s*0.06,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(s*0.16,-s*0.07,s*0.06,0,6.28);ctx.fill();
        ctx.font=Math.round(s*0.5)+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(em,0,s*0.18);
        ctx.restore();
      };

      const drawFig = (it) => {
        var rot=it.rot*0.01745;
        switch(it.t){
          case'b':drawBird(it.x,it.y,it.s,it.c,rot);break;
          case'y':drawYeti(it.x,it.y,it.s,rot);break;
          case's':drawShark(it.x,it.y,it.s,rot);break;
          case'l':drawLizard(it.x,it.y,it.s,rot);break;
          case'o':drawGenToy(it.x,it.y,it.s,it.c,'🐙',rot);break;
          case'm':drawGenToy(it.x,it.y,it.s,it.c,'🧸',rot);break;
        }
      };

      // ═══ BLOCK 2.1 — Enhanced Background ═══
      const drawBg = () => {
        // Sky gradient (pre-created)
        ctx.fillStyle = skyGrad || '#a8ddf0';
        ctx.fillRect(0, 0, W, H * 0.42);

        // ★ Sun in top-right of game area
        var sunX = GX + GW * 0.88, sunY = H * 0.06, sunR = Math.max(W, H) * 0.028;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, 6.28); ctx.fill();
        // Sun glow
        ctx.globalAlpha = 0.15;
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 2.2, 0, 6.28); ctx.fill();
        ctx.globalAlpha = 0.08;
        ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.5, 0, 6.28); ctx.fill();
        ctx.globalAlpha = 1;
        // Sun rays
        ctx.strokeStyle = 'rgba(255,215,0,0.2)'; ctx.lineWidth = 2;
        for (var ra = 0; ra < 6.28; ra += 0.52) {
          ctx.beginPath();
          ctx.moveTo(sunX + Math.cos(ra + g.f * 0.005) * sunR * 1.5, sunY + Math.sin(ra + g.f * 0.005) * sunR * 1.5);
          ctx.lineTo(sunX + Math.cos(ra + g.f * 0.005) * sunR * 2.8, sunY + Math.sin(ra + g.f * 0.005) * sunR * 2.8);
          ctx.stroke();
        }

        // ★ 3 Clouds with parallax
        var clouds = [
          { speed: 0.3, y: H * 0.04, sz: 1.0, alpha: 0.5 },
          { speed: 0.5, y: H * 0.025, sz: 1.3, alpha: 0.35 },
          { speed: 0.15, y: H * 0.065, sz: 0.75, alpha: 0.55 },
        ];
        for (var ci = 0; ci < clouds.length; ci++) {
          var cl = clouds[ci];
          ctx.fillStyle = 'rgba(255,255,255,' + cl.alpha + ')';
          var cx1 = ((g.f * cl.speed + ci * W * 0.4) % (W + 400 * cl.sz)) - 200 * cl.sz;
          var csz = 22 * cl.sz;
          ctx.beginPath(); ctx.arc(cx1, cl.y, csz, 0, 6.28); ctx.arc(cx1 + 28 * cl.sz, cl.y - 8 * cl.sz, csz * 1.2, 0, 6.28); ctx.arc(cx1 + 58 * cl.sz, cl.y, csz * 0.9, 0, 6.28); ctx.fill();
        }

        // Sea with gradient
        ctx.fillStyle = seaGrad || '#4a90d9';
        ctx.fillRect(0, H * 0.07, W, H * 0.08);

        // ★ Animated waves in 2 layers + foam
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        for (var ww = 0; ww < 3; ww++) {
          ctx.beginPath();
          for (var x = 0; x < W; x += 6) {
            var wy = H * 0.085 + ww * H * 0.015 + Math.sin((x + g.f * 1.5 + ww * 35) / 30) * 3;
            ctx.lineTo(x, wy);
          }
          ctx.stroke();
        }
        // Foam — white dots on wave crests
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (var fx = 0; fx < W; fx += 18) {
          var foamY = H * 0.08 + Math.sin((fx + g.f * 1.5) / 30) * 3;
          if (Math.sin((fx + g.f * 1.5) / 30) > 0.5) {
            ctx.beginPath(); ctx.arc(fx, foamY, 1.5, 0, 6.28); ctx.fill();
          }
        }

        // ★ Ground with tile texture
        ctx.fillStyle = '#b5a07a';
        ctx.fillRect(0, H * 0.15, W, H);
        // Tile stripes alternating
        var tileH = H * 0.025;
        for (var ty2 = H * 0.15; ty2 < H; ty2 += tileH) {
          var tileRow = Math.floor((ty2 - H * 0.15) / tileH);
          ctx.fillStyle = tileRow % 2 === 0 ? '#C4A882' : '#B8976E';
          ctx.fillRect(0, ty2, W, tileH);
        }
        // Tile vertical lines
        ctx.strokeStyle = 'rgba(0,0,0,0.04)'; ctx.lineWidth = 1;
        var ts = GW / 6;
        for (var x2 = GX; x2 < GX + GW; x2 += ts) { ctx.beginPath(); ctx.moveTo(x2, H * 0.15); ctx.lineTo(x2, H); ctx.stroke(); }
        // Tile horizontal lines
        for (var y2 = H * 0.15; y2 < H; y2 += tileH) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(W, y2); ctx.stroke(); }
      };

      // ═══ BLOCK 2.2 — Enhanced Table ═══
      const drawTable = () => {
        var ty = H * 0.17, th = H * 0.06;
        var tl = GX + GW * 0.08, tr = GX + GW * 0.92;
        var ttl = GX + GW * 0.15, ttr = GX + GW * 0.85;

        // ★ Blurred shadow under table (multiple semi-transparent strips)
        for (var si = 0; si < 4; si++) {
          ctx.fillStyle = 'rgba(0,0,0,' + (0.06 - si * 0.012) + ')';
          ctx.beginPath();
          ctx.moveTo(tl + si * 3, ty + th + 3 + si * 2);
          ctx.lineTo(tr - si * 3, ty + th + 3 + si * 2);
          ctx.lineTo(tr - si * 3 - 4, ty + th + 6 + si * 2);
          ctx.lineTo(tl + si * 3 + 4, ty + th + 6 + si * 2);
          ctx.fill();
        }

        // ★ Table legs
        var legW = GW * 0.03, legH = H * 0.04;
        ctx.fillStyle = '#3a2210';
        ctx.fillRect(GX + GW * 0.2 - legW / 2, ty + th, legW, legH);
        ctx.fillRect(GX + GW * 0.8 - legW / 2, ty + th, legW, legH);

        // Table top (trapezoid)
        ctx.fillStyle = '#4a2e14'; ctx.beginPath();
        ctx.moveTo(tl, ty + th);
        ctx.lineTo(tr, ty + th);
        ctx.lineTo(ttr, ty);
        ctx.lineTo(ttl, ty);
        ctx.closePath(); ctx.fill();

        // ★ Wood grain lines
        ctx.strokeStyle = 'rgba(120,80,40,0.2)'; ctx.lineWidth = 1;
        for (var gi = 0; gi < 5; gi++) {
          var gy = ty + th * (0.15 + gi * 0.17);
          ctx.beginPath();
          ctx.moveTo(ttl + GW * 0.02, gy);
          ctx.lineTo(ttr - GW * 0.02, gy);
          ctx.stroke();
        }

        // Table edge highlight
        ctx.strokeStyle = '#e8ddd0'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tl, ty + th); ctx.lineTo(tr, ty + th);
        ctx.lineTo(ttr, ty); ctx.lineTo(ttl, ty); ctx.closePath();
        ctx.stroke();

        // ★ White tablecloth stripe along front edge
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tl + 2, ty + th - 2); ctx.lineTo(tr - 2, ty + th - 2); ctx.stroke();

        // ★ Mini birds on table — adaptive size
        var tbs = Math.max(W, H) * 0.018;
        var cols = ['#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#4ade80'];
        for (var i = 0; i < cols.length; i++) {
          var ix = GX + GW * 0.18 + i * (GW * 0.64 / cols.length);
          var wb = Math.sin((g.f * 0.025 + i * 1.4) * Math.max(0.5, g.wind * 0.3)) * g.wind * 0.4;
          drawBird(ix + wb, ty + th * 0.15, tbs, cols[i], wb * 0.01);
        }
      };

      // ═══ Death line ═══
      const DEATH_Y = () => H * 0.87;
      const drawDeathLine = () => {
        var dy = DEATH_Y();
        ctx.fillStyle = 'rgba(239,68,68,0.05)'; ctx.fillRect(GX, dy, GW, H - dy);
        ctx.strokeStyle = 'rgba(239,68,68,0.15)'; ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(GX, dy); ctx.lineTo(GX + GW, dy); ctx.stroke(); ctx.setLineDash([]);
      };

      // ═══ Wind particles ═══
      const drawDust = () => {
        for (var i = 0; i < g.dust.length; i++) {
          var p = g.dust[i];
          ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, p.l / p.m) * 0.25 + ')';
          ctx.fillRect(p.x, p.y, p.z * 6, 1);
        }
      };

      // ═══ BLOCK 2.3 — Enhanced Catcher ═══
      const CATCH_Y = () => H * 0.77;
      const CATCH_HW = () => GW * 0.15;
      const drawCatcher = () => {
        var cx = GX + g.tx * GW + g.shakeX, hw = CATCH_HW(), cy = CATCH_Y(), ch = H * 0.055;

        // ★ Apply catch scale animation
        var sc = g.catchScale;
        ctx.save();
        if (sc !== 1) { ctx.translate(cx, cy + ch * 0.3); ctx.scale(sc, sc); ctx.translate(-cx, -(cy + ch * 0.3)); }

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.beginPath();
        ctx.moveTo(cx - hw * 0.7, cy + ch + 3); ctx.lineTo(cx + hw * 0.7, cy + ch + 3);
        ctx.lineTo(cx + hw * 0.6, cy + ch + 6); ctx.lineTo(cx - hw * 0.6, cy + ch + 6); ctx.fill();

        // ★ Arms (arc lines on sides)
        ctx.strokeStyle = '#e0a87a'; ctx.lineWidth = Math.max(3, hw * 0.06); ctx.lineCap = 'round';
        // Left arm
        ctx.beginPath();
        ctx.arc(cx - hw * 0.6, cy + ch * 0.1, hw * 0.55, -0.4, 0.8); ctx.stroke();
        // Right arm
        ctx.beginPath();
        ctx.arc(cx + hw * 0.6, cy + ch * 0.1, hw * 0.55, 2.34, 3.54); ctx.stroke();

        // Body
        ctx.fillStyle = '#fcd9b6'; ctx.beginPath();
        ctx.moveTo(cx - hw, cy + ch * 0.3);
        ctx.lineTo(cx - hw * 0.65, cy - ch * 0.5);
        ctx.lineTo(cx - hw * 0.25, cy - ch * 0.7);
        ctx.lineTo(cx + hw * 0.25, cy - ch * 0.7);
        ctx.lineTo(cx + hw * 0.65, cy - ch * 0.5);
        ctx.lineTo(cx + hw, cy + ch * 0.3);
        ctx.quadraticCurveTo(cx, cy + ch * 1.1, cx - hw, cy + ch * 0.3);
        ctx.fill(); ctx.strokeStyle = '#e0a87a'; ctx.lineWidth = 1.5; ctx.stroke();

        // Blue stripes on sides
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(cx - hw - 3, cy, 12, ch * 0.8);
        ctx.fillRect(cx + hw - 9, cy, 12, ch * 0.8);

        ctx.restore();
      };

      // ═══ BLOCK 2.4 — Enhanced Effects ═══
      const drawFx = () => {
        // Star particles
        var si = g.stars.length;
        while (si--) {
          var st = g.stars[si]; st.l--; st.x += st.vx; st.y += st.vy;
          if (st.l <= 0) { g.stars.splice(si, 1); continue; }
          var sa = st.l / st.m;
          ctx.fillStyle = 'rgba(' + st.cr + ',' + st.cg + ',' + st.cb + ',' + sa + ')';
          // Draw star shape
          ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(st.rot);
          var ssr = st.sz;
          ctx.beginPath();
          for (var sp = 0; sp < 5; sp++) {
            var ang = sp * 1.2566 - 1.5708;
            ctx.lineTo(Math.cos(ang) * ssr, Math.sin(ang) * ssr);
            ctx.lineTo(Math.cos(ang + 0.6283) * ssr * 0.4, Math.sin(ang + 0.6283) * ssr * 0.4);
          }
          ctx.closePath(); ctx.fill(); ctx.restore();
          st.rot += 0.1;
        }

        // Text effects
        var i = g.fx.length;
        while (i--) {
          var e = g.fx[i]; e.l--;
          if (e.l <= 0) { g.fx.splice(i, 1); continue; }
          var a = e.l / e.m;
          if (e.k === 'c') {
            ctx.font = 'bold ' + Math.round(22 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            // ★ Color matches figure type
            ctx.fillStyle = e.fc ? e.fc.replace(')', ',' + a + ')').replace('rgb', 'rgba') : 'rgba(34,197,94,' + a + ')';
            if (!e.fc || e.fc[0] === '#') {
              // Hex color — just use alpha overlay
              ctx.globalAlpha = a;
              ctx.fillStyle = e.fc || '#22c55e';
            }
            ctx.fillText('+' + e.p, e.x, e.y - (e.m - e.l) * 2);
            ctx.globalAlpha = 1;
          } else {
            ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(239,68,68,' + a + ')'; ctx.fillText('✗', e.x, e.y - (e.m - e.l) * 1.2);
          }
        }

        // ★ Miss vignette (red flash around edges)
        if (g.vignetteT > 0) {
          g.vignetteT--;
          var va = (g.vignetteT / 15) * 0.35;
          ctx.fillStyle = 'rgba(239,68,68,' + va + ')';
          ctx.fillRect(0, 0, W, H * 0.04);
          ctx.fillRect(0, H - H * 0.04, W, H * 0.04);
          ctx.fillRect(0, 0, W * 0.03, H);
          ctx.fillRect(W - W * 0.03, 0, W * 0.03, H);
        }
      };

      // ★ Spawn star particles on catch
      const spawnStars = (x, y, color) => {
        var count = 5 + Math.floor(Math.random() * 4);
        if (g.stars.length > 35) count = 3; // cap
        // Parse hex color
        var r2 = 255, g2 = 215, b2 = 0;
        if (color && color[0] === '#') {
          var hx = color.length === 4 ? color[1] + color[1] + color[2] + color[2] + color[3] + color[3] : color.slice(1);
          r2 = parseInt(hx.substring(0, 2), 16) || 255;
          g2 = parseInt(hx.substring(2, 4), 16) || 215;
          b2 = parseInt(hx.substring(4, 6), 16) || 0;
        }
        for (var i = 0; i < count; i++) {
          var ang = Math.random() * 6.28;
          var spd = (1.5 + Math.random() * 2.5) * dpr;
          g.stars.push({
            x: x, y: y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1,
            l: 18 + Math.random() * 10, m: 28, sz: (3 + Math.random() * 4) * dpr,
            cr: r2, cg: g2, cb: b2, rot: Math.random() * 6.28
          });
        }
      };

      // ★ Spawn confetti for new record
      const spawnConfetti = () => {
        var count = 25;
        var colors = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6', '#06b6d4'];
        for (var i = 0; i < count; i++) {
          g.confetti.push({
            x: W * 0.2 + Math.random() * W * 0.6,
            y: -20 - Math.random() * 100,
            vx: (Math.random() - 0.5) * 4 * dpr,
            vy: (1 + Math.random() * 3) * dpr,
            w: (4 + Math.random() * 6) * dpr,
            h: (8 + Math.random() * 10) * dpr,
            rot: Math.random() * 6.28,
            rs: (Math.random() - 0.5) * 0.2,
            c: colors[Math.floor(Math.random() * colors.length)],
            l: 120 + Math.random() * 60, m: 180,
          });
        }
      };

      const drawConfetti = () => {
        var i = g.confetti.length;
        while (i--) {
          var c = g.confetti[i]; c.l--; c.x += c.vx; c.y += c.vy; c.rot += c.rs;
          if (c.l <= 0 || c.y > H + 50) { g.confetti.splice(i, 1); continue; }
          ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
          ctx.fillStyle = c.c;
          ctx.globalAlpha = Math.min(1, c.l / 30);
          ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      };

      // ═══ HUD ═══
      const drawHUD = () => {
        var p = W * 0.02, fs = Math.round(W * 0.038), hh = fs * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(p, p, W - p * 2, hh);
        var my = p + hh / 2;
        ctx.font = 'bold ' + fs + 'px sans-serif'; ctx.textBaseline = 'middle';
        ctx.textAlign = 'left'; ctx.fillStyle = '#fbbf24'; ctx.fillText('⭐ ' + g.score, p * 3, my);
        ctx.textAlign = 'center'; ctx.fillStyle = '#93c5fd'; ctx.fillText('Ур.' + g.lvl, W / 2, my);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fca5a5';
        var h = ''; for (var i = 0; i < 3; i++) h += i < g.lives ? '❤' : '♡';
        ctx.fillText(h, W - p * 3, my);
        ctx.font = Math.round(fs * 0.55) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText('💨 ' + (g.wdir > 0 ? '→' : '←'), W / 2, p + hh + fs * 0.5);
      };

      // ═══ Rounded rect helper ═══
      const rRect = (x, y, w, h2, r, col) => {
        ctx.fillStyle = col; ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h2 - r); ctx.arcTo(x + w, y + h2, x + w - r, y + h2, r);
        ctx.lineTo(x + r, y + h2); ctx.arcTo(x, y + h2, x, y + h2 - r, r);
        ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.fill();
      };

      // ═══ BLOCK 2.5 — Enhanced Menu screen ═══
      const drawMenu = () => {
        drawBg(); drawTable();

        // ★ Animated preview figures falling in background
        if (g.menuItems.length < 3 && g.f % 90 === 0) {
          var tp = TPS[Math.floor(Math.random() * TPS.length)];
          var mbs = Math.max(W, H) * 0.05;
          g.menuItems.push({
            t: tp.t, c: tp.c, s: mbs, x: GX + GW * 0.15 + Math.random() * GW * 0.7,
            y: H * 0.25, vy: 0.5 * dpr, rot: Math.random() * 360, rs: (Math.random() - 0.5) * 1.5,
          });
        }
        for (var mi = g.menuItems.length - 1; mi >= 0; mi--) {
          var mit = g.menuItems[mi]; mit.y += mit.vy; mit.rot += mit.rs;
          if (mit.y > H * 0.7) { g.menuItems.splice(mi, 1); continue; }
          ctx.globalAlpha = 0.35; drawFig(mit); ctx.globalAlpha = 1;
        }

        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
        var cw = Math.min(W * 0.88, 480 * dpr), ch = Math.min(H * 0.78, 620 * dpr);
        var cx = (W - cw) / 2, cy = (H - ch) / 2;
        rRect(cx, cy, cw, ch, 18, '#fff');
        var mid = W / 2, yy = cy + 22 * dpr;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = Math.round(36 * dpr) + 'px serif'; ctx.fillStyle = '#333'; ctx.fillText('🌊🐦💨', mid, yy); yy += 48 * dpr;
        ctx.font = 'bold ' + Math.round(19 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937'; ctx.fillText('Ветер на набережной', mid, yy); yy += 28 * dpr;
        ctx.font = Math.round(11 * dpr) + 'px sans-serif'; ctx.fillStyle = '#6b7280';
        ctx.fillText('Ветер сдувает товар со стола!', mid, yy); yy += 16 * dpr;
        ctx.fillText('Двигай палец и лови фигурки!', mid, yy); yy += 26 * dpr;
        ctx.textAlign = 'left'; var col = cx + cw * 0.1;
        var info = ['🐦 Птички — 10 очк', '🧌 Йети — 20 очк', '🦈 Акула / 🦎 Ящерка — 15', '🐙🧸 Другие — 12 очк', '❤️ 3 жизни, промах = −1'];
        for (var i = 0; i < info.length; i++) { ctx.fillStyle = '#374151'; ctx.fillText(info[i], col, yy); yy += 17 * dpr; }
        yy += 8 * dpr;
        if (g.hs > 0) { ctx.textAlign = 'center'; ctx.font = 'bold ' + Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#d97706'; ctx.fillText('🏆 Рекорд: ' + g.hs, mid, yy); yy += 24 * dpr; }

        // ★ Buttons: Start, Leaderboard, Levels
        var bw = cw * 0.65, bh = 42 * dpr, bx = mid - bw / 2;
        var btnY = cy + ch - bh * 3.6 - 12 * dpr;

        // Start button with gradient-like hover
        var isHoverStart = g.hoverBtn === 'start';
        rRect(bx, btnY, bw, bh, 14, isHoverStart ? '#0e7490' : '#0891b2');
        ctx.font = 'bold ' + Math.round(15 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText('▶  Начать игру', mid, btnY + bh / 2);
        g.mb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
        btnY += bh + 8 * dpr;

        // ★ Leaderboard button
        var isHoverLb = g.hoverBtn === 'lb';
        rRect(bx, btnY, bw, bh, 14, isHoverLb ? '#d97706' : '#f59e0b');
        ctx.fillStyle = '#fff'; ctx.fillText('🏆  Таблица', mid, btnY + bh / 2);
        g.lbb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
        btnY += bh + 8 * dpr;

        // ★ Level select button
        var isHoverLvl = g.hoverBtn === 'lvl';
        rRect(bx, btnY, bw, bh, 14, isHoverLvl ? '#7c3aed' : '#8b5cf6');
        ctx.fillStyle = '#fff'; ctx.fillText('⚡  Уровни', mid, btnY + bh / 2);
        g.lvlb = { x: bx / dpr, y: btnY / dpr, w: bw / dpr, h: bh / dpr };
      };

      // ═══ BLOCK 3.1 — Leaderboard screen ═══
      const drawLeaderboard = () => {
        drawBg();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
        var cw = Math.min(W * 0.92, 500 * dpr), ch = Math.min(H * 0.82, 640 * dpr);
        var cx = (W - cw) / 2, cy = (H - ch) / 2;
        rRect(cx, cy, cw, ch, 18, '#fff');
        var mid = W / 2, yy = cy + 18 * dpr;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = 'bold ' + Math.round(20 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937';
        ctx.fillText('🏆 Таблица рекордов', mid, yy); yy += 36 * dpr;

        if (g.lbLoading || !g.lb) {
          ctx.font = Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
          ctx.fillText('Загрузка...', mid, yy);
        } else {
          // Sort by score
          var entries = [];
          try {
            Object.keys(g.lb).forEach(function(k) {
              var v = g.lb[k];
              if (v && typeof v.score === 'number') entries.push({ login: k, score: v.score, date: v.date || '', level: v.level || 1 });
            });
          } catch (e) { /* silent */ }
          entries.sort(function(a, b) { return b.score - a.score; });
          var top10 = entries.slice(0, 10);

          var auth2 = {};
          try { auth2 = JSON.parse(localStorage.getItem('likebird-auth') || '{}'); } catch (e) { /* silent */ }
          var myLogin = auth2.login || '';

          if (top10.length === 0) {
            ctx.font = Math.round(13 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
            ctx.fillText('Пока нет записей', mid, yy);
          } else {
            var rowH = Math.min(36 * dpr, (ch - 120 * dpr) / 10);
            var colL = cx + cw * 0.08, colR = cx + cw * 0.92;
            for (var li = 0; li < top10.length; li++) {
              var e2 = top10[li];
              var ry = yy + li * rowH;
              // Highlight current player
              if (e2.login === myLogin) {
                ctx.fillStyle = 'rgba(251,191,36,0.15)';
                ctx.fillRect(cx + 8, ry - 2, cw - 16, rowH - 2);
              }
              ctx.font = 'bold ' + Math.round(12 * dpr) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
              ctx.fillStyle = li < 3 ? '#d97706' : '#4b5563';
              var medal = li === 0 ? '🥇' : li === 1 ? '🥈' : li === 2 ? '🥉' : (li + 1) + '.';
              ctx.fillText(medal + ' ' + e2.login, colL, ry + 2);
              ctx.textAlign = 'right'; ctx.fillStyle = '#1f2937';
              ctx.fillText(e2.score + ' очк  Ур.' + e2.level, colR, ry + 2);
              ctx.font = Math.round(9 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af';
              ctx.fillText(e2.date, colR, ry + 16 * dpr);
            }
          }
        }
        // Back button
        var bw = cw * 0.5, bh = 40 * dpr, bx = mid - bw / 2, by = cy + ch - bh - 14 * dpr;
        rRect(bx, by, bw, bh, 13, '#6b7280');
        ctx.font = 'bold ' + Math.round(14 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText('← Назад', mid, by + bh / 2);
        g.backb = { x: bx / dpr, y: by / dpr, w: bw / dpr, h: bh / dpr };
      };

      // ═══ BLOCK 3.2 — Level select screen ═══
      const drawLevelSelect = () => {
        drawBg();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
        var cw = Math.min(W * 0.92, 500 * dpr), ch = Math.min(H * 0.85, 680 * dpr);
        var cx = (W - cw) / 2, cy = (H - ch) / 2;
        rRect(cx, cy, cw, ch, 18, '#fff');
        var mid = W / 2, yy = cy + 18 * dpr;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937';
        ctx.fillText('⚡ Выбор уровня', mid, yy); yy += 34 * dpr;

        var maxLevel = parseInt(localStorage.getItem('likebird-max-level') || '1');
        var cols2 = 5, rows2 = 10, totalLvls = 50;
        var pad = cw * 0.06;
        var cellW = (cw - pad * 2) / cols2;
        var cellH = Math.min(cellW, (ch - 100 * dpr) / rows2);
        var gridW = cellW * cols2, gridX = cx + (cw - gridW) / 2;

        g._lvlBtns = [];
        for (var lv = 1; lv <= totalLvls; lv++) {
          var row = Math.floor((lv - 1) / cols2);
          var colI = (lv - 1) % cols2;
          var lx = gridX + colI * cellW + 3;
          var ly = yy + row * cellH + 3;
          var lw = cellW - 6, lh = cellH - 6;
          var unlocked = lv <= maxLevel;

          rRect(lx, ly, lw, lh, 8, unlocked ? '#8b5cf6' : '#d1d5db');
          ctx.font = 'bold ' + Math.round(11 * dpr) + 'px sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = unlocked ? '#fff' : '#9ca3af';
          ctx.fillText(unlocked ? '' + lv : '🔒', lx + lw / 2, ly + lh / 2);

          if (unlocked) g._lvlBtns.push({ lvl: lv, x: lx / dpr, y: ly / dpr, w: lw / dpr, h: lh / dpr });
        }

        // Back button
        var bw = cw * 0.5, bh = 40 * dpr, bx = mid - bw / 2, by = cy + ch - bh - 14 * dpr;
        rRect(bx, by, bw, bh, 13, '#6b7280');
        ctx.font = 'bold ' + Math.round(14 * dpr) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText('← Назад', mid, by + bh / 2);
        g.backb = { x: bx / dpr, y: by / dpr, w: bw / dpr, h: bh / dpr };
      };

      // ═══ Game over screen (enhanced) ═══
      const drawOver = () => {
        drawBg();
        // ★ Draw confetti
        drawConfetti();

        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
        var cw = Math.min(W * 0.85, 440 * dpr), ch = Math.min(H * 0.58, 460 * dpr);
        var cx = (W - cw) / 2, cy = (H - ch) / 2;
        rRect(cx, cy, cw, ch, 18, '#fff');
        var mid = W / 2, yy = cy + 18 * dpr;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = Math.round(34 * dpr) + 'px serif'; ctx.fillStyle = '#333'; ctx.fillText(g.nr ? '🎉🏆🎉' : '💨😅', mid, yy); yy += 45 * dpr;
        ctx.font = 'bold ' + Math.round(18 * dpr) + 'px sans-serif'; ctx.fillStyle = '#1f2937'; ctx.fillText(g.nr ? 'Новый рекорд!' : 'Ветер победил!', mid, yy); yy += 32 * dpr;
        var sw = 150 * dpr, sh = 52 * dpr, sx = mid - sw / 2;
        rRect(sx, yy, sw, sh, 12, g.nr ? '#eab308' : '#f59e0b');
        ctx.font = 'bold ' + Math.round(24 * dpr) + 'px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('' + g.score, mid, yy + sh / 2);
        yy += sh + 14 * dpr; ctx.textBaseline = 'top';
        if (!g.nr && g.hs > 0) { ctx.font = Math.round(11 * dpr) + 'px sans-serif'; ctx.fillStyle = '#9ca3af'; ctx.fillText('Лучший: ' + g.hs, mid, yy); }
        var bw = cw * 0.6, bh = 44 * dpr, bx = mid - bw / 2;
        var b1y = cy + ch - bh * 2.2 - 8 * dpr;
        rRect(bx, b1y, bw, bh, 13, '#0891b2');
        ctx.font = 'bold ' + Math.round(15 * dpr) + 'px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('🔄  Ещё раз', mid, b1y + bh / 2);
        g.rb = { x: bx / dpr, y: b1y / dpr, w: bw / dpr, h: bh / dpr };
        var b2y = b1y + bh + 8 * dpr;
        rRect(bx, b2y, bw, bh, 13, '#f0f0f0');
        ctx.fillStyle = '#666'; ctx.fillText('На главную', mid, b2y + bh / 2);
        g.hb = { x: bx / dpr, y: b2y / dpr, w: bw / dpr, h: bh / dpr };
      };

      // ═══ BLOCK 1.1 — Adaptive spawn ═══
      const spawn = () => {
        var tp = TPS[Math.floor(Math.random() * TPS.length)];
        // ★ Adaptive size relative to game field
        var baseSize = Math.max(GW, H) * 0.072;
        var sz = baseSize * (0.85 + Math.random() * 0.35);
        var margin = sz * 0.6;
        g.items.push({
          t: tp.t, c: tp.c, p: tp.p, s: sz, fc: tp.fc,
          // ★ BLOCK 1.2 — X within game field
          x: GX + margin + Math.random() * (GW - margin * 2),
          y: H * 0.17 + H * 0.06 + 2,
          vx: g.wdir * (0.15 + Math.random() * 0.4) * dpr,
          vy: (1.3 + Math.random() * 1.0 + g.lvl * 0.15) * dpr,
          rot: Math.random() * 360,
          rs: (Math.random() - 0.5) * 2.5,
        });
      };

      // ═══ Update gameplay ═══
      const update = () => {
        g.f++;
        // Wind changes
        g.wt++;
        if (g.wt > 250 + Math.random() * 300) { g.wt = 0; g.wdir = Math.random() > 0.5 ? 1 : -1; g.wind = 0.8 + Math.random() * 1.0 + g.lvl * 0.2; }
        // Spawn
        g.st++;
        if (g.st >= g.sr) { g.st = 0; spawn(); }
        // Dust particles
        if (g.f % 6 === 0 && g.dust.length < 50) g.dust.push({ x: g.wdir > 0 ? GX - 5 : GX + GW + 5, y: Math.random() * H * 0.6, vx: g.wdir * (2 + Math.random() * 2 + g.wind) * dpr, vy: 0.3 * dpr, l: 50 + Math.random() * 30, m: 80, z: 1 + Math.random() * 1.5 });
        var i = g.dust.length; while (i--) { var p = g.dust[i]; p.x += p.vx; p.y += p.vy; p.l--; if (p.l <= 0 || p.x < GX - 20 || p.x > GX + GW + 20) g.dust.splice(i, 1); }

        // ★ Catcher animation updates
        if (g.catchScaleT > 0) {
          g.catchScaleT--;
          var progress = 1 - g.catchScaleT / 10;
          g.catchScale = progress < 0.5 ? 1 + 0.15 * (progress * 2) : 1 + 0.15 * (1 - (progress - 0.5) * 2);
          if (g.catchScaleT <= 0) g.catchScale = 1;
        }
        if (g.shakeT > 0) {
          g.shakeT--;
          g.shakeX = (g.shakeT % 2 === 0 ? 5 : -5) * dpr * (g.shakeT / 6);
          if (g.shakeT <= 0) g.shakeX = 0;
        }

        // Items physics — ★ use GW/GX for bounds
        var ccx = GX + g.tx * GW, hw = CATCH_HW(), cy = CATCH_Y(), ch = H * 0.055, dy = DEATH_Y();
        var margin2 = GX + 30 * dpr;
        var marginR = GX + GW - 30 * dpr;

        i = g.items.length;
        while (i--) {
          var it = g.items[i];
          it.x += it.vx + g.wdir * g.wind * 0.1 * dpr;
          it.y += it.vy;
          it.rot += it.rs;

          // ★ Clamp to game field bounds
          if (it.x < margin2) { it.x = margin2; it.vx = Math.abs(it.vx) * 0.5; }
          if (it.x > marginR) { it.x = marginR; it.vx = -Math.abs(it.vx) * 0.5; }

          // Check catch
          if (it.y >= cy - it.s * 0.5 && it.y <= cy + ch + it.s * 0.3) {
            if (Math.abs(it.x - ccx) < hw + it.s * 0.3) {
              g.score += it.p;
              g.fx.push({ k: 'c', x: it.x, y: it.y, p: it.p, l: 28, m: 28, fc: it.fc || it.c });
              // ★ Star particles on catch
              spawnStars(it.x, it.y, it.fc || it.c);
              // ★ Catcher scale animation
              g.catchScaleT = 10;
              g.items.splice(i, 1);
              continue;
            }
          }

          // Hit death line = miss
          if (it.y > dy) {
            g.lives--;
            g.fx.push({ k: 'm', x: it.x, y: dy, l: 22, m: 22 });
            // ★ Red vignette on miss
            g.vignetteT = 15;
            // ★ Catcher shake on miss
            g.shakeT = 6;
            g.items.splice(i, 1);
            continue;
          }
        }

        // ★ Level up — save max level
        var nl = Math.floor(g.score / 80) + 1;
        if (nl > g.lvl) {
          g.lvl = nl;
          g.sr = Math.max(40, 110 - g.lvl * 8);
          try {
            var saved = parseInt(localStorage.getItem('likebird-max-level') || '1');
            if (nl > saved) localStorage.setItem('likebird-max-level', '' + nl);
          } catch (e) { /* silent */ }
        }

        // Game over
        if (g.lives <= 0) {
          g.phase = 'over';
          g.nr = g.score > g.hs;
          if (g.nr) {
            g.hs = g.score;
            try { localStorage.setItem('likebird-game-highscore', '' + g.score); } catch (e) { /* silent */ }
            // ★ Confetti for new record
            spawnConfetti();
            // ★ BLOCK 3.1 — Save to leaderboard
            try {
              var auth3 = JSON.parse(localStorage.getItem('likebird-auth') || '{}');
              var login2 = auth3.login || 'Аноним';
              fbSave('likebird-game-leaderboard/' + login2, {
                score: g.score,
                date: new Date().toLocaleDateString('ru-RU'),
                level: g.lvl
              });
            } catch (e) { /* silent */ }
          }
        }
      };

      // ═══ Reset ═══
      const reset = () => {
        g.phase = 'play'; g.items = []; g.fx = []; g.dust = []; g.stars = []; g.confetti = [];
        g.score = 0; g.lives = 3; g.lvl = g.startLvl || 1;
        g.wind = 0.8 + (g.lvl - 1) * 0.15; g.wdir = 1; g.wt = 0;
        g.st = 0; g.sr = Math.max(40, 110 - g.lvl * 8); g.f = 0; g.nr = false;
        g.score = (g.lvl - 1) * 80;
        g.catchScale = 1; g.catchScaleT = 0; g.shakeX = 0; g.shakeT = 0; g.vignetteT = 0;
        g.startLvl = 1;
      };

      // ★ BLOCK 3.2 — Reset to specific level
      const resetToLevel = (lvl) => {
        g.startLvl = lvl;
        g.phase = 'play'; g.items = []; g.fx = []; g.dust = []; g.stars = []; g.confetti = [];
        g.score = (lvl - 1) * 80;
        g.lives = 3; g.lvl = lvl;
        g.wind = 0.8 + lvl * 0.15; g.wdir = 1; g.wt = 0;
        g.st = 0; g.sr = Math.max(40, 110 - lvl * 8); g.f = 0; g.nr = false;
        g.catchScale = 1; g.catchScaleT = 0; g.shakeX = 0; g.shakeT = 0; g.vignetteT = 0;
      };

      // ═══ MAIN LOOP — with try-catch safety net ═══
      var raf = 0;
      const loop = () => {
        if (!g.run) { return; }
        try {
          if (W < 2 || H < 2) { doResize(); }
          ctx.clearRect(0, 0, W, H);
          if (g.phase === 'menu') { drawMenu(); }
          else if (g.phase === 'play') { update(); drawBg(); drawTable(); drawDeathLine(); drawDust(); for (var i = 0; i < g.items.length; i++) drawFig(g.items[i]); drawCatcher(); drawFx(); drawHUD(); }
          else if (g.phase === 'over') { drawOver(); }
          else if (g.phase === 'leaderboard') { drawLeaderboard(); }
          else if (g.phase === 'levelselect') { drawLevelSelect(); }
        } catch(err) {
          try { console.error('Game render error:', err); } catch (e2) { /* silent */ }
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      // ═══ Input ═══
      var getP = function(e) { var r = canvas.getBoundingClientRect(); var t = e.touches ? (e.touches[0] || e.changedTouches[0]) : e; if (!t) return null; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
      var hit = function(b, p) { return b && p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; };

      var onDown = function(e) {
        e.preventDefault();
        var p = getP(e); if (!p) return;
        if (g.phase === 'menu') {
          if (hit(g.mb, p)) reset();
          else if (hit(g.lbb, p)) { g.phase = 'leaderboard'; /* Refresh leaderboard */ try { fbGet('likebird-game-leaderboard').then(function(d) { g.lb = d || {}; }).catch(function() {}); } catch (e2) { /* silent */ } }
          else if (hit(g.lvlb, p)) { g.phase = 'levelselect'; }
        }
        else if (g.phase === 'over') {
          if (hit(g.rb, p)) reset();
          else if (hit(g.hb, p)) { g.run = false; setCurrentView('menu'); }
        }
        else if (g.phase === 'play') {
          var r = canvas.getBoundingClientRect();
          g.tx = Math.max(0.02, Math.min(0.98, (p.x - GX / dpr) / (GW / dpr)));
        }
        else if (g.phase === 'leaderboard') {
          if (hit(g.backb, p)) { g.phase = 'menu'; }
        }
        else if (g.phase === 'levelselect') {
          if (hit(g.backb, p)) { g.phase = 'menu'; }
          else if (g._lvlBtns) {
            for (var li = 0; li < g._lvlBtns.length; li++) {
              if (hit(g._lvlBtns[li], p)) { resetToLevel(g._lvlBtns[li].lvl); break; }
            }
          }
        }
      };

      var onMv = function(e) {
        e.preventDefault();
        var r = canvas.getBoundingClientRect();
        var t = e.touches ? e.touches[0] : e;
        if (!t) return;
        if (g.phase === 'play') {
          g.tx = Math.max(0.02, Math.min(0.98, (t.clientX - r.left - GX / dpr) / (GW / dpr)));
        }
        // ★ Hover detection for desktop
        if (g.phase === 'menu' && !e.touches) {
          var mp = { x: t.clientX - r.left, y: t.clientY - r.top };
          if (hit(g.mb, mp)) g.hoverBtn = 'start';
          else if (hit(g.lbb, mp)) g.hoverBtn = 'lb';
          else if (hit(g.lvlb, mp)) g.hoverBtn = 'lvl';
          else g.hoverBtn = null;
        }
      };

      canvas.addEventListener('touchstart', onDown, { passive: false });
      canvas.addEventListener('touchmove', onMv, { passive: false });
      canvas.addEventListener('mousedown', onDown);
      canvas.addEventListener('mousemove', onMv);
      window.addEventListener('resize', doResize);

      return function() {
        g.run = false; cancelAnimationFrame(raf);
        canvas.removeEventListener('touchstart', onDown);
        canvas.removeEventListener('touchmove', onMv);
        canvas.removeEventListener('mousedown', onDown);
        canvas.removeEventListener('mousemove', onMv);
        window.removeEventListener('resize', doResize);
        try { if (box.contains(canvas)) box.removeChild(canvas); } catch (e) { /* silent */ }
      };
    }, []);

    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col" style={{touchAction:'none',userSelect:'none',WebkitUserSelect:'none'}}>
        <div className="bg-gradient-to-r from-cyan-600 to-sky-700 text-white p-2 flex items-center gap-3 shrink-0 z-10" style={{paddingTop:"max(0.5rem, env(safe-area-inset-top))"}}>
          <button onClick={handleBack} className="p-1"><ArrowLeft className="w-5 h-5" /></button>
          <span className="font-bold text-sm">🌊 Ветер на набережной</span>
        </div>
        <div ref={containerRef} className="flex-1 relative" />
      </div>
    );
  };

  const SettingsView = () => (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
      <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 sticky top-0 z-10 safe-area-top">
        <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
        <h2 className="text-xl font-bold">⚙️ Настройки</h2>
      </div>
      <div className="max-w-md mx-auto px-4 mt-4 space-y-4">
        {/* Онлайн-статус */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'Онлайн' : 'Оффлайн — данные сохраняются локально'}
        </div>

        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Info className="w-5 h-5 text-blue-500" />Статистика</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Всего продаж:</span><span className="font-semibold">{reports.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Всего расходов:</span><span className="font-semibold">{expenses.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Дней с записями:</span><span className="font-semibold">{getAllDates().length}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">ID устройства:</span><span className="font-semibold text-xs">{SyncManager.getSyncId()}</span></div>
          </div>
        </div>

        {/* Установка PWA */}
        {(deferredPrompt || showInstallBanner) && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone className="w-8 h-8" />
              <div>
                <h3 className="font-bold">Установите приложение</h3>
                <p className="text-xs text-white/80">Работайте оффлайн, быстрый доступ с рабочего стола</p>
              </div>
            </div>
            <button onClick={async () => {
              if (deferredPrompt) {
                deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice.outcome === 'accepted') { showNotification('Приложение установлено!'); }
                setDeferredPrompt(null); setShowInstallBanner(false);
              }
            }} className="w-full py-3 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50">
              📲 Установить на устройство
            </button>
          </div>
        )}

        {/* BLOCK 9: Dark Mode Toggle */}
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-3 flex items-center gap-2">🎨 Тема оформления</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Тёмная тема</span>
            <button onClick={() => setDarkMode(!darkMode)} className={`relative w-14 h-7 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 ${darkMode ? 'right-0.5' : 'left-0.5'} w-6 h-6 bg-white rounded-full shadow transition-all flex items-center justify-center text-sm`}>
                {darkMode ? '🌙' : '☀️'}
              </span>
            </button>
          </div>
        </div>

        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="w-5 h-5 text-green-500" />Экспорт данных</h3>
          <p className="text-sm text-gray-500 mb-3">Полный бэкап всех данных приложения</p>
          <button onClick={exportData} className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 mb-2">📥 Скачать полный бэкап</button>
          <button onClick={() => {
            const BOM = '\uFEFF';
            // Reports CSV
            const exportReports = filterEmployee ? reports.filter(r => r.employee === filterEmployee) : reports;
            const reportHeaders = 'Дата;Сотрудник;Товар;Категория;Количество;Цена;Сумма;Чаевые;ЗП;Тип оплаты';
            const reportRows = exportReports.map(r => [
              r.date?.split(',')[0] || '', r.employee || '', getProductName(r.product), r.category || '',
              r.quantity || 1, r.salePrice || 0, r.total || 0, r.tips || 0,
              getEffectiveSalary(r), r.paymentType === 'cashless' ? 'Безнал' : 'Наличные'
            ].join(';'));
          const reportsCSV = BOM + reportHeaders + '\n' + reportRows.join('\n');
            const blob1 = new Blob(['\uFEFF' + reportsCSV], { type: 'text/csv;charset=utf-8' });
            const url1 = URL.createObjectURL(blob1);
            const a1 = document.createElement('a'); a1.href = url1; a1.download = `reports-${formatDate(new Date())}.csv` // Разделитель ; для Excel, для Google Sheets откройте и выберите ';'; a1.click();
            URL.revokeObjectURL(url1);
            // Stock CSV
            const stockHeaders = 'Товар;Категория;Количество;Мин. остаток;Цена';
            const stockRows = Object.entries(stock).map(([name, data]) => [
              name, data.category || '', data.count || 0, data.minStock || 3, data.price || 0
            ].join(';'));
            const stockCSV = BOM + stockHeaders + '\n' + stockRows.join('\n');
            const blob2 = new Blob(['\uFEFF' + stockCSV], { type: 'text/csv;charset=utf-8' });
            const url2 = URL.createObjectURL(blob2);
            const a2 = document.createElement('a'); a2.href = url2; a2.download = `stock-${formatDate(new Date())}.csv`; a2.click();
            URL.revokeObjectURL(url2);
            showNotification('📊 CSV файлы скачаны');
          }} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">📊 Экспорт CSV (отчёты + остатки)</button>
        </div>

        <div className="bg-white rounded-xl p-4 shadow border-2 border-blue-100">
          <h3 className="font-bold mb-1 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-500" />Восстановление из бэкапа</h3>
          <p className="text-xs text-gray-500 mb-1">Загрузите файл <code className="bg-gray-100 px-1 rounded">.json</code> — данные запишутся и в Firebase, и в локальное хранилище.</p>
          <p className="text-xs text-amber-600 mb-3">⚠️ Существующие данные в Firebase будут перезаписаны ключами из файла!</p>
          <label className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 flex items-center justify-center gap-2 cursor-pointer shadow">
            📤 Загрузить бэкап (JSON)
            <input type="file" accept=".json" onChange={(e) => { if (e.target.files[0]) importData(e.target.files[0]); }} className="hidden" />
          </label>
          <p className="text-xs text-gray-400 mt-2 text-center">После загрузки страница перезагрузится автоматически</p>
        </div>

        {/* Уведомления */}
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-3 flex items-center gap-2"><Bell className="w-5 h-5 text-purple-500" />🔔 Уведомления</h3>
          {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
            <button onClick={() => Notification.requestPermission().then(p => { if (p === 'granted') showNotification('Уведомления включены!'); })} className="w-full py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 mb-3">
              🔔 Разрешить push-уведомления
            </button>
          )}
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">⏰ Напоминание об открытии смены (после 10:00)</span>
              <input type="checkbox" checked={notifSettings.shiftReminder} onChange={(e) => {
                const updated = { ...notifSettings, shiftReminder: e.target.checked };
                setNotifSettings(updated);
                save('likebird-notif-settings', updated);
              }} className="w-5 h-5 accent-purple-500" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">⚠️ Уведомление о низком остатке товара</span>
              <input type="checkbox" checked={notifSettings.lowStockAlert} onChange={(e) => {
                const updated = { ...notifSettings, lowStockAlert: e.target.checked };
                setNotifSettings(updated);
                save('likebird-notif-settings', updated);
              }} className="w-5 h-5 accent-purple-500" />
            </label>
            {notifSettings.lowStockAlert && (
              <div className="flex items-center gap-2 pl-2">
                <span className="text-xs text-gray-500">Порог остатка:</span>
                <input type="number" value={notifSettings.stockThreshold} onChange={(e) => {
                  const updated = { ...notifSettings, stockThreshold: parseInt(e.target.value) || 3 };
                  setNotifSettings(updated);
                  save('likebird-notif-settings', updated);
                }} className="w-20 p-1.5 border rounded text-sm text-center" min="1" max="50" />
                <span className="text-xs text-gray-500">шт</span>
              </div>
            )}
          </div>
        </div>

        {/* Аккаунт */}
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h3 className="font-bold mb-3 flex items-center gap-2"><LogOut className="w-5 h-5 text-orange-500" />Аккаунт</h3>
          <p className="text-sm text-gray-500 mb-3">Вы вошли как: <strong>{authName || employeeName || 'Пользователь'}</strong></p>
          <button onClick={() => {
            localStorage.removeItem('likebird-auth');
            setIsAuthenticated(false);
            setCurrentView('menu');
            showNotification('Вы вышли из аккаунта');
          }} className="w-full py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600">🚪 Выйти</button>
        </div>

        <p className="text-center text-gray-400 text-xs pb-4">LikeBird v{APP_VERSION} • PWA Ready</p>
      </div>
    </div>
  );

  const TextImportView = () => {
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
      const product = findProductByPrice(newName, sale.price);
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
  };

  const NewReportView = () => {
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
    );
  };

  const CatalogView = () => {
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
  };

  const StockView = () => {
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
        return findProductByPrice(t, 500);
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
  };

  const ReportsView = () => {
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
  };

  const DayReportView = () => {
    const dates = getAllDates();
    const dateReports = getReportsByDate(selectedDate);
    const dateExpenses = getExpensesByDate(selectedDate);
    const idx = dates.indexOf(selectedDate);
    const byEmployee = dateReports.reduce((acc, r) => { if (!acc[r.employee]) acc[r.employee] = []; acc[r.employee].push(r); return acc; }, {});
    const expByEmp = dateExpenses.reduce((acc, e) => { if (!acc[e.employee]) acc[e.employee] = []; acc[e.employee].push(e); return acc; }, {});
    const dayTotal = dateReports.reduce((s, r) => s + r.total, 0);
    const dayCash = dateReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
    const dayCashless = dateReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
    const dayTips = dateReports.reduce((s, r) => s + (r.tips || 0), 0);
    const daySalary = dateReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
    const dayExpenses = dateExpenses.reduce((s, e) => s + e.amount, 0);
    
    // Редактирование смены
    const [editingShift, setEditingShift] = useState(null); // login сотрудника
    const [editOpen, setEditOpen] = useState('');
    const [editClose, setEditClose] = useState('');
    
    // Админ: добавление продажи за сотрудника
    const [adminReport, setAdminReport] = useState(null); // { employee: string } или null
    const [arProduct, setArProduct] = useState(null);
    const [arPrice, setArPrice] = useState('');
    const [arTips, setArTips] = useState('0');
    const [arPayment, setArPayment] = useState('cash');
    const [arQty, setArQty] = useState(1);
    const [arSearch, setArSearch] = useState('');
    const [arLocation, setArLocation] = useState('');
    const [arDiscount, setArDiscount] = useState('');
    
    const activeEmployeesList = employees.filter(e => e.active);
    
    const adminSaveReport = () => {
      if (!adminReport?.employee) { showNotification('Выберите сотрудника', 'error'); return; }
      if (!arProduct) { showNotification('Выберите товар', 'error'); return; }
      const price = parseInt(arPrice, 10);
      if (!price || price <= 0) { showNotification('Введите цену', 'error'); return; }
      // Формируем дату: если выбрана дата не сегодня, используем её
      const today = new Date().toLocaleDateString('ru-RU');
      const customDate = selectedDate !== today ? (selectedDate + ', ' + new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })) : null;
      saveReport({
        employeeName: adminReport.employee,
        selectedProduct: arProduct,
        selectedCategory: arProduct.category,
        salePrice: price,
        tipsAmount: parseInt(arTips, 10) || 0,
        paymentType: arPayment,
        quantity: arQty,
        location: arLocation || null,
        discountReason: arDiscount || null,
        photo: null,
        customDate: customDate,
        noRedirect: true,
        addedBy: employeeName || 'Админ',
      });
      showNotification(`Продажа ${arProduct.name} добавлена за ${adminReport.employee}`);
      setAdminReport(null); setArProduct(null); setArPrice(''); setArTips('0');
      setArPayment('cash'); setArQty(1); setArSearch(''); setArDiscount('');
    };
    
    const AdminReportModal = () => {
      if (!adminReport) return null;
      const filteredProds = arSearch.length >= 1
        ? DYNAMIC_ALL_PRODUCTS.filter(p => !(archivedProducts||[]).includes(p.name))
            .filter(p => p.name.toLowerCase().includes(arSearch.toLowerCase()) || p.aliases?.some(a => a.includes(arSearch.toLowerCase())))
            .slice(0, 8)
        : [];
      const isBelowBase = arProduct && arPrice && parseInt(arPrice, 10) < arProduct.price;
      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdminReport(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">📝 Продажа за сотрудника</h3>
              <button onClick={() => setAdminReport(null)} className="text-gray-400" aria-label="Закрыть"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Сотрудник</label>
                <select value={adminReport.employee} onChange={e => setAdminReport({ employee: e.target.value })} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                  <option value="">— Выберите —</option>
                  {activeEmployeesList.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Товар</label>
                {arProduct ? (
                  <div className="flex items-center justify-between p-2.5 bg-amber-50 border-2 border-amber-200 rounded-xl">
                    <span>{arProduct.emoji} {arProduct.name} — {arProduct.price}₽</span>
                    <button onClick={() => { setArProduct(null); setArPrice(''); setArSearch(''); }} className="text-gray-400"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div>
                    <input type="text" value={arSearch} onChange={e => setArSearch(e.target.value)} placeholder="Поиск товара..." className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                    {filteredProds.length > 0 && (
                      <div className="mt-1 border rounded-xl max-h-40 overflow-y-auto">
                        {filteredProds.map(p => (
                          <button key={p.name} onClick={() => { setArProduct(p); setArPrice(String(p.price)); setArSearch(''); }} className="w-full text-left px-3 py-2 hover:bg-amber-50 text-sm flex justify-between border-b last:border-0">
                            <span>{p.emoji} {p.name}</span>
                            <span className="text-amber-600 font-semibold">{p.price}₽</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Цена продажи</label>
                  <input type="number" value={arPrice} onChange={e => setArPrice(e.target.value)} className={`w-full p-2.5 border-2 rounded-xl focus:outline-none ${isBelowBase ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 focus:border-amber-500'}`} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Чаевые</label>
                  <input type="number" value={arTips} onChange={e => setArTips(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                </div>
              </div>
              
              {isBelowBase && (
                <input type="text" value={arDiscount} onChange={e => setArDiscount(e.target.value)} placeholder="Причина скидки" maxLength={200} className="w-full p-2.5 border-2 border-yellow-300 rounded-xl bg-yellow-50 focus:outline-none" />
              )}
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Оплата</label>
                  <select value={arPayment} onChange={e => setArPayment(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                    <option value="cash">💵 Наличные</option>
                    <option value="cashless">💳 Безнал</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Кол-во</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setArQty(Math.max(1, arQty - 1))} className="w-10 h-10 bg-gray-100 rounded-xl font-bold text-lg">−</button>
                    <span className="font-bold text-lg flex-1 text-center">{arQty}</span>
                    <button onClick={() => setArQty(arQty + 1)} className="w-10 h-10 bg-gray-100 rounded-xl font-bold text-lg">+</button>
                  </div>
                </div>
              </div>
              
              {locations.filter(l => l.active).length > 1 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Точка продаж</label>
                  <select value={arLocation} onChange={e => setArLocation(e.target.value)} className="w-full p-2.5 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none">
                    <option value="">— Не указана —</option>
                    {locations.filter(l => l.active).map(l => <option key={l.id} value={`${l.city} — ${l.name}`}>{l.city} — {l.name}</option>)}
                  </select>
                </div>
              )}
              
              {arProduct && arPrice && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">ЗП сотрудника:</span><span className="font-bold text-amber-600">{calculateSalary(arProduct.price, parseInt(arPrice,10), arProduct.category, parseInt(arTips,10)||0, 'normal', salarySettings)}₽</span></div>
                  {arQty > 1 && <div className="flex justify-between"><span className="text-gray-500">Итого ({arQty} шт):</span><span className="font-bold">{parseInt(arPrice,10) * arQty}₽</span></div>}
                </div>
              )}
              
              <button onClick={adminSaveReport} disabled={!adminReport.employee || !arProduct || !arPrice} className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                ✅ Сохранить продажу
              </button>
            </div>
          </div>
        </div>
      );
    };
    
    // Получить login сотрудника по имени
    const getLoginByName = (empName) => {
      try {
        const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
        const u = users.find(u => (u.name || u.login) === empName);
        return u?.login || empName;
      } catch { return empName; }
    };
    
    // Получить данные смены сотрудника за выбранную дату
    const getEmployeeShift = (empName) => {
      const login = getLoginByName(empName);
      const key = `${login}_${selectedDate}`;
      return { shift: shiftsData[key] || null, key, login };
    };
    
    // Округление минут до четверти часа (0, 0.25, 0.5, 0.75)
    const roundMinutesToQuarter = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return h + Math.floor(m / 15) * 0.25;
    };
    
    // Форматировать округлённые часы
    const formatRoundedHours = (roundedHours) => {
      if (roundedHours <= 0) return '—';
      if (Number.isInteger(roundedHours)) return `${roundedHours} ч`;
      return `${roundedHours.toFixed(2).replace(/0$/, '')} ч`;
    };
    
    // Посчитать минуты смены
    // Посчитать минуты смены (с поддержкой ночных смен через полночь)
    const getShiftMinutes = (shift) => {
      if (!shift?.openTime || !shift?.closeTime) return 0;
      const [oh, om] = shift.openTime.split(':').map(Number);
      const [ch, cm] = shift.closeTime.split(':').map(Number);
      let mins = (ch * 60 + cm) - (oh * 60 + om);
      if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
      return mins;
    };
    
    // Сохранить отредактированное время смены
    const saveShiftEdit = (empName) => {
      // Валидация
      const openVal = editOpen.trim();
      const closeVal = editClose.trim();
      if (!openVal) { showNotification('Укажите время начала смены', 'error'); return; }
      if (closeVal) {
        // Проверка формата HH:MM
        const timeRe = /^\d{1,2}:\d{2}$/;
        if (!timeRe.test(openVal) || !timeRe.test(closeVal)) { showNotification('Неверный формат времени', 'error'); return; }
      }
      const { key } = getEmployeeShift(empName);
      const existing = shiftsData[key] || {};
      const updated = { 
        ...shiftsData, 
        [key]: { 
          ...existing,
          openTime: openVal, 
          closeTime: closeVal || undefined, 
          status: closeVal ? 'closed' : 'open',
          openedAt: existing.openedAt || Date.now(),
          closedAt: closeVal ? (existing.closedAt || Date.now()) : undefined,
          editedInDayReport: true
        } 
      };
      updateShiftsData(updated);
      setEditingShift(null);
      showNotification('Время смены обновлено');
    };
    
    // Проверка можно ли редактировать (20 минут = 1200000 мс)
    // Администраторы могут редактировать без ограничений
    const EDIT_TIME_LIMIT = 20 * 60 * 1000;
    const isAdminUser = isAdminUnlocked || currentUser?.role === 'admin' || currentUser?.isAdmin;
    const canEdit = (report) => {
      if (isAdminUser) return true; // Админ может редактировать всегда
      if (!report.createdAt) return true;
      return Date.now() - report.createdAt < EDIT_TIME_LIMIT;
    };
    
    const getRemainingTime = (report) => {
      if (!report.createdAt) return null;
      const remaining = EDIT_TIME_LIMIT - (Date.now() - report.createdAt);
      if (remaining <= 0) return null;
      const mins = Math.ceil(remaining / 60000);
      return mins;
    };
    
    // Статус проверки для группы отчётов
    const getReviewStatus = (empReports) => {
      const statuses = empReports.map(r => r.reviewStatus || 'pending');
      if (statuses.every(s => s === 'approved')) return 'approved';
      if (statuses.some(s => s === 'rejected')) return 'rejected';
      if (statuses.some(s => s === 'revision')) return 'revision';
      return 'pending';
    };
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 pb-6">
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white p-4 pt-safe sticky top-0 z-10" style={{paddingTop: "max(1rem, env(safe-area-inset-top))"}}>
          <button onClick={() => setCurrentView('menu')} className="mb-2 mt-1 block"><ArrowLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold">📊 Итог дня</h2>
        </div>
        <div className="max-w-md mx-auto px-4 mt-4 pb-8" style={{scrollMarginTop:"80px"}}>
          <div className="bg-white rounded-xl shadow p-3 flex items-center justify-between mb-4">
            <button onClick={() => navigateDate('prev')} disabled={idx >= dates.length - 1} className={`p-2 rounded-lg ${idx >= dates.length - 1 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronLeft className="w-6 h-6" /></button>
            <div className="text-center"><p className="font-bold">{selectedDate}</p><p className="text-xs text-gray-400">{dateReports.length} продаж</p></div>
            <button onClick={() => navigateDate('next')} disabled={idx <= 0} className={`p-2 rounded-lg ${idx <= 0 ? 'text-gray-300' : 'text-amber-600 hover:bg-amber-50'}`}><ChevronRight className="w-6 h-6" /></button>
          </div>
          {dateReports.length > 0 && (<div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-4 mb-4 shadow-lg"><h3 className="font-bold mb-2">📈 Общий итог</h3><div className="grid grid-cols-2 gap-2 text-sm"><div><span className="opacity-75">Выручка:</span> <span className="font-bold">{dayTotal.toLocaleString()}₽</span></div><div><span className="opacity-75">Наличные:</span> <span className="font-bold">{dayCash.toLocaleString()}₽</span></div><div><span className="opacity-75">Безнал:</span> <span className="font-bold">{dayCashless.toLocaleString()}₽</span></div><div><span className="opacity-75">Чаевые:</span> <span className="font-bold">{dayTips.toLocaleString()}₽</span></div><div><span className="opacity-75">ЗП:</span> <span className="font-bold">{daySalary.toLocaleString()}₽</span></div><div><span className="opacity-75">Расходы:</span> <span className="font-bold">{dayExpenses.toLocaleString()}₽</span></div></div></div>)}
        </div>
        <div className="max-w-md mx-auto px-4 pb-6 space-y-4">
          {Object.entries(byEmployee).map(([emp, empReports]) => {
            const unrec = empReports.filter(r => r.isUnrecognized);
            const belowPrice = empReports.filter(r => !r.isUnrecognized && isBelowBasePrice(r.basePrice, r.salePrice));
            const cashTotal = empReports.reduce((s, r) => s + (r.cashAmount || 0), 0);
            const cashlessTotal = empReports.reduce((s, r) => s + (r.cashlessAmount || 0), 0);
            const totalTips = empReports.reduce((s, r) => s + (r.tips || 0), 0);
            const totalSalary = empReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
            const empExpenses = (expByEmp[emp] || []).reduce((s, e) => s + e.amount, 0);
            const expensesList = expByEmp[emp] || [];
            const given = getGivenToAdmin(emp);
            const grandTotal = cashTotal + cashlessTotal;
            const ownCard = getOwnCard(emp, selectedDate);
            const toGive = ownCard ? (cashTotal + cashlessTotal + totalTips - totalSalary - empExpenses - given) : (cashTotal + totalTips - totalSalary - empExpenses - given);
            const byCat = empReports.filter(r => !r.isUnrecognized).reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + (r.quantity || 1); return acc; }, {});
            const reviewStatus = getReviewStatus(empReports);
            const anyEditable = empReports.some(r => canEdit(r));
            
            return (
              <div key={emp} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold">{emp}</h3>
                        {reviewStatus === 'approved' && <span className="bg-green-400 text-white px-2 py-0.5 rounded text-xs">✓ Проверен</span>}
                        {reviewStatus === 'rejected' && <span className="bg-red-400 text-white px-2 py-0.5 rounded text-xs">✗ Ошибки</span>}
                        {reviewStatus === 'revision' && <span className="bg-orange-300 text-white px-2 py-0.5 rounded text-xs">↻ Доработать</span>}
                      </div>
                      <p className="text-white/80 text-xs">{empReports.length} продаж{Object.entries(byCat).map(([cat, cnt]) => (<span key={cat} className="ml-2">{CAT_ICONS[cat]}{cnt}</span>))}</p>
                    </div>
                    <button onClick={() => copyDayReport(emp, empReports, { cashTotal, cashlessTotal, totalTips, totalSalary, empExpenses, toGive })} className="bg-white/20 p-1.5 rounded hover:bg-white/30" title="Скопировать"><Copy className="w-4 h-4" /></button>
                    {isAdminUser && <button onClick={() => setAdminReport({ employee: emp })} className="bg-white/20 p-1.5 rounded hover:bg-white/30" title="Добавить продажу"><Plus className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  {/* Время смены */}
                  {(() => {
                    const { shift, login } = getEmployeeShift(emp);
                    const mins = getShiftMinutes(shift);
                    const roundedHours = roundMinutesToQuarter(mins);
                    const salesCount = empReports.length;
                    const speed = roundedHours > 0 ? parseFloat((salesCount / roundedHours).toFixed(2)) : 0;
                    const isEditing = editingShift === login;
                    
                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-blue-700">⏱️ Время работы</span>
                          {!isEditing && (
                            <button onClick={() => {
                              setEditingShift(login);
                              setEditOpen(shift?.openTime || '');
                              setEditClose(shift?.closeTime || '');
                            }} className="text-xs text-blue-500 hover:text-blue-700 underline">
                              {shift?.openTime ? 'изменить' : 'указать'}
                            </button>
                          )}
                        </div>
                        
                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <div className="flex gap-2 items-center">
                              <label className="text-xs text-gray-500 w-16">Начало:</label>
                              <input type="time" value={editOpen} onChange={e => setEditOpen(e.target.value)}
                                className="flex-1 p-2 border-2 border-blue-300 rounded-lg text-sm font-bold focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div className="flex gap-2 items-center">
                              <label className="text-xs text-gray-500 w-16">Конец:</label>
                              <input type="time" value={editClose} onChange={e => setEditClose(e.target.value)}
                                className="flex-1 p-2 border-2 border-blue-300 rounded-lg text-sm font-bold focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingShift(null)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold">Отмена</button>
                              <button onClick={() => saveShiftEdit(emp)} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold">Сохранить</button>
                            </div>
                          </div>
                        ) : shift?.openTime ? (
                          <div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-lg font-black text-blue-800">
                                {shift.openTime} → {shift.closeTime || <span className="text-green-500 animate-pulse text-sm">работает</span>}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1.5 text-xs text-blue-600">
                              {mins > 0 && <span className="bg-blue-100 px-2 py-0.5 rounded-full font-semibold">{formatRoundedHours(roundedHours)}</span>}
                              {speed > 0 && <span className="bg-indigo-100 px-2 py-0.5 rounded-full font-semibold">🚀 {speed} прод/ч</span>}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-blue-400 mt-1">Смена не зафиксирована</p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Предупреждение о времени редактирования */}
                  {anyEditable && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700">
                      ⏱️ Редактирование доступно {getRemainingTime(empReports[0]) || 20} мин. после создания
                    </div>
                  )}
                  
                  {unrec.length > 0 && (<div className="bg-red-50 border border-red-200 rounded-lg p-2"><h4 className="font-bold text-red-700 text-xs mb-1"><AlertTriangle className="w-3 h-3 inline" /> Нераспознанные ({unrec.length})</h4>{unrec.map(r => (<div key={r.id} className="py-1 border-b border-red-200 last:border-0"><div className="flex justify-between items-center text-xs"><span className="text-red-600">❓ {getProductName(r.product)}</span><div className="flex items-center gap-1"><span>{r.total}₽</span>{canEdit(r) ? (<button onClick={() => deleteReport(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>) : (<Lock className="w-3 h-3 text-gray-400" />)}</div></div><FixUnrecognizedButton report={r} /></div>))}</div>)}
                  {belowPrice.length > 0 && (<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2"><h4 className="font-bold text-yellow-700 text-xs mb-1"><AlertCircle className="w-3 h-3 inline" /> Со скидкой ({belowPrice.length})</h4>{belowPrice.map(r => (<div key={r.id} className="py-1 border-b border-yellow-200 last:border-0"><div className="flex justify-between items-center text-xs"><span>{getProductName(r.product)}</span><span>{r.total}₽ <span className="text-gray-400">(база: {r.basePrice}₽)</span></span></div>{r.discountReason && <p className="text-xs text-yellow-600 mt-0.5">💬 {r.discountReason}</p>}{isAdminUser && <SalaryDecisionButtons report={r} compact />}</div>))}</div>)}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between py-1 border-b"><span>💰 Итого</span><span className="font-bold">{grandTotal.toLocaleString()}{totalTips > 0 && <span className="text-amber-500"> ({(grandTotal+totalTips).toLocaleString()})</span>}₽</span></div>
                    <div className="flex justify-between py-1 border-b"><span>💵 Наличные</span><span className="font-bold text-green-600">{cashTotal.toLocaleString()}₽</span></div>
                    <div className="flex justify-between py-1 border-b"><span>💳 Безнал</span><span className="font-bold text-blue-600">{cashlessTotal.toLocaleString()}₽</span></div>
                    <div className="flex justify-between py-1 border-b"><span>🎁 Чаевые</span><span className="font-bold text-amber-600">{totalTips.toLocaleString()}₽</span></div>
                    <div className="flex justify-between py-1 border-b"><span>👛 ЗП</span><span className="font-bold text-amber-600">{totalSalary.toLocaleString()}₽</span></div>
                    {expensesList.length > 0 && (<div className="py-1 border-b"><div className="flex justify-between"><span>📝 Расходы</span><span className="font-bold text-red-600">-{empExpenses}₽</span></div><div className="text-xs text-gray-500 mt-1">{expensesList.map((e) => (<div key={e.id} className="flex justify-between items-center"><span>{e.description}</span><button onClick={() => deleteExpense(e.id)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button></div>))}</div></div>)}
                    <div className="flex justify-between items-center py-1 border-b"><span>📝 Добавить расход</span><button onClick={() => addExpense(emp)} className="text-amber-600 text-xs bg-amber-100 px-2 py-1 rounded hover:bg-amber-200">+ Добавить</button></div>
                    <div className="flex justify-between items-center py-1 border-b"><span>💸 Уже отдано</span><input type="number" defaultValue={given || ''} onBlur={(e) => updateGivenToAdmin(emp, parseInt(e.target.value) || 0)} className="w-24 p-1 border rounded text-right text-sm font-bold focus:border-amber-500 focus:outline-none" placeholder="0" /></div>
                    <div className="flex items-center py-1 border-b"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={ownCard} onChange={(e) => updateOwnCard(emp, selectedDate, e.target.checked)} className="w-4 h-4 accent-amber-500" /><span className="text-sm">💳 Переводы на свою карту</span></label></div>
                  </div>
                  <div className={`rounded-lg p-3 text-white ${toGive >= 0 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}>
                    <p className="text-xs opacity-90">💼 К выдаче</p>
                    <p className="text-2xl font-bold">{toGive.toLocaleString()}₽</p>
                    <p className="text-xs opacity-80 mt-1">{ownCard ? `(${cashTotal}+${cashlessTotal}+${totalTips})-${totalSalary}-${empExpenses}-${given}` : `(${cashTotal}+${totalTips})-${totalSalary}-${empExpenses}-${given}`}</p>
                    {!ownCard && cashlessTotal > 0 && <p className="text-xs opacity-80">💳 Безнал {cashlessTotal}₽ на карте компании</p>}
                  </div>
                  <details className="group"><summary className="cursor-pointer text-amber-600 font-semibold text-sm flex items-center gap-1"><ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />Все продажи ({empReports.length})</summary><div className="mt-2 space-y-1 max-h-64 overflow-y-auto">{empReports.map(r => { const isDiscount = isBelowBasePrice(r.basePrice, r.salePrice); return (<div key={r.id} className={`py-1.5 text-xs px-2 rounded ${isDiscount ? 'bg-yellow-50 border border-yellow-200' : r.isUnrecognized ? 'bg-red-50' : 'bg-gray-50'}`}><div className="flex justify-between items-center"><span className="truncate flex-1">{r.isUnrecognized ? '❓ ' : ''}{getProductName(r.product)}{isDiscount && ' ⚠️'}</span><div className="flex items-center gap-1 ml-2"><span>{r.total}₽ {r.paymentType === 'cashless' ? '💳' : '💵'}</span><span className="text-amber-600">ЗП:{getEffectiveSalary(r)}</span>{canEdit(r) ? (<button onClick={() => deleteReport(r.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>) : (<Lock className="w-3 h-3 text-gray-400" title="Заблокировано" />)}</div></div>{isDiscount && <p className="text-yellow-600 mt-0.5">Скидка: {r.basePrice - r.salePrice}₽{r.discountReason ? ` — ${r.discountReason}` : ''}</p>}{r.addedBy && <p className="text-purple-500 mt-0.5">👤 {r.addedBy}</p>}</div>); })}</div></details>
                </div>
              </div>
            );
          })}
          {Object.keys(byEmployee).length === 0 && (<div className="text-center py-10"><BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-2" /><p className="text-gray-400">Нет продаж за этот день</p></div>)}
          
          {isAdminUser && (
            <button onClick={() => setAdminReport({ employee: '' })} className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg">
              <Plus className="w-5 h-5" /> Добавить продажу за сотрудника
            </button>
          )}
        </div>
        <AdminReportModal />
      </div>
    );
  };

  const AdminView = () => {
    const [passwordInput, setPasswordInput] = useState('');
    const [newEmployee, setNewEmployee] = useState('');
    const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Птички-свистульки', emoji: '🎁' });
    const [editingManual, setEditingManual] = useState(null);
    const [newManual, setNewManual] = useState({ title: '', category: 'sales', content: '', isPinned: false });
    const [personnelTab, setPersonnelTab] = useState('penalties');
    const [editBonusId, setEditBonusId] = useState(null);
    const [editBonusForm, setEditBonusForm] = useState({ amount: '', reason: '' });
    const [regUsers, setRegUsers] = useState(() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } });
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [addForm, setAddForm] = useState({ login: '', name: '', password: '', role: 'seller', isAdmin: false });
    const [addMode, setAddMode] = useState(false);
    const [addError, setAddError] = useState('');
    const [viewingProfile, setViewingProfile] = useState(null);
    const [expandedEdit, setExpandedEdit] = useState(null);
    const [adminEditForm, setAdminEditForm] = useState({});
    const [showEventForm, setShowEventForm] = useState(false);
    const [newDate, setNewDate] = useState('');
    const [newEvent, setNewEvent] = useState({ title: '', description: '', type: 'info', emoji: '📅' });
    const [editingEventRef, setEditingEventRef] = useState(null); // { dateKey, index }
    const [achForm, setAchForm] = useState({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '', bonusAmount: '' });
    const [editingAch, setEditingAch] = useState(null);

    // Refresh regUsers from localStorage (was inside IIFE)
    useEffect(() => {
      const interval = setInterval(() => {
        try { setRegUsers(JSON.parse(localStorage.getItem('likebird-users') || '[]')); } catch { /* silent */ }
      }, 2000);
      return () => clearInterval(interval);
    }, []);
    const [kpiEditMode, setKpiEditMode] = useState(null);
    const [kpiEditValue, setKpiEditValue] = useState('');
    // States moved from IIFEs to fix input focus bug
    const [stockTab, setStockTab] = useState('history');
    const [adminPassInput, setAdminPassInput] = useState('');
    const [historyLimit, setHistoryLimit] = useState(50);
    const [newWriteOff, setNewWriteOff] = useState({ product: '', quantity: '', reason: '' });
    const [chatText, setChatText] = useState('');
    const [chatTo, setChatTo] = useState('');
    // chatLimit moved to parent scope
    const [newCity, setNewCity] = useState('');
    const [newLocName, setNewLocName] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [newPenalty, setNewPenalty] = useState({ employeeId: '', amount: '', reason: '' });
    const [newBonus, setNewBonus] = useState({ employeeId: '', amount: '', reason: '' });
    const [newTimeOff, setNewTimeOff] = useState({ employeeId: '', type: 'vacation', startDate: '', endDate: '', note: '' });
    // Products tab edit states
    const [editingProduct, setEditingProduct] = useState(null);
    const [editProductData, setEditProductData] = useState({ name: '', price: '', emoji: '', category: '' });
    const [productPhoto, setProductPhoto] = useState(null);
    // productPhotos & setProductPhotos — using global state (synced via Firebase)
    // FIX: inviteCodes перенесён в глобальное состояние LikeBirdApp (синхронизируется через Firebase)
    
    // Проверка пароля при входе
    if (adminPassword && !isAdminUnlocked) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Админ-панель</h2>
              <p className="text-sm text-gray-500 mt-1">Введите пароль для доступа</p>
            </div>
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-purple-500 focus:outline-none" onKeyDown={(e) => { if (e.key === 'Enter') { checkAdminPassword(passwordInput).then(ok => ok ? setIsAdminUnlocked(true) : showNotification('Неверный пароль', 'error')).catch(() => showNotification('Ошибка проверки пароля', 'error')); }}} />
            <button onClick={() => { checkAdminPassword(passwordInput).then(ok => ok ? setIsAdminUnlocked(true) : showNotification('Неверный пароль', 'error')).catch(() => showNotification('Ошибка проверки пароля', 'error')); }} className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:opacity-90">Войти</button>
            <button onClick={() => setCurrentView('menu')} className="w-full mt-3 text-gray-500 py-2">Назад</button>
          </div>
        </div>
      );
    }

    // Вычисления для дашборда
    const today = new Date();
    const todayStr = formatDate(today);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const todayReports = reports.filter(r => r.date.startsWith(todayStr) && !r.isUnrecognized);
    const todayApproved = todayReports.filter(r => r.reviewStatus === 'approved' || r.reviewStatus === 'submitted');
    const todayPending = todayReports.filter(r => !r.reviewStatus || r.reviewStatus === 'pending');
    const weekReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= weekAgo && !r.isUnrecognized;
    });
    const monthReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= monthAgo && !r.isUnrecognized;
    });

    const todayRevenue = todayReports.reduce((s, r) => s + r.total, 0);
    const weekRevenue = weekReports.reduce((s, r) => s + r.total, 0);
    const monthRevenue = monthReports.reduce((s, r) => s + r.total, 0);
    const todaySalary = todayReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
    const weekSalary = weekReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
    
    const todayExpenses = expenses.filter(e => e.date.startsWith(todayStr)).reduce((s, e) => s + e.amount, 0);
    const weekExpenses = expenses.filter(e => {
      const [datePart] = (e.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const expDate = new Date(parseYear(y), m - 1, d);
      return expDate >= weekAgo;
    }).reduce((s, e) => s + e.amount, 0);

    // Топ продаж за неделю
    const topProducts = weekReports.reduce((acc, r) => {
      const pName = getProductName(r.product);
      acc[pName] = (acc[pName] || 0) + (r.quantity || 1);
      return acc;
    }, {});
    const topProductsList = Object.entries(topProducts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Статистика по сотрудникам
    const employeeStats = weekReports.reduce((acc, r) => {
      if (!acc[r.employee]) acc[r.employee] = { sales: 0, revenue: 0, count: 0 };
      acc[r.employee].sales += (r.quantity || 1);
      acc[r.employee].revenue += r.total;
      acc[r.employee].count++;
      return acc;
    }, {});

    // Статистика по категориям
    const categoryStats = weekReports.reduce((acc, r) => {
      if (!acc[r.category]) acc[r.category] = { count: 0, revenue: 0 };
      acc[r.category].count += (r.quantity || 1);
      acc[r.category].revenue += r.total;
      return acc;
    }, {});

    // Функции настроек зарплаты
    const updateRange = (index, field, value) => {
      const newRanges = [...salarySettings.ranges];
      newRanges[index] = {...newRanges[index], [field]: parseInt(value) || 0};
      const updated = {...salarySettings, ranges: newRanges};
      setSalarySettings(updated);
      save('likebird-salary-settings', updated);
      logAction('Изменены настройки ЗП', `Диапазон ${index + 1}`);
    };

    const toggleBonus = () => {
      const updated = {...salarySettings, bonusForBirds: !salarySettings.bonusForBirds};
      setSalarySettings(updated);
      save('likebird-salary-settings', updated);
      logAction('Изменён бонус за птичек', updated.bonusForBirds ? 'Включен' : 'Выключен');
    };

    // Компонент редактирования графика
    const ScheduleEditor = () => {
      const [weekRange, setWeekRange] = useState(scheduleData.week || '');
      const [shifts, setShifts] = useState(scheduleData.shifts || {});
      const [scheduleViewMode, setScheduleViewMode] = useState('list');
      const activeEmployees = employees.filter(e => e.active).map(e => e.name);
      
      // Функция расчёта часов из времени
      const calculateHours = (startTime, endTime, breakStart, breakEnd) => {
        if (!startTime || !endTime) return 0;
        
        const parseTime = (time) => {
          const [h, m] = time.split(':').map(Number);
          return h + (m || 0) / 60;
        };
        
        const start = parseTime(startTime);
        const end = parseTime(endTime);
        let hours = end - start;
        
        // Вычитаем перерыв если указан
        if (breakStart && breakEnd) {
          const bStart = parseTime(breakStart);
          const bEnd = parseTime(breakEnd);
          const breakHours = bEnd - bStart;
          if (breakHours > 0) hours -= breakHours;
        }
        
        return Math.max(0, Math.round(hours * 10) / 10);
      };

      const shiftsCount = Object.values(shifts).reduce((sum, emp) => sum + (emp?.length || 0), 0);
      const totalHours = Object.values(shifts).reduce((sum, emp) => 
        sum + (emp?.reduce((s, sh) => s + (sh.hours || 0), 0) || 0), 0
      );

      const saveSchedule = () => {
        const data = { week: weekRange, shifts };
        setScheduleData(data);
        save('likebird-schedule', data);
        logAction('Обновлён график работы', weekRange);
        showNotification('График сохранён ✓');
      };

      const addShift = (employee) => {
        const newShifts = { ...shifts };
        if (!newShifts[employee]) newShifts[employee] = [];
        newShifts[employee].push({ 
          date: '', 
          startTime: '10:00', 
          endTime: '19:00', 
          breakStart: '', 
          breakEnd: '', 
          hours: 9 
        });
        setShifts(newShifts);
      };

      const updateShift = (employee, index, field, value) => {
        const newShifts = { ...shifts };
        newShifts[employee][index][field] = value;
        
        // Пересчитываем часы при изменении времени
        const shift = newShifts[employee][index];
        shift.hours = calculateHours(shift.startTime, shift.endTime, shift.breakStart, shift.breakEnd);
        
        setShifts(newShifts);
      };

      const removeShift = (employee, index) => {
        const newShifts = { ...shifts };
        newShifts[employee].splice(index, 1);
        if (newShifts[employee].length === 0) delete newShifts[employee];
        setShifts(newShifts);
      };

      const clearAllShifts = () => {
        showConfirm('Очистить все смены?', () => {
          // FIX: Обновляем parent state напрямую (setShifts — локальный state ScheduleEditor, 
          // который теряется при remount от showConfirm → parent re-render)
          const data = { week: weekRange, shifts: {} };
          setScheduleData(data);
          save('likebird-schedule', data);
          logAction('Очищены все смены', '');
          showNotification('Смены очищены');
        });
      };

      // Быстрые шаблоны смен
      const applyTemplate = (employee, template) => {
        const newShifts = { ...shifts };
        if (!newShifts[employee]) newShifts[employee] = [];
        
        const templates = {
          'full': { startTime: '10:00', endTime: '19:00', breakStart: '13:00', breakEnd: '14:00', hours: 8 },
          'morning': { startTime: '09:00', endTime: '15:00', breakStart: '', breakEnd: '', hours: 6 },
          'evening': { startTime: '15:00', endTime: '21:00', breakStart: '', breakEnd: '', hours: 6 },
          'short': { startTime: '10:00', endTime: '14:00', breakStart: '', breakEnd: '', hours: 4 },
        };
        
        const t = templates[template];
        newShifts[employee].push({ date: '', ...t });
        setShifts(newShifts);
      };

      return (
        <div className="space-y-4">
          {/* Период + Вид */}
          <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-600" />Период графика</h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setScheduleViewMode('list')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${scheduleViewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Список</button>
                <button onClick={() => setScheduleViewMode('table')} className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${scheduleViewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Таблица</button>
              </div>
            </div>
            <input type="text" value={weekRange} onChange={(e) => setWeekRange(e.target.value)} placeholder="27.01.26 - 02.02.26" className="w-full p-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none" />
          </div>

          {/* Статистика */}
          <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl p-4 border-2 border-blue-300">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-blue-700">📊 Статистика</p>
                <p className="text-sm text-blue-600">{shiftsCount} смен • {totalHours} часов</p>
              </div>
              <button onClick={clearAllShifts} className="text-red-500 hover:text-red-700 text-sm">Очистить всё</button>
            </div>
          </div>

          {/* Табличный вид */}
          {scheduleViewMode === 'table' && (() => {
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Понедельник
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              return d;
            });
            const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
            const todayDateStr = now.toISOString().split('T')[0];

            const getShiftForDay = (emp, day) => {
              const dayStr = day.toISOString().split('T')[0];
              const empShifts = shifts[emp] || [];
              return empShifts.find(s => s.date === dayStr);
            };

            const toggleShiftType = (emp, day, type) => {
              const dayStr = day.toISOString().split('T')[0];
              const newShifts = { ...shifts };
              if (!newShifts[emp]) newShifts[emp] = [];
              const existingIdx = newShifts[emp].findIndex(s => s.date === dayStr);
              
              const templates = {
                'morning': { startTime: '09:00', endTime: '15:00', breakStart: '', breakEnd: '', hours: 6 },
                'evening': { startTime: '15:00', endTime: '21:00', breakStart: '', breakEnd: '', hours: 6 },
                'full': { startTime: '10:00', endTime: '19:00', breakStart: '13:00', breakEnd: '14:00', hours: 8 },
              };

              if (existingIdx >= 0) {
                const existing = newShifts[emp][existingIdx];
                if (existing.startTime === templates[type].startTime && existing.endTime === templates[type].endTime) {
                  newShifts[emp].splice(existingIdx, 1);
                  if (newShifts[emp].length === 0) delete newShifts[emp];
                } else {
                  newShifts[emp][existingIdx] = { date: dayStr, ...templates[type] };
                }
              } else {
                newShifts[emp].push({ date: dayStr, ...templates[type] });
              }
              setShifts(newShifts);
            };

            return (
              <div className="bg-white rounded-xl shadow overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-bold text-gray-700 min-w-[80px]">Сотрудник</th>
                      {days.map((d, i) => {
                        const isToday = d.toISOString().split('T')[0] === todayDateStr;
                        return (
                          <th key={i} className={`p-2 text-center min-w-[60px] ${isToday ? 'bg-blue-50 text-blue-700 font-black' : 'text-gray-500'}`}>
                            <div>{dayLabels[i]}</div>
                            <div className="text-[10px]">{d.getDate()}.{String(d.getMonth() + 1).padStart(2, '0')}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmployees.map(emp => (
                      <tr key={emp} className="border-b last:border-0">
                        <td className="p-2 font-semibold text-gray-700">{emp}</td>
                        {days.map((d, i) => {
                          const isToday = d.toISOString().split('T')[0] === todayDateStr;
                          const shift = getShiftForDay(emp, d);
                          const shiftType = shift ? (shift.startTime === '09:00' ? 'morning' : shift.startTime === '15:00' ? 'evening' : 'full') : null;
                          return (
                            <td key={i} className={`p-1 text-center ${isToday ? 'bg-blue-50' : ''}`}>
                              <div className="flex flex-col gap-0.5">
                                <button onClick={() => toggleShiftType(emp, d, 'morning')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'morning' ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400 hover:bg-yellow-100'}`}>☀</button>
                                <button onClick={() => toggleShiftType(emp, d, 'evening')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'evening' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-indigo-100'}`}>🌙</button>
                                <button onClick={() => toggleShiftType(emp, d, 'full')} className={`px-1 py-0.5 rounded text-[10px] font-bold transition-all ${shiftType === 'full' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-100'}`}>∎</button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-2 flex gap-3 text-[10px] text-gray-500 border-t">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded"></span> Утро (09-15)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-indigo-500 rounded"></span> Вечер (15-21)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Полная (10-19)</span>
                </div>
              </div>
            );
          })()}

          {/* Список смен (оригинальный вид) */}
          {scheduleViewMode === 'list' && activeEmployees.map(emp => (
            <div key={emp} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">{emp}</h3>
                <div className="flex gap-1">
                  <button onClick={() => applyTemplate(emp, 'full')} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs hover:bg-blue-200" title="Полный день 10-19">Полный</button>
                  <button onClick={() => applyTemplate(emp, 'morning')} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200" title="Утро 9-15">Утро</button>
                  <button onClick={() => applyTemplate(emp, 'evening')} className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs hover:bg-purple-200" title="Вечер 15-21">Вечер</button>
                  <button onClick={() => addShift(emp)} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">+ Своя</button>
                </div>
              </div>
              
              {shifts[emp]?.length > 0 ? (
                <div className="space-y-3">
                  {shifts[emp].map((shift, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {/* Дата */}
                      <div className="flex gap-2 items-center mb-2">
                        <label className="text-xs text-gray-500 w-12">Дата:</label>
                        <input 
                          type="text" 
                          placeholder="30.01.26" 
                          value={shift.date} 
                          onChange={(e) => updateShift(emp, idx, 'date', e.target.value)} 
                          className="flex-1 p-2 border rounded text-sm focus:border-blue-500 focus:outline-none" 
                        />
                        <button onClick={() => removeShift(emp, idx)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Время работы */}
                      <div className="flex gap-2 items-center mb-2">
                        <label className="text-xs text-gray-500 w-12">Работа:</label>
                        <input 
                          type="time" 
                          value={shift.startTime || ''} 
                          onChange={(e) => updateShift(emp, idx, 'startTime', e.target.value)} 
                          className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none" 
                        />
                        <span className="text-gray-400">—</span>
                        <input 
                          type="time" 
                          value={shift.endTime || ''} 
                          onChange={(e) => updateShift(emp, idx, 'endTime', e.target.value)} 
                          className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none" 
                        />
                      </div>
                      
                      {/* Перерыв */}
                      <div className="flex gap-2 items-center mb-2">
                        <label className="text-xs text-gray-500 w-12">Обед:</label>
                        <input 
                          type="time" 
                          value={shift.breakStart || ''} 
                          onChange={(e) => updateShift(emp, idx, 'breakStart', e.target.value)} 
                          className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none" 
                          placeholder="13:00"
                        />
                        <span className="text-gray-400">—</span>
                        <input 
                          type="time" 
                          value={shift.breakEnd || ''} 
                          onChange={(e) => updateShift(emp, idx, 'breakEnd', e.target.value)} 
                          className="p-2 border rounded text-sm focus:border-blue-500 focus:outline-none" 
                          placeholder="14:00"
                        />
                        <span className="text-xs text-gray-400">(опционально)</span>
                      </div>
                      
                      {/* Итого часов */}
                      <div className="flex justify-end items-center pt-2 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Итого: </span>
                        <span className="text-lg font-bold text-blue-600 ml-2">{shift.hours || 0} ч</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 px-2">
                    <span className="text-sm text-gray-500">Всего у {emp}:</span>
                    <span className="font-bold text-blue-700">{shifts[emp].reduce((s, sh) => s + (sh.hours || 0), 0)} часов</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-400 text-sm py-4 text-center">Нет запланированных смен</p>
              )}
            </div>
          ))}

          {activeEmployees.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center">
              <p className="text-yellow-700">Нет активных сотрудников</p>
              <p className="text-sm text-yellow-600 mt-1">Добавьте сотрудников во вкладке "Сотрудники"</p>
            </div>
          )}

          {/* Кнопка сохранения */}
          <button onClick={saveSchedule} className="w-full bg-green-500 text-white py-4 rounded-xl font-bold hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg">
            <CheckCircle className="w-6 h-6" />Сохранить график
          </button>
        </div>
      );
    };

    const tabs = [
      { id: 'today', label: '📊 Сегодня', icon: BarChart3 },
      { id: 'analytics', label: '📈 Аналитика', icon: BarChart3 },
      { id: 'review', label: '✅ Проверка', icon: CheckCircle },
      { id: 'employees', label: '👥 Сотрудники', icon: Users },
      { id: 'personnel', label: '🏆 Персонал+', icon: Award },
      { id: 'finance', label: '💰 Финансы', icon: DollarSign },
      { id: 'locations', label: '📍 Точки', icon: MapPin },
      { id: 'products', label: '📦 Товары', icon: Package },
      { id: 'stock', label: '📋 Ревизия', icon: Package },
      { id: 'stockplus', label: '📦 Склад+', icon: Archive },
      { id: 'schedule', label: '📅 График', icon: Calendar },
      { id: 'chat', label: '💬 Чат', icon: MessageCircle },
      { id: 'settings', label: '⚙️ Настройки', icon: Settings },
      { id: 'security', label: '🔐 Доступ', icon: Lock },
      { id: 'manuals', label: '📚 Мануалы', icon: FileText },
      { id: 'achievements-admin', label: '🏅 Достижения', icon: Award },
      { id: 'challenges', label: '🏆 Челленджи', icon: Award },
      { id: 'audit', label: '📋 Аудит', icon: FileText },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-indigo-50 pb-6">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 sticky top-0 z-10 safe-area-top">
          <button onClick={() => { setCurrentView('menu'); setIsAdminUnlocked(false); }} className="mb-2"><ArrowLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" />Админ-панель</h2>
        </div>

        {/* Вкладки — auto-scroll to active tab only on adminTab change */}
        <div className="sticky top-16 z-10 bg-white shadow-md" ref={el => {
          if (el && !el._scrollSetup) {
            el._scrollSetup = true;
            const scrollToActive = () => {
              const container = el.querySelector('#admin-tabs-scroll');
              if (!container) return;
              const active = container.querySelector('[data-active="true"]');
              if (!active) return;
              const cRect = container.getBoundingClientRect();
              const aRect = active.getBoundingClientRect();
              if (aRect.left < cRect.left || aRect.right > cRect.right) {
                active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
              }
            };
            setTimeout(scrollToActive, 50);
            if (el._observer) { try { el._observer.disconnect(); } catch { /* silent */ } }
            const observer = new MutationObserver(scrollToActive);
            el._observer = observer;
            observer.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-active'] });
          }
        }}>
          <div className="relative flex items-center">
            {/* Кнопка влево */}
            <button
              onClick={() => { const el = document.getElementById('admin-tabs-scroll'); if (el) el.scrollBy({ left: -200, behavior: 'smooth' }); }}
              className="flex-shrink-0 px-2 py-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border-r border-gray-100 z-10 bg-white"
              style={{minWidth: 32}}>
              ‹
            </button>
            <div id="admin-tabs-scroll"
              className="flex overflow-x-auto px-1 py-2 gap-1 flex-1"
              style={{scrollbarWidth: 'thin', scrollbarColor: '#9333ea #f3f4f6', WebkitOverflowScrolling: 'touch'}}
              onWheel={e => {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); e.currentTarget.scrollLeft += e.deltaX; }
                else { e.currentTarget.scrollLeft += e.deltaY; }
              }}>
            {tabs.map(tab => (
              <button key={tab.id} data-active={adminTab === tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${adminTab === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {tab.label}
              </button>
            ))}
            </div>
            {/* Кнопка вправо */}
            <button
              onClick={() => { const el = document.getElementById('admin-tabs-scroll'); if (el) el.scrollBy({ left: 200, behavior: 'smooth' }); }}
              className="flex-shrink-0 px-2 py-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border-l border-gray-100 z-10 bg-white"
              style={{minWidth: 32}}>
              ›
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-4">
          {/* ВКЛАДКА: Сегодня (дашборд) */}
          {adminTab === 'today' && (() => {
            const todayTopProducts = todayReports.reduce((acc, r) => {
              const n = getProductName(r.product);
              acc[n] = (acc[n] || 0) + 1;
              return acc;
            }, {});
            const topToday = Object.entries(todayTopProducts).sort((a, b) => b[1] - a[1])[0];
            const onShiftNow = Object.entries(shiftsData).filter(([key, s]) => {
              return key.endsWith(`_${todayStr}`) && s.status === 'open';
            }).map(([key]) => {
              const login = key.replace(`_${todayStr}`, '');
              const user = employees.find(e => e.name === login) || { name: login };
              try { const users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); const u = users.find(u => u.login === login); if (u) return { name: u.name || login }; } catch { /* silent */ }
              return { name: login };
            });
            const lowStockItems = Object.entries(stock).filter(([name, data]) => data.count > 0 && data.count <= (data.minStock || 3));

            return (
              <div className="space-y-4">
                {/* KPI виджеты */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-4 text-white">
                    <p className="text-white/70 text-xs">💰 Выручка сегодня</p>
                    <p className="text-2xl font-black">{todayRevenue.toLocaleString()}₽</p>
                    <p className="text-white/60 text-xs mt-1">{todayReports.length} продаж</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl p-4 text-white">
                    <p className="text-white/70 text-xs">👤 На смене сейчас</p>
                    <p className="text-2xl font-black">{onShiftNow.length}</p>
                    <p className="text-white/60 text-xs mt-1 truncate">{onShiftNow.map(e => e.name).join(', ') || 'Никого'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-4 text-white">
                    <p className="text-white/70 text-xs">🏆 Топ-товар дня</p>
                    <p className="text-lg font-black truncate">{topToday ? topToday[0] : '—'}</p>
                    <p className="text-white/60 text-xs mt-1">{topToday ? `${topToday[1]} шт` : 'Нет продаж'}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-white ${lowStockItems.length > 0 ? 'bg-gradient-to-br from-red-400 to-rose-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                    <p className="text-white/70 text-xs">⚠️ Мало на складе</p>
                    <p className="text-2xl font-black">{lowStockItems.length}</p>
                    <p className="text-white/60 text-xs mt-1">{lowStockItems.length > 0 ? 'позиций' : 'Всё в норме'}</p>
                  </div>
                </div>

                {/* Детали низких остатков */}
                {lowStockItems.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                    <h4 className="font-bold text-red-700 mb-2 text-sm">⚠️ Остатки ниже нормы</h4>
                    <div className="space-y-1">
                      {lowStockItems.slice(0, 8).map(([name, data]) => (
                        <div key={name} className="flex justify-between items-center text-sm py-1 border-b border-red-100 last:border-0">
                          <span>{data.emoji} {name}</span>
                          <span className="font-bold text-red-600">{data.count} / {data.minStock || 3}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Продажи сегодня по сотрудникам */}
                {todayReports.length > 0 && (
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h4 className="font-bold text-gray-700 mb-3 text-sm">👥 Продажи сегодня по сотрудникам</h4>
                    <div className="space-y-2">
                      {Object.entries(todayReports.reduce((acc, r) => {
                        if (!acc[r.employee]) acc[r.employee] = { count: 0, revenue: 0 };
                        acc[r.employee].count++;
                        acc[r.employee].revenue += r.total;
                        return acc;
                      }, {})).sort((a, b) => b[1].revenue - a[1].revenue).map(([emp, data]) => (
                        <div key={emp} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                          <span className="font-medium text-sm">{emp}</span>
                          <div className="text-right">
                            <span className="font-bold text-green-600 text-sm">{data.revenue.toLocaleString()}₽</span>
                            <span className="text-xs text-gray-400 ml-2">{data.count} шт</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          {/* ВКЛАДКА: Дашборд */}
          {/* Аналитика (объединённая) */}
          {adminTab === 'analytics' && (() => {
            const analytics = getAnalytics(analyticsPeriod);
            const cities = getCities();
            const maxRevenue = Math.max(...Object.values(analytics.byDay).map(d => d.revenue), 1);
            
            return (
              <div className="space-y-4">
                {/* KPI карточки */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl p-3 text-white">
                    <p className="text-xs opacity-80">Сегодня</p>
                    <p className="text-xl font-bold">{todayRevenue.toLocaleString()}₽</p>
                    <p className="text-xs">{todayApproved.length} подтв.{todayPending.length > 0 && <span className="opacity-70"> · {todayPending.length} ожид.</span>}</p>
                    <div className="mt-1 bg-white/20 rounded-full h-1.5"><div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, (todayRevenue / (salesPlan.daily || 1)) * 100)}%` }} /></div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-400 to-indigo-500 rounded-xl p-3 text-white">
                    <p className="text-xs opacity-80">За неделю</p>
                    <p className="text-xl font-bold">{weekRevenue.toLocaleString()}₽</p>
                    <p className="text-xs">{weekReports.length} продаж</p>
                    <div className="mt-1 bg-white/20 rounded-full h-1.5"><div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${Math.min(100, (weekRevenue / (salesPlan.weekly || 1)) * 100)}%` }} /></div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl p-3 text-white">
                    <p className="text-xs opacity-80">За месяц</p>
                    <p className="text-xl font-bold">{monthRevenue.toLocaleString()}₽</p>
                    <p className="text-xs">{monthReports.length} продаж</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl p-3 text-white">
                    <p className="text-xs opacity-80">Прибыль (неделя)</p>
                    <p className="text-xl font-bold">{(weekRevenue - weekSalary - weekExpenses).toLocaleString()}₽</p>
                    <p className="text-xs">ЗП: {weekSalary.toLocaleString()}₽ • Расх: {weekExpenses.toLocaleString()}₽</p>
                  </div>
                </div>

                {/* Топ продаж + Категории */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 shadow">
                    <h4 className="font-bold text-sm mb-2">🏆 Топ (неделя)</h4>
                    {topProductsList.slice(0, 5).map(([name, count], i) => {
                      const dn = typeof name === 'object' ? (name?.name || '?') : String(name);
                      return (<div key={i} className="flex items-center gap-2 text-xs py-0.5"><span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100'}`}>{i+1}</span><span className="flex-1 truncate">{dn}</span><span className="font-bold">{count}</span></div>);
                    })}
                    {topProductsList.length === 0 && <p className="text-gray-400 text-xs">Нет данных</p>}
                  </div>
                  <div className="bg-white rounded-xl p-3 shadow">
                    <h4 className="font-bold text-sm mb-2">📊 Категории</h4>
                    {Object.entries(categoryStats).map(([cat, data]) => (
                      <div key={cat} className="flex justify-between text-xs py-0.5"><span>{CAT_ICONS[cat]}</span><span className="font-bold">{data.count} шт ({data.revenue.toLocaleString()}₽)</span></div>
                    ))}
                  </div>
                </div>

                {/* План продаж */}
                <div className="bg-white rounded-xl p-3 shadow">
                  <h4 className="font-bold text-sm mb-2">🎯 План продаж</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-xs text-gray-500">День</label><input type="number" value={salesPlan.daily} onChange={(e) => updateSalesPlan({...salesPlan, daily: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                    <div><label className="text-xs text-gray-500">Неделя</label><input type="number" value={salesPlan.weekly} onChange={(e) => updateSalesPlan({...salesPlan, weekly: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                    <div><label className="text-xs text-gray-500">Месяц</label><input type="number" value={salesPlan.monthly} onChange={(e) => updateSalesPlan({...salesPlan, monthly: parseInt(e.target.value) || 0})} className="w-full p-1.5 border rounded text-sm" /></div>
                  </div>
                </div>

                {/* Период аналитики */}
                <div className="flex gap-2">
                  {[7, 14, 30].map(p => (
                    <button key={p} onClick={() => setAnalyticsPeriod(p)}
                      className={`px-4 py-2 rounded-lg font-medium ${analyticsPeriod === p ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 border'}`}>
                      {p} дней
                    </button>
                  ))}
                </div>

                {/* Основные метрики */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-4 text-white">
                    <p className="text-xs opacity-80">Выручка</p>
                    <p className="text-2xl font-bold">{analytics.totalRevenue.toLocaleString()}₽</p>
                    <p className={`text-xs ${analytics.revenueChange >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                      {analytics.revenueChange >= 0 ? '↑' : '↓'} {Math.abs(analytics.revenueChange)}% vs прошлый период
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-4 text-white">
                    <p className="text-xs opacity-80">Прибыль</p>
                    <p className="text-2xl font-bold">{analytics.totalProfit.toLocaleString()}₽</p>
                    <p className="text-xs opacity-70">Без себестоимости</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-4 text-white">
                    <p className="text-xs opacity-80">Продаж</p>
                    <p className="text-2xl font-bold">{analytics.totalSales}</p>
                    <p className="text-xs opacity-70">{(analytics.totalSales / analyticsPeriod).toFixed(1)}/день</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl p-4 text-white">
                    <p className="text-xs opacity-80">Ср. чек</p>
                    <p className="text-2xl font-bold">{analytics.avgCheck}₽</p>
                  </div>
                </div>

                {/* График по дням */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-600" />Выручка по дням</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.byDay).slice(-7).map(([date, data]) => (
                      <div key={date} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16">{date.split('.').slice(0, 2).join('.')}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                          <div className="bg-gradient-to-r from-purple-400 to-purple-600 h-full rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(5, (data.revenue / maxRevenue) * 100)}%` }}>
                            <span className="text-xs text-white font-medium">{data.revenue.toLocaleString()}₽</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 w-8">{data.sales}шт</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Топ сотрудников */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-purple-600" />Топ сотрудников</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.byEmployee).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([emp, data], i) => (
                      <div key={emp} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100'}`}>{i + 1}</span>
                        <span className="flex-1 font-medium">{emp}</span>
                        <span className="text-purple-600 font-bold">{data.revenue.toLocaleString()}₽</span>
                        <span className="text-gray-400 text-sm">{data.sales}шт</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Топ товаров */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="w-5 h-5 text-purple-600" />Топ товаров</h3>
                  <div className="space-y-2">
                    {Object.entries(analytics.byProduct).sort((a, b) => b[1].sales - a[1].sales).slice(0, 5).map(([prod, data], i) => (
                      <div key={prod} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="font-medium">{prod}</span>
                        <div className="text-right">
                          <span className="text-purple-600 font-bold">{data.sales}шт</span>
                          <span className="text-gray-400 text-sm ml-2">{data.revenue.toLocaleString()}₽</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* По локациям */}
                {Object.keys(analytics.byLocation).length > 1 && (
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-600" />По точкам</h3>
                    <div className="space-y-2">
                      {Object.entries(analytics.byLocation).sort((a, b) => b[1].revenue - a[1].revenue).map(([loc, data]) => (
                        <div key={loc} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="font-medium">{loc}</span>
                          <span className="text-purple-600 font-bold">{data.revenue.toLocaleString()}₽</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ВКЛАДКА: Проверка отчётов */}
          {adminTab === 'review' && (
            <div className="space-y-4">
              {/* Статистика */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-yellow-100 rounded-xl p-3 text-center border-2 border-yellow-300">
                  <p className="text-2xl font-bold text-yellow-700">{reports.filter(r => r.reviewStatus === 'pending' || !r.reviewStatus).length}</p>
                  <p className="text-xs text-yellow-600">Ожидают</p>
                </div>
                <div className="bg-green-100 rounded-xl p-3 text-center border-2 border-green-300">
                  <p className="text-2xl font-bold text-green-700">{reports.filter(r => r.reviewStatus === 'approved').length}</p>
                  <p className="text-xs text-green-600">Верно</p>
                </div>
                <div className="bg-red-100 rounded-xl p-3 text-center border-2 border-red-300">
                  <p className="text-2xl font-bold text-red-700">{reports.filter(r => r.reviewStatus === 'rejected' || r.reviewStatus === 'revision').length}</p>
                  <p className="text-xs text-red-600">Ошибки</p>
                </div>
              </div>

              {/* Группировка по датам */}
              {(() => {
                const groupedByDate = {};
                reports.forEach(r => {
                  const dateKey = (r.date||'').split(',')[0];
                  if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
                  groupedByDate[dateKey].push(r);
                });
                const dates = Object.keys(groupedByDate).slice(0, 7);
                
                return dates.map(dateKey => {
                  const dayReports = groupedByDate[dateKey];
                  const byEmployee = {};
                  dayReports.forEach(r => {
                    if (!byEmployee[r.employee]) byEmployee[r.employee] = [];
                    byEmployee[r.employee].push(r);
                  });
                  
                  return (
                    <div key={dateKey} className={`rounded-xl shadow overflow-hidden ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <div className="bg-purple-100 p-3 border-b">
                        <h3 className="font-bold text-purple-800">📅 {dateKey}</h3>
                        <p className="text-xs text-purple-600">{dayReports.length} продаж</p>
                      </div>
                      
                      {Object.entries(byEmployee).map(([empName, empReports]) => {
                        const empTotal = empReports.reduce((s, r) => s + r.total, 0);
                        const empSalary = empReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                        const status = empReports[0]?.reviewStatus || 'pending';
                        const hasOriginalText = empReports.some(r => r.originalReportText);
                        
                        return (
                          <div key={empName} className="p-4 border-b last:border-b-0">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="font-bold">{empName}</p>
                                <p className="text-sm text-gray-600">{empReports.length} продаж • {empTotal.toLocaleString()}₽</p>
                                <p className="text-xs text-amber-600">ЗП: {empSalary.toLocaleString()}₽</p>
                              </div>
                              <div className="flex items-center gap-1">
                                {status === 'approved' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">✓ Верно</span>}
                                {status === 'rejected' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-medium">✗ Ошибки</span>}
                                {status === 'revision' && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">↻ Доработать</span>}
                                {(status === 'pending' || !status) && <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">⏳ Ожидает</span>}
                              </div>
                            </div>
                            
                            {/* Продажи — с редактированием */}
                            {(() => {
                              return (
                                <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
                                  {empReports.map((r, idx) => (
                                    <div key={r.id || idx} className={`text-sm rounded-lg overflow-hidden border ${r.isUnrecognized ? 'border-red-200' : 'border-gray-200'}`}>
                                      {expandedEdit === r.id ? (
                                        <div className="p-3 bg-blue-50 space-y-2">
                                          <p className="text-xs font-bold text-blue-700 mb-1">✏️ Редактирование</p>
                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-xs text-gray-500">Цена ₽</label>
                                              <input type="number" value={adminEditForm.salePrice || ''} onChange={e => setAdminEditForm({...adminEditForm, salePrice: e.target.value})}
                                                className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5" />
                                            </div>
                                            <div>
                                              <label className="text-xs text-gray-500">Тип оплаты</label>
                                              <select value={adminEditForm.paymentType || 'cash'} onChange={e => setAdminEditForm({...adminEditForm, paymentType: e.target.value})}
                                                className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5">
                                                <option value="cash">💵 Нал</option>
                                                <option value="cashless">💳 Безнал</option>
                                                <option value="mixed">💵💳 Смеш</option>
                                              </select>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="text-xs text-gray-500">Товар</label>
                                            <input type="text" value={adminEditForm.product || ''} onChange={e => setAdminEditForm({...adminEditForm, product: e.target.value})}
                                              className="w-full p-2 border-2 border-blue-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none mt-0.5" />
                                          </div>
                                          <div className="flex gap-2">
                                            <button onClick={() => {
                                              const priceNum = parseInt(adminEditForm.salePrice) || r.salePrice;
                                              const prod = DYNAMIC_ALL_PRODUCTS.find(p => p.name === adminEditForm.product) || { price: r.basePrice, category: r.category };
                                              const newBase = prod.price || r.basePrice;
                                              const newCat = prod.category || r.category;
                                              const newSal = calculateSalary(newBase, priceNum, newCat, r.tips || 0, 'normal', salarySettings);
                                              let ca = 0, cla = 0;
                                              if (adminEditForm.paymentType === 'cash') ca = priceNum;
                                              else if (adminEditForm.paymentType === 'cashless') cla = priceNum;
                                              else { ca = r.cashAmount; cla = r.cashlessAmount; }
                                              const updatedR = reports.map(rep => rep.id === r.id
                                                ? { ...rep, product: adminEditForm.product, basePrice: newBase, category: newCat, salePrice: priceNum, total: priceNum, salary: newSal, paymentType: adminEditForm.paymentType, cashAmount: ca, cashlessAmount: cla, isBelowBase: priceNum < newBase }
                                                : rep
                                              );
                                              updateReports(updatedR);
                                              logAction('Отчёт исправлен администратором', `${empName}: ${r.product} → ${adminEditForm.product} ${priceNum}₽`);
                                              setExpandedEdit(null);
                                              showNotification('Продажа исправлена');
                                            }} className="flex-1 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold">✅ Сохранить</button>
                                            <button onClick={() => {
                                              showConfirm('Удалить эту продажу?', () => {
                                                // FIX: Восстанавливаем склад при удалении (как в deleteReport)
                                                const productName = r ? getProductName(r.product) : null;
                                                if (r && !r.isUnrecognized && productName && stock[productName]) {
                                                  const newStock = {...stock};
                                                  newStock[productName] = {...newStock[productName], count: newStock[productName].count + (r.quantity || 1)};
                                                  updateStock(newStock);
                                                  addStockHistoryEntry(productName, 'return', (r.quantity || 1), `Удалена продажа (админ)`);
                                                }
                                                const nd = {...salaryDecisions}; delete nd[r.id]; setSalaryDecisions(nd); save('likebird-salary-decisions', nd);
                                                updateReports(reports.filter(rep => rep.id !== r.id));
                                                setExpandedEdit(null);
                                                showNotification('Удалено');
                                              });
                                            }} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold">🗑️</button>
                                            <button onClick={() => setExpandedEdit(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">✕</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className={`p-2 flex justify-between items-center cursor-pointer hover:bg-gray-50 ${r.isUnrecognized ? 'bg-red-50' : 'bg-white'}`}
                                          onClick={() => { setExpandedEdit(r.id); setAdminEditForm({ product: r.product, salePrice: String(r.salePrice), paymentType: r.paymentType }); }}>
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-base flex-shrink-0">{r.isUnrecognized ? '❓' : (DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product)?.emoji || '🐦')}</span>
                                            <span className="truncate text-sm">{getProductName(r.product)}</span>
                                          </div>
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="font-bold text-sm">{r.total}₽</span>
                                            <span>{r.paymentType === 'cashless' ? '💳' : '💵'}</span>
                                            <Edit3 className="w-3 h-3 text-gray-400" />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            
                            {/* Исходный текст отчёта */}
                            {hasOriginalText && empReports[0].originalReportText && (
                              <details className="mb-3">
                                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">📄 Исходный текст отчёта</summary>
                                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">{empReports[0].originalReportText}</pre>
                              </details>
                            )}
                            
                            {/* Кнопки проверки */}
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const ids = empReports.map(r => r.id);
                                  showConfirm(`Утвердить ${ids.length} отчётов от ${empName}?`, () => {
                                    updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'approved'} : r));
                                  });
                                  logAction('Отчёт подтверждён', `${empName} ${dateKey}`);
                                  showNotification('Отчёт подтверждён ✓');
                                }}
                                className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-medium hover:bg-green-600"
                              >
                                ✓ Верно
                              </button>
                              <button 
                                onClick={() => {
                                  const ids = empReports.map(r => r.id);
                                  updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'revision'} : r));
                                  logAction('Отчёт на доработку', `${empName} ${dateKey}`);
                                  showNotification('Отправлено на доработку');
                                }}
                                className="flex-1 bg-orange-500 text-white py-2 rounded text-sm font-medium hover:bg-orange-600"
                              >
                                ↻ Доработать
                              </button>
                              <button 
                                onClick={() => {
                                  const ids = empReports.map(r => r.id);
                                  updateReports(reports.map(r => ids.includes(r.id) ? {...r, reviewStatus: 'rejected'} : r));
                                  logAction('Отчёт отклонён', `${empName} ${dateKey}`);
                                  showNotification('Отчёт отклонён');
                                }}
                                className="flex-1 bg-red-500 text-white py-2 rounded text-sm font-medium hover:bg-red-600"
                              >
                                ✗ Ошибки
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}

              {reports.length === 0 && (
                <div className="text-center py-10 bg-white rounded-xl shadow">
                  <FileText className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Нет отчётов для проверки</p>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА: Сотрудники */}
          {adminTab === 'employees' && (() => {
            // regUsers refreshed via useEffect at AdminView top level

            const saveUsers = (updated) => {
              setRegUsers(updated);
              localStorage.setItem('likebird-users', JSON.stringify(updated));
              fbSave('likebird-users', updated);
            };

            const isMasterAdmin = currentUser?.isAdmin === true;

            const ROLE_LABELS = {
              seller: { label: 'Продавец', color: 'bg-purple-100 text-purple-700', icon: '🐦' },
              senior: { label: 'Старший продавец', color: 'bg-amber-100 text-amber-700', icon: '⭐' },
              admin: { label: 'Администратор', color: 'bg-red-100 text-red-700', icon: '🛡️' },
            };

            const handleStartEdit = (user) => {
              setEditingUser(user.login);
              setEditForm({ name: user.name, role: user.role || 'seller', isAdmin: !!user.isAdmin });
            };

            const handleSaveEdit = () => {
              const updated = regUsers.map(u => u.login === editingUser
                ? { ...u, name: editForm.name, role: editForm.role, isAdmin: editForm.isAdmin || editForm.role === 'admin' }
                : u
              );
              saveUsers(updated);
              // FIX: Синхронизируем роль в employees (ранее role менялось только в users)
              const editedUser = updated.find(u => u.login === editingUser);
              if (editedUser) {
                const empMatch = employees.find(e => e.name === editedUser.name || e.name === editingUser);
                if (empMatch) {
                  updateEmployees(employees.map(e => e.id === empMatch.id ? { ...e, name: editedUser.name, role: editedUser.role } : e));
                }
              }
              // Если редактируем самого себя — обновить currentUser
              if (editingUser === currentUser?.login) {
                const me = updated.find(u => u.login === editingUser);
                if (me) setCurrentUser(me);
              }
              setEditingUser(null);
              showNotification('Сохранено');
            };

            const handleDeleteUser = (login) => {
              if (login === currentUser?.login) { showNotification('Нельзя удалить себя', 'error'); return; }
              showConfirm(`Удалить аккаунт ${login}?`, () => {
                const updated = regUsers.filter(u => u.login !== login);
                saveUsers(updated);
                showNotification('Аккаунт удалён');
              });
            };

            const handleAddUser = async () => {
              setAddError('');
              if (!addForm.login.trim()) { setAddError('Введите логин'); return; }
              if (addForm.login.trim().length < 2) { setAddError('Логин минимум 2 символа'); return; }
              if (!addForm.password || addForm.password.length < 4) { setAddError('Пароль минимум 4 символа'); return; }
              if (regUsers.find(u => u.login.toLowerCase() === addForm.login.trim().toLowerCase())) { setAddError('Логин уже занят'); return; }
              const hashed = await hashPassword(addForm.password);
              const newU = {
                login: addForm.login.trim(),
                name: addForm.name.trim() || addForm.login.trim(),
                passwordHash: hashed,
                createdAt: Date.now(),
                role: addForm.role,
                isAdmin: addForm.role === 'admin',
              };
              saveUsers([...regUsers, newU]);
              // Добавляем в employees если нет
              if (!employees.find(e => e.name === newU.name)) {
                addEmployee(newU.name, newU.role);
              }
              setAddForm({ login: '', name: '', password: '', role: 'seller', isAdmin: false });
              setAddMode(false);
              showNotification(`Аккаунт ${newU.login} создан`);
            };

            return (
              <div className="space-y-4">

                {/* Заголовок */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Пользователи ({regUsers.length})
                  </h3>
                  {isMasterAdmin && (
                    <button onClick={() => { setAddMode(!addMode); setAddError(''); }}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${addMode ? 'bg-gray-100 text-gray-600' : 'bg-purple-500 text-white hover:bg-purple-600'}`}>
                      {addMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {addMode ? 'Отмена' : 'Добавить'}
                    </button>
                  )}
                </div>

                {/* Форма добавления */}
                {addMode && isMasterAdmin && (
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-3">
                    <h4 className="font-bold text-purple-700">➕ Новый пользователь</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 font-semibold block mb-1">Логин *</label>
                        <input type="text" value={addForm.login} onChange={e => setAddForm({...addForm, login: e.target.value})}
                          placeholder="login" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold block mb-1">Имя</label>
                        <input type="text" value={addForm.name} onChange={e => setAddForm({...addForm, name: e.target.value})}
                          placeholder="Отображаемое" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1">Пароль *</label>
                      <input type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})}
                        placeholder="Минимум 4 символа" className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-semibold block mb-1">Роль</label>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(ROLE_LABELS).map(([val, info]) => (
                          <button key={val} onClick={() => setAddForm({...addForm, role: val})}
                            className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${addForm.role === val ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            {info.icon} {info.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {addError && <p className="text-red-500 text-sm">{addError}</p>}
                    <button onClick={handleAddUser}
                      className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                      ✅ Создать аккаунт
                    </button>
                  </div>
                )}

                {/* Список пользователей */}
                <div className="space-y-3">
                  {regUsers.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center shadow">
                      <p className="text-4xl mb-2">👥</p>
                      <p className="text-gray-400">Нет зарегистрированных пользователей</p>
                    </div>
                  ) : regUsers.map(user => {
                    const isEditing = editingUser === user.login;
                    const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.seller;
                    const stats = employeeStats[user.name] || { count: 0, revenue: 0, sales: 0 };
                    const userProfile = profilesData[user.login] || {};
                    const isMe = user.login === currentUser?.login;

                    return (
                      <div key={user.login} className={`bg-white rounded-2xl shadow overflow-hidden ${isMe ? 'ring-2 ring-purple-300' : ''}`}>
                        {/* Шапка карточки */}
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Аватар */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-black text-lg overflow-hidden flex-shrink-0">
                              {userProfile.avatar
                                ? <img src={userProfile.avatar} alt="" className="w-full h-full object-cover" />
                                : (userProfile.displayName || user.name || '?')[0].toUpperCase()
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-800">{userProfile.displayName || user.name}</p>
                                {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">это вы</span>}
                                {user.isAdmin && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">👑 Мастер-админ</span>}
                              </div>
                              <p className="text-xs text-gray-400">@{user.login}</p>
                              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${roleInfo.color}`}>
                                {roleInfo.icon} {roleInfo.label}
                              </span>
                            </div>
                            {/* Кнопки действий */}
                            {isMasterAdmin && !isEditing && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button onClick={() => handleStartEdit(user)}
                                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                {!isMe && (
                                  <button onClick={() => handleDeleteUser(user.login)}
                                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Статистика */}
                          {stats.count > 0 && (
                            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                              <div className="bg-gray-50 rounded-lg py-1.5">
                                <p className="text-xs text-gray-400">Продаж</p>
                                <p className="font-bold text-sm">{stats.count}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg py-1.5">
                                <p className="text-xs text-gray-400">Товаров</p>
                                <p className="font-bold text-sm">{stats.sales}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg py-1.5">
                                <p className="text-xs text-gray-400">Выручка</p>
                                <p className="font-bold text-sm">{stats.revenue >= 1000 ? (stats.revenue/1000).toFixed(1)+'к' : stats.revenue}₽</p>
                              </div>
                            </div>
                          )}
                          <button onClick={() => setViewingProfile(user.login)} className="mt-2 w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-100 flex items-center justify-center gap-1">
                            <Eye className="w-4 h-4" /> Подробный профиль
                          </button>
                        </div>

                        {/* Форма редактирования */}
                        {isEditing && isMasterAdmin && (
                          <div className="border-t bg-gray-50 p-4 space-y-3">
                            <h4 className="font-bold text-gray-700 text-sm">✏️ Редактирование</h4>
                            <div>
                              <label className="text-xs text-gray-500 font-semibold block mb-1">Отображаемое имя</label>
                              <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                                className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-semibold block mb-1">Роль</label>
                              <div className="grid grid-cols-3 gap-2">
                                {Object.entries(ROLE_LABELS).map(([val, info]) => (
                                  <button key={val} onClick={() => setEditForm({...editForm, role: val, isAdmin: val === 'admin' ? true : editForm.isAdmin})}
                                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${editForm.role === val ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                    {info.icon} {info.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                              <input type="checkbox" id={`admin-${user.login}`}
                                checked={editForm.isAdmin || editForm.role === 'admin'}
                                onChange={e => setEditForm({...editForm, isAdmin: e.target.checked})}
                                className="w-5 h-5 accent-purple-600" />
                              <label htmlFor={`admin-${user.login}`} className="text-sm font-semibold text-gray-700 cursor-pointer">
                                🛡️ Доступ к Админ-панели
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleSaveEdit}
                                className="flex-1 py-2.5 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-all">
                                ✅ Сохранить
                              </button>
                              <button onClick={() => setEditingUser(null)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all">
                                Отмена
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Рейтинг */}
                {Object.keys(employeeStats).length > 0 && (
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3 flex items-center gap-2">🏆 Топ по выручке (всё время)</h3>
                    <div className="space-y-2">
                      {Object.entries(employeeStats)
                        .sort((a, b) => b[1].revenue - a[1].revenue)
                        .slice(0, 5)
                        .map(([name, data], i) => (
                          <div key={name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>{i + 1}</span>
                            <span className="flex-1 font-medium">{name}</span>
                            <div className="text-right">
                              <p className="font-bold text-purple-600">{data.revenue.toLocaleString()}₽</p>
                              <p className="text-xs text-gray-400">{data.count} продаж</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ════ Модальное окно профиля сотрудника ════ */}
                {viewingProfile && (() => {
                  const user = regUsers.find(u => u.login === viewingProfile);
                  if (!user) return null;
                  const empName = user.name || user.login;
                  const emp = employees.find(e => e.name === empName);
                  const profile = profilesData[user.login] || {};
                  const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.seller;
                  
                  // Отчёты сотрудника
                  const empReports = reports.filter(r => r.employee === empName && !r.isUnrecognized);
                  const now = new Date();
                  const weekAgo = new Date(now.getTime() - 7 * 86400000);
                  const monthAgo = new Date(now.getTime() - 30 * 86400000);
                  
                  const parseDate = (ds) => { try { const [dp] = ds.split(','); const [d,m,y] = dp.trim().split('.'); return new Date(parseYear(y), m-1, d); } catch { return new Date(0); } };
                  
                  const weekReports = empReports.filter(r => parseDate(r.date) >= weekAgo);
                  const monthReports = empReports.filter(r => parseDate(r.date) >= monthAgo);
                  
                  // ЗП за неделю и месяц
                  const weekSalary = weekReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                  const weekRevenue = weekReports.reduce((s, r) => s + r.total, 0);
                  const weekTips = weekReports.reduce((s, r) => s + (r.tips || 0), 0);
                  const monthSalary = monthReports.reduce((s, r) => s + getEffectiveSalary(r), 0);
                  const monthRevenue = monthReports.reduce((s, r) => s + r.total, 0);
                  const monthTips = monthReports.reduce((s, r) => s + (r.tips || 0), 0);
                  
                  // Бонусы и штрафы
                  const empBonusList = emp ? bonuses.filter(b => b.employeeId === emp.id) : [];
                  const empPenaltiesList = emp ? penalties.filter(p => p.employeeId === emp.id) : [];
                  const totalBonuses = empBonusList.reduce((s, b) => s + b.amount, 0);
                  const totalPenalties = empPenaltiesList.reduce((s, p) => s + p.amount, 0);
                  
                  // Достижения
                  const myAchievements = customAchievements.filter(a => (achievementsGranted[a.id] || []).includes(user.login));
                  
                  // Формула ЗП
                  const byCat = weekReports.reduce((acc, r) => { const cat = r.category || 'Другое'; acc[cat] = (acc[cat] || 0) + 1; return acc; }, {});
                  
                  return (
                    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setViewingProfile(null)}>
                      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mt-8 mb-8 overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Шапка */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black overflow-hidden">
                              {profile.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : (empName[0] || '?').toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold">{profile.displayName || empName}</h3>
                              <p className="text-white/70 text-sm">@{user.login}</p>
                              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-semibold bg-white/20`}>{roleInfo.icon} {roleInfo.label}</span>
                            </div>
                            <button onClick={() => setViewingProfile(null)} className="text-white/70 hover:text-white p-1"><X className="w-6 h-6" /></button>
                          </div>
                          {profile.birthDate && <p className="text-white/80 text-sm mt-3">🎂 {profile.birthDate}</p>}
                        </div>
                        
                        <div className="p-4 space-y-4">
                          {/* ЗП за неделю */}
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
                            <h4 className="font-bold text-green-700 mb-2">💰 Зарплата за неделю</h4>
                            <p className="text-2xl font-black text-green-600">{weekSalary.toLocaleString()}₽</p>
                            <div className="mt-2 text-xs text-green-700 space-y-1">
                              <p>📦 Продаж: {weekReports.length} шт. → выручка {weekRevenue.toLocaleString()}₽</p>
                              {weekTips > 0 && <p>⭐ Чаевые: {weekTips.toLocaleString()}₽</p>}
                              {Object.entries(byCat).map(([cat, cnt]) => (
                                <p key={cat}>{cat}: {cnt} шт.</p>
                              ))}
                              <p className="text-xs text-green-500 mt-1">ЗП = сумма комиссий от продаж + чаевые</p>
                            </div>
                          </div>
                          
                          {/* ЗП за месяц */}
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <h4 className="font-bold text-blue-700 mb-1">📅 За месяц</h4>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div><p className="text-lg font-black text-blue-600">{monthSalary.toLocaleString()}₽</p><p className="text-xs text-blue-400">ЗП</p></div>
                              <div><p className="text-lg font-black text-blue-600">{monthRevenue.toLocaleString()}₽</p><p className="text-xs text-blue-400">Выручка</p></div>
                              <div><p className="text-lg font-black text-blue-600">{monthReports.length}</p><p className="text-xs text-blue-400">Продаж</p></div>
                            </div>
                          </div>
                          
                          {/* Бонусы и штрафы */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                              <p className="text-xs text-green-600 font-semibold">🎁 Бонусы</p>
                              <p className="text-lg font-black text-green-600">+{totalBonuses.toLocaleString()}₽</p>
                              <p className="text-xs text-green-400">{empBonusList.length} шт.</p>
                              {empBonusList.slice(-3).map(b => <p key={b.id} className="text-xs text-green-500 truncate">{b.reason}: +{b.amount}₽</p>)}
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                              <p className="text-xs text-red-600 font-semibold">⚠️ Штрафы</p>
                              <p className="text-lg font-black text-red-600">-{totalPenalties.toLocaleString()}₽</p>
                              <p className="text-xs text-red-400">{empPenaltiesList.length} шт.</p>
                              {empPenaltiesList.slice(-3).map(p => <p key={p.id} className="text-xs text-red-500 truncate">{p.reason}: -{p.amount}₽</p>)}
                            </div>
                          </div>
                          
                          {/* Достижения */}
                          {myAchievements.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                              <h4 className="font-bold text-yellow-700 mb-2">🏆 Достижения ({myAchievements.length})</h4>
                              <div className="flex flex-wrap gap-2">
                                {myAchievements.map(a => (
                                  <div key={a.id} className="bg-white border border-yellow-300 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                                    <span className="text-lg">{a.icon || '🏆'}</span>
                                    <div>
                                      <p className="text-xs font-bold">{a.title}</p>
                                      {a.bonusAmount > 0 && <p className="text-xs text-green-600">+{a.bonusAmount}₽</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Итого */}
                          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-4">
                            <h4 className="font-bold mb-1">📊 Итого за месяц</h4>
                            <p className="text-2xl font-black">{(monthSalary + totalBonuses - totalPenalties).toLocaleString()}₽</p>
                            <p className="text-xs text-white/70 mt-1">ЗП {monthSalary.toLocaleString()} + Бонусы {totalBonuses.toLocaleString()} - Штрафы {totalPenalties.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* ВКЛАДКА: Персонал+ (штрафы, бонусы, рейтинг, отпуска) */}
          {adminTab === 'personnel' && (() => {
            return (
              <div className="space-y-4">
                {/* Под-вкладки */}
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    { id: 'penalties', label: '⚠️ Штрафы' },
                    { id: 'bonuses', label: '🎁 Бонусы' },
                    { id: 'ratings', label: '⭐ Рейтинг' },
                    { id: 'timeoff', label: '🏖️ Отпуска' },
                    { id: 'kpi', label: '🎯 KPI' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setPersonnelTab(t.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${personnelTab === t.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Штрафы */}
                {personnelTab === 'penalties' && (
                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">➕ Добавить штраф</h3>
                      <div className="space-y-2">
                        <select value={newPenalty.employeeId} onChange={(e) => setNewPenalty({...newPenalty, employeeId: e.target.value})} className="w-full p-2 border rounded">
                          <option value="">Выберите сотрудника</option>
                          {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <input type="number" placeholder="Сумма штрафа" value={newPenalty.amount} onChange={(e) => setNewPenalty({...newPenalty, amount: e.target.value})} className="w-full p-2 border rounded" />
                        <input type="text" placeholder="Причина" value={newPenalty.reason} onChange={(e) => setNewPenalty({...newPenalty, reason: e.target.value})} className="w-full p-2 border rounded" />
                        <button onClick={() => {
                          if (newPenalty.employeeId && newPenalty.amount && newPenalty.reason) {
                            addPenalty(parseInt(newPenalty.employeeId), (parseInt(newPenalty.amount) || 0), newPenalty.reason);
                            setNewPenalty({ employeeId: '', amount: '', reason: '' });
                            showNotification('Штраф добавлен');
                          }
                        }} className="w-full bg-red-500 text-white py-2 rounded font-medium">Добавить штраф</button>
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">📋 История штрафов</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {penalties.slice().reverse().slice(0, 20).map(p => {
                          const emp = employees.find(e => e.id === p.employeeId);
                          return (
                            <div key={p.id} className="flex justify-between items-center p-2 bg-red-50 rounded border border-red-200">
                              <div>
                                <p className="font-medium text-red-700">{emp?.name || 'Удалён'}</p>
                                <p className="text-xs text-gray-500">{p.reason}</p>
                                <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('ru-RU')}</p>
                              </div>
                              <span className="text-red-600 font-bold">-{p.amount}₽</span>
                            </div>
                          );
                        })}
                        {penalties.length === 0 && <p className="text-gray-400 text-center py-4">Нет штрафов</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Бонусы */}
                {personnelTab === 'bonuses' && (() => {
                  const deleteBonus = (id) => {
                    showConfirm('Удалить этот бонус?', () => {
                      updateBonuses(bonuses.filter(b => b.id !== id));
                      showNotification('Бонус удалён');
                    });
                  };
                  
                  const startEditBonus = (b) => {
                    setEditBonusId(b.id);
                    setEditBonusForm({ amount: String(b.amount), reason: b.reason });
                  };
                  
                  const saveEditBonus = () => {
                    const amt = parseInt(editBonusForm.amount);
                    if (!amt || !editBonusForm.reason) { showNotification('Заполните поля', 'error'); return; }
                    updateBonuses(bonuses.map(b => b.id === editBonusId ? { ...b, amount: amt, reason: editBonusForm.reason } : b));
                    setEditBonusId(null);
                    showNotification('Бонус обновлён');
                  };
                  
                  return (
                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">➕ Добавить бонус</h3>
                      <div className="space-y-2">
                        <select value={newBonus.employeeId} onChange={(e) => setNewBonus({...newBonus, employeeId: e.target.value})} className="w-full p-2 border rounded">
                          <option value="">Выберите сотрудника</option>
                          {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <input type="number" placeholder="Сумма бонуса" value={newBonus.amount} onChange={(e) => setNewBonus({...newBonus, amount: e.target.value})} className="w-full p-2 border rounded" />
                        <input type="text" placeholder="Причина" value={newBonus.reason} onChange={(e) => setNewBonus({...newBonus, reason: e.target.value})} className="w-full p-2 border rounded" />
                        <button onClick={() => {
                          if (newBonus.employeeId && newBonus.amount && newBonus.reason) {
                            addBonus(parseInt(newBonus.employeeId), (parseInt(newBonus.amount) || 0), newBonus.reason);
                            setNewBonus({ employeeId: '', amount: '', reason: '' });
                            showNotification('Бонус добавлен');
                          }
                        }} className="w-full bg-green-500 text-white py-2 rounded font-medium">Добавить бонус</button>
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">📋 История бонусов</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {bonuses.slice().reverse().slice(0, 40).map(b => {
                          const emp = employees.find(e => e.id === b.employeeId);
                          const isAchBonus = !!b.achievementId || (b.reason && b.reason.startsWith('Достижение:'));
                          const isEditing = editBonusId === b.id;
                          
                          return (
                            <div key={b.id} className={`p-3 rounded-lg border ${isAchBonus ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input type="number" value={editBonusForm.amount} onChange={e => setEditBonusForm({...editBonusForm, amount: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Сумма" />
                                  <input type="text" value={editBonusForm.reason} onChange={e => setEditBonusForm({...editBonusForm, reason: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Причина" />
                                  <div className="flex gap-2">
                                    <button onClick={() => setEditBonusId(null)} className="flex-1 py-1.5 bg-gray-200 rounded text-sm font-medium">Отмена</button>
                                    <button onClick={saveEditBonus} className="flex-1 py-1.5 bg-green-500 text-white rounded text-sm font-medium">Сохранить</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-green-700">{emp?.name || b.employeeName || 'Удалён'}</p>
                                      {isAchBonus && <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">🏆</span>}
                                    </div>
                                    <p className="text-xs text-gray-500">{b.reason}</p>
                                    <p className="text-xs text-gray-400">{b.date ? new Date(b.date).toLocaleDateString('ru-RU') : ''}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-green-600 font-bold">+{b.amount}₽</span>
                                    <button onClick={() => startEditBonus(b)} className="text-blue-400 hover:text-blue-600 p-1"><Edit3 className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => deleteBonus(b.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {bonuses.length === 0 && <p className="text-gray-400 text-center py-4">Нет бонусов</p>}
                      </div>
                    </div>
                  </div>
                  );
                })()}

                {/* Рейтинг */}
                {personnelTab === 'ratings' && (
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">⭐ Рейтинг сотрудников</h3>
                    <div className="space-y-3">
                      {employees.filter(e => e.active).map(emp => {
                        const avgRating = getEmployeeAverageRating(emp.id);
                        const empPenalties = getEmployeePenalties(emp.id);
                        const empBonuses = getEmployeeBonuses(emp.id);
                        return (
                          <div key={emp.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold">{emp.name}</span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star key={star} className={`w-4 h-4 cursor-pointer ${star <= avgRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                    onClick={() => rateEmployee(emp.id, star)} />
                                ))}
                                <span className="text-sm text-gray-500 ml-1">({avgRating.toFixed(1)})</span>
                              </div>
                            </div>
                            <div className="flex gap-4 text-xs">
                              <span className="text-red-500">Штрафов: {empPenalties.length} ({empPenalties.reduce((s, p) => s + p.amount, 0)}₽)</span>
                              <span className="text-green-500">Бонусов: {empBonuses.length} ({empBonuses.reduce((s, b) => s + b.amount, 0)}₽)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Отпуска/Больничные */}
                {personnelTab === 'timeoff' && (
                  <div className="space-y-4">
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">➕ Добавить отпуск/больничный</h3>
                      <div className="space-y-2">
                        <select value={newTimeOff.employeeId} onChange={(e) => setNewTimeOff({...newTimeOff, employeeId: e.target.value})} className="w-full p-2 border rounded">
                          <option value="">Выберите сотрудника</option>
                          {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <select value={newTimeOff.type} onChange={(e) => setNewTimeOff({...newTimeOff, type: e.target.value})} className="w-full p-2 border rounded">
                          <option value="vacation">🏖️ Отпуск</option>
                          <option value="sick">🏥 Больничный</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={newTimeOff.startDate} onChange={(e) => setNewTimeOff({...newTimeOff, startDate: e.target.value})} className="p-2 border rounded" />
                          <input type="date" value={newTimeOff.endDate} onChange={(e) => setNewTimeOff({...newTimeOff, endDate: e.target.value})} className="p-2 border rounded" />
                        </div>
                        <input type="text" placeholder="Примечание" value={newTimeOff.note} onChange={(e) => setNewTimeOff({...newTimeOff, note: e.target.value})} className="w-full p-2 border rounded" />
                        <button onClick={() => {
                          if (newTimeOff.employeeId && newTimeOff.startDate && newTimeOff.endDate) {
                            addTimeOff(parseInt(newTimeOff.employeeId), newTimeOff.type, newTimeOff.startDate, newTimeOff.endDate, newTimeOff.note);
                            setNewTimeOff({ employeeId: '', type: 'vacation', startDate: '', endDate: '', note: '' });
                            showNotification('Добавлено');
                          }
                        }} className="w-full bg-blue-500 text-white py-2 rounded font-medium">Добавить</button>
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <h3 className="font-bold mb-3">📋 Текущие отсутствия</h3>
                      <div className="space-y-2">
                        {getActiveTimeOff().map(t => {
                          const emp = employees.find(e => e.id === t.employeeId);
                          return (
                            <div key={t.id} className={`p-3 rounded-lg ${t.type === 'sick' ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{emp?.name || 'Удалён'}</span>
                                <span className="text-sm">{t.type === 'sick' ? '🏥 Больничный' : '🏖️ Отпуск'}</span>
                              </div>
                              <p className="text-xs text-gray-500">{t.startDate} — {t.endDate}</p>
                              {t.note && <p className="text-xs text-gray-400">{t.note}</p>}
                            </div>
                          );
                        })}
                        {getActiveTimeOff().length === 0 && <p className="text-gray-400 text-center py-4">Все на работе</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* KPI */}
                {personnelTab === 'kpi' && (
                  // KPI: inline-форма без вложенных компонентов (чтобы state не сбрасывался)
                  <KpiGoalsPanel
                    employees={employees}
                    employeeKPI={employeeKPI}
                    setEmployeeGoal={setEmployeeGoal}
                    showNotification={showNotification}
                    getEmployeeProgress={getEmployeeProgress}
                  />
                )}
              </div>
            );
          })()}

          {/* ВКЛАДКА: Финансы */}
          {adminTab === 'finance' && (
            <div className="space-y-4">
              {/* Сводка */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                <h3 className="font-bold mb-3">💰 Финансовая сводка (неделя)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-xs opacity-80">Выручка</p>
                    <p className="text-xl font-bold">+{weekRevenue.toLocaleString()}₽</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-xs opacity-80">ЗП сотрудников</p>
                    <p className="text-xl font-bold">-{weekSalary.toLocaleString()}₽</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-xs opacity-80">Расходы</p>
                    <p className="text-xl font-bold">-{weekExpenses.toLocaleString()}₽</p>
                  </div>
                  <div className="bg-white/20 rounded-lg p-3">
                    <p className="text-xs opacity-80">Чистая прибыль</p>
                    <p className="text-xl font-bold">{(weekRevenue - weekSalary - weekExpenses).toLocaleString()}₽</p>
                  </div>
                </div>
              </div>

              {/* Настройки зарплаты */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><DollarSign className="w-5 h-5 text-purple-600" />Настройки зарплаты</h3>
                <div className="space-y-2">
                  {salarySettings.ranges.map((range, i) => (
                    <div key={i} className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg text-sm">
                      <input type="number" value={range.min} onChange={(e) => updateRange(i, 'min', e.target.value)} className="w-16 px-2 py-1 border rounded text-center" />
                      <span className="text-gray-400">—</span>
                      <input type="number" value={range.max} onChange={(e) => updateRange(i, 'max', e.target.value)} className="w-16 px-2 py-1 border rounded text-center" />
                      <span className="text-gray-400">=</span>
                      <input type="number" value={range.base} onChange={(e) => updateRange(i, 'base', e.target.value)} className="w-16 px-2 py-1 border-2 border-purple-200 rounded text-center font-bold" />
                      <span className="text-gray-600">₽</span>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-3 mt-3 p-3 bg-amber-50 rounded-lg cursor-pointer" onClick={toggleBonus}>
                  <input type="checkbox" checked={salarySettings.bonusForBirds} readOnly className="w-5 h-5 accent-purple-600" />
                  <div><span className="font-medium">Бонус за птичек</span><p className="text-xs text-gray-600">Добавлять разницу при продаже выше базовой</p></div>
                </label>
              </div>

              {/* Расходы по категориям */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">📝 Расходы по категориям</h3>
                <div className="space-y-2">
                  {expenseCategories.map(cat => {
                    const catExpenses = expenses.filter(e => e.category === cat.id || (!e.category && cat.id === 'other'));
                    const total = catExpenses.reduce((s, e) => s + e.amount, 0);
                    return (
                      <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <span className="text-sm">{cat.emoji} {cat.name}</span>
                        <span className="font-bold text-red-600">{total.toLocaleString()}₽</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: Точки продаж */}
          {adminTab === 'locations' && (() => {
            const cities = getCities();
            return (
              <div className="space-y-4">
                {/* Добавление точки */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5 text-purple-600" />Добавить точку</h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="text" placeholder="Город" value={newCity} onChange={(e) => setNewCity(e.target.value)} className="flex-1 p-2 border rounded" list="cities-list" />
                      <datalist id="cities-list">{cities.map(c => <option key={c} value={c} />)}</datalist>
                    </div>
                    <input type="text" placeholder="Название точки (например: Пушкинская ул.)" value={newLocName} onChange={(e) => setNewLocName(e.target.value)} className="w-full p-2 border rounded" />
                    <button onClick={() => {
                      if (newCity.trim() && newLocName.trim()) {
                        addLocation(newCity.trim(), newLocName.trim());
                        setNewCity(''); setNewLocName('');
                        showNotification('Точка добавлена');
                      }
                    }} className="w-full bg-purple-500 text-white py-2 rounded font-medium">Добавить точку</button>
                  </div>
                </div>

                {/* Фильтр по городу */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button onClick={() => setSelectedCity('')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedCity ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                    Все города
                  </button>
                  {cities.map(city => (
                    <button key={city} onClick={() => setSelectedCity(city)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCity === city ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                      {city}
                    </button>
                  ))}
                </div>

                {/* Список точек */}
                {(selectedCity ? [selectedCity] : cities).map(city => (
                  <div key={city} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3 flex items-center gap-2">📍 {city}</h3>
                    <div className="space-y-2">
                      {getLocationsByCity(city).map(loc => (
                        <div key={loc.id} className={`flex items-center justify-between p-3 rounded-lg border ${loc.active ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                          <div>
                            <span className="font-medium">{loc.name}</span>
                            {!loc.active && <span className="ml-2 text-xs text-red-500">неактивна</span>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => toggleLocationActive(loc.id)} className={`px-3 py-1 rounded text-sm ${loc.active ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                              {loc.active ? 'Отключить' : 'Включить'}
                            </button>
                            <button onClick={() => showConfirm('Удалить точку?', () => removeLocation(loc.id))} className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">
                              Удалить
                            </button>
                          </div>
                        </div>
                      ))}
                      {getLocationsByCity(city).length === 0 && <p className="text-gray-400 text-center py-4">Нет точек</p>}
                    </div>
                  </div>
                ))}

                {cities.length === 0 && (
                  <div className="text-center py-10 bg-white rounded-xl shadow">
                    <MapPin className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">Добавьте первую точку продаж</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ВКЛАДКА: Товары */}
          {adminTab === 'products' && (
            <div className="space-y-4">
              {/* Добавление товара */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-5 h-5 text-purple-600" />Добавить товар</h3>
                <div className="space-y-2">
                  <input type="text" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} placeholder="Название" className="w-full p-2 border rounded" />
                  <div className="flex gap-2">
                    <input type="number" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: e.target.value})} placeholder="Цена" className="flex-1 p-2 border rounded" />
                    <input type="text" value={newProduct.emoji} onChange={(e) => setNewProduct({...newProduct, emoji: e.target.value})} placeholder="🎁" className="w-16 p-2 border rounded text-center" />
                  </div>
                  <select value={newProduct.category} onChange={(e) => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border rounded">
                    {Object.keys(PRODUCTS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {/* Фото товара */}
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
              </div>

              {/* Все товары с возможностью редактирования */}
              {Object.entries(PRODUCTS).map(([cat, items]) => (
                <div key={cat} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3">{CAT_ICONS[cat]} {cat} ({items.length + customProducts.filter(p => p.category === cat).length})</h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {[...items.map(p => ({...p, category: cat, isBase: true})), ...customProducts.filter(p => p.category === cat).map(p => ({...p, isBase: false}))].map((prod, i) => (
                      <div key={prod.name + i} className={`flex items-center gap-2 p-2 rounded-lg text-sm ${prod.isBase ? 'bg-gray-50' : 'bg-purple-50'}`}>
                        {productPhotos[prod.name] ? (
                          <img src={productPhotos[prod.name]} alt={prod.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-200 shadow-sm" />
                        ) : (
                          <span className="text-2xl flex-shrink-0 w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center text-4xl">{prod.emoji}</span>
                        )}
                        {editingProduct === prod.name ? (
                          <div className="flex-1 flex gap-1">
                            <input type="text" value={editProductData.emoji} onChange={(e) => setEditProductData({...editProductData, emoji: e.target.value})} className="w-10 p-1 border rounded text-center text-xs" />
                            <input type="number" value={editProductData.price} onChange={(e) => setEditProductData({...editProductData, price: e.target.value})} className="w-16 p-1 border rounded text-xs" placeholder="Цена" />
                            <button onClick={() => { if (!prod.isBase) { const updated = customProducts.map(p => p.name === prod.name ? {...p, emoji: editProductData.emoji, price: parseInt(editProductData.price) || p.price} : p); setCustomProducts(updated); save('likebird-custom-products', updated); } setEditingProduct(null); showNotification('Сохранено'); }} className="px-2 py-1 bg-green-500 text-white rounded text-xs">✓</button>
                            <button onClick={() => setEditingProduct(null)} className="px-2 py-1 bg-gray-300 rounded text-xs">✕</button>
                          </div>
                        ) : (
                          <>
                            <span className="flex-1">{prod.name}</span>
                            <span className="text-gray-500">{prod.price}₽</span>
                            <div className="flex gap-1">
                              {/* Загрузка фото */}
                              <label className="text-gray-400 hover:text-purple-500 cursor-pointer"><Camera className="w-4 h-4" /><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files[0]; if (f) { const compressed = await compressImage(f, 400, 0.6); if (compressed) { updateProductPhotos({...productPhotos, [prod.name]: compressed}); showNotification('📷 Фото добавлено'); } else { showNotification('Формат не поддерживается', 'error'); } }}} className="hidden" /></label>
                              {!prod.isBase && <button onClick={() => { setEditingProduct(prod.name); setEditProductData({ name: prod.name, price: prod.price, emoji: prod.emoji, category: prod.category }); }} className="text-gray-400 hover:text-blue-500"><Edit3 className="w-3.5 h-3.5" /></button>}
                              {!prod.isBase && <button onClick={() => showConfirm(`Удалить ${prod.name}?`, () => removeCustomProduct(prod.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
                              <button onClick={() => { toggleArchiveProduct(prod.name); showNotification(archivedProducts.includes(prod.name) ? 'Товар восстановлен' : 'Товар в архиве'); }} className={`text-xs ${archivedProducts.includes(prod.name) ? 'text-green-500' : 'text-gray-400 hover:text-amber-500'}`} title={archivedProducts.includes(prod.name) ? 'Восстановить' : 'Архивировать'}>{archivedProducts.includes(prod.name) ? '♻️' : '📦'}</button>
                              {productPhotos[prod.name] && <button onClick={() => { deleteMediaPhoto(prod.name); showNotification('Фото удалено'); }} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}


            </div>
          )}

          {/* ВКЛАДКА: Ревизия */}
          {adminTab === 'stock' && (
            <div className="space-y-4">
              {/* Общая информация */}
              <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 border-2 border-amber-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-amber-700">🐦 Всего птичек-свистулек</p>
                    <p className="text-xs text-amber-600">По ревизии / В системе</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-700">
                      {totalBirds > 0 ? totalBirds : '—'} 
                      <span className="text-lg text-amber-500"> / {Object.entries(stock).filter(([_, data]) => data.category === 'Птички-свистульки').reduce((sum, [_, data]) => sum + data.count, 0)}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Низкие остатки */}
              {getLowStockItems().length > 0 && (
                <div className="bg-orange-50 border border-orange-300 rounded-xl p-4">
                  <h3 className="font-bold text-orange-700 mb-3 flex items-center gap-2">
                    <Bell className="w-5 h-5" />Требуется дозаказ ({getLowStockItems().length})
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {getLowStockItems().map(item => (
                      <div key={item.name} className="flex justify-between items-center p-2 bg-white rounded-lg text-sm">
                        <span>{item.emoji} {item.name}</span>
                        <span className="font-bold text-orange-600">{item.count} шт (мин: {item.minStock})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Переход к полной ревизии */}
              <button onClick={() => setCurrentView('stock')} className="w-full bg-amber-500 text-white py-4 rounded-xl font-bold hover:bg-amber-600 flex items-center justify-center gap-2">
                <Package className="w-6 h-6" />Открыть полную ревизию
              </button>

              {/* Статистика по категориям */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">📊 Остатки по категориям</h3>
                <div className="space-y-2">
                  {Object.keys(PRODUCTS).map(cat => {
                    const catItems = Object.entries(stock).filter(([_, data]) => data.category === cat);
                    const total = catItems.reduce((sum, [_, data]) => sum + data.count, 0);
                    const lowCount = catItems.filter(([_, data]) => data.count <= data.minStock).length;
                    return (
                      <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="font-medium">{CAT_ICONS[cat]} {cat}</span>
                        <div className="text-right">
                          <span className="font-bold">{total} шт</span>
                          {lowCount > 0 && <span className="text-orange-500 text-xs ml-2">({lowCount} мало)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Быстрый ввод птичек */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3">🐦 Быстрый ввод птичек по ревизии</h3>
                <div className="flex gap-2">
                  <input type="number" value={totalBirds || ''} onChange={(e) => { setTotalBirds(parseInt(e.target.value) || 0); save('likebird-totalbirds', parseInt(e.target.value) || 0); }} placeholder="Количество" className="flex-1 p-3 border rounded-lg" />
                  <button onClick={() => showNotification('Сохранено')} className="bg-amber-500 text-white px-4 rounded-lg hover:bg-amber-600">Сохранить</button>
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: Склад+ (история, списания, автозаказ) */}
          {adminTab === 'stockplus' && (
              <div className="space-y-4">
                {/* Под-вкладки */}
                <div className="flex gap-2">
                  {[
                    { id: 'history', label: '📜 История' },
                    { id: 'writeoff', label: '🗑️ Списания' },
                    { id: 'autoorder', label: '📦 Автозаказ' },
                    { id: 'cost', label: '💰 Себестоимость' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setStockTab(t.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${stockTab === t.id ? 'bg-purple-500 text-white' : 'bg-white border text-gray-600'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* История движения */}
                {stockTab === 'history' && (
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
                )}

                {/* Списания */}
                {stockTab === 'writeoff' && (
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
                )}

                {/* Автозаказ */}
                {stockTab === 'autoorder' && (
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
                )}

                {/* Себестоимость */}
                {stockTab === 'cost' && (
                  <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                    <h3 className="font-bold mb-3">💰 Себестоимость товаров</h3>
                    <p className="text-xs text-gray-500 mb-3">⚠️ Эта информация видна только администратору</p>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {DYNAMIC_ALL_PRODUCTS.map(prod => (
                        <div key={prod.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium">{prod.emoji} {prod.name}</span>
                            <span className="text-gray-400 text-sm ml-2">Цена: {prod.price}₽</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Себест:</span>
                            <input type="number" value={getCostPrice(prod.name) || ''} onChange={(e) => setCostPrice(prod.name, parseInt(e.target.value) || 0)}
                              placeholder="0" className="w-20 p-1 border rounded text-center text-sm" />
                            <span className="text-xs">₽</span>
                            {getCostPrice(prod.name) > 0 && (
                              <span className="text-xs text-green-600 font-medium ml-2">
                                Прибыль: {prod.price - getCostPrice(prod.name)}₽
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
          )}

          {/* ВКЛАДКА: Чат */}
          {adminTab === 'chat' && (
              <div className="space-y-4">
                {/* Отправка сообщения */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-purple-600" />Новое сообщение</h3>
                  <div className="space-y-2">
                    <select value={chatTo} onChange={(e) => setChatTo(e.target.value)} className="w-full p-2 border rounded">
                      <option value="">📢 Всем сотрудникам</option>
                      {employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>👤 {e.name}</option>)}
                    </select>
                    <textarea value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Текст сообщения..." className="w-full p-3 border rounded-lg" rows={3} />
                    <button onClick={() => {
                      if (chatText.trim()) {
                        sendMessage(chatText.trim(), chatTo ? parseInt(chatTo) : null);
                        setChatText('');
                        showNotification('Сообщение отправлено');
                      }
                    }} className="w-full bg-purple-500 text-white py-2 rounded font-medium">Отправить</button>
                  </div>
                </div>

                {/* Список сообщений */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3">💬 История сообщений</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {chatMessages.slice().reverse().slice(0, 30).map(msg => {
                      const toEmp = msg.to ? employees.find(e => e.id === msg.to) : null;
                      return (
                        <div key={msg.id} className={`p-3 rounded-lg ${msg.read ? 'bg-gray-50' : 'bg-purple-50 border border-purple-200'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm">{msg.from}</span>
                            <span className="text-xs text-gray-400">{new Date(msg.date).toLocaleString('ru-RU')}</span>
                          </div>
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {toEmp ? `→ ${toEmp.name}` : '→ Всем'}
                            {!msg.read && <span className="ml-2 text-purple-600">● Новое</span>}
                          </p>
                        </div>
                      );
                    })}
                    {chatMessages.length === 0 && <p className="text-gray-400 text-center py-8">Нет сообщений</p>}
                  </div>
                </div>
              </div>
          )}

          {/* ВКЛАДКА: График работы */}
          {adminTab === 'schedule' && (() => {
            const EVENT_TYPES = [
              { id: 'sale', label: '🎁 Акция', emoji: '🎁' },
              { id: 'holiday', label: '🎉 Праздник', emoji: '🎉' },
              { id: 'training', label: '📚 Обучение', emoji: '📚' },
              { id: 'shift', label: '🔄 Смена', emoji: '🔄' },
              { id: 'info', label: '📌 Инфо', emoji: '📌' },
            ];

            const saveEvent = () => {
              if (!newDate || !newEvent.title) { showNotification('Заполните дату и название', 'error'); return; }
              const [y, m, d] = newDate.split('-');
              const dateKey = `${d}.${m}.${y}`;
              const updated = { ...eventsCalendar };
              if (!updated[dateKey]) updated[dateKey] = [];
              if (editingEventRef) {
                // Удаляем старое событие (дата могла измениться)
                const oldKey = editingEventRef.dateKey;
                const oldIdx = editingEventRef.index;
                if (updated[oldKey]) {
                  updated[oldKey] = updated[oldKey].filter((_, i) => i !== oldIdx);
                  if (updated[oldKey].length === 0) delete updated[oldKey];
                }
                if (!updated[dateKey]) updated[dateKey] = [];
              }
              updated[dateKey] = [...(updated[dateKey] || []), { ...newEvent, createdAt: Date.now() }];
              setEventsCalendar(updated);
              save('likebird-events', updated);
              setNewDate(''); setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' });
              setEditingEventRef(null);
              setShowEventForm(false);
              showNotification(editingEventRef ? 'Событие обновлено' : 'Событие добавлено');
            };
            const deleteEvent = (date, index) => {
              showConfirm('Удалить событие?', () => {
                const updated = { ...eventsCalendar };
                if (updated[date]) {
                  updated[date] = updated[date].filter((_, i) => i !== index);
                  if (updated[date].length === 0) delete updated[date];
                }
                setEventsCalendar(updated);
                save('likebird-events', updated);
              });
            };
            const startEditEvent = (date, index, ev) => {
              const [d, m, y] = date.split('.');
              setNewDate(`${y}-${m}-${d}`);
              setNewEvent({ title: ev.title, description: ev.description || '', type: ev.type || 'info', emoji: ev.emoji || '📅' });
              setEditingEventRef({ dateKey: date, index });
              setShowEventForm(true);
            };

            // Flatten: [{date, ev, index}, ...] sorted by date
            const sortedEvents = Object.entries(eventsCalendar)
              .flatMap(([date, evArr]) => (Array.isArray(evArr) ? evArr : [evArr]).map((ev, i) => ({ date, ev, index: i })))
              .sort((a, b) => {
                const parse = (d) => { const [dd, mm, yy] = d.split('.'); return new Date(parseInt(parseYear(yy)), mm - 1, dd); };
                return parse(a.date) - parse(b.date);
              });

            return (
              <div className="space-y-4">
                <ScheduleEditor />

                {/* Календарь событий */}
                <div className="bg-white rounded-2xl p-4 shadow">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-red-500" />
                      События и даты ({sortedEvents.length})
                    </h3>
                    <button onClick={() => setShowEventForm(!showEventForm)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${showEventForm ? 'bg-gray-100 text-gray-600' : 'bg-red-500 text-white hover:bg-red-600'}`}>
                      {showEventForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {showEventForm ? 'Отмена' : 'Добавить'}
                    </button>
                  </div>

                  {showEventForm && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 font-semibold block mb-1">Дата *</label>
                          <input type="date" value={newDate} onChange={e => {
                            setNewDate(e.target.value);
                          }} className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 font-semibold block mb-1">Тип</label>
                          <select value={newEvent.type} onChange={e => {
                            const t = EVENT_TYPES.find(et => et.id === e.target.value);
                            setNewEvent({...newEvent, type: e.target.value, emoji: t?.emoji || '📅'});
                          }} className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none">
                            {EVENT_TYPES.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                        placeholder="Название события *"
                        className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none" />
                      <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                        placeholder="Описание (необязательно)"
                        rows={2} className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none resize-none" />
                      <button onClick={saveEvent}
                        className="w-full py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">
                        {editingEventRef ? '✏️ Обновить событие' : '✅ Сохранить событие'}
                      </button>
                      {editingEventRef && (
                        <button onClick={() => { setEditingEventRef(null); setShowEventForm(false); setNewDate(''); setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' }); }}
                          className="w-full py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 mt-2">
                          Отмена редактирования
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {sortedEvents.length === 0 ? (
                      <p className="text-gray-400 text-center py-6">Нет событий</p>
                    ) : sortedEvents.map(({ date, ev, index }) => (
                      <div key={`${date}_${index}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border">
                        <span className="text-2xl flex-shrink-0">{ev.emoji || '📅'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{ev.title}</p>
                          <p className="text-xs text-gray-400">{date}{ev.description && ` • ${ev.description}`}</p>
                        </div>
                        <button onClick={() => startEditEvent(date, index, ev)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg flex-shrink-0">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteEvent(date, index)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ВКЛАДКА: Настройки */}

          {/* BLOCK 8: Audit Log */}
          {adminTab === 'audit' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">📋 Журнал действий ({auditLog.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLog.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Нет записей</p>
                  ) : auditLog.slice(0, 50).map(entry => (
                    <div key={entry.id} className="p-3 bg-gray-50 rounded-lg border text-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold">{entry.action}</span>
                        <span className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString('ru')}</span>
                      </div>
                      <p className="text-gray-600 text-xs mt-1">{entry.details}</p>
                      <p className="text-xs text-gray-400 mt-0.5">👤 {entry.user}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BLOCK 7: Challenges Management */}
          {adminTab === 'challenges' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2">🏆 Челленджи</h3>
                {/* New challenge form */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 space-y-2">
                  <input type="text" value={challengeForm.title} onChange={e => setChallengeForm({...challengeForm, title: e.target.value})}
                    placeholder="Название челленджа" className="w-full p-2 border rounded-lg text-sm" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={challengeForm.type} onChange={e => setChallengeForm({...challengeForm, type: e.target.value})}
                      className="p-2 border rounded-lg text-sm">
                      <option value="daily">Ежедневный</option>
                      <option value="weekly">Еженедельный</option>
                    </select>
                    <select value={challengeForm.metric} onChange={e => setChallengeForm({...challengeForm, metric: e.target.value})}
                      className="p-2 border rounded-lg text-sm">
                      <option value="sales_count">Кол-во продаж</option>
                      <option value="revenue">Выручка</option>
                      <option value="product_sales">Продажи товара</option>
                      <option value="avg_check">Средний чек</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={challengeForm.target} onChange={e => setChallengeForm({...challengeForm, target: parseInt(e.target.value) || 0})}
                      placeholder="Цель" className="p-2 border rounded-lg text-sm" />
                    <input type="text" value={challengeForm.reward} onChange={e => setChallengeForm({...challengeForm, reward: e.target.value})}
                      placeholder="Награда (опц.)" className="p-2 border rounded-lg text-sm" />
                  </div>
                  {challengeForm.metric === 'product_sales' && (
                    <input type="text" value={challengeForm.product} onChange={e => setChallengeForm({...challengeForm, product: e.target.value})}
                      placeholder="Название товара" className="w-full p-2 border rounded-lg text-sm" />
                  )}
                  <button onClick={() => {
                    if (!challengeForm.title || !challengeForm.target) { showNotification('Заполните название и цель', 'error'); return; }
                    const ch = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), ...challengeForm, condition: { metric: challengeForm.metric, target: challengeForm.target, product: challengeForm.product }, active: true, createdAt: new Date().toISOString() };
                    updateChallenges([...challenges, ch]);
                    setChallengeForm({ title: '', icon: '🏆', type: 'daily', metric: 'sales_count', target: 10, product: '', reward: '' });
                    showNotification('Челлендж создан!');
                  }} className="w-full py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600">
                    + Создать челлендж
                  </button>
                </div>
                {/* Existing challenges */}
                <div className="space-y-2">
                  {challenges.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">Нет челленджей</p>
                  ) : challenges.map(ch => (
                    <div key={ch.id} className={`p-3 rounded-xl border ${ch.active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-sm">{ch.icon || '🏆'} {ch.title}</p>
                          <p className="text-xs text-gray-500">{ch.type === 'daily' ? 'Ежедневный' : 'Еженедельный'} · Цель: {ch.condition?.target || ch.target} · {ch.condition?.metric}</p>
                          {ch.reward && <p className="text-xs text-amber-600">🎁 {ch.reward}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => updateChallenges(challenges.map(c => c.id === ch.id ? {...c, active: !c.active} : c))}
                            className={`px-2 py-1 rounded text-xs font-bold ${ch.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {ch.active ? 'ON' : 'OFF'}
                          </button>
                          <button onClick={() => showConfirm('Удалить челлендж?', () => updateChallenges(challenges.filter(c => c.id !== ch.id)))}
                            className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {adminTab === 'settings' && (
            <div className="space-y-4">
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Settings className="w-5 h-5 text-purple-600" />Общие настройки</h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium">📊 Статистика системы</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>Отчётов: <span className="font-bold">{reports.length}</span></div>
                      <div>Расходов: <span className="font-bold">{expenses.length}</span></div>
                      <div>Товаров: <span className="font-bold">{ALL_PRODUCTS.length + customProducts.length}</span></div>
                      <div>Дней: <span className="font-bold">{getAllDates().length}</span></div>
                      <div>Фото товаров: <span className="font-bold">{Object.keys(productPhotos).length}</span></div>
                      <div>Фото смен: <span className="font-bold">{Object.keys(shiftPhotos).length}</span></div>
                      <div>Размер медиа: <span className="font-bold">{Math.round((JSON.stringify(productPhotos).length + JSON.stringify(shiftPhotos).length) / 1024)} КБ</span></div>
                    </div>
                  </div>
                  {Object.keys(productPhotos).length > 0 && (
                    <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                      <p className="font-medium text-blue-700">📷 Фото товаров</p>
                      <button onClick={() => {
                        // Пушим каждое фото отдельным ключом + индекс
                        const names = Object.keys(productPhotos);
                        names.forEach(name => {
                          const k = 'likebird-mp-' + name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '_');
                          fbSave(k, productPhotos[name]);
                        });
                        fbSave('likebird-media-index', names);
                        // Легаси (для обратной совместимости)
                        fbSave('likebird-product-photos-data', productPhotos);
                        // Фото смен
                        Object.entries(shiftPhotos).forEach(([dk, v]) => {
                          fbSave('likebird-ms-' + dk.replace(/[^a-zA-Z0-9_.]/g, '_'), v);
                        });
                        showNotification(`☁️ ${names.length} фото товаров + ${Object.keys(shiftPhotos).length} фото смен → облако`);
                      }} className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 text-sm flex items-center justify-center gap-2">
                        <Upload className="w-4 h-4" />Синхронизировать все медиа в облако
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Экспорт/Импорт */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Download className="w-5 h-5 text-purple-600" />Резервное копирование</h3>
                <div className="space-y-2">
                  <button onClick={() => {
                    const data = SyncManager.exportAll();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `likebird-backup-${formatDate(new Date()).replace(/\./g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    logAction('Создана резервная копия', '');
                    showNotification('Резервная копия создана');
                  }} className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />Скачать резервную копию
                  </button>
                </div>
              </div>

              {/* Очистка данных — только мастер-администратор */}
              {currentUser?.isAdmin && (
                <div className="bg-white rounded-xl p-4 shadow border-2 border-red-200">
                  <h3 className="font-bold mb-3 flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" />Опасная зона</h3>
                  <div className="space-y-2">
                    <button onClick={() => showConfirm('Удалить ВСЕ отчёты? Это действие необратимо!', () => { updateReports([]); logAction('Удалены все отчёты', ''); showNotification('Отчёты удалены'); })} className="w-full bg-red-100 text-red-600 py-2 rounded hover:bg-red-200">
                      Удалить все отчёты
                    </button>
                    <button onClick={() => showConfirm('Удалить ВСЕ расходы? Это действие необратимо!', () => { setExpenses([]); save('likebird-expenses', []); logAction('Удалены все расходы', ''); showNotification('Расходы удалены'); })} className="w-full bg-red-100 text-red-600 py-2 rounded hover:bg-red-200">
                      Удалить все расходы
                    </button>
                    <div className="border-t border-red-200 my-3 pt-3">
                      <p className="text-xs text-red-400 mb-2">⚠️ Полная очистка удалит ВСЕ данные приложения: отчёты, расходы, склад, сотрудников, настройки и т.д. Это действие нельзя отменить!</p>
                      <button onClick={clearAllData} className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600">🗑️ Очистить ВСЕ данные</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА: Безопасность */}
          {adminTab === 'security' && (
            <div className="space-y-4">
              {/* Коды приглашения для сотрудников */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Key className="w-5 h-5 text-green-600" />Коды приглашения</h3>
                <p className="text-sm text-gray-500 mb-3">Сгенерируйте код и передайте сотруднику для регистрации</p>
                <button onClick={() => {
                  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                  const newCodes = [...inviteCodes, { code, createdAt: Date.now(), used: false, usedBy: null }];
                  setInviteCodes(newCodes);
                  save('likebird-invite-codes', newCodes);
                  logAction('Создан код приглашения', code);
                  showNotification(`Код: ${code}`);
                }} className="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 mb-3">🔑 Сгенерировать код</button>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inviteCodes.slice().reverse().map((ic, i) => (
                    <div key={i} className={`flex justify-between items-center p-2 rounded-lg text-sm ${ic.used ? 'bg-gray-100' : 'bg-green-50 border border-green-200'}`}>
                      <div>
                        <span className={`font-mono font-bold text-lg ${ic.used ? 'text-gray-400 line-through' : 'text-green-700'}`}>{ic.code}</span>
                        {ic.used && <span className="text-xs text-gray-500 ml-2">→ {ic.usedBy}</span>}
                      </div>
                      <div className="flex gap-2">
                        {!ic.used && <button onClick={() => { navigator.clipboard.writeText(ic.code); showNotification('Код скопирован'); }} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">📋</button>}
                        <button onClick={() => {
                          const updated = inviteCodes.filter((_, j) => j !== inviteCodes.length - 1 - i);
                          setInviteCodes(updated);
                          save('likebird-invite-codes', updated);
                        }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  {inviteCodes.length === 0 && <p className="text-gray-400 text-center text-sm py-4">Нет созданных кодов</p>}
                </div>
                {/* Зарегистрированные пользователи */}
                {(() => { try { const users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); return users.length > 0 ? (
                  <div className="mt-4 pt-3 border-t">
                    <h4 className="font-semibold text-sm mb-2">👥 Зарегистрированные ({users.length})</h4>
                    {users.map((u, i) => (
                      <div key={i} className="flex justify-between items-center py-1 text-sm">
                        <span>{u.name}</span>
                        <span className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</span>
                      </div>
                    ))}
                  </div>
                ) : null; } catch { return null; } })()}
              </div>

              {/* Пароль */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><Lock className="w-5 h-5 text-purple-600" />Пароль админ-панели</h3>
                <p className="text-sm text-gray-600 mb-3">{adminPassword ? '🔒 Пароль установлен' : '🔓 Пароль не установлен'}</p>
                <input type="password" value={adminPassInput || ''} onChange={e => setAdminPassInput(e.target.value)} placeholder="Новый пароль (оставьте пустым для отключения)" className="w-full p-2 border rounded mb-2" />
                <button onClick={() => {
                  setAdminPass(adminPassInput || '');
                  showNotification(adminPassInput ? 'Пароль установлен' : 'Пароль отключён');
                  setAdminPassInput('');
                }} className="w-full bg-purple-500 text-white py-2 rounded hover:bg-purple-600">
                  {adminPassword ? 'Изменить пароль' : 'Установить пароль'}
                </button>
              </div>

              {/* Журнал действий */}
              <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="font-bold mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-purple-600" />Журнал действий</h3>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {auditLog.length > 0 ? auditLog.slice(0, 20).map(entry => (
                    <div key={entry.id} className="p-2 bg-gray-50 rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{entry.action}</span>
                        <span className="text-gray-400 text-xs">{new Date(entry.timestamp).toLocaleString('ru-RU')}</span>
                      </div>
                      {entry.details && <p className="text-gray-500 text-xs">{entry.details}</p>}
                      <p className="text-gray-400 text-xs">👤 {entry.user}</p>
                    </div>
                  )) : <p className="text-gray-400 text-sm">Журнал пуст</p>}
                </div>
                {auditLog.length > 20 && <p className="text-center text-xs text-gray-400 mt-2">Показаны последние 20 из {auditLog.length}</p>}
              </div>
            </div>
          )}

          {/* ВКЛАДКА: Мануалы */}
          {adminTab === 'manuals' && (() => {
            const saveManual = () => {
              if (!newManual.title.trim() || !newManual.content.trim()) {
                showNotification('Заполните название и содержимое', 'error');
                return;
              }
              if (editingManual) {
                updateManuals(manuals.map(m => m.id === editingManual.id ? { ...newManual, id: editingManual.id } : m));
                logAction('Мануал изменён', newManual.title);
                showNotification('Мануал обновлён ✓');
              } else {
                updateManuals([...manuals, { ...newManual, id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) }]);
                logAction('Мануал добавлен', newManual.title);
                showNotification('Мануал добавлен ✓');
              }
              setNewManual({ title: '', category: 'sales', content: '', isPinned: false });
              setEditingManual(null);
            };

            const deleteManual = (id) => {
              showConfirm('Удалить этот мануал?', () => {
                const manual = manuals.find(m => m.id === id);
                updateManuals(manuals.filter(m => m.id !== id));
                logAction('Мануал удалён', manual?.title);
                showNotification('Мануал удалён');
              });
            };

            const togglePin = (id) => {
              updateManuals(manuals.map(m => m.id === id ? { ...m, isPinned: !m.isPinned } : m));
            };

            return (
              <div className="space-y-4">
                {/* Форма добавления/редактирования */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    {editingManual ? 'Редактировать мануал' : 'Добавить мануал'}
                  </h3>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="Название (например: 🐦 Методичка продаж)" 
                      value={newManual.title}
                      onChange={(e) => setNewManual({...newManual, title: e.target.value})}
                      className="w-full p-3 border-2 rounded-lg focus:border-purple-500 focus:outline-none" 
                    />
                    <div className="flex gap-2">
                      <select 
                        value={newManual.category}
                        onChange={(e) => setNewManual({...newManual, category: e.target.value})}
                        className="flex-1 p-2 border rounded-lg"
                      >
                        <option value="sales">🎯 Продажи</option>
                        <option value="info">💰 Финансы/Инфо</option>
                        <option value="faq">❓ FAQ</option>
                      </select>
                      <label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <input 
                          type="checkbox" 
                          checked={newManual.isPinned}
                          onChange={(e) => setNewManual({...newManual, isPinned: e.target.checked})}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span className="text-sm">📌 Закрепить</span>
                      </label>
                    </div>
                    <textarea 
                      placeholder="Содержимое мануала..."
                      value={newManual.content}
                      onChange={(e) => setNewManual({...newManual, content: e.target.value})}
                      className="w-full p-3 border-2 rounded-lg font-mono text-sm focus:border-purple-500 focus:outline-none"
                      rows={10}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={saveManual}
                        className="flex-1 bg-purple-500 text-white py-3 rounded-lg font-bold hover:bg-purple-600"
                      >
                        {editingManual ? '💾 Сохранить изменения' : '➕ Добавить мануал'}
                      </button>
                      {editingManual && (
                        <button 
                          onClick={() => { setEditingManual(null); setNewManual({ title: '', category: 'sales', content: '', isPinned: false }); }}
                          className="px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                        >
                          Отмена
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Список мануалов */}
                <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Все мануалы ({manuals.length})
                  </h3>
                  <div className="space-y-2">
                    {manuals.map(manual => (
                      <div key={manual.id} className={`p-3 rounded-lg border flex justify-between items-center ${manual.isPinned ? 'bg-purple-50 border-purple-200' : 'bg-gray-50'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {manual.isPinned && <span className="text-purple-500">📌</span>}
                            <span className="font-medium">{manual.title}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {manual.category === 'sales' ? '🎯 Продажи' : manual.category === 'faq' ? '❓ FAQ' : '💰 Инфо'}
                            {' • '}{manual.content.length} символов
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => togglePin(manual.id)}
                            className={`p-2 rounded hover:bg-gray-200 ${manual.isPinned ? 'text-purple-500' : 'text-gray-400'}`}
                            title={manual.isPinned ? 'Открепить' : 'Закрепить'}
                          >
                            📌
                          </button>
                          <button 
                            onClick={() => { setEditingManual(manual); setNewManual(manual); }}
                            className="p-2 text-blue-500 rounded hover:bg-blue-50"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteManual(manual.id)}
                            className="p-2 text-red-500 rounded hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {manuals.length === 0 && (
                      <p className="text-gray-400 text-center py-4">Нет мануалов</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ===== ВКЛАДКА: ДОСТИЖЕНИЯ ===== */}
          {adminTab === 'achievements-admin' && (() => {
            const COND_TYPES = [
              { id: 'manual', label: '🎖️ Выдать вручную' },
              { id: 'sales_count', label: '🛒 Кол-во продаж' },
              { id: 'revenue', label: '💰 Выручка (₽)' },
              { id: 'big_sale', label: '🎯 Продажа от N ₽' },
              { id: 'tips_count', label: '⭐ Чаевые (раз)' },
            ];
            const ICON_PRESETS = ['🏆','🥇','🥈','🥉','🌟','⭐','🔥','💎','🎯','🎖️','👑','🚀','💪','🦅','🐦','🎁','💡','🌈','⚡','🎪','🏅','✨','🌙','🦁','🐯'];

            const handleSaveAch = () => {
              if (!achForm.title.trim()) { showNotification('Введите название', 'error'); return; }
              if (achForm.condType !== 'manual' && !achForm.condValue) { showNotification('Укажите значение условия', 'error'); return; }
              if (editingAch) {
                updateCustomAchievements(customAchievements.map(a => a.id === editingAch ? { ...a, ...achForm } : a));
                setEditingAch(null);
              } else {
                const newA = { ...achForm, id: 'custom_' + Date.now(), condValue: Number(achForm.condValue) || 0, bonusAmount: Number(achForm.bonusAmount) || 0, createdAt: Date.now() };
                updateCustomAchievements([...customAchievements, newA]);
              }
              setAchForm({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '' });
              showNotification(editingAch ? 'Достижение обновлено' : 'Достижение создано');
            };

            const handleDeleteAch = (id) => {
              showConfirm('Удалить достижение?', () => {
                updateCustomAchievements(customAchievements.filter(a => a.id !== id));
                // Убираем из выданных
                const newGranted = { ...achievementsGranted };
                delete newGranted[id];
                updateAchievementsGranted(newGranted);
                showNotification('Удалено');
              });
            };

            const handleGrantToggle = (achId, userLogin) => {
              const current = achievementsGranted[achId] || [];
              const isRevoking = current.includes(userLogin);
              const updated = isRevoking
                ? current.filter(l => l !== userLogin)
                : [...current, userLogin];
              updateAchievementsGranted({ ...achievementsGranted, [achId]: updated });

              // ═══ СНЯТИЕ достижения — удалить бонус ═══
              if (isRevoking) {
                const ach = customAchievements.find(a => a.id === achId);
                if (ach && ach.bonusAmount > 0) {
                  const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
                  const user = regUsers.find(u => u.login === userLogin);
                  const empName = user?.name || userLogin;
                  // Удаляем бонус с пометкой achievementId или по reason
                  const updatedBonuses = bonuses.filter(b => {
                    if (b.achievementId === achId && (b.employeeName === empName || b.employeeLogin === userLogin)) return false;
                    if (b.reason === `Достижение: ${ach.title}` && (b.employeeName === empName || b.employeeLogin === userLogin)) return false;
                    return true;
                  });
                  if (updatedBonuses.length !== bonuses.length) {
                    updateBonuses(updatedBonuses);
                    showNotification(`Достижение снято, бонус ${ach.bonusAmount}₽ удалён`);
                  } else {
                    showNotification('Достижение снято');
                  }
                } else {
                  showNotification('Достижение снято');
                }
                return;
              }

              // ═══ ВЫДАЧА достижения — начислить бонус и отправить уведомление ═══
              const ach = customAchievements.find(a => a.id === achId);
              if (!ach) return;
              // Уведомление в Firebase
              const notifKey = 'likebird-notifications';
              const existingNotifs = (() => { try { return JSON.parse(localStorage.getItem(notifKey) || '[]'); } catch { return []; } })();
              const newNotif = {
                id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6),
                type: 'achievement',
                targetLogin: userLogin,
                title: '🏆 Новое достижение!',
                body: `Вы получили достижение: «${ach.title}»${ach.bonusAmount > 0 ? ` + бонус ${Number(ach.bonusAmount).toLocaleString()}₽` : ''}`,
                bonusAmount: ach.bonusAmount || 0,
                achievementId: achId,
                createdAt: Date.now(),
                read: false,
              };
              const updatedNotifs = [newNotif, ...existingNotifs].slice(0, 100);
              localStorage.setItem(notifKey, JSON.stringify(updatedNotifs));
              fbSave(notifKey, updatedNotifs);

              // Если бонус — добавить в bonuses (с achievementId для отката)
              if (ach.bonusAmount > 0) {
                const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();
                const user = regUsers.find(u => u.login === userLogin);
                const emp = employees.find(e => e.name === (user?.name || userLogin));
                if (emp) {
                  const newBonus = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), employeeId: emp.id, employeeName: emp.name, employeeLogin: userLogin, achievementId: achId, amount: Number(ach.bonusAmount), reason: `Достижение: ${ach.title}`, date: new Date().toLocaleDateString('ru-RU'), createdAt: Date.now() };
                  const updatedBonuses = [newBonus, ...bonuses];
                  updateBonuses(updatedBonuses);
                }
              }
              showNotification(`Достижение выдано${ach.bonusAmount > 0 ? ` + бонус ${ach.bonusAmount}₽` : ''}`);
            };

            const users = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();

            return (
              <div className="space-y-4">

                {/* Форма создания/редактирования */}
                <div className="bg-white rounded-2xl p-4 shadow">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    {editingAch ? 'Редактировать достижение' : 'Новое достижение'}
                  </h3>

                  {/* Выбор иконки */}
                  <div className="mb-3">
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Иконка</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {ICON_PRESETS.map(ic => (
                        <button key={ic} onClick={() => setAchForm({...achForm, icon: ic})}
                          className={`w-10 h-10 text-xl rounded-xl transition-all ${achForm.icon === ic ? 'bg-amber-100 ring-2 ring-amber-400 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          {ic}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{achForm.icon}</span>
                      <input type="text" value={achForm.icon} onChange={e => setAchForm({...achForm, icon: e.target.value})}
                        placeholder="или введите свой эмодзи"
                        className="flex-1 p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" maxLength={4} />
                    </div>
                  </div>

                  {/* Название и описание */}
                  <div className="space-y-2 mb-3">
                    <input type="text" value={achForm.title} onChange={e => setAchForm({...achForm, title: e.target.value})}
                      placeholder="Название достижения *"
                      className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold focus:border-amber-400 focus:outline-none" />
                    <input type="text" value={achForm.desc} onChange={e => setAchForm({...achForm, desc: e.target.value})}
                      placeholder="Описание (подсказка для сотрудника)"
                      className="w-full p-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" />
                    <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border-2 border-amber-200">
                      <span className="text-amber-600 font-semibold text-sm flex-shrink-0">🎁 Бонус:</span>
                      <input type="number" value={achForm.bonusAmount || ''} onChange={e => setAchForm({...achForm, bonusAmount: e.target.value})}
                        placeholder="0 ₽ (оставьте пустым без бонуса)"
                        className="flex-1 p-2 border-2 border-amber-200 rounded-lg text-sm focus:border-amber-400 focus:outline-none" />
                      <span className="text-gray-400 text-sm">₽</span>
                    </div>
                  </div>

                  {/* Условие получения */}
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 font-semibold block mb-2">Условие получения</label>
                    <div className="grid grid-cols-1 gap-2 mb-2">
                      {COND_TYPES.map(ct => (
                        <button key={ct.id} onClick={() => setAchForm({...achForm, condType: ct.id, condValue: ''})}
                          className={`py-2.5 px-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${achForm.condType === ct.id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {ct.label}
                        </button>
                      ))}
                    </div>
                    {achForm.condType !== 'manual' && (
                      <input type="number" value={achForm.condValue} onChange={e => setAchForm({...achForm, condValue: e.target.value})}
                        placeholder={achForm.condType === 'sales_count' ? 'Кол-во продаж, например 25' : achForm.condType === 'revenue' ? 'Сумма выручки, например 100000' : achForm.condType === 'big_sale' ? 'Минимальная сумма продажи, например 2000' : 'Количество раз'}
                        className="w-full p-2.5 border-2 border-amber-200 rounded-xl text-sm focus:border-amber-400 focus:outline-none" />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={handleSaveAch}
                      className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                      {editingAch ? '💾 Сохранить' : '✅ Создать достижение'}
                    </button>
                    {editingAch && (
                      <button onClick={() => { setEditingAch(null); setAchForm({ icon: '🏆', title: '', desc: '', condType: 'manual', condValue: '' }); }}
                        className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">
                        Отмена
                      </button>
                    )}
                  </div>
                </div>

                {/* Список созданных достижений */}
                <div className="space-y-3">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <span>Созданные достижения</span>
                    <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">{customAchievements.length}</span>
                  </h3>
                  {customAchievements.length === 0 && (
                    <div className="bg-white rounded-xl p-8 text-center shadow">
                      <p className="text-4xl mb-2">🏅</p>
                      <p className="text-gray-400">Нет кастомных достижений</p>
                      <p className="text-gray-400 text-sm mt-1">Создайте первое выше</p>
                    </div>
                  )}
                  {customAchievements.map(ach => {
                    const grantedTo = achievementsGranted[ach.id] || [];
                    const condLabel = COND_TYPES.find(c => c.id === ach.condType)?.label || ach.condType;
                    return (
                      <div key={ach.id} className="bg-white rounded-2xl shadow overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
                              {ach.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-800">{ach.title}</p>
                              {ach.desc && <p className="text-xs text-gray-400 mt-0.5">{ach.desc}</p>}
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                  {condLabel}{ach.condValue ? `: ${Number(ach.condValue).toLocaleString()}` : ''}
                                </span>
                                {ach.bonusAmount > 0 && (
                                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🎁 +{Number(ach.bonusAmount).toLocaleString()}₽</span>
                                )}
                                {grantedTo.length > 0 && (
                                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                                    ✅ Выдано: {grantedTo.length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => { setEditingAch(ach.id); setAchForm({ icon: ach.icon, title: ach.title, desc: ach.desc || '', condType: ach.condType, condValue: String(ach.condValue || ''), bonusAmount: String(ach.bonusAmount || '') }); }}
                                className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg">
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteAch(ach.id)}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Ручная выдача */}
                          {ach.condType === 'manual' && users.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-gray-500 font-semibold mb-2">Выдать сотрудникам:</p>
                              <div className="flex flex-wrap gap-2">
                                {users.map(u => {
                                  const granted = grantedTo.includes(u.login);
                                  const profile = profilesData[u.login] || {};
                                  return (
                                    <button key={u.login} onClick={() => handleGrantToggle(ach.id, u.login)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${granted ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                                      <span>{granted ? '✅' : '○'}</span>
                                      <span>{profile.displayName || u.name || u.login}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    );
  };

  // Объединённый TeamView с вкладками (только просмотр для сотрудников)
  const TeamView = () => {
    const activeEmployees = employees.filter(e => e.active).map(e => e.name);
    const shiftsCount = Object.values(scheduleData.shifts || {}).reduce((sum, emp) => sum + (emp?.length || 0), 0);
    const [manualFilter, setManualFilter] = useState('all');
    const [manualSearch, setManualSearch] = useState('');

    // Онлайн-статус: онлайн если lastSeen < 5 минут назад
    const ONLINE_THRESHOLD = 5 * 60 * 1000;
    const now = Date.now();
    const getOnlineStatus = (login) => {
      const p = presenceData[login];
      if (!p) return 'offline';
      return (now - p.lastSeen) < ONLINE_THRESHOLD ? 'online' : 'offline';
    };
    // Список всех пользователей с их онлайн-статусом
    const regUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { return []; } })();

    // Данные для результатов недели
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weekReports = reports.filter(r => {
      const [datePart] = (r.date||'').split(',');
      const [d, m, y] = datePart.split('.');
      const reportDate = new Date(parseYear(y), m - 1, d);
      return reportDate >= weekAgo && !r.isUnrecognized;
    });

    const byEmployee = {};
    weekReports.forEach(r => {
      if (!byEmployee[r.employee]) {
        byEmployee[r.employee] = { name: r.employee, shifts: 0, totalHours: 0, sales: 0, workDays: new Set() };
      }
      byEmployee[r.employee].sales += 1;
      const [datePart] = (r.date||'').split(',');
      byEmployee[r.employee].workDays.add(datePart);
      if (r.workTime?.workHours) byEmployee[r.employee].totalHours += r.workTime.workHours;
    });

    const weekResults = Object.values(byEmployee).map(emp => {
      emp.shifts = emp.workDays.size;
      emp.speed = emp.totalHours > 0 ? (emp.sales / emp.totalHours) : 0;
      emp.totalHours = Math.round(emp.totalHours * 10) / 10;
      emp.speed = Math.round(emp.speed * 10) / 10;
      return emp;
    }).sort((a, b) => b.shifts - a.shifts);

    // Данные для событий — flatten array-based eventsCalendar
    const today = new Date();
    const sortedEvents = Object.entries(eventsCalendar)
      .flatMap(([date, evArr]) => (Array.isArray(evArr) ? evArr : [evArr]).map((ev, i) => ({ date, ev, index: i })))
      .sort((a, b) => {
        const parse = (d) => { const [dd, mm, yy] = d.split('.'); return new Date(parseYear(yy), parseInt(mm) - 1, parseInt(dd)); };
        return parse(a.date) - parse(b.date);
      });

    const upcomingEvents = sortedEvents.filter(({ date }) => {
      const [d, m, y] = date.split('.');
      return new Date(parseYear(y), parseInt(m) - 1, parseInt(d)) >= today;
    });

    const pastEvents = sortedEvents.filter(({ date }) => {
      const [d, m, y] = date.split('.');
      return new Date(parseYear(y), parseInt(m) - 1, parseInt(d)) < today;
    });

    const tabs = [
      { id: 'online', label: '🟢 Онлайн', color: 'green' },
      { id: 'schedule', label: '📅 График', color: 'blue' },
      { id: 'results', label: '📊 Результаты', color: 'yellow' },
      { id: 'events', label: '🎉 События', color: 'red' },
      { id: 'manuals', label: '📚 Мануалы', color: 'purple' },
      { id: 'leaderboard', label: '🏅 Рейтинг', color: 'amber' },
      { id: 'chat', label: '💬 Чат', color: 'cyan' },
    ];

    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-50 pb-6">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 sticky top-0 z-10 safe-area-top">
          <button onClick={() => setCurrentView('menu')} className="mb-2" aria-label="Назад"><ArrowLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold flex items-center gap-2"><Users className="w-6 h-6" />Команда</h2>
        </div>

        {/* Вкладки команды */}
        <div className="bg-white shadow-sm sticky top-16 z-10">
          <div className="flex px-2 py-2 gap-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setTeamTab(tab.id)} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${teamTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 mt-4">
          {/* ВКЛАДКА: Онлайн — список сотрудников с присутствием */}
          {teamTab === 'online' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    Сотрудники
                  </h3>
                  <span className="text-xs text-gray-400">
                    онлайн: {regUsers.filter(u => getOnlineStatus(u.login) === 'online').length} / {regUsers.length}
                  </span>
                </div>
                {regUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-2">👥</p>
                    <p className="text-gray-400">Нет зарегистрированных пользователей</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...regUsers].sort((a, b) => {
                      const aOnline = getOnlineStatus(a.login) === 'online';
                      const bOnline = getOnlineStatus(b.login) === 'online';
                      return bOnline - aOnline;
                    }).map(u => {
                      const isOnline = getOnlineStatus(u.login) === 'online';
                      const p = presenceData[u.login];
                      const lastSeenMin = p ? Math.round((now - p.lastSeen) / 60000) : null;
                      const userProfile = profilesData[u.login] || {};
                      const displayName = userProfile.displayName || u.name || u.login;
                      const isMe = u.login === currentUser?.login;
                      const roleLabel = u.role === 'admin' ? '🛡️ Администратор' : u.role === 'senior' ? '⭐ Старший' : '🐦 Продавец';
                      // Продажи сегодня
                      const todayStr = formatDate(new Date());
                      const todaySales = reports.filter(r =>
                        (r.employee === u.name || r.employee === u.login || r.employee === userProfile.displayName) &&
                        (r.date||'').split(',')[0].trim() === todayStr
                      ).length;

                      return (
                        <div key={u.login} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isOnline ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                          {/* Аватар + индикатор */}
                          <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                              {userProfile.avatar
                                ? <img src={userProfile.avatar} alt="" className="w-full h-full object-cover" />
                                : displayName[0]?.toUpperCase()
                              }
                            </div>
                            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                          </div>
                          {/* Имя и статус */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800 truncate">{displayName}</p>
                              {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">вы</span>}
                            </div>
                            <p className="text-xs text-gray-400">{roleLabel}</p>
                            <p className={`text-xs font-semibold mt-0.5 ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                              {isOnline
                                ? '● онлайн сейчас'
                                : lastSeenMin !== null
                                  ? lastSeenMin < 60 ? `был(а) ${lastSeenMin} мин назад` : `был(а) ${Math.round(lastSeenMin/60)} ч назад`
                                  : '● не в сети'}
                            </p>
                          </div>
                          {/* Продажи сегодня */}
                          {todaySales > 0 && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-black text-amber-500">{todaySales}</p>
                              <p className="text-xs text-gray-400">сегодня</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ВКЛАДКА: График работы (только просмотр) */}
          {teamTab === 'schedule' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-300 rounded-xl p-4">
                <h3 className="font-bold text-lg mb-1">📅 {scheduleData.week || 'График не установлен'}</h3>
                <p className="text-sm text-gray-600">{shiftsCount} смен запланировано</p>
              </div>
              
              {activeEmployees.map(emp => scheduleData.shifts?.[emp] && (
                <div key={emp} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                  <h3 className="font-bold mb-3">{emp}</h3>
                  <div className="space-y-2">
                    {scheduleData.shifts[emp].map((shift, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-blue-800">{shift.date || 'Дата не указана'}</span>
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm font-bold">{shift.hours || 0}ч</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span>🕐</span>
                            <span>{shift.startTime || '—'} — {shift.endTime || '—'}</span>
                          </div>
                          {shift.breakStart && shift.breakEnd && (
                            <div className="flex items-center gap-2 mt-1 text-orange-600">
                              <span>☕</span>
                              <span>Обед: {shift.breakStart} — {shift.breakEnd}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-right text-sm text-gray-500 pt-2 border-t">
                      Всего: <span className="font-bold text-blue-700">{scheduleData.shifts[emp].reduce((s, sh) => s + (sh.hours || 0), 0)} ч</span>
                    </div>
                  </div>
                </div>
              ))}
              
              {!scheduleData.week && (
                <div className="text-center py-10 bg-white rounded-xl shadow">
                  <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">График ещё не создан</p>
                  <p className="text-sm text-gray-400 mt-2">Администратор может создать график в админ-панели</p>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА: Результаты недели */}
          {teamTab === 'results' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-400 rounded-xl p-4">
                <div className="grid grid-cols-4 gap-2 text-center font-bold text-sm">
                  <div className="flex items-center justify-center gap-1"><span>🦩</span><span>Участник</span></div>
                  <div className="flex items-center justify-center gap-1"><span>⏱️</span><span>Время</span></div>
                  <div className="flex items-center justify-center gap-1"><span>🎨</span><span>Продажи</span></div>
                  <div className="flex items-center justify-center gap-1"><span>🚀</span><span>Скорость</span></div>
                </div>
              </div>

              {weekResults.map((emp, idx) => {
                // Суммируем реальные часы из shiftsData за неделю
                const regUser = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]').find(u => (u.name || u.login) === emp.name); } catch { return null; } })();
                const login = regUser?.login || emp.name;
                const weekAgoTs = weekAgo.getTime();
                let totalMinutes = 0;
                let isCurrentlyOpen = false;
                Object.entries(shiftsData).forEach(([key, shift]) => {
                  if (!key.startsWith(login + '_')) return;
                  if (!shift.openTime) return;
                  // Проверяем что смена за последнюю неделю
                  const dateStr = key.replace(login + '_', ''); // DD.MM.YYYY
                  const [d, m, y] = dateStr.split('.');
                  const shiftDate = y ? new Date(parseInt(parseYear(y)), parseInt(m)-1, parseInt(d)) : new Date(0);
                  if (shiftDate.getTime() < weekAgoTs) return;
                  // Считаем минуты
                  if (shift.openTime && shift.closeTime) {
                    const [oh, om] = shift.openTime.split(':').map(Number);
                    const [ch, cm] = shift.closeTime.split(':').map(Number);
                    let mins = (ch * 60 + cm) - (oh * 60 + om);
                    if (mins < 0) mins += 24 * 60; // Ночная смена через полночь
                    totalMinutes += mins;
                  } else if (shift.status === 'open') {
                    isCurrentlyOpen = true;
                  }
                });
                // Округление времени до четверти часа (0.25 = 15 мин):
                // floor(минуты / 15) * 0.25 — 14м→0, 15м→0.25, 25м→0.25, 30м→0.5, 45м→0.75
                const fullHours = Math.floor(totalMinutes / 60);
                const remainMinutes = totalMinutes % 60;
                const quarterFraction = Math.floor(remainMinutes / 15) * 0.25;
                const roundedHours = fullHours + quarterFraction;
                // Скорость продаж = продажи / округлённые часы (до сотых)
                const speed = roundedHours > 0 ? emp.sales / roundedHours : 0;
                const speedDisplay = parseFloat(speed.toFixed(2));
                // Формат отображения часов: "5.25 ч", "8 ч", "0.5 ч"
                const hoursDisplay = roundedHours > 0
                  ? (Number.isInteger(roundedHours) ? `${roundedHours} ч` : `${roundedHours.toFixed(2).replace(/0$/, '')} ч`)
                  : null;
                const timeLabel = hoursDisplay
                  ? hoursDisplay
                  : isCurrentlyOpen ? null
                  : `${emp.shifts} дн.`;

                return (
                  <div key={emp.name} className={`${idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} border-2 border-yellow-300 rounded-xl p-4`}>
                    <div className="grid grid-cols-4 gap-2 text-center items-center">
                      <div>
                        <p className="font-bold">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.sales} прод.</p>
                      </div>
                      <div className="font-bold text-lg flex flex-col items-center gap-0.5">
                        {isCurrentlyOpen
                          ? <span className="text-green-500 animate-pulse text-sm font-semibold">● работает</span>
                          : <span>{timeLabel}</span>
                        }
                        {totalMinutes > 0 && isCurrentlyOpen && <span className="text-xs text-green-400">{hoursDisplay || `${fullHours}ч`}</span>}
                      </div>
                      <div className="font-bold text-lg">{emp.sales}</div>
                      <div className="font-bold text-lg flex items-center justify-center gap-1">
                        {speedDisplay > 2 && <span className="text-yellow-500">⚡</span>}
                        {speedDisplay > 0 ? speedDisplay : <span className="text-gray-300">—</span>}
                      </div>
                    </div>
                  </div>
                );
              })}

              {weekResults.length === 0 && (
                <div className="bg-white rounded-xl p-10 text-center shadow">
                  <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Нет данных за последнюю неделю</p>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА: События */}
          {teamTab === 'events' && (
            <div className="space-y-4">
              {upcomingEvents.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">📅 Предстоящие события</h3>
                  <div className="space-y-3">
                    {upcomingEvents.map(({ date, ev, index }) => {
                      const [d, m, y] = date.split('.');
                      const eventDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
                      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={`${date}_${index}`} className="bg-white rounded-xl p-4 shadow border-l-4 border-red-500">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xl font-bold text-red-600">{date}</p>
                              {daysUntil <= 7 && (
                                <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${daysUntil === 0 ? 'bg-red-500 text-white' : daysUntil <= 3 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {daysUntil === 0 ? '🔥 Сегодня!' : daysUntil === 1 ? 'Завтра' : `Через ${daysUntil} дн.`}
                                </span>
                              )}
                            </div>
                            <span className="text-2xl">{ev.emoji || '🎉'}</span>
                          </div>
                          <p className="text-lg font-medium text-gray-800 mt-2">{ev.title}</p>
                          {ev.description && <p className="text-sm text-gray-500 mt-1">{ev.description}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-500 mb-3">📋 Прошедшие события</h3>
                  <div className="space-y-2">
                    {pastEvents.slice(0, 5).map(({ date, ev, index }) => (
                      <div key={`${date}_${index}`} className="bg-gray-50 rounded-lg p-3 opacity-60">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-gray-600">{date}</p>
                            <p className="text-sm text-gray-500">{ev.title}</p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sortedEvents.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl shadow">
                  <Calendar className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg">Нет событий</p>
                  <p className="text-gray-400 text-sm mt-2">Администратор может добавить события</p>
                </div>
              )}
            </div>
          )}

          {/* ВКЛАДКА: Мануалы */}

          {/* BLOCK 7: Leaderboard */}
          {teamTab === 'leaderboard' && (() => {
            const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
            const weekAgo2 = new Date(); weekAgo2.setDate(weekAgo2.getDate() - 7);
            const cutoff = lbPeriod === 'week' ? weekAgo2 : monthAgo;
            const periodReports = reports.filter(r => {
              try { const d = parseRuDate(r.date || r.timestamp); return d >= cutoff && !r.isUnrecognized; } catch { return false; }
            });
            const byEmp = {};
            periodReports.forEach(r => {
              const emp = r.employee || 'Неизвестно';
              if (!byEmp[emp]) byEmp[emp] = { name: emp, revenue: 0, count: 0 };
              byEmp[emp].revenue += r.total || 0;
              byEmp[emp].count += 1;
            });
            const ranking = Object.values(byEmp).sort((a, b) => b.revenue - a.revenue);
            const medals = ['🥇', '🥈', '🥉'];
            
            return (
              <div className="space-y-4">
                <div className="flex gap-2 mb-2">
                  <button onClick={() => setLbPeriod('week')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${lbPeriod === 'week' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Неделя</button>
                  <button onClick={() => setLbPeriod('month')} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${lbPeriod === 'month' ? 'bg-amber-500 text-white' : 'bg-white'}`}>Месяц</button>
                </div>
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  {ranking.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Нет данных за период</p>
                  ) : ranking.map((e, i) => (
                    <div key={e.name} className={`flex items-center gap-3 p-4 ${i === 0 ? 'bg-amber-50' : ''} ${i < ranking.length - 1 ? 'border-b' : ''}`}>
                      <span className="text-2xl w-8 text-center">{i < 3 ? medals[i] : (i + 1)}</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                        {e.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.count} продаж</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{e.revenue.toLocaleString()} ₽</p>
                        <p className="text-xs text-gray-400">ср. {e.count > 0 ? Math.round(e.revenue / e.count) : 0} ₽</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* BLOCK 3: Enhanced Chat */}
          {teamTab === 'chat' && (() => {
            const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👎'];
            const myLogin = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}').login; } catch { return ''; } })();
            const isAdminUser = currentUser?.isAdmin || currentUser?.role === 'admin';

            const handleSendChat = () => {
              if (!chatText.trim()) return;
              const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Аноним', text: chatText.trim(), date: new Date().toISOString(), read: false, reactions: {}, pinned: false };
              // Check for @mentions
              const mentionRegex = /@(\S+)/g;
              let match;
              while ((match = mentionRegex.exec(chatText)) !== null) {
                const mentioned = match[1];
                try {
                  const users = JSON.parse(localStorage.getItem('likebird-users') || '[]');
                  const user = users.find(u => u.login === mentioned || u.name === mentioned);
                  if (user) {
                    const notif = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6) + Math.random(), type: 'mention', targetLogin: user.login, title: '💬 Вас упомянули в чате', body: employeeName + ': ' + chatText.trim().substring(0, 80), icon: '💬', timestamp: Date.now(), read: false };
                    const updatedNotifs = [...userNotifications, notif];
                    setUserNotifications(updatedNotifs);
                    save('likebird-notifications', updatedNotifs);
                  }
                } catch { /* silent */ }
              }
              updateChatMessages([...chatMessages, msg]);
              setChatText('');
              setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            };

            const addReaction = (msgId, emoji) => {
              const updated = chatMessages.map(m => {
                if (m.id !== msgId) return m;
                const reactions = { ...(m.reactions || {}) };
                if (!reactions[emoji]) reactions[emoji] = [];
                if (reactions[emoji].includes(myLogin)) {
                  reactions[emoji] = reactions[emoji].filter(l => l !== myLogin);
                  if (reactions[emoji].length === 0) delete reactions[emoji];
                } else {
                  reactions[emoji] = [...reactions[emoji], myLogin];
                }
                return { ...m, reactions };
              });
              updateChatMessages(updated);
              setReactionMsgId(null);
            };

            const togglePin = (msgId) => {
              const updated = chatMessages.map(m => m.id === msgId ? { ...m, pinned: !m.pinned } : m);
              updateChatMessages(updated);
            };

            const pinnedMessages = chatMessages.filter(m => m.pinned);
            const recentMessages = chatMessages.slice(-(chatLimit || 50));

            const handleChatPhoto = async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) { showNotification('Фото слишком большое (макс 10MB)', 'error'); return; }
              try {
                const compressed = await compressImage(file, 800, 0.7);
                const msg = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), from: employeeName || 'Аноним', text: '', image: compressed, date: new Date().toISOString(), read: false, reactions: {}, pinned: false };
                updateChatMessages([...chatMessages, msg]);
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
              } catch { showNotification('Ошибка загрузки фото', 'error'); }
            };

            return (
              <div className="space-y-3">
                {/* Pinned messages */}
                {pinnedMessages.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-amber-600 mb-2">📌 Закреплённые</p>
                    {pinnedMessages.map(m => (
                      <div key={m.id} className="text-sm py-1 border-b border-amber-100 last:border-0">
                        <span className="font-semibold">{m.from}:</span> {m.text}
                      </div>
                    ))}
                  </div>
                )}
                {/* Messages */}
                <div className="bg-white rounded-2xl shadow max-h-96 overflow-y-auto p-3 space-y-2">
                  {recentMessages.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Начните общение! 💬</p>
                  ) : <>{chatMessages.length > (chatLimit || 50) && <button onClick={() => setChatLimit(prev => prev + 50)} className="w-full text-center py-2 text-purple-500 text-sm hover:text-purple-700 border-b">↑ Загрузить ещё ({chatMessages.length - (chatLimit || 50)} сообщений)</button>}{recentMessages.map(m => (
                    <div key={m.id} className={`relative ${m.from === employeeName ? 'ml-8' : 'mr-8'}`}
                      onContextMenu={(e) => { e.preventDefault(); setReactionMsgId(m.id); }}>
                      <div className={`p-3 rounded-xl ${m.from === employeeName ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                        {m.from !== employeeName && <p className="text-xs font-bold mb-1 text-blue-600">{(() => { const pr = Object.values(profilesData || {}).find(p => p.name === m.from); return pr?.avatar ? <img src={pr.avatar} alt="" className="w-4 h-4 rounded-full inline mr-1" /> : null; })()}{m.from}</p>}
                        {m.image && (
                          <img src={m.image} alt="" className="max-w-48 rounded-lg mb-1 cursor-pointer" onClick={() => window.open(m.image)} />
                        )}
                        {m.text && <p className="text-sm">{m.text.split(/(@\S+)/g).map((part, idx) => 
                          part.startsWith('@') ? <span key={idx} className="text-blue-500 font-semibold">{part}</span> : part
                        )}</p>}
                        <p className={`text-xs mt-1 ${m.from === employeeName ? 'text-blue-200' : 'text-gray-400'}`}>
                          {new Date(m.date).toLocaleTimeString('ru', {hour:'2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      {/* Reactions display */}
                      {m.reactions && Object.keys(m.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Object.entries(m.reactions).map(([emoji, users]) => (
                            <button key={emoji} onClick={() => addReaction(m.id, emoji)}
                              className={`text-xs px-1.5 py-0.5 rounded-full border ${users.includes(myLogin) ? 'bg-blue-100 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                              {emoji} {users.length}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Reaction picker */}
                      {reactionMsgId === m.id && (
                        <div className="absolute bottom-full left-0 bg-white shadow-lg rounded-xl p-2 flex gap-1 z-20 border">
                          {REACTION_EMOJIS.map(emoji => (
                            <button key={emoji} onClick={() => addReaction(m.id, emoji)} className="text-lg hover:scale-125 transition-transform p-1">{emoji}</button>
                          ))}
                          {isAdminUser && (
                            <button onClick={() => { togglePin(m.id); setReactionMsgId(null); }} className="text-sm px-2 hover:bg-gray-100 rounded">📌</button>
                          )}
                          <button onClick={() => setReactionMsgId(null)} className="text-sm px-2 hover:bg-gray-100 rounded">✕</button>
                        </div>
                      )}
                    </div>
                  ))}</>}
                  <div ref={chatEndRef} />
                </div>
                {/* Input */}
                <div className="flex gap-2">
                  <label className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200">
                    <Camera className="w-5 h-5 text-gray-500" />
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChatPhoto} />
                  </label>
                  <input type="text" value={chatText} onChange={(e) => { setChatText(e.target.value); if (e.target.value.endsWith('@')) setShowMentions(true); else setShowMentions(false); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                    placeholder="Сообщение..."
                    className="flex-1 p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-400 focus:outline-none" />
                  <button onClick={handleSendChat} className="px-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600">→</button>
                </div>
                {/* Mention autocomplete */}
                {showMentions && (
                  <div className="bg-white rounded-xl shadow border p-2 space-y-1">
                    {employees.filter(e => e.active).map(e => (
                      <button key={e.id} onClick={() => { setChatText(chatText + e.name + ' '); setShowMentions(false); }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm">{e.name}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {teamTab === 'manuals' && (() => {
            const categories = [
              { id: 'all', label: '📚 Все', color: 'purple' },
              { id: 'sales', label: '🎯 Продажи', color: 'blue' },
              { id: 'info', label: '💰 Финансы', color: 'green' },
              { id: 'faq', label: '❓ FAQ', color: 'orange' },
            ];
            const filteredManuals = manuals.filter(m => {
              const matchCat = manualFilter === 'all' || m.category === manualFilter;
              const matchSearch = !manualSearch.trim() || m.title.toLowerCase().includes(manualSearch.toLowerCase()) || (m.content && m.content.toLowerCase().includes(manualSearch.toLowerCase()));
              return matchCat && matchSearch;
            });
            
            return (
              <div className="space-y-4">
                {/* Поиск */}
                <div className="relative">
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    placeholder="🔍 Поиск по названию или содержанию..."
                    className="w-full p-3 pr-10 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-400 focus:outline-none"
                  />
                  {manualSearch && (
                    <button onClick={() => setManualSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                  )}
                </div>

                {/* Категории */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setManualFilter(cat.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                        manualFilter === cat.id 
                          ? 'bg-purple-500 text-white shadow-md' 
                          : 'bg-white text-gray-600 border hover:bg-gray-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Закреплённые мануалы */}
                {filteredManuals.filter(m => m.isPinned).length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                      📌 Важное
                    </h3>
                    {filteredManuals.filter(m => m.isPinned).map(manual => (
                      <details key={manual.id} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl shadow-md border-2 border-purple-200 mb-3 overflow-hidden group">
                        <summary className="p-4 cursor-pointer hover:bg-purple-100/50 flex items-center justify-between list-none">
                          <span className="font-bold text-purple-800">{manual.title}</span>
                          <ChevronRight className="w-5 h-5 text-purple-500 transition-transform duration-200 group-open:rotate-90" />
                        </summary>
                        <div className="px-4 pb-4 pt-2 border-t border-purple-200 bg-white">
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{manual.content}</pre>
                        </div>
                      </details>
                    ))}
                  </div>
                )}

                {/* Остальные мануалы */}
                <div className="space-y-3">
                  {filteredManuals.filter(m => !m.isPinned).map(manual => (
                    <details key={manual.id} className="bg-white rounded-xl shadow-md overflow-hidden group">
                      <summary className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between list-none">
                        <div>
                          <span className="font-bold text-gray-800">{manual.title}</span>
                          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                            {manual.category === 'sales' ? '🎯 Продажи' : manual.category === 'faq' ? '❓ FAQ' : '💰 Инфо'}
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-90" />
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t bg-gray-50">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">{manual.content}</pre>
                      </div>
                    </details>
                  ))}
                </div>

                {filteredManuals.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-xl shadow">
                    <FileText className="w-20 h-20 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg">
                      {manualFilter === 'all' ? 'Нет мануалов' : 'Нет мануалов в этой категории'}
                    </p>
                    <p className="text-gray-400 text-sm mt-2">Администратор может добавить обучающие материалы</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };



  // ===== РАЗДЕЛ: СМЕНА =====
  const ShiftView = () => {
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
    const parseRevisionText = (text) => {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let totalBirds = 0;
      const birdsByPrice = {};
      const items = []; // { name, qty }
      let section = 'birds';
      
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (/^(3[дd]|зд|здэ|здшк|другое|мех|игрушк)/i.test(lower)) { section = 'items'; continue; }
        if (/^птиц/i.test(lower)) {
          const m = lower.match(/(\d+)/);
          if (m) totalBirds = parseInt(m[1], 10);
          section = 'birds';
          continue;
        }
        // Bird price: "30х300" or "30x300"
        const birdMatch = line.match(/^(\d+)\s*[хxХX×]\s*(\d+)$/);
        if (birdMatch && section === 'birds') {
          const count = parseInt(birdMatch[1], 10);
          const price = parseInt(birdMatch[2], 10);
          birdsByPrice[price] = (birdsByPrice[price] || 0) + count;
          continue;
        }
        // Item: "6 птиц" or "1 коала"
        const itemMatch = line.match(/^(\d+)\s+(.+)$/);
        if (itemMatch) {
          items.push({ name: itemMatch[2].trim(), qty: parseInt(itemMatch[1], 10) });
          continue;
        }
        if (line.length > 1 && !/^\d/.test(line)) items.push({ name: line, qty: 1 });
      }
      const birdCount = Object.values(birdsByPrice).reduce((s, c) => s + c, 0);
      return { totalBirds: totalBirds || birdCount, birdsByPrice, items };
    };
    
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
    const BirdPriceEditor = ({ birdsByPrice, setBirdsByPrice, totalBirds, setTotalBirds }) => {
      const [newCount, setNewCount] = useState('');
      const [newPrice, setNewPrice] = useState('');
      const sortedPrices = Object.keys(birdPriceTiers).sort((a, b) => parseInt(a) - parseInt(b));
      const birdCount = Object.values(birdsByPrice).reduce((s, c) => s + c, 0);
      
      return (
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm flex items-center gap-2">🐦 Птицы-свистульки</h4>
          </div>
          
          {/* Total birds input */}
          <div className="flex items-center gap-3 mb-3 bg-amber-50 rounded-lg p-2.5">
            <span className="text-sm font-semibold text-amber-700">Всего птиц:</span>
            <input type="number" value={totalBirds || ''} onChange={e => setTotalBirds(parseInt(e.target.value, 10) || 0)}
              className="w-20 text-center border-2 border-amber-300 rounded-lg p-1.5 font-bold text-lg focus:border-amber-500 focus:outline-none" placeholder="0" />
            {birdCount > 0 && birdCount !== totalBirds && (
              <span className="text-xs text-orange-500">по ценам: {birdCount}</span>
            )}
          </div>
          
          {/* Price tiers */}
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
          
          {/* Custom price row */}
          <div className="flex gap-2 mt-2 items-center">
            <input type="number" value={newCount} onChange={e => setNewCount(e.target.value)} placeholder="Кол" className="w-14 p-1.5 border rounded-lg text-sm text-center" />
            <span className="text-gray-400 text-sm">×</span>
            <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Цена" className="flex-1 p-1.5 border rounded-lg text-sm" />
            <button onClick={() => {
              const c = parseInt(newCount,10), p = parseInt(newPrice,10);
              if (c > 0 && p > 0) { setBirdsByPrice(prev => ({...prev, [p]: (prev[p]||0) + c})); setNewCount(''); setNewPrice(''); }
            }} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold">+</button>
          </div>
          
          {/* Admin-only: total value */}
          {isAdmin && birdCount > 0 && (
            <div className="mt-2 pt-2 border-t text-right text-xs text-gray-400">
              💰 {Object.entries(birdsByPrice).reduce((s, [p, c]) => s + parseInt(p,10) * c, 0).toLocaleString()}₽
            </div>
          )}
        </div>
      );
    };
    
    // ═══ Items Editor (3D / Мех / Кастомные — by name) ═══
    const ItemsEditor = ({ items, setItems }) => {
      const [search, setSearch] = useState('');
      const [newName, setNewName] = useState('');
      const [newQty, setNewQty] = useState('1');
      
      const filteredProducts = search.length >= 1
        ? otherProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.emoji.includes(search)).slice(0, 10)
        : [];
      
      // Group items by category for display
      const catOrder = ['3D игрушки', 'Меховые игрушки'];
      const grouped = {};
      items.forEach((item, i) => {
        const prod = otherProducts.find(p => p.name === item.name);
        const cat = prod?.category || 'Другое';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ ...item, idx: i, emoji: prod?.emoji || '📦' });
      });
      
      const updateQty = (idx, delta) => setItems(prev => prev.map((x, i) => i === idx ? { ...x, qty: Math.max(0, x.qty + delta) } : x).filter(x => x.qty > 0));
      
      return (
        <div className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
          <h4 className="font-bold text-sm mb-3 flex items-center gap-2">🎮 3D, Мех и другие</h4>
          
          {/* Existing items by category */}
          {catOrder.concat(['Другое']).map(cat => {
            const catItems = grouped[cat];
            if (!catItems || catItems.length === 0) return null;
            const catIcon = cat === '3D игрушки' ? '🎮' : cat === 'Меховые игрушки' ? '🧸' : '📦';
            return (
              <div key={cat} className="mb-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">{catIcon} {cat}</p>
                <div className="space-y-1">
                  {catItems.map(item => (
                    <div key={item.idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5">
                      <span className="text-sm">{item.emoji} {item.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.idx, -1)} className="w-7 h-7 bg-gray-200 rounded text-sm font-bold active:bg-red-100">−</button>
                        <span className="font-bold w-6 text-center text-sm">{item.qty}</span>
                        <button onClick={() => updateQty(item.idx, 1)} className="w-7 h-7 bg-gray-200 rounded text-sm font-bold active:bg-green-100">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* Quick-add from catalog */}
          <div className="relative mt-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Найти товар из каталога..." className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:outline-none" />
            {filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredProducts.map(p => {
                  const existing = items.find(i => i.name === p.name);
                  return (
                    <button key={p.name} onClick={() => {
                      if (existing) { setItems(prev => prev.map(i => i.name === p.name ? { ...i, qty: i.qty + 1 } : i)); }
                      else { setItems(prev => [...prev, { name: p.name, qty: 1 }]); }
                      setSearch('');
                    }} className="w-full text-left px-3 py-2 hover:bg-purple-50 text-sm flex justify-between border-b last:border-0">
                      <span>{p.emoji} {p.name}</span>
                      <span className="text-gray-400">{existing ? `(уже ${existing.qty})` : ''}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Manual add */}
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
    };
    
    // ═══ Text Input Mode ═══
    const TextInputMode = ({ onSave, onCancel }) => {
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
              {parsed.totalBirds > 0 && (
                <div>
                  <p className="font-semibold">🐦 Птицы: {parsed.totalBirds} шт</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(parsed.birdsByPrice).sort((a,b) => parseInt(a[0])-parseInt(b[0])).map(([p,c]) => (
                      <span key={p} className="bg-white px-2 py-0.5 rounded text-xs border">{c}×{p}₽</span>
                    ))}
                  </div>
                </div>
              )}
              {parsed.items.length > 0 && (
                <div className="mt-1">
                  <p className="font-semibold">🎮 Другие: {parsed.items.reduce((s,i)=>s+i.qty, 0)} шт</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parsed.items.map((item, i) => <span key={i} className="bg-white px-2 py-0.5 rounded text-xs border">{item.qty}× {item.name}</span>)}
                  </div>
                </div>
              )}
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
    };
    
    // ═══ Inventory Modal (after shift open) ═══
    const InventoryModal = () => {
      if (!showInventoryModal) return null;
      const [mTotalBirds, setMTotalBirds] = useState(0);
      const [mBirdsByPrice, setMBirdsByPrice] = useState({});
      const [mItems, setMItems] = useState([]);
      const [mTextMode, setMTextMode] = useState(false);
      
      const birdCount = Object.values(mBirdsByPrice).reduce((s,c)=>s+c, 0);
      const itemCount = mItems.reduce((s,i)=>s+i.qty, 0);
      const totalCount = (mTotalBirds || birdCount) + itemCount;
      
      if (mTextMode) {
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInventoryModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-3">📋 Текстовый ввод</h3>
              <TextInputMode onSave={(parsed) => {
                saveInventoryData(parsed, invPhotoUrl);
                setShowInventoryModal(false); setInvPhotoUrl(null);
              }} onCancel={() => setMTextMode(false)} />
            </div>
          </div>
        );
      }
      
      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowInventoryModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">📋 Ревизия при открытии</h3>
                  <p className="text-white/70 text-sm">Укажите количество товара</p>
                </div>
                {totalCount > 0 && <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">{totalCount} шт</span>}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <BirdPriceEditor birdsByPrice={mBirdsByPrice} setBirdsByPrice={setMBirdsByPrice} totalBirds={mTotalBirds} setTotalBirds={setMTotalBirds} />
              <ItemsEditor items={mItems} setItems={setMItems} />
              
              {/* Photo */}
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
                  }} disabled={totalCount === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                  ✅ Сохранить
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    };
    
    // ═══ Revision Tab ═══
    const RevisionTab = () => {
      const [editMode, setEditMode] = useState(false);
      const [textMode, setTextMode] = useState(false);
      const [totalBirds, setTotalBirds] = useState(() => inventory?.totalBirds || 0);
      const [birdsByPrice, setBirdsByPrice] = useState(() => inventory?.birdsByPrice ? {...inventory.birdsByPrice} : {});
      const [items, setItems] = useState(() => inventory?.items ? [...inventory.items] : []);
      
      const birdCount = Object.values(birdsByPrice).reduce((s,c)=>s+c, 0);
      const itemCount = items.reduce((s,i)=>s+i.qty, 0);
      
      // No inventory — creation mode
      if (!inventory && !editMode) {
        if (textMode) {
          return <TextInputMode onSave={(parsed) => { saveInventoryData(parsed, null); setTextMode(false); }} onCancel={() => setTextMode(false)} />;
        }
        return (
          <div className="space-y-3">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
              <p className="text-4xl mb-2">📋</p>
              <p className="font-bold text-purple-700">Ревизия не проведена</p>
              <p className="text-sm text-purple-500 mt-1">Укажите количество товара на витрине</p>
            </div>
            
            <BirdPriceEditor birdsByPrice={birdsByPrice} setBirdsByPrice={setBirdsByPrice} totalBirds={totalBirds} setTotalBirds={setTotalBirds} />
            <ItemsEditor items={items} setItems={setItems} />
            
            <label className="flex items-center justify-center h-12 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-purple-400 hover:bg-purple-50">
              <Camera className="w-4 h-4 text-gray-400 mr-2" /><span className="text-sm text-gray-500">📷 Фото витрины</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleInvPhoto} className="hidden" />
            </label>
            
            <div className="flex gap-2">
              <button onClick={() => setTextMode(true)} className="py-3 px-4 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600">📝 Текстом</button>
              <button onClick={() => {
                  if ((totalBirds || birdCount) === 0 && itemCount === 0) { showNotification('Введите количество', 'error'); return; }
                  saveInventoryData({ totalBirds, birdsByPrice, items }, invPhotoUrl);
                  setInvPhotoUrl(null);
                }} disabled={(totalBirds || birdCount) === 0 && itemCount === 0}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                ✅ Сохранить
              </button>
            </div>
          </div>
        );
      }
      
      // Edit mode
      if (editMode) {
        if (textMode) {
          return <TextInputMode onSave={(parsed) => { saveInventoryData(parsed, null); setEditMode(false); setTextMode(false); }} onCancel={() => setTextMode(false)} />;
        }
        return (
          <div className="space-y-3">
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between">
              <p className="font-bold text-purple-700 text-sm">✏️ Редактирование ревизии</p>
              {((totalBirds||birdCount) + itemCount) > 0 && <span className="text-xs text-purple-500">{(totalBirds||birdCount) + itemCount} шт</span>}
            </div>
            <BirdPriceEditor birdsByPrice={birdsByPrice} setBirdsByPrice={setBirdsByPrice} totalBirds={totalBirds} setTotalBirds={setTotalBirds} />
            <ItemsEditor items={items} setItems={setItems} />
            <div className="flex gap-2">
              <button onClick={() => setTextMode(true)} className="py-3 px-3 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600">📝</button>
              <button onClick={() => setEditMode(false)} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
              <button onClick={() => { saveInventoryData({ totalBirds, birdsByPrice, items }, null); setEditMode(false); }}
                className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold">💾 Сохранить</button>
            </div>
          </div>
        );
      }
      
      // View mode
      const inv = inventory;
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
            setTotalBirds(inv.totalBirds || 0);
            setBirdsByPrice(inv.birdsByPrice ? {...inv.birdsByPrice} : {});
            setItems(inv.items ? [...inv.items] : []);
            setEditMode(true);
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
          <button onClick={() => { const wasOpen = shiftPhotoMode === 'open'; setShiftPhotoMode(null); if (wasOpen && !myShift?.inventory) setShowInventoryModal(true); }} className="w-full bg-gray-200 py-2 rounded-xl font-semibold hover:bg-gray-300">
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
                      <button onClick={() => setShowInventoryModal(true)} className="mt-2 bg-yellow-500/30 border border-yellow-300/50 rounded-lg px-3 py-1.5 text-xs text-white w-full text-center hover:bg-yellow-500/40 animate-pulse">
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
            <RevisionTab />
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
        <InventoryModal />
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
  };

  // ===== ЛИЧНЫЙ КАБИНЕТ СОТРУДНИКА =====
  const ProfileView = () => {
    const [tab, setTab] = useState('salary'); // salary | goals | achievements | bonuses | account
    const [period, setPeriod] = useState('week'); // week | month
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);
    const [passError, setPassError] = useState('');
    const [passSaved, setPassSaved] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [displayNameEdit, setDisplayNameEdit] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState('');

    // Текущий залогиненный пользователь
    const authData = (() => { try { return JSON.parse(localStorage.getItem('likebird-auth') || '{}'); } catch { return {}; } })();
    const currentLogin = authData.login || employeeName;
    const myProfile = profilesData[currentLogin] || {};
    const avatar = myProfile.avatar || null;
    const displayName = myProfile.displayName || employeeName;

    // Найти сотрудника по имени
    const myEmployee = employees.find(e => e.name === employeeName || e.name === displayName);

    // Период для фильтрации отчётов
    const now = new Date();
    const periodStart = new Date();
    if (period === 'week') periodStart.setDate(now.getDate() - 7);
    // FIX: «месяц» = 30 дней назад (единообразно с getEmployeeProgress)
    else periodStart.setDate(now.getDate() - 30);

    const parseReportDate = (dateStr) => {
      try {
        const [datePart] = dateStr.split(',');
        const [d, m, y] = datePart.trim().split('.');
        return new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
      } catch { return new Date(0); }
    };

    // Мои отчёты за период
    const myReports = reports.filter(r => {
      const isMe = r.employee === employeeName || r.employee === displayName;
      const date = parseReportDate(r.date);
      return isMe && date >= periodStart && date <= now;
    });

    // Зарплата
    const mySalary = myReports.reduce((sum, r) => sum + (getEffectiveSalary(r) || 0), 0);
    const myRevenue = myReports.reduce((sum, r) => sum + (r.total || 0), 0);
    const myTips = myReports.reduce((sum, r) => sum + (r.tips || 0), 0);

    // Все мои отчёты (всё время) для достижений
    const allMyReports = reports.filter(r => r.employee === employeeName || r.employee === displayName);
    const totalRevenue = allMyReports.reduce((sum, r) => sum + (r.total || 0), 0);

    // Штрафы и бонусы за период
    const myEmpId = myEmployee?.id;
    // FIX: Безопасный парсинг дат бонусов/штрафов (поддержка ISO и DD.MM.YYYY)
    const parseBonusDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
      // Пробуем DD.MM.YYYY
      const parts = dateStr.split('.');
      if (parts.length === 3) return new Date(parseYear(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      return new Date(0);
    };

    const myPenalties = myEmpId ? penalties.filter(p => {
      const d = parseBonusDate(p.date);
      return p.employeeId === myEmpId && d >= periodStart && d <= now;
    }) : [];
    const myBonuses = myEmpId ? bonuses.filter(b => {
      const d = parseBonusDate(b.date);
      return b.employeeId === myEmpId && d >= periodStart && d <= now;
    }) : [];
    const totalPenalties = myPenalties.reduce((s, p) => s + p.amount, 0);
    const totalBonuses = myBonuses.reduce((s, b) => s + b.amount, 0);
    const netSalary = mySalary + totalBonuses - totalPenalties;

    // Мой рейтинг
    const myRating = myEmpId ? getEmployeeAverageRating(myEmpId) : 0;
    const myRatingCount = myEmpId ? Object.values(employeeRatings).filter(r => r.employeeId === myEmpId).length : 0;

    // Цели KPI
    const myGoals = myEmpId ? Object.values(employeeKPI).filter(g => g.employeeId === myEmpId) : [];

    // Достижения
    // Встроенные достижения
    const builtinAchievements = [
      { id: 'first_sale', icon: '🐣', title: 'Первая продажа', desc: 'Совершить первую продажу', done: allMyReports.length >= 1 },
      { id: 'sales_10', icon: '🌱', title: 'Начинающий', desc: '10 продаж', done: allMyReports.length >= 10 },
      { id: 'sales_50', icon: '🐦', title: 'Продавец птиц', desc: '50 продаж', done: allMyReports.length >= 50 },
      { id: 'sales_100', icon: '🦅', title: 'Охотник', desc: '100 продаж', done: allMyReports.length >= 100 },
      { id: 'sales_500', icon: '🏆', title: 'Легенда', desc: '500 продаж', done: allMyReports.length >= 500 },
      { id: 'revenue_10k', icon: '💵', title: '10 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 10000 },
      { id: 'revenue_50k', icon: '💰', title: '50 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 50000 },
      { id: 'revenue_200k', icon: '💎', title: '200 000 ₽', desc: 'Выручка за всё время', done: totalRevenue >= 200000 },
      { id: 'tips', icon: '⭐', title: 'Любимчик', desc: 'Получить чаевые', done: allMyReports.some(r => r.tips > 0) },
      { id: 'streak_week', icon: '🔥', title: 'Активная неделя', desc: '5+ продаж за 7 дней', done: (() => {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return allMyReports.filter(r => parseReportDate(r.date) >= weekAgo).length >= 5;
      })() },
      { id: 'big_sale', icon: '🎯', title: 'Большая продажа', desc: 'Продажа от 1500 ₽', done: allMyReports.some(r => r.salePrice >= 1500) },
      { id: 'no_penalty', icon: '😇', title: 'Чистая репутация', desc: 'Ни одного штрафа', done: myEmpId ? penalties.filter(p => p.employeeId === myEmpId).length === 0 : true },
    ];

    // Кастомные достижения от администратора
    const customAchievementsEvaluated = customAchievements.map(ach => {
      let done = false;
      const val = Number(ach.condValue) || 0;
      if (ach.condType === 'manual') {
        done = (achievementsGranted[ach.id] || []).includes(currentLogin);
      } else if (ach.condType === 'sales_count') {
        done = allMyReports.length >= val;
      } else if (ach.condType === 'revenue') {
        done = totalRevenue >= val;
      } else if (ach.condType === 'big_sale') {
        done = allMyReports.some(r => r.salePrice >= val);
      } else if (ach.condType === 'tips_count') {
        done = allMyReports.filter(r => r.tips > 0).length >= val;
      }
      return { ...ach, done, isCustom: true };
    });

    const achievements = [...builtinAchievements, ...customAchievementsEvaluated];
    const doneCount = achievements.filter(a => a.done).length;

    const handleSavePassword = async () => {
      setPassError('');
      setPassSaved(false);
      if (!newPassword) { setPassError('Введите новый пароль'); return; }
      if (newPassword.length < 4) { setPassError('Минимум 4 символа'); return; }
      if (newPassword !== confirmNewPassword) { setPassError('Пароли не совпадают'); return; }
      let users = [];
      try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
      const idx = users.findIndex(u => u.login === currentLogin);
      if (idx === -1) { setPassError('Пользователь не найден'); return; }
      const hashed = await hashPassword(newPassword);
      users[idx].passwordHash = hashed;
      localStorage.setItem('likebird-users', JSON.stringify(users));
      // FIX: Синхронизируем с Firebase (ранее пароль не сохранялся — терялся при sync/на другом устройстве)
      fbSave('likebird-users', users);
      setNewPassword(''); setConfirmNewPassword('');
      setPassSaved(true);
      setTimeout(() => setPassSaved(false), 3000);
    };

    const handleAvatarChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) { showNotification('Максимум 1.5 МБ', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newData = { ...profilesData, [currentLogin]: { ...myProfile, avatar: ev.target.result } };
        updateProfilesData(newData);
        showNotification('Аватар обновлён');
      };
      reader.readAsDataURL(file);
    };

    const handleRemoveAvatar = () => {
      const newData = { ...profilesData, [currentLogin]: { ...myProfile, avatar: null } };
      updateProfilesData(newData);
      showNotification('Аватар удалён');
    };

    const handleSaveDisplayName = () => {
      if (!newDisplayName.trim()) return;
      const newData = { ...profilesData, [currentLogin]: { ...myProfile, displayName: newDisplayName.trim() } };
      updateProfilesData(newData);
      setDisplayNameEdit(false);
      showNotification('Имя обновлено');
    };

    const TABS = [
      { id: 'salary', label: '💰 Зарплата' },
      { id: 'bonuses', label: '📊 Бонусы' },
      { id: 'goals', label: '🎯 Цели' },
      { id: 'achievements', label: '🏆 Достижения' },
      { id: 'account', label: '⚙️ Аккаунт' },
    ];

    const roleLabel = myEmployee?.role === 'admin' ? '👑 Администратор' : myEmployee?.role === 'senior' ? '⭐ Старший продавец' : '🐦 Продавец';

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 pb-8">
        {/* Шапка профиля */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <div className="p-4 flex items-center gap-3">
            <button onClick={() => setCurrentView('menu')} className="p-1 rounded-lg hover:bg-white/20">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold">Мой профиль</h2>
          </div>
          <div className="px-4 pb-6 flex items-center gap-4">
            {/* Аватар */}
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-white/20 overflow-hidden flex items-center justify-center shadow-lg">
                {avatar
                  ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-4xl">{(displayName || '?')[0].toUpperCase()}</span>
                }
              </div>
            </div>
            {/* Имя и роль */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black truncate">{displayName}</h3>
              </div>
              <p className="text-white/70 text-sm">{roleLabel}</p>
              {myRating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= Math.round(myRating) ? 'text-yellow-300 fill-yellow-300' : 'text-white/30'}`} />
                  ))}
                  <span className="text-white/70 text-xs ml-1">{myRating.toFixed(1)} ({myRatingCount})</span>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{doneCount}/{achievements.length} достижений</span>
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{allMyReports.length} продаж</span>
              </div>
            </div>
          </div>
        </div>

        {/* Табы */}
        <div className="flex overflow-x-auto bg-white shadow-sm sticky top-0 z-10 gap-0 no-scrollbar">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="max-w-md mx-auto px-4 pt-4">

          {/* ===== ЗАРПЛАТА ===== */}
          {tab === 'salary' && (
            <div className="space-y-4">

              {/* BLOCK 6: Working Hours */}
              <div className="bg-white rounded-2xl p-4 shadow">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" />Рабочее время за месяц</h3>
                {(() => {
                  const myLoginPV = authData.login || '';
                  const now2 = new Date();
                  const monthStart2 = new Date(now2.getFullYear(), now2.getMonth(), 1);
                  let totalHours = 0; let daysWorked = 0; let overtimeDays = 0;
                  Object.entries(shiftsData).forEach(([key, shift]) => {
                    if (!key.startsWith(myLoginPV + '_')) return;
                    if (!shift.openTime || !shift.closeTime) return;
                    try {
                      // Use openedAt/closedAt timestamps if available, otherwise parse from key date + time string
                      let hours = 0;
                      if (shift.openedAt && shift.closedAt) {
                        const openTs = new Date(shift.openedAt);
                        if (openTs < monthStart2) return;
                        hours = (shift.closedAt - shift.openedAt) / (1000 * 60 * 60);
                      } else {
                        // Parse date from key (login_DD.MM.YY) and time from openTime/closeTime (HH:MM)
                        const datePart = key.split('_').slice(1).join('_'); // DD.MM.YY
                        const [dd, mm, yy] = datePart.split('.');
                        if (!dd || !mm) return;
                        const year = parseInt(yy) < 100 ? 2000 + parseInt(yy) : parseInt(yy);
                        const shiftDate = new Date(year, parseInt(mm) - 1, parseInt(dd));
                        if (shiftDate < monthStart2) return;
                        const [oh, om] = shift.openTime.split(':').map(Number);
                        const [ch, cm] = shift.closeTime.split(':').map(Number);
                        hours = (ch * 60 + cm - oh * 60 - om) / 60;
                      }
                      if (hours > 0 && hours < 24) { totalHours += hours; daysWorked++; if (hours > 8) overtimeDays++; }
                    } catch { /* silent */ }
                  });
                  totalHours = Math.round(totalHours * 10) / 10;
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Дней отработано:</span><span className="font-bold">{daysWorked}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Часов всего:</span><span className="font-bold">{totalHours} ч</span></div>
                      {overtimeDays > 0 && <div className="flex justify-between"><span className="text-gray-500">Переработки (&gt;8ч):</span><span className="font-bold text-red-500">{overtimeDays} дн</span></div>}
                      <div className="flex justify-between"><span className="text-gray-500">Ср. часов/день:</span><span className="font-bold">{daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : 0} ч</span></div>
                    </div>
                  );
                })()}
              </div>

              {/* BLOCK 7: Streaks */}
              <div className="bg-white rounded-2xl p-4 shadow">
                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">🔥 Серия хороших дней</h3>
                {(() => {
                  const byDay = {};
                  allMyReports.forEach(r => {
                    const d = r.date?.split(',')[0] || '';
                    byDay[d] = (byDay[d] || 0) + (r.total || 0);
                  });
                  const dailyVals = Object.values(byDay);
                  const avg = dailyVals.length > 0 ? dailyVals.reduce((s, v) => s + v, 0) / dailyVals.length : 0;
                  const dates = Object.keys(byDay).sort((a, b) => {
                    const [ad, am, ay] = a.split('.'); const [bd, bm, by_] = b.split('.');
                    return new Date(2000 + parseInt(by_ || 0), parseInt(bm || 1) - 1, parseInt(bd || 1)) - new Date(2000 + parseInt(ay || 0), parseInt(am || 1) - 1, parseInt(ad || 1));
                  });
                  let streak = 0;
                  for (let i = dates.length - 1; i >= 0; i--) { if (byDay[dates[i]] >= avg) streak++; else break; }
                  const icon = streak >= 14 ? '🏆' : streak >= 7 ? '⭐' : streak >= 3 ? '🌟' : '🔥';
                  return (
                    <div className="text-center py-2">
                      <p className="text-3xl mb-1">{icon}</p>
                      <p className="text-xl font-black">{streak} {streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}</p>
                      <p className="text-xs text-gray-500">подряд выше среднего ({Math.round(avg).toLocaleString()} ₽)</p>
                    </div>
                  );
                })()}
              </div>

              {/* Переключатель периода */}
              <div className="flex bg-white rounded-xl p-1 shadow">
                {[{id:'week',label:'Эта неделя'},{id:'month',label:'Этот месяц'}].map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${period === p.id ? 'bg-indigo-500 text-white shadow' : 'text-gray-500'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Итоговая карточка */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
                <p className="text-white/70 text-sm mb-1">К получению</p>
                <p className="text-4xl font-black">{netSalary.toLocaleString()} ₽</p>
                <div className="flex gap-4 mt-3 text-sm">
                  <div><p className="text-white/60">Продажи</p><p className="font-bold">{mySalary.toLocaleString()} ₽</p></div>
                  {totalBonuses > 0 && <div><p className="text-white/60">Бонусы</p><p className="font-bold text-green-300">+{totalBonuses.toLocaleString()} ₽</p></div>}
                  {totalPenalties > 0 && <div><p className="text-white/60">Штрафы</p><p className="font-bold text-red-300">-{totalPenalties.toLocaleString()} ₽</p></div>}
                  {myTips > 0 && <div><p className="text-white/60">Чаевые</p><p className="font-bold text-yellow-300">+{myTips.toLocaleString()} ₽</p></div>}
                </div>
              </div>

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 shadow text-center">
                  <p className="text-2xl font-black text-indigo-600">{myReports.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">продаж</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow text-center">
                  <p className="text-2xl font-black text-green-600">{myRevenue.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-0.5">выручка ₽</p>
                </div>
                <div className="bg-white rounded-xl p-3 shadow text-center">
                  <p className="text-2xl font-black text-amber-600">{myReports.length > 0 ? Math.round(myRevenue / myReports.length) : 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">средний чек</p>
                </div>
              </div>

              {/* Список продаж */}
              <div>
                <h3 className="font-bold text-gray-700 mb-2 text-sm">Детализация ({myReports.length})</h3>
                {myReports.length === 0 ? (
                  <div className="bg-white rounded-xl p-6 text-center shadow">
                    <p className="text-gray-400">Нет продаж за этот период</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...myReports].sort((a, b) => parseReportDate(b.date) - parseReportDate(a.date)).map(r => {
                      const sal = getEffectiveSalary(r);
                      return (
                        <div key={r.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                          <div className="text-2xl">{(() => {
                            const prod = DYNAMIC_ALL_PRODUCTS.find(p => p.name === r.product);
                            return prod?.emoji || '🐦';
                          })()}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{r.product}</p>
                            <p className="text-xs text-gray-400">{(r.date||'').split(',')[0]} · {r.total?.toLocaleString()} ₽ · {r.paymentType === 'cashless' ? '💳' : '💵'}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-indigo-600">+{sal} ₽</p>
                            {r.tips > 0 && <p className="text-xs text-amber-500">⭐ +{r.tips}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== БОНУСЫ / ШТРАФЫ ===== */}
          {tab === 'bonuses' && (
            <div className="space-y-4">
              <div className="flex bg-white rounded-xl p-1 shadow">
                {[{id:'week',label:'Эта неделя'},{id:'month',label:'Этот месяц'}].map(p => (
                  <button key={p.id} onClick={() => setPeriod(p.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${period === p.id ? 'bg-indigo-500 text-white shadow' : 'text-gray-500'}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Итог */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-green-600">+{totalBonuses.toLocaleString()}</p>
                  <p className="text-sm text-green-700 mt-1">₽ Бонусы</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-red-600">-{totalPenalties.toLocaleString()}</p>
                  <p className="text-sm text-red-700 mt-1">₽ Штрафы</p>
                </div>
              </div>

              {/* Список бонусов */}
              {myBonuses.length > 0 && (
                <div>
                  <h3 className="font-bold text-green-700 mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Бонусы</h3>
                  <div className="space-y-2">
                    {myBonuses.map(b => (
                      <div key={b.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🎁</div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{b.reason}</p>
                          <p className="text-xs text-gray-400">{new Date(b.date).toLocaleDateString('ru-RU')}</p>
                        </div>
                        <p className="font-bold text-green-600">+{b.amount.toLocaleString()} ₽</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Список штрафов */}
              {myPenalties.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-700 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Штрафы</h3>
                  <div className="space-y-2">
                    {myPenalties.map(p => (
                      <div key={p.id} className="bg-white rounded-xl p-3 shadow flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">⚠️</div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{p.reason}</p>
                          <p className="text-xs text-gray-400">{new Date(p.date).toLocaleDateString('ru-RU')}</p>
                        </div>
                        <p className="font-bold text-red-600">-{p.amount.toLocaleString()} ₽</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {myBonuses.length === 0 && myPenalties.length === 0 && (
                <div className="bg-white rounded-xl p-8 text-center shadow">
                  <p className="text-4xl mb-3">😊</p>
                  <p className="text-gray-500">За этот период нет бонусов и штрафов</p>
                </div>
              )}
            </div>
          )}

          {/* ===== ЦЕЛИ ===== */}
          {tab === 'goals' && (
            <div className="space-y-4">
              {myGoals.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center shadow">
                  <p className="text-5xl mb-3">🎯</p>
                  <p className="text-gray-600 font-semibold">Целей пока нет</p>
                  <p className="text-gray-400 text-sm mt-2">Администратор может поставить вам цели в разделе «Команда»</p>
                </div>
              ) : (
                myGoals.map(goal => {
                  const progress = myEmpId ? getEmployeeProgress(myEmpId, goal.goalType, goal.period) : null;
                  const pct = progress ? Math.min(100, Math.round((progress.current / progress.target) * 100)) : 0;
                  const goalLabels = { sales: '🛒 Количество продаж', sales_count: '🛒 Количество продаж', revenue: '💰 Выручка', avg_check: '📊 Средний чек' };
                  return (
                    <div key={`${goal.employeeId}_${goal.goalType}_${goal.period}`} className={`rounded-xl p-4 shadow ${darkMode ? "bg-gray-800" : "bg-white"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold">{goalLabels[goal.goalType] || goal.goalType}</p>
                          <p className="text-xs text-gray-400">{goal.period === 'week' ? 'За неделю' : 'За месяц'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-indigo-600">{pct}%</p>
                        </div>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-indigo-500' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      {progress && (
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {typeof progress.current === 'number' ? progress.current.toLocaleString() : progress.current} / {goal.target.toLocaleString()}
                          {goal.goalType === 'revenue' || goal.goalType === 'avg_check' ? ' ₽' : ''}
                        </p>
                      )}
                      {pct >= 100 && (
                        <p className="text-center text-green-600 font-bold text-sm mt-2">✅ Цель выполнена!</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ===== ДОСТИЖЕНИЯ ===== */}
          {tab === 'achievements' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg flex items-center gap-4">
                <div className="text-5xl">🏅</div>
                <div>
                  <p className="font-black text-2xl">{doneCount} / {achievements.length}</p>
                  <p className="text-white/80 text-sm">достижений получено</p>
                  <div className="h-2 bg-white/30 rounded-full mt-2 w-32 overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{width: `${Math.round(doneCount/achievements.length*100)}%`}} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {achievements.sort((a, b) => b.done - a.done).map(ach => (
                  <div key={ach.id} className={`bg-white rounded-xl p-4 shadow flex items-center gap-3 transition-all ${!ach.done ? 'opacity-50 grayscale' : ''}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${ach.done ? 'bg-amber-100' : 'bg-gray-100'}`}>
                      {ach.done ? ach.icon : '🔒'}
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold ${ach.done ? 'text-gray-800' : 'text-gray-400'}`}>{ach.title}</p>
                      <p className="text-xs text-gray-400">{ach.desc}</p>
                    </div>
                    {ach.done && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== АККАУНТ ===== */}
          {tab === 'account' && (
            <div className="space-y-4">

              {/* Аватар */}
              <div className="bg-white rounded-2xl p-5 shadow">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Camera className="w-4 h-4" /> Аватар</h3>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-100 overflow-hidden flex items-center justify-center text-4xl shadow">
                    {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span>{(displayName || '?')[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-600 transition-all text-center">
                      📷 Загрузить фото
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                    {avatar && (
                      <button onClick={handleRemoveAvatar} className="text-red-500 text-sm font-semibold hover:text-red-700 text-center">
                        🗑️ Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Отображаемое имя */}
              <div className="bg-white rounded-2xl p-5 shadow">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Edit3 className="w-4 h-4" /> Отображаемое имя</h3>
                {displayNameEdit ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={e => setNewDisplayName(e.target.value)}
                      placeholder={displayName}
                      className="flex-1 p-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:border-indigo-500 text-sm"
                      autoFocus
                    />
                    <button onClick={handleSaveDisplayName} className="bg-indigo-500 text-white px-4 rounded-xl font-bold hover:bg-indigo-600">✓</button>
                    <button onClick={() => setDisplayNameEdit(false)} className="bg-gray-100 text-gray-600 px-4 rounded-xl hover:bg-gray-200">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="font-semibold text-gray-700">{displayName}</span>
                    <button onClick={() => { setDisplayNameEdit(true); setNewDisplayName(displayName); }}
                      className="text-indigo-500 text-sm font-semibold hover:text-indigo-700">Изменить</button>
                  </div>
                )}
              </div>

              {/* Смена пароля */}
              <div className="bg-white rounded-2xl p-5 shadow">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Key className="w-4 h-4" /> Сменить пароль</h3>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPassError(''); }}
                      placeholder="Новый пароль"
                      className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none text-sm pr-12"
                    />
                    <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-3 text-gray-400">
                      {showNewPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={e => { setConfirmNewPassword(e.target.value); setPassError(''); }}
                    placeholder="Повторите пароль"
                    className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none text-sm"
                  />
                  {passError && <p className="text-red-500 text-sm">{passError}</p>}
                  {passSaved && <p className="text-green-600 text-sm font-semibold">✅ Пароль успешно изменён!</p>}
                  <button onClick={handleSavePassword}
                    className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all">
                    Сохранить пароль
                  </button>
                </div>
              </div>

              {/* Информация */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                <p className="text-xs text-gray-400 text-center">Логин: <span className="font-semibold text-gray-600">{currentLogin}</span></p>
                <p className="text-xs text-gray-400 text-center mt-1">Аккаунт создан: {authData.createdAt ? new Date(authData.createdAt).toLocaleDateString('ru-RU') : '—'}</p>
              </div>

              {/* Выход */}
              <button
                onClick={() => {
                  showConfirm('Выйти из аккаунта?', () => {
                    localStorage.removeItem('likebird-auth');
                    localStorage.removeItem('likebird-employee');
                    setIsAuthenticated(false);
                    setEmployeeName('');
                    setAuthName('');
                  });
                }}
                className="w-full py-3 bg-white border-2 border-red-200 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all shadow">
                <LogOut className="w-5 h-5" /> Выйти из аккаунта
              </button>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ===== СТРАНИЦА АВТОРИЗАЦИИ =====
  const AuthView = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [mode, setMode] = useState('login'); // login, register
    const [error, setError] = useState('');
    const [showPass, setShowPass] = useState(false);

    const handleRegister = async () => {
      if (!login.trim()) { setError('Введите логин'); return; }
      if (login.trim().length < 2) { setError('Логин минимум 2 символа'); return; }
      if (!password) { setError('Введите пароль'); return; }
      if (password.length < 4) { setError('Пароль минимум 4 символа'); return; }
      if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
      if (!inviteCode.trim()) { setError('Введите код приглашения от администратора'); return; }

      setError('Проверяем код...');

      // Читаем коды НАПРЯМУЮ из Firebase — без кэша localStorage
      const normalizedCode = inviteCode.trim().toUpperCase();
      let codes = (await fbGet('likebird-invite-codes')) || [];
      if (!Array.isArray(codes)) codes = [];

      // Дополняем из localStorage на случай если Firebase недоступен
      if (codes.length === 0) {
        try { codes = JSON.parse(localStorage.getItem('likebird-invite-codes') || '[]'); } catch { /* silent */ }
      }

      const validCode = codes.find(c => c.code === normalizedCode && !c.used);
      if (!validCode) { setError('Неверный или использованный код приглашения'); return; }

      // Проверяем что логин не занят — тоже читаем из Firebase напрямую
      let users = (await fbGet('likebird-users')) || [];
      if (!Array.isArray(users)) users = [];
      if (users.length === 0) {
        try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
      }

      if (users.find(u => u.login.toLowerCase() === login.trim().toLowerCase())) { setError('Этот логин уже занят'); return; }

      setError('');
      const hashedPass = await hashPassword(password);
      const newUser = { login: login.trim(), name: login.trim(), passwordHash: hashedPass, createdAt: Date.now(), role: 'seller', inviteCode: validCode.code };
      const updatedUsers = [...users, newUser];
      localStorage.setItem('likebird-users', JSON.stringify(updatedUsers));
      await fbSave('likebird-users', updatedUsers);

      // Добавляем в employees если ещё нет
      const currentEmps = (() => { try { return JSON.parse(localStorage.getItem('likebird-employees') || '[]'); } catch { return []; } })();
      if (!currentEmps.find(e => e.name === newUser.name)) {
        const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name: newUser.name, role: newUser.role || 'seller', salaryMultiplier: 1.0, active: true };
        const updatedEmps = [...currentEmps, newEmp];
        localStorage.setItem('likebird-employees', JSON.stringify(updatedEmps));
        await fbSave('likebird-employees', updatedEmps);
        // FIX: Обновляем React-state (ранее отсутствовало — сотрудник не появлялся до перезагрузки)
        setEmployees(updatedEmps);
      }

      // Помечаем код как использованный — сразу в Firebase
      const updatedCodes = codes.map(c => c.code === validCode.code ? {...c, used: true, usedBy: login.trim(), usedAt: Date.now()} : c);
      localStorage.setItem('likebird-invite-codes', JSON.stringify(updatedCodes));
      await fbSave('likebird-invite-codes', updatedCodes);
      // FIX: Обновляем React-state (ранее код оставался «неиспользованным» в UI админки)
      setInviteCodes(updatedCodes);

      // Авторизуем
      const authData = { authenticated: true, name: login.trim(), login: login.trim(), expiry: Date.now() + (30*24*60*60*1000), createdAt: Date.now() };
      localStorage.setItem('likebird-auth', JSON.stringify(authData));
      localStorage.setItem('likebird-employee', login.trim());
      setEmployeeName(login.trim());
      setAuthName(login.trim());
      setCurrentUser(newUser);
      setIsAuthenticated(true);
    };

    const handleLogin = async () => {
      if (!login.trim()) { setError('Введите логин'); return; }
      if (!password) { setError('Введите пароль'); return; }

      setError('Входим...');
      // Читаем пользователей напрямую из Firebase для актуальности
      let users = (await fbGet('likebird-users')) || [];
      if (!Array.isArray(users) || users.length === 0) {
        try { users = JSON.parse(localStorage.getItem('likebird-users') || '[]'); } catch { /* silent */ }
      }
      // Кэшируем локально
      if (users.length > 0) localStorage.setItem('likebird-users', JSON.stringify(users));

      const user = users.find(u => u.login.toLowerCase() === login.trim().toLowerCase());
      if (!user) { setError('Пользователь не найден'); return; }

      const hashedPass = await hashPassword(password);
      if (hashedPass !== user.passwordHash) { setError('Неверный пароль'); setPassword(''); return; }

      const authData = { authenticated: true, name: user.name, login: user.login, expiry: Date.now() + (30*24*60*60*1000) };
      localStorage.setItem('likebird-auth', JSON.stringify(authData));
      localStorage.setItem('likebird-employee', user.name);
      setEmployeeName(user.name);
      setAuthName(user.name);
      setCurrentUser(user);
      setIsAuthenticated(true);
    };

    const hasUsers = (() => { try { return JSON.parse(localStorage.getItem('likebird-users') || '[]').length > 0; } catch { return false; } })();
    // Первый пользователь = админ, может регистрироваться без кода
    const isFirstUser = !hasUsers;

    const handleFirstUserRegister = async () => {
      if (!login.trim()) { setError('Введите логин'); return; }
      if (!password || password.length < 4) { setError('Пароль минимум 4 символа'); return; }
      if (password !== confirmPassword) { setError('Пароли не совпадают'); return; }
      
      const hashedPass = await hashPassword(password);
      const newUser = { login: login.trim(), name: login.trim(), passwordHash: hashedPass, createdAt: Date.now(), isAdmin: true, role: 'admin' };
      localStorage.setItem('likebird-users', JSON.stringify([newUser]));
      fbSave('likebird-users', [newUser]);
      
      // FIX: Добавляем первого пользователя в employees (ранее отсутствовало)
      const newEmp = { id: Date.now() + Math.random().toString(36).slice(2,6) + Math.random().toString(36).slice(2, 6), name: newUser.name, role: 'admin', salaryMultiplier: 1.0, active: true };
      const empList = [newEmp];
      localStorage.setItem('likebird-employees', JSON.stringify(empList));
      fbSave('likebird-employees', empList);
      setEmployees(empList);
      
      const authData = { authenticated: true, name: login.trim(), login: login.trim(), expiry: Date.now() + (30*24*60*60*1000), createdAt: Date.now() };
      localStorage.setItem('likebird-auth', JSON.stringify(authData));
      localStorage.setItem('likebird-employee', login.trim());
      setEmployeeName(login.trim());
      setAuthName(login.trim());
      setCurrentUser(newUser);
      setIsAuthenticated(true);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-4 shadow-2xl">
              <span className="text-5xl">🐦</span>
            </div>
            <h1 className="text-4xl font-black text-white drop-shadow-lg">LikeBird</h1>
            <p className="text-white/80 text-sm mt-1">Учёт продаж v{APP_VERSION}</p>
          </div>

          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-2xl">
            {isFirstUser ? (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-1">Первый запуск!</h2>
                <p className="text-gray-500 text-sm mb-4">Создайте аккаунт администратора</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                    <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Ваш логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Минимум 4 символа" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Подтвердите пароль</label>
                    <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Повторите пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                  </div>
                  <button onClick={handleFirstUserRegister} className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                    ✅ Создать аккаунт
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Переключатель вход / регистрация */}
                <div className="flex mb-4 bg-gray-100 rounded-xl p-1">
                  <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Вход</button>
                  <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}>Регистрация</button>
                </div>

                {mode === 'login' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                      <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Ваш логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" autoFocus />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Ваш пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }} />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <button onClick={handleLogin} className="w-full py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                      🔓 Войти
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Код приглашения</label>
                      <input type="text" value={inviteCode} onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setError(''); }} placeholder="Код от администратора" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none font-mono text-center tracking-widest text-lg" autoFocus maxLength={6} />
                      <p className="text-xs text-gray-400 mt-1">Получите код у администратора</p>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Логин</label>
                      <input type="text" value={login} onChange={(e) => { setLogin(e.target.value); setError(''); }} placeholder="Придумайте логин" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Пароль</label>
                      <div className="relative">
                        <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} placeholder="Минимум 4 символа" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none pr-12" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">{showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Подтвердите пароль</label>
                      <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }} placeholder="Повторите пароль" className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none" />
                    </div>
                    <button onClick={handleRegister} className="w-full py-4 bg-gradient-to-r from-green-400 to-emerald-500 text-white rounded-2xl font-bold text-lg hover:shadow-lg transition-all">
                      ✅ Зарегистрироваться
                    </button>
                  </div>
                )}
              </>
            )}

            {error && <p className="text-red-500 text-sm text-center mt-3 font-medium">{error}</p>}
          </div>

          <div className="mt-6 text-center">
            <p className="text-white/60 text-xs">📲 Добавьте в закладки или установите как приложение</p>
          </div>
        </div>
      </div>
    );
  };

  // ===== ЗАГРУЗКА =====
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mb-4 animate-pulse">
            <span className="text-4xl">🐦</span>
          </div>
          <p className="text-white font-bold text-xl">LikeBird</p>
          <p className="text-white/70 text-sm mt-1">Загрузка...</p>
        </div>
      </div>
    );
  }

  // ===== АВТОРИЗАЦИЯ =====
  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <div className={darkMode ? 'dark-theme' : ''} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div ref={notificationRef} style={{opacity: 0, pointerEvents: 'none'}} className="fixed top-4 left-1/2 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white text-sm font-medium transition-opacity duration-300 bg-green-500" />
      <div ref={confirmDialogRef} style={{display: 'none'}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
          <p data-confirm-msg className="text-lg mb-4"></p>
          <div className="flex gap-3">
            <button onClick={hideConfirm} className="flex-1 py-2 bg-gray-200 rounded-lg font-semibold">Отмена</button>
            <button onClick={handleConfirmClick} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-semibold">Подтвердить</button>
          </div>
        </div>
      </div>
      <ExpenseModal key={expenseModal ? 'exp-' + expenseModal.employee : 'exp-closed'} />
      <div ref={inputModalRef} style={{display: 'none'}} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <h3 data-input-title className="text-lg font-bold mb-3"></h3>
          <input ref={inputModalInputRef} type="text" value={inputModalValue || ""} onChange={e => setInputModalValue(e.target.value)} className="w-full p-3 border-2 border-gray-200 rounded-xl mb-4 focus:border-amber-500 focus:outline-none" onKeyDown={e => { if (e.key === 'Enter') handleInputModalSave(); if (e.key === 'Escape') hideInputModal(); }} />
          <div className="flex gap-3">
            <button onClick={hideInputModal} className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold">Отмена</button>
            <button onClick={handleInputModalSave} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600">Сохранить</button>
          </div>
        </div>
      </div>
      {currentView === 'menu' && <MenuView />}
      {currentView === 'catalog' && <CatalogView />}
      {currentView === 'new-report' && <NewReportView />}
      {currentView === 'text-import' && <TextImportView />}
      {currentView === 'stock' && <StockView />}
      {currentView === 'reports' && <ReportsView />}
      {currentView === 'day-report' && <DayReportView />}
      {currentView === 'notifications' && <NotificationsView />}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'admin' && <AdminView />}
      {currentView === 'team' && <TeamView />}
      {currentView === 'profile' && <ProfileView />}
      {currentView === 'shift' && <ShiftView />}
      {currentView === 'analytics' && <AnalyticsView />}
      {currentView === 'game' && <GameView />}
    </div>
  );
}
