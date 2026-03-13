import React from 'react';

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
};

export default KpiGoalRow;
