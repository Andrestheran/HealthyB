import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        return { name: 'alert-circle' as const, color: '#DC2626', bg: '#FEE2E2' };
      case 'checkin':
        return { name: 'fitness' as const, color: '#8B5CF6', bg: '#F3E8FF' };
      case 'symptom_report':
        return { name: 'warning' as const, color: '#F59E0B', bg: '#FEF3C7' };
      case 'location_ping':
        return { name: 'location' as const, color: '#10B981', bg: '#D1FAE5' };
      case 'alert_status_change':
        return { name: 'notifications' as const, color: '#0EA5E9', bg: '#E0F2FE' };
      default:
        return { name: 'document-text' as const, color: '#6366F1', bg: '#E0E7FF' };
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
          events?.map((event) => {
            const iconData = getEventIcon(event.type);
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={[styles.eventIconContainer, { backgroundColor: iconData.bg }]}>
                    <Ionicons name={iconData.name} size={24} color={iconData.color} />
                  </View>
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
            );
          })
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
    color: '#94A3B8',
    marginTop: 40,
    fontWeight: '500',
  },
  eventCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  eventDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  eventPayload: {
    marginTop: 12,
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
});
