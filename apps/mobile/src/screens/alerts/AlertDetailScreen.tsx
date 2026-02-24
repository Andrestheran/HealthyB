import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import Constants from 'expo-constants';

export function AlertDetailScreen({ route, navigation }: any) {
  const { alertId } = route.params;
  const queryClient = useQueryClient();

  const { data: alert, isLoading } = useQuery({
    queryKey: ['alert', alertId],
    queryFn: async () => {
      // Get alert details
      const { data: alertData, error: alertError } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', alertId)
        .single();

      if (alertError) throw alertError;

      // Get patient emergency card
      const { data: cardData, error: cardError } = await supabase.rpc('get_patient_emergency_card', {
        p_patient_id: alertData.patient_id,
      });

      if (cardError) throw cardError;

      // Get location
      const { data: locationData } = await supabase
        .from('locations')
        .select('*')
        .eq('patient_id', alertData.patient_id)
        .single();

      return {
        ...alertData,
        patient_card: cardData,
        location: locationData,
      };
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/update_alert_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          alert_id: alertId,
          new_status: newStatus,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar estado');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert', alertId] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      Alert.alert('Éxito', 'Estado actualizado');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Error al actualizar estado');
    },
  });

  function handleOpenMap() {
    if (alert?.location) {
      const url = `https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}`;
      Linking.openURL(url);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
      </View>
    );
  }

  const card = alert?.patient_card;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalle de Alerta</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Alert Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estado de Alerta</Text>
          <Text style={styles.statusText}>Estado: {alert?.status}</Text>
          <Text style={styles.statusText}>Severidad: {alert?.severity}</Text>
          <Text style={styles.statusText}>
            Fecha: {new Date(alert?.created_at).toLocaleString('es-CO')}
          </Text>
        </View>

        {/* Patient Info */}
        {card?.profile && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Información del Paciente</Text>
            <Text style={styles.infoText}>Nombre: {card.profile.full_name}</Text>
            <Text style={styles.infoText}>Teléfono: {card.profile.phone}</Text>
            {card.patient && (
              <>
                <Text style={styles.infoText}>EPS: {card.patient.eps}</Text>
                <Text style={styles.infoText}>Hospital: {card.patient.preferred_hospital}</Text>
              </>
            )}
          </View>
        )}

        {/* Risk Factors */}
        {card?.risk_factors && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Factores de Riesgo</Text>
            {card.risk_factors.has_htn && <Text style={styles.riskText}>• Hipertensión</Text>}
            {card.risk_factors.has_diabetes && <Text style={styles.riskText}>• Diabetes</Text>}
            {card.risk_factors.has_afib && <Text style={styles.riskText}>• Fibrilación Auricular</Text>}
            {card.risk_factors.has_prior_stroke && <Text style={styles.riskText}>• ACV Previo</Text>}
            {card.risk_factors.smoker && <Text style={styles.riskText}>• Fumador</Text>}
            {card.risk_factors.dyslipidemia && <Text style={styles.riskText}>• Dislipidemia</Text>}
          </View>
        )}

        {/* Medications */}
        {card?.medications && card.medications.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medicamentos</Text>
            {card.medications.map((med: any) => (
              <Text key={med.id} style={styles.medText}>
                • {med.name} - {med.dose} ({med.schedule_text})
              </Text>
            ))}
          </View>
        )}

        {/* Allergies */}
        {card?.allergies && card.allergies.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Alergias</Text>
            {card.allergies.map((allergy: any) => (
              <Text key={allergy.id} style={styles.allergyText}>
                • {allergy.substance} - {allergy.reaction}
              </Text>
            ))}
          </View>
        )}

        {/* Emergency Contacts */}
        {card?.emergency_contacts && card.emergency_contacts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contactos de Emergencia</Text>
            {card.emergency_contacts.map((contact: any) => (
              <Text key={contact.id} style={styles.contactText}>
                • {contact.full_name} ({contact.relationship}) - {contact.phone}
              </Text>
            ))}
          </View>
        )}

        {/* Location */}
        {alert?.location && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Última Ubicación</Text>
            <Text style={styles.infoText}>
              Lat: {alert.location.lat.toFixed(6)}, Lng: {alert.location.lng.toFixed(6)}
            </Text>
            <Text style={styles.infoText}>
              Actualizada: {new Date(alert.location.updated_at).toLocaleString('es-CO')}
            </Text>
            <TouchableOpacity style={styles.mapButton} onPress={handleOpenMap}>
              <Text style={styles.mapButtonText}>📍 Abrir en Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        {alert?.status === 'triggered' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.acknowledgeButton]}
            onPress={() => updateStatusMutation.mutate('acknowledged')}
            disabled={updateStatusMutation.isPending}
          >
            {updateStatusMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Reconocer Alerta</Text>
            )}
          </TouchableOpacity>
        )}

        {alert?.status === 'acknowledged' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.escalateButton]}
              onPress={() => updateStatusMutation.mutate('escalated')}
              disabled={updateStatusMutation.isPending}
            >
              <Text style={styles.actionButtonText}>Escalar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.closeButton]}
              onPress={() => updateStatusMutation.mutate('closed')}
              disabled={updateStatusMutation.isPending}
            >
              <Text style={styles.actionButtonText}>Cerrar Alerta</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    fontSize: 16,
    color: '#3498db',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  riskText: {
    fontSize: 14,
    color: '#e74c3c',
    marginBottom: 3,
  },
  medText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  allergyText: {
    fontSize: 14,
    color: '#f39c12',
    marginBottom: 3,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  mapButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#3498db',
    borderRadius: 8,
    alignItems: 'center',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  acknowledgeButton: {
    backgroundColor: '#27ae60',
  },
  escalateButton: {
    backgroundColor: '#f39c12',
  },
  closeButton: {
    backgroundColor: '#95a5a6',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
