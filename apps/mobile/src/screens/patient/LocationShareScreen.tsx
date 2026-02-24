import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import Constants from 'expo-constants';

export function LocationShareScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastLocation, setLastLocation] = useState<any>(null);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);

  useEffect(() => {
    loadLastLocation();
  }, []);

  async function loadLastLocation() {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('patient_id', user.id)
        .single();

      setLastLocation(data);
    } catch (error) {
      // No location saved yet
    }
  }

  async function handleShareLocation() {
    if (!user) return;

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Denegado', 'Necesitamos acceso a tu ubicación');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});

      // Call ingest_location Edge Function
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/ingest_location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          patient_id: user.id,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy_m: loc.coords.accuracy || 0,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al compartir ubicación');
      }

      Alert.alert('Ubicación Compartida', 'Tu ubicación ha sido actualizada');
      loadLastLocation();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al compartir ubicación');
    } finally {
      setLoading(false);
    }
  }

  async function handleBackgroundToggle(value: boolean) {
    Alert.alert(
      'Ubicación en Segundo Plano',
      value
        ? 'La ubicación en segundo plano consume batería. ¿Deseas habilitarla?'
        : '¿Deseas deshabilitar la ubicación en segundo plano?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            if (value) {
              const { status } = await Location.requestBackgroundPermissionsAsync();
              if (status === 'granted') {
                setBackgroundEnabled(true);
                // In production, start background location task here
                Alert.alert('Habilitado', 'Ubicación en segundo plano activada (limitado por el sistema)');
              } else {
                Alert.alert('Permiso Denegado', 'No se pudo habilitar ubicación en segundo plano');
              }
            } else {
              setBackgroundEnabled(false);
              // In production, stop background location task here
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Compartir Ubicación</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Comparte tu ubicación para que tus contactos de emergencia y médicos puedan encontrarte en caso de
          necesidad.
        </Text>

        <TouchableOpacity
          style={[styles.shareButton, loading && styles.shareButtonDisabled]}
          onPress={handleShareLocation}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.shareButtonIcon}>📍</Text>
              <Text style={styles.shareButtonText}>Compartir Ubicación Ahora</Text>
            </>
          )}
        </TouchableOpacity>

        {lastLocation && (
          <View style={styles.lastLocationCard}>
            <Text style={styles.lastLocationTitle}>Última ubicación compartida:</Text>
            <Text style={styles.lastLocationText}>
              Lat: {lastLocation.lat.toFixed(6)}, Lng: {lastLocation.lng.toFixed(6)}
            </Text>
            <Text style={styles.lastLocationDate}>
              {new Date(lastLocation.updated_at).toLocaleString('es-CO')}
            </Text>
          </View>
        )}

        <View style={styles.backgroundSection}>
          <View style={styles.backgroundInfo}>
            <Text style={styles.backgroundTitle}>Ubicación en Segundo Plano</Text>
            <Text style={styles.backgroundDescription}>
              Actualiza tu ubicación periódicamente (puede consumir batería)
            </Text>
          </View>
          <Switch
            value={backgroundEnabled}
            onValueChange={handleBackgroundToggle}
            trackColor={{ false: '#ccc', true: '#e74c3c' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Tu ubicación solo se comparte con personas que hayas autorizado y se usa exclusivamente para
            emergencias médicas.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    lineHeight: 24,
  },
  shareButton: {
    backgroundColor: '#3498db',
    padding: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  shareButtonDisabled: {
    backgroundColor: '#ccc',
  },
  shareButtonIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  lastLocationCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  lastLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  lastLocationText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  lastLocationDate: {
    fontSize: 12,
    color: '#999',
  },
  backgroundSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backgroundInfo: {
    flex: 1,
    marginRight: 15,
  },
  backgroundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  backgroundDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#e8f4f8',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#2980b9',
    lineHeight: 20,
  },
});
