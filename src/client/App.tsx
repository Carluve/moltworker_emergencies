import { useState } from 'react';
import AdminPage from './pages/AdminPage';
import KanbanPage from './pages/KanbanPage';
import './App.css';

type Tab = 'kanban' | 'devices';

export default function App() {
  const [tab, setTab] = useState<Tab>('kanban');

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo-small.png" alt="Moltworker" className="header-logo" />
        <h1>Moltbot Admin</h1>
        <nav className="app-tabs">
          <button
            className={`tab-btn ${tab === 'kanban' ? 'active' : ''}`}
            onClick={() => setTab('kanban')}
          >
            Emergencies
          </button>
          <button
            className={`tab-btn ${tab === 'devices' ? 'active' : ''}`}
            onClick={() => setTab('devices')}
          >
            Devices
          </button>
        </nav>
      </header>
      <main className="app-main">{tab === 'kanban' ? <KanbanPage /> : <AdminPage />}</main>
    </div>
  );
}
