import React from 'react';

export const formatDate = (date) => typeof date === 'string' ? date : date.toLocaleDateString('ru-RU');

export const dateForFile = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };

export const useDebounce = (value, delay = 300) => {
  const [deb, setDeb] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setDeb(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return deb;
};

export const parseRuDate = (dateStr) => {
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

export const parseYear = (y) => {
  if (!y) return new Date().getFullYear().toString();
  if (y.length === 4) return y;
  return `20${y}`;
};
