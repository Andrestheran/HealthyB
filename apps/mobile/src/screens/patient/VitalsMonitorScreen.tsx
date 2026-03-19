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
import { Ionicons } from '@expo/vector-icons';
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
            <View style={styles.watchIconContainer}>
              <Ionicons name="watch" size={28} color="#0EA5E9" />
            </View>
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
            <View style={styles.noWatchIconContainer}>
              <Ionicons name="watch-outline" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.noWatchText}>No hay smartwatch vinculado</Text>
            <TouchableOpacity
              style={styles.pairButton}
              onPress={() => pairWatchMutation.mutate()}
              disabled={pairWatchMutation.isPending || !isHealthKitReady}
            >
              {pairWatchMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.pairButtonText}>Vincular Smartwatch</Text>
                </>
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
              <>
                <Ionicons name="sync" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.syncButtonText}>Sincronizar Datos</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Vital Signs Grid */}
        <View style={styles.vitalsGrid}>
          {/* Heart Rate */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="heart" size={28} color="#DC2626" />
            </View>
            <Text style={styles.vitalLabel}>Frecuencia Cardíaca</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.HEART_RATE)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.HEART_RATE)}</Text>
          </View>

          {/* Blood Pressure */}
          <View style={styles.vitalCard}>
            <View style={styles.vitalIconContainer}>
              <Ionicons name="fitness" size={28} color="#8B5CF6" />
            </View>
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
            <View style={[styles.vitalIconContainer, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="water" size={28} color="#0EA5E9" />
            </View>
            <Text style={styles.vitalLabel}>Oxígeno en Sangre</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.BLOOD_OXYGEN)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.BLOOD_OXYGEN)}</Text>
          </View>

          {/* Steps */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconContainer, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="walk" size={28} color="#10B981" />
            </View>
            <Text style={styles.vitalLabel}>Pasos Hoy</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.STEPS)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.STEPS)}</Text>
          </View>

          {/* Sleep */}
          <View style={styles.vitalCard}>
            <View style={[styles.vitalIconContainer, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="moon" size={28} color="#6366F1" />
            </View>
            <Text style={styles.vitalLabel}>Horas de Sueño</Text>
            <Text style={styles.vitalValue}>{getVitalValue(VitalSignType.SLEEP_HOURS)}</Text>
            <Text style={styles.vitalTime}>{getVitalTime(VitalSignType.SLEEP_HOURS)}</Text>
          </View>
        </View>

        {/* Fall Detection Toggle */}
        <View style={styles.fallDetectionCard}>
          <View style={styles.fallDetectionHeader}>
            <View style={styles.fallDetectionIconContainer}>
              <Ionicons name="alert-circle" size={28} color="#DC2626" />
            </View>
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
  watchCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  watchIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  watchInfo: {
    flex: 1,
  },
  watchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  watchStatus: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  noWatchCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  noWatchIconContainer: {
    marginBottom: 16,
  },
  noWatchText: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 18,
    fontWeight: '500',
  },
  pairButton: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pairButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  syncButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  syncButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  vitalCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    width: '47%',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  vitalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  vitalTime: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  fallDetectionCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  fallDetectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallDetectionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  fallDetectionInfo: {
    flex: 1,
  },
  fallDetectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  fallDetectionDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
  toggleButton: {
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
    elevation: 2,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toggleButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  toggleButtonTextActive: {
    color: '#fff',
  },
});
