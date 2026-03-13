import { AMBIGUOUS_PRODUCTS } from '../data/products.js';
import { calculateSalary } from './salary.js';

export const checkCashless = (line) => {
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

export const parseWorkTime = (text) => {
  let open = null, close = null;
  const oM = text.match(/открыл[аси]*[ья]?\s*(?:в\s*)?(\d{1,2})[:\.]?(\d{2})?/i);
  if (oM) open = oM[1].padStart(2, '0') + ':' + (oM[2] || '00');
  const cM = text.match(/(?:закрыл[аси]*|передал[аи]?\s*смену)[ья]?\s*(?:в\s*)?(\d{1,2})[:\.]?(\d{2})?/i);
  if (cM) close = cM[1].padStart(2, '0') + ':' + (cM[2] || '00');
  let hours = null;
  if (open && close) { const [oh, om] = open.split(':').map(Number); const [ch, cm] = close.split(':').map(Number); hours = (ch + cm/60) - (oh + om/60); if (hours < 0) hours += 24; }
  return { openTime: open, closeTime: close, workHours: hours };
};

export const findProductByPrice = (text, price, customAliases, dynamicAllProducts) => {
  const l = text.toLowerCase().trim();
  // Сначала проверяем кастомные алиасы
  for (const [alias, productName] of Object.entries(customAliases)) {
    if (l.includes(alias.toLowerCase())) {
      const found = dynamicAllProducts.find(p => p.name === productName);
      if (found) return found;
    }
  }
  for (const [keyword, rule] of Object.entries(AMBIGUOUS_PRODUCTS)) {
    if (l.includes(keyword)) {
      if (price >= rule.above) return dynamicAllProducts.find(p => p.name === rule.nameAbove);
      return dynamicAllProducts.find(p => p.name === rule.name);
    }
  }
  let found = null, best = 0;
  for (const p of dynamicAllProducts) { for (const a of p.aliases) { if (l.includes(a) && a.length > best) { found = p; best = a.length; } } }
  return found;
};

export const parseExpenses = (text) => {
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

export const parseInventory = (text, customAliases, dynamicAllProducts) => {
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
      const product = findProductByPrice(countMatch[1].trim(), 500, customAliases, dynamicAllProducts);
      if (product) inventory[section][product.name] = parseInt(countMatch[2]);
    }
  });
  return inventory;
};

export const countSoldProducts = (recognized) => {
  const sold = {};
  recognized.forEach(s => { if (s.product?.name) sold[s.product.name] = (sold[s.product.name] || 0) + 1; });
  return sold;
};

export const compareInventory = (inventory, sold, dynamicAllProducts) => {
  const discrepancies = [];
  const allProducts = new Set([...Object.keys(inventory.start), ...Object.keys(inventory.end), ...Object.keys(sold)]);
  allProducts.forEach(name => {
    const start = inventory.start[name] || 0, end = inventory.end[name] || 0, soldCount = sold[name] || 0, expected = start - end;
    if ((start > 0 || end > 0) && expected !== soldCount) {
      const p = dynamicAllProducts.find(x => x.name === name);
      discrepancies.push({ name, emoji: p?.emoji || '❓', startCount: start, endCount: end, expectedSold: expected, actualSold: soldCount, difference: soldCount - expected });
    }
  });
  return discrepancies;
};

export const parseTextReport = (text, customAliases, dynamicAllProducts) => {
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
    const product = findProductByPrice(productText, price, customAliases, dynamicAllProducts);
    if (product) {
      const salary = calculateSalary(product.price, price, product.category, tips, 'normal', null);
      recognized.push({ price, tips, paymentType, cashAmount: isCashless ? 0 : price, cashlessAmount: isCashless ? price : 0, product, category: product.category, isUnrecognized: false, salary, originalLine: t });
    } else {
      unrecognized.push({ price, tips, paymentType, cashAmount: isCashless ? 0 : price, cashlessAmount: isCashless ? price : 0, extractedName: productText || t, isUnrecognized: true, salary: tips, originalText: t });
    }
  });
  return { recognized, unrecognized, workTime, expenses: parsedExpenses, inventory: parseInventory(text, customAliases, dynamicAllProducts) };
};
