import React, { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { formatDate, parseRuDate } from '../utils/dates.js';
import { useApp } from '../context/AppContext';

export default function AnalyticsView() {
  const { analyticsPeriod, currentUser, darkMode, employeeName, employees, getEffectiveSalary, getProductName, predictDemand, reports, salesPlan, setAnalyticsPeriod, setCurrentView, stock } = useApp();

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
}
