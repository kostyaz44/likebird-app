import { ALL_PRODUCTS } from '../data/products.js';

export const getInitialStock = () => {
  const stock = {};
  ALL_PRODUCTS.forEach(p => { stock[p.name] = { count: 0, minStock: 3, category: p.category, emoji: p.emoji, price: p.price }; });
  return stock;
};

// Mobile-compatible file download helper
export const downloadBlob = (blob, filename) => {
  try {
    const url = URL.createObjectURL(blob);
    // Method 1: Standard download via <a> click
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { document.body.removeChild(a); } catch {} URL.revokeObjectURL(url); }, 1000);
  } catch (err) {
    // Method 2: Fallback — open in new tab
    try {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { /* final fallback - do nothing */ }
  }
};

export const logErr = (ctx, e) => { try { console.warn('[LikeBird]', ctx, e?.message || e); } catch { /* silent */ } };
