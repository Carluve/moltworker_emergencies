import { useState } from 'react';
import AdminPage from './pages/AdminPage';
import KanbanPage from './pages/KanbanPage';
import { useI18n } from './i18n';
import './App.css';

type Tab = 'kanban' | 'devices';

export default function App() {
  const [tab, setTab] = useState<Tab>('kanban');
  const { lang, setLang, t } = useI18n();

  return (
    <div className="app">
      <header className="app-header">
        <img src="/logo-small.png" alt="Moltworker" className="header-logo" />
        <h1>{t('app.title')}</h1>
        <nav className="app-tabs">
          <button
            className={`tab-btn ${tab === 'kanban' ? 'active' : ''}`}
            onClick={() => setTab('kanban')}
          >
            {t('app.tab.emergencies')}
          </button>
          <button
            className={`tab-btn ${tab === 'devices' ? 'active' : ''}`}
            onClick={() => setTab('devices')}
          >
            {t('app.tab.devices')}
          </button>
        </nav>
        <div className="lang-toggle">
          <button
            className={`tab-btn ${lang === 'es' ? 'active' : ''}`}
            onClick={() => setLang('es')}
          >
            ES
          </button>
          <button
            className={`tab-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </header>
      <main className="app-main">{tab === 'kanban' ? <KanbanPage /> : <AdminPage />}</main>
    </div>
  );
}
