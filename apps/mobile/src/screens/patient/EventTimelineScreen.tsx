import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
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

  function getEventDescription(event: any) {
    const payload = event.payload || {};

    switch (event.type) {
      case 'sos':
        return 'Alerta de emergencia activada manualmente';
      case 'checkin':
        const symptoms = [];
        if (payload.balance) symptoms.push('Balance');
        if (payload.eyes) symptoms.push('Ojos');
        if (payload.face) symptoms.push('Cara');
        if (payload.arm) symptoms.push('Brazo');
        if (payload.speech) symptoms.push('Habla');
        return symptoms.length > 0
          ? `Síntomas reportados: ${symptoms.join(', ')}`
          : 'Revisión completada sin síntomas';
      case 'location_ping':
        return 'Ubicación actualizada en el sistema';
      case 'alert_status_change':
        return `Estado cambiado a: ${payload.new_status || 'N/A'}`;
      default:
        return 'Evento registrado';
    }
  }

  function openLocation(lat: number, lng: number) {
    const url = `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url);
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
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No hay eventos registrados</Text>
            <Text style={styles.emptySubtext}>Tus actividades aparecerán aquí</Text>
          </View>
        ) : (
          events?.map((event) => {
            const iconData = getEventIcon(event.type);
            const hasLocation = event.payload?.lat && event.payload?.lng;

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeader}>
                  <View style={[styles.eventIconContainer, { backgroundColor: iconData.bg }]}>
                    <Ionicons name={iconData.name} size={24} color={iconData.color} />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{getEventTitle(event.type)}</Text>
                    <Text style={styles.eventDate}>
                      {new Date(event.created_at).toLocaleDateString('es-CO', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })} • {new Date(event.created_at).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventDescription}>{getEventDescription(event)}</Text>

                {hasLocation && (
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => openLocation(event.payload.lat, event.payload.lng)}
                  >
                    <Ionicons name="location" size={16} color="#10B981" style={{ marginRight: 6 }} />
                    <Text style={styles.locationButtonText}>
                      Ver ubicación en mapa
                    </Text>
                    <Ionicons name="open-outline" size={14} color="#10B981" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                )}

                {event.payload?.notes && (
                  <View style={styles.notesContainer}>
                    <Ionicons name="document-text" size={16} color="#64748B" />
                    <Text style={styles.notesText}>{event.payload.notes}</Text>
                  </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 18,
    color: '#64748B',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
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
  eventDescription: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '500',
  },
  locationButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  locationButtonText: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  notesContainer: {
    marginTop: 12,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  notesText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
});
