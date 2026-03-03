import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

export function PatientHomeScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [sosLoading, setSosLoading] = useState(false);

  async function handleSOS() {
    if (!user) return;

    Alert.alert(
      '🚨 SOS Emergencia',
      '¿Estás seguro de activar la alerta de emergencia? Se notificará a tus contactos y médicos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar SOS',
          style: 'destructive',
          onPress: async () => {
            setSosLoading(true);
            try {
              // Get location
              let location = null;
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                  const loc = await Location.getCurrentPositionAsync({});
                  location = {
                    lat: loc.coords.latitude,
                    lng: loc.coords.longitude,
                    accuracy_m: loc.coords.accuracy || 0,
                  };
                }
              } catch (e) {
                console.warn('Failed to get location for SOS:', e);
              }

              // Call create_alert Edge Function
              const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
              const { data: { session } } = await supabase.auth.getSession();

              const response = await fetch(`${supabaseUrl}/functions/v1/create_alert`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                  patient_id: user.id,
                  source: 'sos',
                  triggered_by: 'patient_manual',
                  payload: location || {},
                }),
              });

              const result = await response.json();

              if (!response.ok) {
                throw new Error(result.error || 'Error al crear alerta');
              }

              Alert.alert('Alerta Enviada', 'Se ha notificado a tus contactos de emergencia');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al enviar alerta');
            } finally {
              setSosLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {profile?.full_name}</Text>
        <Text style={styles.subtitle}>Alert-IO</Text>
      </View>

      {/* SOS Button */}
      <TouchableOpacity
        style={[styles.sosButton, sosLoading && styles.sosButtonDisabled]}
        onPress={handleSOS}
        disabled={sosLoading}
      >
        {sosLoading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <>
            <Text style={styles.sosIcon}>🚨</Text>
            <Text style={styles.sosText}>SOS EMERGENCIA</Text>
          </>
        )}
      </TouchableOpacity>

      {/* BE-FAST Check-in */}
      <TouchableOpacity
        style={styles.checkButton}
        onPress={() => navigation.navigate('BeFastCheck')}
      >
        <Text style={styles.checkButtonIcon}>🩺</Text>
        <View style={styles.checkButtonContent}>
          <Text style={styles.checkButtonTitle}>Revisión BE-FAST</Text>
          <Text style={styles.checkButtonSubtitle}>Evaluar síntomas de ACV</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Acciones Rápidas</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Location')}
        >
          <Text style={styles.actionIcon}>📍</Text>
          <Text style={styles.actionText}>Compartir Ubicación</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Timeline')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionText}>Ver Historial</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 30,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  sosButton: {
    backgroundColor: '#e74c3c',
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  sosButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sosIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  sosText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  checkButtonIcon: {
    fontSize: 40,
    marginRight: 15,
  },
  checkButtonContent: {
    flex: 1,
  },
  checkButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  checkButtonSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    marginTop: 10,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  actionText: {
    fontSize: 16,
    color: '#333',
  },
});
