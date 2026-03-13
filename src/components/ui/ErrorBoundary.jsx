import React from 'react';

// Error Boundary для перехвата крашей
export default class LikeBirdErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { try { console.error('[LikeBird] Crash:', error, info); } catch { /* silent */ } }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', { style: { padding: 40, textAlign: 'center', fontFamily: 'system-ui' } },
        React.createElement('h2', null, '😔 Приложение столкнулось с ошибкой'),
        React.createElement('p', { style: { color: '#666', margin: '16px 0' } }, String(this.state.error?.message || 'Неизвестная ошибка')),
        React.createElement('button', {
          onClick: () => { this.setState({ hasError: false, error: null }); },
          style: { padding: '12px 24px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, cursor: 'pointer' }
        }, '🔄 Перезагрузить'),
        React.createElement('button', {
          onClick: () => { localStorage.clear(); window.location.reload(); },
          style: { padding: '12px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, cursor: 'pointer', marginLeft: 12 }
        }, '🗑️ Сбросить данные')
      );
    }
    return this.props.children;
  }
}
