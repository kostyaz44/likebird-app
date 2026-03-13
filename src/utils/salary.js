// ===== УТИЛИТЫ: Расчёт зарплаты =====

export const calculateSalary = (basePrice, salePrice, category, tips = 0, adj = 'normal', salarySettings = null) => {
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

export const isBelowBasePrice = (basePrice, salePrice) => salePrice < basePrice;
