// ===== УТИЛИТЫ: Расчёт зарплаты =====

/**
 * Расчёт ЗП за одну продажу.
 *
 * @param {number} basePrice - базовая цена товара (для проверки занижения)
 * @param {number} salePrice - фактическая цена продажи
 * @param {string} category - категория товара ("Птички-свистульки" и т.д.)
 * @param {number} tips - чаевые
 * @param {'normal'|'none'|'deduct'} adj - корректировка решения админа
 * @param {object} salarySettings - настройки зарплаты (диапазоны + админские поля)
 * @param {string} [employeeRole] - роль сотрудника ('seller'|'senior'|'admin'). Если 'admin' и
 *                                  salarySettings.adminSalaryMode === 'perSale' — добавляется
 *                                  фиксированная надбавка adminSalaryPerSale за каждую продажу.
 *                                  Режим 'percentage' применяется ОТДЕЛЬНО на уровне смены
 *                                  (через выручку), а не здесь.
 */
export const calculateSalary = (basePrice, salePrice, category, tips = 0, adj = 'normal', salarySettings = null, employeeRole = null) => {
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

  // НОВОЕ: фикс ₽ за продажу для администратора (режим 'perSale')
  // Режим 'percentage' (% от выручки) применяется на уровне смены, не здесь
  if (employeeRole === 'admin' && salarySettings?.adminSalaryMode === 'perSale') {
    const perSale = Number(salarySettings?.adminSalaryPerSale) || 0;
    base += perSale;
  }

  return Math.max(0, base) + tips;
};

/**
 * Расчёт дополнительной ЗП администратора за смену (режим 'percentage').
 * Используется на уровне дневного отчёта/смены — добавляется один раз к общей ЗП.
 *
 * @param {number} shiftRevenue - суммарная выручка за смену
 * @param {object} salarySettings - настройки зарплаты
 * @returns {number} надбавка (₽). Возвращает 0, если режим не percentage.
 */
export const calculateAdminShiftBonus = (shiftRevenue, salarySettings = null) => {
  if (!salarySettings) return 0;
  if (salarySettings.adminSalaryMode !== 'percentage') return 0;
  const pct = Number(salarySettings.adminSalaryPercentage) || 0;
  if (pct <= 0) return 0;
  return Math.round((Number(shiftRevenue) || 0) * pct / 100);
};

/**
 * Заработок администратора за ПЕРИОД (по списку отчётов).
 * Удобная функция для UI SalaryPanel — суммарный заработок админа за неделю/месяц.
 *
 * - В режиме 'percentage': % от суммарной выручки всех отчётов в периоде
 * - В режиме 'perSale':    фикс ₽ × количество отчётов в периоде
 *
 * @param {Array} periodReports - массив отчётов за период (с полем total для percentage режима)
 * @param {object} salarySettings - настройки зарплаты
 * @returns {number} заработок админа за период в ₽
 */
export const calculateAdminEarnings = (periodReports = [], salarySettings = null) => {
  if (!salarySettings || !Array.isArray(periodReports) || periodReports.length === 0) return 0;
  const mode = salarySettings.adminSalaryMode || 'percentage';
  if (mode === 'perSale') {
    const perSale = Number(salarySettings.adminSalaryPerSale) || 0;
    return perSale * periodReports.length;
  }
  // percentage по умолчанию
  const pct = Number(salarySettings.adminSalaryPercentage) || 0;
  if (pct <= 0) return 0;
  const totalRevenue = periodReports.reduce((s, r) => s + (Number(r.total) || 0), 0);
  return Math.round(totalRevenue * pct / 100);
};

export const isBelowBasePrice = (basePrice, salePrice) => salePrice < basePrice;
