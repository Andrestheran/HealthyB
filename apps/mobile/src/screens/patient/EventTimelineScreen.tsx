import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export function EventTimelineScreen() {
  const { user } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  function getEventIcon(type: string) {
    switch (type) {
      case 'sos':
        return '🚨';
      case 'checkin':
        return '🩺';
      case 'symptom_report':
        return '⚠️';
      case 'location_ping':
        return '📍';
      case 'alert_status_change':
        return '🔔';
      default:
        return '📋';
    }
  }

  function getEventTitle(type: string) {
    switch (type) {
      case 'sos':
        return 'SOS Emergencia';
      case 'checkin':
        return 'Revisión BE-FAST';
      case 'symptom_report':
        return 'Reporte de Síntomas';
      case 'location_ping':
        return 'Ubicación Compartida';
      case 'alert_status_change':
        return 'Cambio de Estado de Alerta';
      default:
        return 'Evento';
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
        <Text style={styles.title}>Historial</Text>
      </View>

      <ScrollView style={styles.content}>
        {events?.length === 0 ? (
          <Text style={styles.emptyText}>No hay eventos registrados</Text>
        ) : (
          events?.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventIcon}>{getEventIcon(event.type)}</Text>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{getEventTitle(event.type)}</Text>
                  <Text style={styles.eventDate}>
                    {new Date(event.created_at).toLocaleString('es-CO')}
                  </Text>
                </View>
              </View>
              {event.payload && Object.keys(event.payload).length > 0 && (
                <Text style={styles.eventPayload}>
                  {JSON.stringify(event.payload, null, 2)}
                </Text>
              )}
            </View>
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
  eventCard: {
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
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
  },
  eventPayload: {
    marginTop: 10,
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
