import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'es';

const en = {
  // App shell
  'app.title': 'Moltbot Admin',
  'app.tab.emergencies': 'Emergencies',
  'app.tab.devices': 'Devices',

  // Common
  'common.dismiss': 'Dismiss',
  'common.refresh': 'Refresh',
  'common.never': 'Never',
  'common.authRequired': 'Authentication required. Please log in via Cloudflare Access.',
  'time.secondsAgo': '{n}s ago',
  'time.minutesAgo': '{n}m ago',
  'time.hoursAgo': '{n}h ago',
  'time.daysAgo': '{n}d ago',

  // Admin (Devices) page
  'admin.loadingDevices': 'Loading devices...',
  'admin.fetchDevicesFailed': 'Failed to fetch devices',
  'admin.parseError': 'Parse error: {msg}',
  'admin.gatewayControls': 'Gateway Controls',
  'admin.restartGateway': 'Restart Gateway',
  'admin.restarting': 'Restarting...',
  'admin.restartConfirm':
    'Are you sure you want to restart the gateway? This will disconnect all clients temporarily.',
  'admin.restartAlert': 'Gateway restart initiated. Clients will reconnect automatically.',
  'admin.restartFailed': 'Failed to restart gateway',
  'admin.restartHint':
    'Restart the gateway to apply configuration changes or recover from errors. All connected clients will be temporarily disconnected.',
  'admin.r2WarningTitle': 'R2 Storage Not Configured',
  'admin.r2WarningBody':
    'Paired devices and conversations will be lost when the container restarts. To enable persistent storage, configure R2 credentials. See the',
  'admin.r2WarningLink': 'README',
  'admin.missing': 'Missing: {list}',
  'admin.r2Configured':
    'R2 storage is configured. Your data will persist across container restarts.',
  'admin.lastBackup': 'Last backup: {time}',
  'admin.backupNow': 'Backup Now',
  'admin.syncing': 'Syncing...',
  'admin.syncFailed': 'Sync failed',
  'admin.pendingRequests': 'Pending Pairing Requests',
  'admin.approveAll': 'Approve All ({n})',
  'admin.approving': 'Approving...',
  'admin.approve': 'Approve',
  'admin.approvalFailed': 'Approval failed',
  'admin.approveDevicesFailed': 'Failed to approve {n} device(s)',
  'admin.approveDeviceFailed': 'Failed to approve device',
  'admin.noPending': 'No pending pairing requests',
  'admin.noPendingHint':
    'Devices will appear here when they attempt to connect without being paired.',
  'admin.pairedDevices': 'Paired Devices',
  'admin.noPaired': 'No paired devices',
  'admin.unknownDevice': 'Unknown Device',
  'admin.badge.pending': 'Pending',
  'admin.badge.paired': 'Paired',
  'admin.label.platform': 'Platform:',
  'admin.label.client': 'Client:',
  'admin.label.mode': 'Mode:',
  'admin.label.role': 'Role:',
  'admin.label.ip': 'IP:',
  'admin.label.requested': 'Requested:',
  'admin.label.pairedAt': 'Paired:',

  // Kanban page
  'kb.loadingBoard': 'Loading board...',
  'kb.board': 'Emergency Board',
  'kb.newCard': '+ New Card',
  'kb.cancel': 'Cancel',
  'kb.create': 'Create',
  'kb.creating': 'Creating...',
  'kb.titlePlaceholder': 'Title (e.g. Flooding in sector 4)',
  'kb.descPlaceholder': 'Description (optional)',
  'kb.deleteConfirm': 'Delete this card?',
  'kb.noCards': 'No cards',
  'kb.col.new': 'New',
  'kb.col.triaged': 'Triaged',
  'kb.col.in_progress': 'In Progress',
  'kb.col.resolved': 'Resolved',
  'kb.agentSource': 'agent · {source}',
  'kb.via': 'via {reporter}',
  'kb.type.need': 'Need',
  'kb.type.offer': 'Offer',
  'kb.case': 'Case #{n}',
  'kb.fetchFailed': 'Failed to fetch cards',
  'kb.createFailed': 'Failed to create card',
  'kb.moveFailed': 'Failed to move card',
  'kb.deleteFailed': 'Failed to delete card',
} as const;

export type I18nKey = keyof typeof en;

const es: Record<I18nKey, string> = {
  'app.title': 'Administración Moltbot',
  'app.tab.emergencies': 'Emergencias',
  'app.tab.devices': 'Dispositivos',

  'common.dismiss': 'Cerrar',
  'common.refresh': 'Actualizar',
  'common.never': 'Nunca',
  'common.authRequired': 'Se requiere autenticación. Inicia sesión con Cloudflare Access.',
  'time.secondsAgo': 'hace {n}s',
  'time.minutesAgo': 'hace {n}m',
  'time.hoursAgo': 'hace {n}h',
  'time.daysAgo': 'hace {n}d',

  'admin.loadingDevices': 'Cargando dispositivos...',
  'admin.fetchDevicesFailed': 'Error al cargar los dispositivos',
  'admin.parseError': 'Error de formato: {msg}',
  'admin.gatewayControls': 'Controles del gateway',
  'admin.restartGateway': 'Reiniciar gateway',
  'admin.restarting': 'Reiniciando...',
  'admin.restartConfirm':
    '¿Seguro que quieres reiniciar el gateway? Todos los clientes se desconectarán temporalmente.',
  'admin.restartAlert':
    'Reinicio del gateway iniciado. Los clientes se reconectarán automáticamente.',
  'admin.restartFailed': 'Error al reiniciar el gateway',
  'admin.restartHint':
    'Reinicia el gateway para aplicar cambios de configuración o recuperarse de errores. Todos los clientes conectados se desconectarán temporalmente.',
  'admin.r2WarningTitle': 'Almacenamiento R2 no configurado',
  'admin.r2WarningBody':
    'Los dispositivos emparejados y las conversaciones se perderán cuando el contenedor se reinicie. Para habilitar el almacenamiento persistente, configura las credenciales de R2. Consulta el',
  'admin.r2WarningLink': 'README',
  'admin.missing': 'Faltan: {list}',
  'admin.r2Configured':
    'El almacenamiento R2 está configurado. Tus datos persistirán entre reinicios del contenedor.',
  'admin.lastBackup': 'Última copia: {time}',
  'admin.backupNow': 'Copiar ahora',
  'admin.syncing': 'Sincronizando...',
  'admin.syncFailed': 'Error al sincronizar',
  'admin.pendingRequests': 'Solicitudes de emparejamiento pendientes',
  'admin.approveAll': 'Aprobar todas ({n})',
  'admin.approving': 'Aprobando...',
  'admin.approve': 'Aprobar',
  'admin.approvalFailed': 'La aprobación falló',
  'admin.approveDevicesFailed': 'Error al aprobar {n} dispositivo(s)',
  'admin.approveDeviceFailed': 'Error al aprobar el dispositivo',
  'admin.noPending': 'No hay solicitudes de emparejamiento pendientes',
  'admin.noPendingHint':
    'Los dispositivos aparecerán aquí cuando intenten conectarse sin estar emparejados.',
  'admin.pairedDevices': 'Dispositivos emparejados',
  'admin.noPaired': 'No hay dispositivos emparejados',
  'admin.unknownDevice': 'Dispositivo desconocido',
  'admin.badge.pending': 'Pendiente',
  'admin.badge.paired': 'Emparejado',
  'admin.label.platform': 'Plataforma:',
  'admin.label.client': 'Cliente:',
  'admin.label.mode': 'Modo:',
  'admin.label.role': 'Rol:',
  'admin.label.ip': 'IP:',
  'admin.label.requested': 'Solicitado:',
  'admin.label.pairedAt': 'Emparejado:',

  'kb.loadingBoard': 'Cargando el tablero...',
  'kb.board': 'Tablero de emergencias',
  'kb.newCard': '+ Nueva tarjeta',
  'kb.cancel': 'Cancelar',
  'kb.create': 'Crear',
  'kb.creating': 'Creando...',
  'kb.titlePlaceholder': 'Título (p. ej. Inundación en el sector 4)',
  'kb.descPlaceholder': 'Descripción (opcional)',
  'kb.deleteConfirm': '¿Eliminar esta tarjeta?',
  'kb.noCards': 'Sin tarjetas',
  'kb.col.new': 'Nuevas',
  'kb.col.triaged': 'Clasificadas',
  'kb.col.in_progress': 'En curso',
  'kb.col.resolved': 'Resueltas',
  'kb.agentSource': 'agente · {source}',
  'kb.via': 'vía {reporter}',
  'kb.type.need': 'Necesidad',
  'kb.type.offer': 'Oferta',
  'kb.case': 'Caso #{n}',
  'kb.fetchFailed': 'Error al cargar las tarjetas',
  'kb.createFailed': 'Error al crear la tarjeta',
  'kb.moveFailed': 'Error al mover la tarjeta',
  'kb.deleteFailed': 'Error al eliminar la tarjeta',
};

const dictionaries: Record<Lang, Record<I18nKey, string>> = { en, es };

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
}

export type TFunction = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLang(): Lang {
  const stored = localStorage.getItem('lang');
  if (stored === 'en' || stored === 'es') return stored;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  const setLang = (next: Lang) => {
    localStorage.setItem('lang', next);
    setLangState(next);
  };

  const t: TFunction = (key, vars) => interpolate(dictionaries[lang][key] ?? en[key], vars);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
