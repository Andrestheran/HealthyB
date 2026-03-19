import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function AlertsInboxScreen({ navigation }: any) {
  const { user } = useAuth();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_alerts', {
        p_status_filter: null,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e74c3c" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alertas</Text>
      </View>

      <ScrollView style={styles.content}>
        {alerts?.length === 0 ? (
          <Text style={styles.emptyText}>No hay alertas activas</Text>
        ) : (
          alerts?.map((alert: any) => (
            <TouchableOpacity
              key={alert.alert_id}
              style={styles.alertCard}
              onPress={() => navigation.navigate('AlertDetail', { alertId: alert.alert_id })}
            >
              <View style={styles.alertHeader}>
                <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(alert.severity) }]}>
                  <Text style={styles.severityText}>{alert.severity.toUpperCase()}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{getStatusText(alert.status)}</Text>
                </View>
              </View>

              <Text style={styles.patientName}>{alert.patient_name}</Text>
              <Text style={styles.alertType}>Tipo: {alert.triggered_by}</Text>
              <Text style={styles.alertDate}>{new Date(alert.created_at).toLocaleString('es-CO')}</Text>

              {alert.location_lat && alert.location_lng && (
                <View style={styles.locationBadge}>
                  <Ionicons name="location" size={14} color="#10B981" />
                  <Text style={styles.locationText}>Ubicación disponible</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
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
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#64748B',
    marginTop: 40,
    fontWeight: '500',
  },
  alertCard: {
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
  alertHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  patientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  alertType: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  alertDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  locationBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  locationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
});
