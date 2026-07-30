import { useState, useEffect, useCallback } from 'react';
import {
  listDevices,
  approveDevice,
  approveAllDevices,
  restartGateway,
  getStorageStatus,
  triggerSync,
  AuthError,
  type PendingDevice,
  type PairedDevice,
  type DeviceListResponse,
  type StorageStatusResponse,
} from '../api';
import { useI18n, type TFunction } from '../i18n';
import './AdminPage.css';

// Small inline spinner for buttons
function ButtonSpinner() {
  return <span className="btn-spinner" />;
}

function formatSyncTime(isoString: string | null, t: TFunction) {
  if (!isoString) return t('common.never');
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
}

function formatTimestamp(ts: number) {
  const date = new Date(ts);
  return date.toLocaleString();
}

function formatTimeAgo(ts: number, t: TFunction) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return t('time.secondsAgo', { n: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('time.daysAgo', { n: days });
}

export default function AdminPage() {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingDevice[]>([]);
  const [paired, setPaired] = useState<PairedDevice[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [restartInProgress, setRestartInProgress] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      setError(null);
      const data: DeviceListResponse = await listDevices();
      setPending(data.pending || []);
      setPaired(data.paired || []);

      if (data.error) {
        setError(data.error);
      } else if (data.parseError) {
        setError(t('admin.parseError', { msg: data.parseError }));
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError(t('common.authRequired'));
      } else {
        setError(err instanceof Error ? err.message : t('admin.fetchDevicesFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchStorageStatus = useCallback(async () => {
    try {
      const status = await getStorageStatus();
      setStorageStatus(status);
    } catch (err) {
      // Don't show error for storage status - it's not critical
      console.error('Failed to fetch storage status:', err);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    fetchStorageStatus();
  }, [fetchDevices, fetchStorageStatus]);

  const handleApprove = async (requestId: string) => {
    setActionInProgress(requestId);
    try {
      const result = await approveDevice(requestId);
      if (result.success) {
        // Refresh the list
        await fetchDevices();
      } else {
        setError(result.error || t('admin.approvalFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.approveDeviceFailed'));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleApproveAll = async () => {
    if (pending.length === 0) return;

    setActionInProgress('all');
    try {
      const result = await approveAllDevices();
      if (result.failed && result.failed.length > 0) {
        setError(t('admin.approveDevicesFailed', { n: result.failed.length }));
      }
      // Refresh the list
      await fetchDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.approveDeviceFailed'));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRestartGateway = async () => {
    if (!confirm(t('admin.restartConfirm'))) {
      return;
    }

    setRestartInProgress(true);
    try {
      const result = await restartGateway();
      if (result.success) {
        setError(null);
        // Show success message briefly
        alert(t('admin.restartAlert'));
      } else {
        setError(result.error || t('admin.restartFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.restartFailed'));
    } finally {
      setRestartInProgress(false);
    }
  };

  const handleSync = async () => {
    setSyncInProgress(true);
    try {
      const result = await triggerSync();
      if (result.success) {
        // Update the storage status with new lastSync time
        setStorageStatus((prev) => (prev ? { ...prev, lastSync: result.lastSync || null } : null));
        setError(null);
      } else {
        setError(result.error || t('admin.syncFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.syncFailed'));
    } finally {
      setSyncInProgress(false);
    }
  };

  return (
    <div className="devices-page">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-btn">
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {storageStatus && !storageStatus.configured && (
        <div className="warning-banner">
          <div className="warning-content">
            <strong>{t('admin.r2WarningTitle')}</strong>
            <p>
              {t('admin.r2WarningBody')}{' '}
              <a
                href="https://github.com/Carluve/moltworker_emergencies"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('admin.r2WarningLink')}
              </a>
              .
            </p>
            {storageStatus.missing && (
              <p className="missing-secrets">
                {t('admin.missing', { list: storageStatus.missing.join(', ') })}
              </p>
            )}
          </div>
        </div>
      )}

      {storageStatus?.configured && (
        <div className="success-banner">
          <div className="storage-status">
            <div className="storage-info">
              <span>{t('admin.r2Configured')}</span>
              <span className="last-sync">
                {t('admin.lastBackup', { time: formatSyncTime(storageStatus.lastSync, t) })}
              </span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSync}
              disabled={syncInProgress}
            >
              {syncInProgress && <ButtonSpinner />}
              {syncInProgress ? t('admin.syncing') : t('admin.backupNow')}
            </button>
          </div>
        </div>
      )}

      <section className="devices-section gateway-section">
        <div className="section-header">
          <h2>{t('admin.gatewayControls')}</h2>
          <button
            className="btn btn-danger"
            onClick={handleRestartGateway}
            disabled={restartInProgress}
          >
            {restartInProgress && <ButtonSpinner />}
            {restartInProgress ? t('admin.restarting') : t('admin.restartGateway')}
          </button>
        </div>
        <p className="hint">{t('admin.restartHint')}</p>
      </section>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>{t('admin.loadingDevices')}</p>
        </div>
      ) : (
        <>
          <section className="devices-section">
            <div className="section-header">
              <h2>{t('admin.pendingRequests')}</h2>
              <div className="header-actions">
                {pending.length > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={handleApproveAll}
                    disabled={actionInProgress !== null}
                  >
                    {actionInProgress === 'all' && <ButtonSpinner />}
                    {actionInProgress === 'all'
                      ? t('admin.approving')
                      : t('admin.approveAll', { n: pending.length })}
                  </button>
                )}
                <button className="btn btn-secondary" onClick={fetchDevices} disabled={loading}>
                  {t('common.refresh')}
                </button>
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="empty-state">
                <p>{t('admin.noPending')}</p>
                <p className="hint">{t('admin.noPendingHint')}</p>
              </div>
            ) : (
              <div className="devices-grid">
                {pending.map((device) => (
                  <div key={device.requestId} className="device-card pending">
                    <div className="device-header">
                      <span className="device-name">
                        {device.displayName || device.deviceId || t('admin.unknownDevice')}
                      </span>
                      <span className="device-badge pending">{t('admin.badge.pending')}</span>
                    </div>
                    <div className="device-details">
                      {device.platform && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.platform')}</span>
                          <span className="value">{device.platform}</span>
                        </div>
                      )}
                      {device.clientId && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.client')}</span>
                          <span className="value">{device.clientId}</span>
                        </div>
                      )}
                      {device.clientMode && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.mode')}</span>
                          <span className="value">{device.clientMode}</span>
                        </div>
                      )}
                      {device.role && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.role')}</span>
                          <span className="value">{device.role}</span>
                        </div>
                      )}
                      {device.remoteIp && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.ip')}</span>
                          <span className="value">{device.remoteIp}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="label">{t('admin.label.requested')}</span>
                        <span className="value" title={formatTimestamp(device.ts)}>
                          {formatTimeAgo(device.ts, t)}
                        </span>
                      </div>
                    </div>
                    <div className="device-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => handleApprove(device.requestId)}
                        disabled={actionInProgress !== null}
                      >
                        {actionInProgress === device.requestId && <ButtonSpinner />}
                        {actionInProgress === device.requestId
                          ? t('admin.approving')
                          : t('admin.approve')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="devices-section">
            <div className="section-header">
              <h2>{t('admin.pairedDevices')}</h2>
            </div>

            {paired.length === 0 ? (
              <div className="empty-state">
                <p>{t('admin.noPaired')}</p>
              </div>
            ) : (
              <div className="devices-grid">
                {paired.map((device) => (
                  <div key={device.deviceId} className="device-card paired">
                    <div className="device-header">
                      <span className="device-name">
                        {device.displayName || device.deviceId || t('admin.unknownDevice')}
                      </span>
                      <span className="device-badge paired">{t('admin.badge.paired')}</span>
                    </div>
                    <div className="device-details">
                      {device.platform && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.platform')}</span>
                          <span className="value">{device.platform}</span>
                        </div>
                      )}
                      {device.clientId && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.client')}</span>
                          <span className="value">{device.clientId}</span>
                        </div>
                      )}
                      {device.clientMode && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.mode')}</span>
                          <span className="value">{device.clientMode}</span>
                        </div>
                      )}
                      {device.role && (
                        <div className="detail-row">
                          <span className="label">{t('admin.label.role')}</span>
                          <span className="value">{device.role}</span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="label">{t('admin.label.pairedAt')}</span>
                        <span className="value" title={formatTimestamp(device.approvedAtMs)}>
                          {formatTimeAgo(device.approvedAtMs, t)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
