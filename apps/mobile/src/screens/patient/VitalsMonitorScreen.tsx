import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { healthManager } from '../../lib/healthKit';
import { fallDetectionService } from '../../lib/fallDetection';
import Constants from 'expo-constants';
import { VitalSignType, SmartwatchType } from '@alert-io/shared';

export function VitalsMonitorScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isHealthKitReady, setIsHealthKitReady] = useState(false);
  const [fallDetectionActive, setFallDetectionActive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeHealthKit();
    checkFallDetectionStatus();
  }, []);

  async function initializeHealthKit() {
    const available = await healthManager.isAvailable();
    if (available) {
      const initialized = await healthManager.initialize();
      setIsHealthKitReady(initialized);
    }
  }

  function checkFallDetectionStatus() {
    const status = fallDetectionService.getStatus();
    setFallDetectionActive(status.isMonitoring);
  }

  // Query for smartwatch devices
  const { data: smartwatchDevices } = useQuery({
    queryKey: ['smartwatch_devices', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('smartwatch_devices')
        .select('*')
        .eq('patient_id', user?.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Query for latest vital signs
  const { data: vitalSigns, refetch: refetchVitals } = useQuery({
    queryKey: ['vital_signs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_latest_vital_signs', {
        p_patient_id: user?.id,
        p_hours: 24,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Query for latest blood pressure
  const { data: bloodPressure } = useQuery({
    queryKey: ['blood_pressure', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blood_pressure_readings')
        .select('*')
        .eq('patient_id', user?.id)
        .order('measured_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  // Sync vitals from HealthKit
  const syncVitalsMutation = useMutation({
    mutationFn: async () => {
      if (!isHealthKitReady || !user) {
        throw new Error('HealthKit not available');
      }

      // Get latest vitals from HealthKit
      const healthData = await healthManager.getAllLatestVitals();

      if (healthData.vital_signs.length === 0 && !healthData.blood_pressure) {
        throw new Error('No hay datos nuevos disponibles');
      }

      // Send to Edge Function
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const smartwatchDeviceId = smartwatchDevices?.[0]?.id || null;

      const response = await fetch(`${supabaseUrl}/functions/v1/ingest_vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          patient_id: user.id,
          smartwatch_device_id: smartwatchDeviceId,
          vital_signs: healthData.vital_signs,
          blood_pressure: healthData.blood_pressure,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar datos');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vital_signs'] });
      queryClient.invalidateQueries({ queryKey: ['blood_pressure'] });
      Alert.alert('Éxito', 'Datos sincronizados correctamente');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Error al sincronizar datos');
    },
  });

  // Pair smartwatch
  const pairWatchMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('No user');

      // Check if HealthKit is available or show demo option
      if (!isHealthKitReady) {
        // Offer demo mode
        return new Promise((resolve, reject) => {
          Alert.alert(
            'HealthKit No Disponible',
            'HealthKit solo funciona en dispositivos iOS físicos.\n\n¿Quieres crear un smartwatch de demostración para probar la interfaz?',
            [
              { text: 'Cancelar', style: 'cancel', onPress: () => reject(new Error('cancelled')) },
              {
                text: 'Crear Demo',
                onPress: async () => {
                  try {
                    const { error } = await supabase.from('smartwatch_devices').insert({
                      patient_id: user.id,
                      device_type: SmartwatchType.APPLE_WATCH,
                      device_name: 'Apple Watch Demo',
                      device_model: 'Series 9 (Demo)',
                      last_sync: new Date().toISOString(),
                    });
                    if (error) throw error;
                    resolve(true);
                  } catch (err) {
                    reject(err);
                  }
                },
              },
            ]
          );
        });
      }

      const watchInfo = await healthManager.getConnectedWatchInfo();
      if (!watchInfo) {
        throw new Error(
          'No se detectó ningún smartwatch.\n\n' +
          'Asegúrate de:\n' +
          '• Tener un Apple Watch emparejado\n' +
          '• Ejecutar en un dispositivo físico (no simulador)\n' +
          '• Haber dado permisos de HealthKit'
        );
      }

      const { error } = await supabase.from('smartwatch_devices').insert({
        patient_id: user.id,
        device_type: watchInfo.type,
        device_name: watchInfo.name,
        device_model: watchInfo.model,
        last_sync: new Date().toISOString(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartwatch_devices'] });
      Alert.alert('Éxito', 'Smartwatch vinculado correctamente');
    },
    onError: (error: any) => {
      if (error.message !== 'cancelled') {
        Alert.alert('Error al Vincular', error.message || 'Error al vincular smartwatch');
      }
    },
  });

  function toggleFallDetection() {
    if (!user) return;

    if (fallDetectionActive) {
      fallDetectionService.stopMonitoring();
      setFallDetectionActive(false);
      Alert.alert('Desactivado', 'Detección de caídas desactivada');
    } else {
      const smartwatchDeviceId = smartwatchDevices?.[0]?.id;
      fallDetectionService.startMonitoring(user.id, smartwatchDeviceId);
      setFallDetectionActive(true);
      Alert.alert('Activado', 'Detección de caídas activada');
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetchVitals();
    setRefreshing(false);
  }

  function getVitalValue(type: VitalSignType) {
    const vital = vitalSigns?.find((v: any) => v.type === type);
    return vital ? `${vital.value.toFixed(1)} ${vital.unit}` : 'N/A';
  }

  function getVitalTime(type: VitalSignType) {
    const vital = vitalSigns?.find((v: any) => v.type === type);
    if (!vital) return '';
    const date = new Date(vital.measured_at);
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Signos Vitales</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Smartwatch Status */}
        {smartwatchDevices && smartwatchDevices.length > 0 ? (
          <View style={styles.watchCard}>
            <Text style={styles.watchIcon}>⌚</Text>
            <View style={styles.watchInfo}>
              <Text style={styles.watchName}>{smartwatchDevices[0].device_name}</Text>
              <Text style={styles.watchStatus}>
                Conectado • Última sincronización:{' '}
                {smartwatchDevices[0].last_sync
                  ? new Date(smartwatchDevices[0].last_sync).toLocaleString('es-CO')
                  : 'Nunca'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noWatchCard}>
            <Text style={styles.noWatchText}>No hay smartwatch vinculado</Text>
            <TouchableOpacity
              style={styles.pairButton}
              onPress={() => pairWatchMutation.mutate()}
              disabled={pairWatchMutation.isPending || !isHealthKitReady}
            >
              {pairWatchMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.pairButtonText}>Vincular Smartwatch</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Sync Button */}
        {isHealthKitReady && smartwatchDevices && smartwatchDevices.length > 0 && (
          <TouchableOpacity
            style={[styles.syncButton, syncVitalsMutation.isPending && styles.syncButtonDisabled]}
            onPress={() => syncVitalsMutation.mutate()}
            disabled={syncVitalsMutation.isPending}
          >
            {syncVitalsMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>🔄 Sincronizar Datos</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Vital Signs Grid */}
        <View style={styles.vitalsGrid}>
          {/* Heart Rate */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>❤️</Text>
            <Text style={styles.vitalLabel}>Frecuencia Cardíaca</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.HEART_RATE)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.HEART_RATE)}</Text>
          </View>

          {/* Blood Pressure */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>🩺</Text>
            <Text style={styles.vitalLabel}>Presión Arterial</Text>
            <Text style={styles.vitalValue}>
              {bloodPressure ? `${bloodPressure.systolic}/${bloodPressure.diastolic}` : 'N/A'}
            </Text>
            <Text style={styles.vitalTime}>
              {bloodPressure
                ? new Date(bloodPressure.measured_at).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''}
            </Text>
          </View>

          {/* Blood Oxygen */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>🫁</Text>
            <Text style={styles.vitalLabel}>Oxígeno en Sangre</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.BLOOD_OXYGEN)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.BLOOD_OXYGEN)}</Text>
          </View>

          {/* Steps */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>👣</Text>
            <Text style={styles.vitalLabel}>Pasos Hoy</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.STEPS)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.STEPS)}</Text>
          </View>

          {/* Sleep */}
          <View style={styles.vitalCard}>
            <Text style={styles.vitalIcon}>😴</Text>
            <Text style={styles.vitalLabel}>Horas de Sueño</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.SLEEP_HOURS)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.SLEEP_HOURS)}</Text>
          </View>
        </View>

        {/* Fall Detection Toggle */}
        <View style={styles.fallDetectionCard}>
          <View style={styles.fallDetectionHeader}>
            <Text style={styles.fallDetectionIcon}>🚨</Text>
            <View style={styles.fallDetectionInfo}>
              <Text style={styles.fallDetectionTitle}>Detección de Caídas</Text>
              <Text style={styles.fallDetectionDescription}>
                {fallDetectionActive
                  ? 'Activa • Monitoreo en tiempo real'
                  : 'Inactiva • Activa para detectar caídas automáticamente'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggleButton, fallDetectionActive && styles.toggleButtonActive]}
            onPress={toggleFallDetection}
          >
            <Text style={[styles.toggleButtonText, fallDetectionActive && styles.toggleButtonTextActive]}>
              {fallDetectionActive ? 'Desactivar' : 'Activar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    flex: 1,
    padding: 20,
  },
  watchCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  watchIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  watchInfo: {
    flex: 1,
  },
  watchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  watchStatus: {
    fontSize: 12,
    color: '#666',
  },
  noWatchCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  noWatchText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  pairButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  pairButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
  },
  vitalCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    width: '47%',
    alignItems: 'center',
  },
  vitalIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  vitalTime: {
    fontSize: 10,
    color: '#999',
  },
  fallDetectionCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
  },
  fallDetectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  fallDetectionIcon: {
    fontSize: 32,
    marginRight: 15,
  },
  fallDetectionInfo: {
    flex: 1,
  },
  fallDetectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  fallDetectionDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  toggleButton: {
    backgroundColor: '#e0e0e0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#e74c3c',
  },
  toggleButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
});
