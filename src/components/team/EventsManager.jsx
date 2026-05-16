import React, { useState } from 'react';
import { Calendar, Plus, X, Edit3, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { parseYear } from '../../utils/dates.js';

/**
 * EventsManager — добавление/редактирование/удаление событий календаря.
 * Раньше: AdminView → Персонал+ → События/Лог.
 * Теперь: рендерится в TeamView → События для админа (над списком событий-просмотра).
 */
export default function EventsManager() {
  const {
    eventsCalendar,
    setEventsCalendar,
    save,
    showNotification,
    showConfirm,
    currentUser,
    darkMode,
  } = useApp();

  const isAdmin = currentUser?.isAdmin === true || currentUser?.role === 'admin' || currentUser?.role === 'deputy';

  const [showEventForm, setShowEventForm] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEvent, setNewEvent] = useState({ title: '', description: '', type: 'info', emoji: '📅' });
  const [editingEventRef, setEditingEventRef] = useState(null); // { dateKey, index }
  const [expanded, setExpanded] = useState(false);

  const EVENT_TYPES = [
    { id: 'sale', label: '🎁 Акция', emoji: '🎁' },
    { id: 'holiday', label: '🎉 Праздник', emoji: '🎉' },
    { id: 'training', label: '📚 Обучение', emoji: '📚' },
    { id: 'shift', label: '🔄 Смена', emoji: '🔄' },
    { id: 'info', label: '📌 Инфо', emoji: '📌' },
  ];

  // Все события, отсортированы по дате
  const sortedEvents = Object.entries(eventsCalendar || {})
    .flatMap(([date, evArr]) => (Array.isArray(evArr) ? evArr : [evArr]).map((ev, i) => ({ date, ev, index: i })))
    .sort((a, b) => {
      const parse = (d) => {
        const [dd, mm, yy] = d.split('.');
        return new Date(parseInt(parseYear(yy)), mm - 1, dd);
      };
      return parse(a.date) - parse(b.date);
    });

  const saveEvent = () => {
    if (!newDate || !newEvent.title) {
      showNotification('Заполните дату и название', 'error');
      return;
    }
    const [y, m, d] = newDate.split('-');
    const dateKey = `${d}.${m}.${y}`;
    const updated = { ...eventsCalendar };

    if (editingEventRef) {
      // Удаляем старое событие (дата могла измениться)
      const oldKey = editingEventRef.dateKey;
      const oldIdx = editingEventRef.index;
      if (updated[oldKey]) {
        updated[oldKey] = updated[oldKey].filter((_, i) => i !== oldIdx);
        if (updated[oldKey].length === 0) delete updated[oldKey];
      }
    }

    if (!updated[dateKey]) updated[dateKey] = [];
    updated[dateKey] = [...updated[dateKey], { ...newEvent, createdAt: Date.now() }];

    setEventsCalendar(updated);
    save('likebird-events', updated);
    setNewDate('');
    setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' });
    setEditingEventRef(null);
    setShowEventForm(false);
    showNotification(editingEventRef ? 'Событие обновлено' : 'Событие добавлено');
  };

  const deleteEvent = (date, index) => {
    showConfirm('Удалить событие?', () => {
      const updated = { ...eventsCalendar };
      if (updated[date]) {
        updated[date] = updated[date].filter((_, i) => i !== index);
        if (updated[date].length === 0) delete updated[date];
      }
      setEventsCalendar(updated);
      save('likebird-events', updated);
      showNotification('Событие удалено');
    });
  };

  const startEditEvent = (date, index, ev) => {
    const [d, m, y] = date.split('.');
    setNewDate(`${y}-${m}-${d}`);
    setNewEvent({
      title: ev.title,
      description: ev.description || '',
      type: ev.type || 'info',
      emoji: ev.emoji || '📅',
    });
    setEditingEventRef({ dateKey: date, index });
    setShowEventForm(true);
    setExpanded(true);
  };

  if (!isAdmin) return null;

  return (
    <div className={`rounded-2xl shadow border-2 border-red-200 mb-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      {/* Заголовок-аккордеон */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-red-500" />
          <h3 className="font-bold text-gray-700">Управление событиями</h3>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {sortedEvents.length}
          </span>
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-3">
          <button
            onClick={() => {
              setShowEventForm(!showEventForm);
              if (showEventForm) {
                setEditingEventRef(null);
                setNewDate('');
                setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' });
              }
            }}
            className={`w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              showEventForm ? 'bg-gray-200 text-gray-700' : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {showEventForm ? <><X className="w-4 h-4" />Отмена</> : <><Plus className="w-4 h-4" />Добавить событие</>}
          </button>

          {showEventForm && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">Дата *</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-semibold block mb-1">Тип</label>
                  <select
                    value={newEvent.type}
                    onChange={(e) => {
                      const t = EVENT_TYPES.find(et => et.id === e.target.value);
                      setNewEvent({ ...newEvent, type: e.target.value, emoji: t?.emoji || '📅' });
                    }}
                    className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-400 focus:outline-none"
                  >
                    {EVENT_TYPES.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
                  </select>
                </div>
              </div>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Название события *"
                className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none"
              />
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Описание (необязательно)"
                rows={2}
                className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm focus:border-red-400 focus:outline-none resize-none"
              />
              <button
                onClick={saveEvent}
                className="w-full py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600"
              >
                {editingEventRef ? '✏️ Обновить событие' : '✅ Сохранить событие'}
              </button>
              {editingEventRef && (
                <button
                  onClick={() => {
                    setEditingEventRef(null);
                    setShowEventForm(false);
                    setNewDate('');
                    setNewEvent({ title: '', description: '', type: 'info', emoji: '📅' });
                  }}
                  className="w-full py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300"
                >
                  Отмена редактирования
                </button>
              )}
            </div>
          )}

          {/* Список событий с кнопками управления */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {sortedEvents.length === 0 ? (
              <p className="text-gray-400 text-center py-6">Нет событий</p>
            ) : sortedEvents.map(({ date, ev, index }) => (
              <div key={`${date}_${index}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border">
                <span className="text-2xl flex-shrink-0">{ev.emoji || '📅'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{ev.title}</p>
                  <p className="text-xs text-gray-400">
                    {date}{ev.description && ` • ${ev.description}`}
                  </p>
                </div>
                <button
                  onClick={() => startEditEvent(date, index, ev)}
                  className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg flex-shrink-0"
                  title="Редактировать"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteEvent(date, index)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg flex-shrink-0"
                  title="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
