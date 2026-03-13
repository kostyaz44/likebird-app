// ═══ Pure revision text parser (extracted for stable reference) ═══
export const parseRevisionText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let totalBirds = 0;
  const birdsByPrice = {};
  const items = [];
  let section = 'birds';
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/^(3[дd]|зд|здэ|здшк|другое|мех|игрушк)/i.test(lower)) { section = 'items'; continue; }
    if (/^птиц/i.test(lower)) { const m = lower.match(/(\d+)/); if (m) totalBirds = parseInt(m[1], 10); section = 'birds'; continue; }
    const birdMatch = line.match(/^(\d+)\s*[хxХX×]\s*(\d+)$/);
    if (birdMatch && section === 'birds') { birdsByPrice[parseInt(birdMatch[2], 10)] = (birdsByPrice[parseInt(birdMatch[2], 10)] || 0) + parseInt(birdMatch[1], 10); continue; }
    const itemMatch = line.match(/^(\d+)\s+(.+)$/);
    if (itemMatch) { items.push({ name: itemMatch[2].trim(), qty: parseInt(itemMatch[1], 10) }); continue; }
    if (line.length > 1 && !/^\d/.test(line)) items.push({ name: line, qty: 1 });
  }
  const birdCount = Object.values(birdsByPrice).reduce((s, c) => s + c, 0);
  return { totalBirds: totalBirds || birdCount, birdsByPrice, items };
};
