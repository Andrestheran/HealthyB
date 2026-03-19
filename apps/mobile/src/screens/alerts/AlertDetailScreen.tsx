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
import { Ionicons } from '@expo/vector-icons';
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
              <Ionicons name="location" size={18} color="#10B981" style={styles.mapButtonIcon} />
              <Text style={styles.mapButtonText}>Abrir en Google Maps</Text>
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    fontSize: 16,
    color: '#0EA5E9',
    marginBottom: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  statusText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  riskText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 4,
    fontWeight: '600',
  },
  medText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  allergyText: {
    fontSize: 14,
    color: '#F59E0B',
    marginBottom: 4,
    fontWeight: '600',
  },
  contactText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
    fontWeight: '500',
  },
  mapButton: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  mapButtonIcon: {
    marginRight: 8,
  },
  mapButtonText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  acknowledgeButton: {
    backgroundColor: '#10B981',
  },
  escalateButton: {
    backgroundColor: '#F59E0B',
  },
  closeButton: {
    backgroundColor: '#94A3B8',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
