'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadAlerts();

    // Refresh every 10 seconds
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(data);
  }

  async function loadAlerts() {
    try {
      const { data, error } = await supabase.rpc('get_my_alerts', {
        p_status_filter: null,
      });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'high':
        return '#e74c3c';
      case 'medium':
        return '#f39c12';
      case 'low':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  }

  function getStatusText(status: string) {
    switch (status) {
      case 'triggered':
        return 'Nueva';
      case 'acknowledged':
        return 'Reconocida';
      case 'escalated':
        return 'Escalada';
      case 'closed':
        return 'Cerrada';
      default:
        return status;
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Portal ACV-Guard</h1>
          <p className={styles.subtitle}>Hola, {profile?.full_name}</p>
        </div>
        <button onClick={handleLogout} className={styles.logoutButton}>
          Cerrar Sesión
        </button>
      </header>

      <main className={styles.main}>
        <div className={styles.alertsHeader}>
          <h2>Alertas Activas</h2>
          <span className={styles.count}>{alerts.length}</span>
        </div>

        {alerts.length === 0 ? (
          <p className={styles.empty}>No hay alertas activas</p>
        ) : (
          <div className={styles.alertsList}>
            {alerts.map((alert: any) => (
              <div
                key={alert.alert_id}
                className={styles.alertCard}
                onClick={() => router.push(`/alert/${alert.alert_id}`)}
              >
                <div className={styles.alertHeader}>
                  <div
                    className={styles.severityBadge}
                    style={{ backgroundColor: getSeverityColor(alert.severity) }}
                  >
                    {alert.severity.toUpperCase()}
                  </div>
                  <div className={styles.statusBadge}>{getStatusText(alert.status)}</div>
                </div>

                <h3 className={styles.patientName}>{alert.patient_name}</h3>
                <p className={styles.alertType}>Tipo: {alert.triggered_by}</p>
                <p className={styles.alertDate}>{new Date(alert.created_at).toLocaleString('es-CO')}</p>

                {alert.location_lat && alert.location_lng && (
                  <div className={styles.locationBadge}>
                    <span>📍 Ubicación disponible</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
