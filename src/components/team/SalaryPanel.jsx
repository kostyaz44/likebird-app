import React, { useState, useMemo } from 'react';
import { DollarSign } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseYear } from '../../utils/dates.js';

/**
 * SalaryPanel — финансовая сводка, настройки зарплаты, расходы по категориям.
 * Раньше: AdminView → Персонал+ → Финансы.
 * Теперь: вкладка "Зарплата" в TeamView (только для админа).
 *
 * Использует те же ключи: 'likebird-salary-settings'.
 */
export default function SalaryPanel() {
  const {
    reports,
    expenses,
    salarySettings,
    setSalarySettings,
    save,
    logAction,
    showNotification,
    getEffectiveSalary,
    darkMode,
    currentUser,
    expenseCategories,
  } = useApp();

  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin';

  // Период: неделя/месяц
  const [period, setPeriod] = useState('week'); // 'week' | 'month'

  // === Вычисление статистики ===
  const stats = useMemo(() => {
    const today = new Date();
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - (period === 'week' ? 7 : 30));

    const inPeriod = (dateStr) => {
      if (!dateStr) return false;
      const [datePart] = String(dateStr).split(',');
      const [d, m, y] = datePart.split('.');
      if (!d || !m || !y) return false;
      const reportDate = new Date(parseYear(y), parseInt(m) - 1, parseInt(d));
      return reportDate >= cutoff;
    };

    const periodReports = reports.filter(r => inPeriod(r.date) && !r.isUnrecognized);
    const periodExpenses = expenses.filter(e => inPeriod(e.date));

    const revenue = periodReports.reduce((s, r) => s + (r.total || 0), 0);
    const salary = periodReports.reduce((s, r) => s + (getEffectiveSalary?.(r) || 0), 0);
    const expensesTotal = periodExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const profit = revenue - salary - expensesTotal;

    return { revenue, salary, expensesTotal, profit, periodReports, periodExpenses };
  }, [reports, expenses, period, getEffectiveSalary]);

  // === Функции редактирования ranges зарплаты ===
  const updateRange = (index, field, value) => {
    const newRanges = [...salarySettings.ranges];
    newRanges[index] = { ...newRanges[index], [field]: parseInt(value) || 0 };
    const updated = { ...salarySettings, ranges: newRanges };
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменены настройки ЗП', `Диапазон ${index + 1}`);
  };

  const toggleBonus = () => {
    const updated = { ...salarySettings, bonusForBirds: !salarySettings.bonusForBirds };
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменён бонус за птичек', updated.bonusForBirds ? 'Включен' : 'Выключен');
  };

  const updateAdminMode = (mode) => {
    const updated = { ...salarySettings, adminSalaryMode: mode };
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменён режим ЗП админа', mode === 'perSale' ? 'Фикс ₽ за продажу' : 'Процент от выручки');
  };

  const updateAdminPct = (value) => {
    const pct = Math.max(0, Math.min(100, parseInt(value) || 0));
    const updated = { ...salarySettings, adminSalaryPercentage: pct };
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменён процент админа', `${pct}%`);
  };

  const updateAdminPerSale = (value) => {
    const amt = Math.max(0, parseInt(value) || 0);
    const updated = { ...salarySettings, adminSalaryPerSale: amt };
    setSalarySettings(updated);
    save('likebird-salary-settings', updated);
    logAction('Изменён фикс ЗП админа', `${amt}₽ за продажу`);
  };

  // Режим ЗП админа (по умолчанию — процент, обратная совместимость)
  const adminMode = salarySettings?.adminSalaryMode || 'percentage';

  // Если не админ — не рендерим
  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
        <p className="text-yellow-700 font-bold">🔒 Раздел доступен только администратору</p>
      </div>
    );
  }

  const periodLabel = period === 'week' ? 'неделя' : 'месяц';

  return (
    <div className="space-y-4">
      {/* Переключатель периода */}
      <div className="flex gap-2 bg-white rounded-xl p-1 shadow">
        <button
          onClick={() => setPeriod('week')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            period === 'week' ? 'bg-green-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Неделя
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            period === 'month' ? 'bg-green-500 text-white shadow' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          Месяц
        </button>
      </div>

      {/* Финансовая сводка */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
        <h3 className="font-bold mb-3">💰 Финансовая сводка ({periodLabel})</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs opacity-80">Выручка</p>
            <p className="text-xl font-bold">+{stats.revenue.toLocaleString()}₽</p>
            <p className="text-[10px] opacity-70 mt-0.5">{stats.periodReports.length} продаж</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs opacity-80">ЗП сотрудников</p>
            <p className="text-xl font-bold">-{stats.salary.toLocaleString()}₽</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs opacity-80">Расходы</p>
            <p className="text-xl font-bold">-{stats.expensesTotal.toLocaleString()}₽</p>
            <p className="text-[10px] opacity-70 mt-0.5">{stats.periodExpenses.length} записей</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
            <p className="text-xs opacity-80">Чистая прибыль</p>
            <p className={`text-xl font-bold ${stats.profit < 0 ? 'text-red-200' : ''}`}>
              {stats.profit.toLocaleString()}₽
            </p>
          </div>
        </div>
      </div>

      {/* Настройки зарплаты */}
      <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-purple-600" />
          Настройки зарплаты
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Диапазоны: от какой суммы продажи начисляется какая базовая ЗП
        </p>
        <div className="space-y-2">
          {(salarySettings?.ranges || []).map((range, i) => (
            <div key={i} className="flex gap-2 items-center p-2 bg-gray-50 rounded-lg text-sm">
              <input
                type="number"
                defaultValue={range.min}
                onBlur={(e) => updateRange(i, 'min', e.target.value)}
                className="w-16 px-2 py-1 border rounded text-center focus:border-purple-500 focus:outline-none"
              />
              <span className="text-gray-400">—</span>
              <input
                type="number"
                defaultValue={range.max}
                onBlur={(e) => updateRange(i, 'max', e.target.value)}
                className="w-20 px-2 py-1 border rounded text-center focus:border-purple-500 focus:outline-none"
              />
              <span className="text-gray-400">₽ ⇒</span>
              <input
                type="number"
                defaultValue={range.base}
                onBlur={(e) => updateRange(i, 'base', e.target.value)}
                className="w-16 px-2 py-1 border-2 border-purple-200 rounded text-center font-bold focus:border-purple-500 focus:outline-none"
              />
              <span className="text-gray-600">₽</span>
            </div>
          ))}
        </div>

        {/* Бонус за птичек */}
        <label className="flex items-center gap-3 mt-3 p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors" onClick={toggleBonus}>
          <input
            type="checkbox"
            checked={!!salarySettings?.bonusForBirds}
            readOnly
            className="w-5 h-5 accent-purple-600"
          />
          <div>
            <span className="font-medium">Бонус за птичек</span>
            <p className="text-xs text-gray-600">
              +50₽ за каждую продажу из категории "Птички-свистульки"
            </p>
          </div>
        </label>

        {/* ЗП администратора — выбор режима */}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg space-y-3">
          <div>
            <p className="font-medium text-sm">ЗП администратора</p>
            <p className="text-[11px] text-gray-600">Дополнительное вознаграждение админу за смену</p>
          </div>

          {/* Переключатель режима */}
          <div className="flex bg-white rounded-lg p-0.5 border border-blue-200">
            <button
              onClick={() => updateAdminMode('percentage')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                adminMode === 'percentage'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              📊 % от выручки
            </button>
            <button
              onClick={() => updateAdminMode('perSale')}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                adminMode === 'perSale'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              💵 ₽ за продажу
            </button>
          </div>

          {/* Поле для соответствующего режима */}
          {adminMode === 'percentage' ? (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">Процент от выручки за смену</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={salarySettings?.adminSalaryPercentage ?? 10}
                  onBlur={(e) => updateAdminPct(e.target.value)}
                  className="w-16 px-2 py-1 border-2 border-blue-200 rounded text-center font-bold focus:border-blue-500 focus:outline-none"
                />
                <span className="text-gray-600">%</span>
              </div>
            </label>
          ) : (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">Фиксированная сумма за каждую продажу</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  defaultValue={salarySettings?.adminSalaryPerSale ?? 50}
                  onBlur={(e) => updateAdminPerSale(e.target.value)}
                  className="w-20 px-2 py-1 border-2 border-blue-200 rounded text-center font-bold focus:border-blue-500 focus:outline-none"
                />
                <span className="text-gray-600">₽</span>
              </div>
            </label>
          )}

          {/* Пример расчёта */}
          <div className="text-[11px] text-gray-500 bg-white rounded p-2 border border-blue-100">
            {adminMode === 'percentage' ? (
              <>
                💡 Пример: смена с выручкой <b>10 000₽</b> →{' '}
                <b className="text-blue-700">
                  {Math.round(10000 * ((salarySettings?.adminSalaryPercentage ?? 10) / 100)).toLocaleString()}₽
                </b>{' '}
                админу
              </>
            ) : (
              <>
                💡 Пример: смена с <b>20 продажами</b> →{' '}
                <b className="text-blue-700">
                  {(20 * (salarySettings?.adminSalaryPerSale ?? 50)).toLocaleString()}₽
                </b>{' '}
                админу
              </>
            )}
          </div>
        </div>
      </div>

      {/* Расходы по категориям */}
      <div className={`rounded-xl p-4 shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className="font-bold mb-3 flex items-center gap-2">📝 Расходы по категориям ({periodLabel})</h3>
        <div className="space-y-2">
          {(expenseCategories || []).map(cat => {
            const catExpenses = stats.periodExpenses.filter(
              e => e.category === cat.id || (!e.category && cat.id === 'other')
            );
            const total = catExpenses.reduce((s, e) => s + (e.amount || 0), 0);
            return (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
              >
                <span className="text-sm">
                  {cat.emoji} {cat.name}{' '}
                  <span className="text-[10px] text-gray-400">({catExpenses.length})</span>
                </span>
                <span className="font-bold text-red-600">{total.toLocaleString()}₽</span>
              </div>
            );
          })}
        </div>
        {stats.expensesTotal === 0 && (
          <p className="text-center text-gray-400 text-sm mt-3">
            За {periodLabel === 'неделя' ? 'неделю' : 'месяц'} расходов нет
          </p>
        )}
      </div>
    </div>
  );
}
