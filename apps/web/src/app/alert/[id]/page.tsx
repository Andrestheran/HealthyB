'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './alert.module.css';

export default function AlertDetailPage() {
  const router = useRouter();
  const params = useParams();
  const alertId = params.id as string;
  const supabase = createClient();
  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadAlertDetail();
  }, [alertId]);

  async function loadAlertDetail() {
    try {
      // Get alert
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (alertError) throw alertError;

      // Get patient emergency card
      const { data: cardData, error: cardError } = await supabase.rpc(
        'get_patient_emergency_card',
        { p_patient_id: alertData.patient_id }
      );

      if (cardError) throw cardError;

      // Get location
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('patient_id', alertData.patient_id)
        .single();

      setAlert({
        ...alertData,
        patient_card: cardData,
        location: locationData,
      });
    } catch (error) {
      console.error('Error loading alert:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update_alert_status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            alert_id: alertId,
            new_status: newStatus,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar estado');
      }

      await loadAlertDetail();
      alert('Estado actualizado exitosamente');
    } catch (error: any) {
      alert(error.message || 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  }

  function openMap() {
    if (alert?.location) {
      const url = `https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`;
      window.open(url, '_blank');
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!alert) {
    return (
      <div className={styles.error}>
        <p>Alerta no encontrada</p>
        <button onClick={() => router.push('/dashboard')}>Volver</button>
      </div>
    );
  }

  const card = alert.patient_card;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button onClick={() => router.push('/dashboard')} className={styles.backButton}>
          ← Volver
        </button>
        <h1 className={styles.title}>Detalle de Alerta</h1>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h2>Estado de Alerta</h2>
          <div className={styles.infoGrid}>
            <div>
              <strong>Estado:</strong> {alert.status}
            </div>
            <div>
              <strong>Severidad:</strong> {alert.severity}
            </div>
            <div>
              <strong>Fecha:</strong> {new Date(alert.created_at).toLocaleString('es-CO')}
            </div>
          </div>

          {/* Action buttons */}
          {alert.status === 'triggered' && (
            <button
              onClick={() => updateStatus('acknowledged')}
              disabled={updating}
              className={styles.acknowledgeButton}
            >
              {updating ? 'Actualizando...' : 'Reconocer Alerta'}
            </button>
          )}

          {alert.status === 'acknowledged' && (
            <div className={styles.actionButtons}>
              <button
                onClick={() => updateStatus('escalated')}
                disabled={updating}
                className={styles.escalateButton}
              >
                Escalar
              </button>
              <button
                onClick={() => updateStatus('closed')}
                disabled={updating}
                className={styles.closeButton}
              >
                Cerrar Alerta
              </button>
            </div>
          )}
        </div>

        {card?.profile && (
          <div className={styles.card}>
            <h2>Información del Paciente</h2>
            <div className={styles.infoGrid}>
              <div>
                <strong>Nombre:</strong> {card.profile.full_name}
              </div>
              <div>
                <strong>Teléfono:</strong> {card.profile.phone}
              </div>
              {card.patient && (
                <>
                  <div>
                    <strong>EPS:</strong> {card.patient.eps}
                  </div>
                  <div>
                    <strong>Hospital:</strong> {card.patient.preferred_hospital}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {card?.risk_factors && (
          <div className={styles.card}>
            <h2>Factores de Riesgo</h2>
            <ul className={styles.riskList}>
              {card.risk_factors.has_htn && <li>Hipertensión</li>}
              {card.risk_factors.has_diabetes && <li>Diabetes</li>}
              {card.risk_factors.has_afib && <li>Fibrilación Auricular</li>}
              {card.risk_factors.has_prior_stroke && <li>ACV Previo</li>}
              {card.risk_factors.smoker && <li>Fumador</li>}
              {card.risk_factors.dyslipidemia && <li>Dislipidemia</li>}
            </ul>
          </div>
        )}

        {card?.medications && card.medications.length > 0 && (
          <div className={styles.card}>
            <h2>Medicamentos</h2>
            <ul className={styles.medList}>
              {card.medications.map((med: any) => (
                <li key={med.id}>
                  <strong>{med.name}</strong> - {med.dose} ({med.schedule_text})
                </li>
              ))}
            </ul>
          </div>
        )}

        {card?.allergies && card.allergies.length > 0 && (
          <div className={styles.card}>
            <h2>Alergias</h2>
            <ul className={styles.allergyList}>
              {card.allergies.map((allergy: any) => (
                <li key={allergy.id}>
                  <strong>{allergy.substance}</strong> - {allergy.reaction}
                </li>
              ))}
            </ul>
          </div>
        )}

        {card?.emergency_contacts && card.emergency_contacts.length > 0 && (
          <div className={styles.card}>
            <h2>Contactos de Emergencia</h2>
            <ul className={styles.contactList}>
              {card.emergency_contacts.map((contact: any) => (
                <li key={contact.id}>
                  <strong>{contact.full_name}</strong> ({contact.relationship}) - {contact.phone}
                </li>
              ))}
            </ul>
          </div>
        )}

        {alert?.location && (
          <div className={styles.card}>
            <h2>Última Ubicación</h2>
            <p>
              <strong>Coordenadas:</strong> {alert.location.lat.toFixed(6)}, {alert.location.lng.toFixed(6)}
            </p>
            <p>
              <strong>Actualizada:</strong>{' '}
              {new Date(alert.location.updated_at).toLocaleString('es-CO')}
            </p>
            <button onClick={openMap} className={styles.mapButton}>
              📍 Abrir en Google Maps
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
