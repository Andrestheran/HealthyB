import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
  FlatList,
  Dimensions,
  Vibration,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

export function PatientHomeScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [sosLoading, setSosLoading] = useState(false);
  const [emergencyContact, setEmergencyContact] = useState<any>(null);
  const [alarmSound, setAlarmSound] = useState<Audio.Sound | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadEmergencyContact();
    setupAudio();
    return () => {
      stopAlarm();
    };
  }, [user]);

  async function setupAudio() {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });
  }

  async function playAlarm() {
    try {
      // Stop any existing alarm
      await stopAlarm();

      // Create a synthesized alarm sound using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      setAlarmSound(sound);

      // Vibrate in pattern
      const pattern = [0, 500, 200, 500];
      alarmIntervalRef.current = setInterval(() => {
        Vibration.vibrate(pattern);
      }, 1500);
    } catch (error) {
      console.error('Error playing alarm:', error);
    }
  }

  async function stopAlarm() {
    try {
      if (alarmSound) {
        await alarmSound.stopAsync();
        await alarmSound.unloadAsync();
        setAlarmSound(null);
      }
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
      Vibration.cancel();
    } catch (error) {
      console.error('Error stopping alarm:', error);
    }
  }

  // Reload emergency contact when screen comes into focus (after editing in Settings)
  useFocusEffect(
    useCallback(() => {
      loadEmergencyContact();
    }, [user])
  );

  async function loadEmergencyContact() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('patient_id', user.id)
        .eq('is_primary', true)
        .single();

      if (data) {
        setEmergencyContact(data);
      }
    } catch (error) {
      console.warn('No emergency contact found:', error);
    }
  }

  function handleCallEmergencyContact() {
    if (!emergencyContact) {
      Alert.alert(
        'Sin Contacto de Emergencia',
        'No has configurado un contacto de emergencia. ¿Deseas configurarlo ahora?',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Configurar', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    const phoneNumber = emergencyContact.phone.replace(/\s/g, '');
    Alert.alert(
      'Llamar a Contacto de Emergencia',
      `¿Deseas llamar a ${emergencyContact.full_name} (${emergencyContact.relationship})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Llamar',
          onPress: () => {
            Linking.openURL(`tel:${phoneNumber}`).catch((err) =>
              Alert.alert('Error', 'No se pudo abrir el marcador telefónico')
            );
          },
        },
      ]
    );
  }

  async function handleSOS() {
    if (!user) return;

    // Play alarm immediately
    await playAlarm();

    Alert.alert(
      '🚨 SOS EMERGENCIA 🚨',
      'ALARMA ACTIVADA\n\n¿Confirmas la emergencia? Se notificará a tus contactos y médicos.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => stopAlarm(),
        },
        {
          text: 'CONFIRMAR EMERGENCIA',
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

              await stopAlarm();
              Alert.alert('✅ Alerta Enviada', 'Se ha notificado a tus contactos de emergencia y servicios médicos');
            } catch (error: any) {
              await stopAlarm();
              Alert.alert('⚠️ Alarma Activada', 'ALARMA SONANDO - Busca ayuda inmediata\n\nError al enviar alerta: ' + (error.message || 'Error desconocido'));
            } finally {
              setSosLoading(false);
            }
          },
        },
      ],
      { cancelable: false }
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {profile?.full_name}</Text>
          <Text style={styles.subtitle}>Alert-IO</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="shield-checkmark" size={32} color="#0EA5E9" />
        </View>
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
            <View style={styles.sosIconContainer}>
              <Ionicons name="alert-circle" size={56} color="#fff" />
            </View>
            <Text style={styles.sosText}>SOS EMERGENCIA</Text>
            <Text style={styles.sosSubtext}>Presiona para activar alerta</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Services Carousel */}
      <View style={styles.quickAccessContainer}>
        <Text style={styles.sectionTitle}>Servicios</Text>
        <FlatList
          data={[
            {
              id: '1',
              title: 'Revisión BE-FAST',
              subtitle: 'Evaluar síntomas de ACV',
              icon: 'fitness' as const,
              iconColor: '#8B5CF6',
              iconBg: '#F3E8FF',
              onPress: () => navigation.navigate('BeFastCheck'),
            },
            {
              id: '2',
              title: 'Asistente de Salud IA',
              subtitle: 'Preguntas sobre tu salud',
              icon: 'sparkles' as const,
              iconColor: '#0EA5E9',
              iconBg: '#E0F2FE',
              onPress: () => navigation.navigate('AIChat'),
            },
            {
              id: '3',
              title: 'Contacto de Emergencia',
              subtitle: emergencyContact
                ? `${emergencyContact.full_name} - ${emergencyContact.relationship}`
                : 'No configurado',
              icon: 'call' as const,
              iconColor: '#F59E0B',
              iconBg: '#FEF3C7',
              onPress: handleCallEmergencyContact,
            },
            {
              id: '4',
              title: 'Signos Vitales',
              subtitle: 'Monitorear tu salud',
              icon: 'pulse' as const,
              iconColor: '#DC2626',
              iconBg: '#FEE2E2',
              onPress: () => navigation.navigate('Vitals'),
            },
          ]}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width - 60}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.carouselCard} onPress={item.onPress}>
              <View style={[styles.carouselIconContainer, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={32} color={item.iconColor} />
              </View>
              <Text style={styles.carouselCardTitle}>{item.title}</Text>
              <Text style={styles.carouselCardSubtitle}>{item.subtitle}</Text>
              <View style={styles.carouselArrow}>
                <Ionicons name="arrow-forward" size={20} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Location')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="location" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Compartir Ubicación</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Timeline')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="time" size={24} color="#6366F1" />
            </View>
            <Text style={styles.actionText}>Ver Historial</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  sosButton: {
    backgroundColor: '#DC2626',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 32,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sosButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowColor: '#000',
  },
  sosIconContainer: {
    marginBottom: 12,
  },
  sosText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  sosSubtext: {
    fontSize: 13,
    color: '#FEE2E2',
    marginTop: 6,
    fontWeight: '500',
  },
  quickAccessContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
    letterSpacing: -0.3,
    paddingHorizontal: 0,
  },
  carouselContent: {
    paddingRight: 20,
  },
  carouselCard: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 20,
    marginRight: 14,
    width: width - 80,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  carouselIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  carouselCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  carouselCardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 16,
  },
  carouselArrow: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});
