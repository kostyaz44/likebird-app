import React from 'react';
import KpiGoalRow from './KpiGoalRow';

const KpiGoalsPanel = ({ employees, employeeKPI, setEmployeeGoal, showNotification, getEmployeeProgress, darkMode }) => {
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

export default KpiGoalsPanel;
