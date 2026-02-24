import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
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
                  <Text style={styles.locationText}>📍 Ubicación disponible</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 40,
  },
  alertCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  severityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  severityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#ecf0f1',
  },
  statusText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  alertType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  alertDate: {
    fontSize: 12,
    color: '#999',
  },
  locationBadge: {
    marginTop: 10,
    paddingVertical: 5,
  },
  locationText: {
    fontSize: 12,
    color: '#3498db',
  },
});
