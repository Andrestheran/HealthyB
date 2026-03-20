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
  Modal,
  Animated,
  Share,
  Platform,
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

  // SOS Modal states
  const [sosModalVisible, setSOSModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnimation = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    loadEmergencyContact();
    setupAudio();
    return () => {
      stopAlarm();
      stopCountdown();
    };
  }, [user]);

  // Pulse animation effect
  useEffect(() => {
    if (sosModalVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnimation.setValue(0.6);
    }
  }, [sosModalVisible]);

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

  function startCountdown() {
    setCountdown(10);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopCountdown();
          handleConfirmEmergency();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function stopCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
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

    // Play alarm and show modal immediately
    await playAlarm();
    setSOSModalVisible(true);
    startCountdown();
  }

  async function handleStopAlarm() {
    // User pressed STOP ALARM button - confirm emergency
    stopCountdown();
    setSOSModalVisible(false);
    await handleConfirmEmergency();
  }

  async function handleCancelSOS() {
    // User pressed cancel - was a mistake
    stopCountdown();
    await stopAlarm();
    setSOSModalVisible(false);
    Alert.alert('Cancelado', 'Alarma detenida. No se envió ninguna alerta.');
  }

  function handleProfileMenu() {
    Alert.alert(
      profile?.full_name || 'Perfil',
      'Selecciona una opción',
      [
        {
          text: 'Ver Perfil',
          onPress: () => navigation.navigate('Settings'),
        },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            Alert.alert(
              '¿Cerrar Sesión?',
              '¿Estás seguro que deseas salir?',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Salir',
                  style: 'destructive',
                  onPress: async () => {
                    await supabase.auth.signOut();
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ]
    );
  }

  async function handleQuickShareLocation() {
    if (!emergencyContact) {
      Alert.alert(
        'Sin Contacto de Emergencia',
        'Necesitas configurar un contacto de emergencia primero.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Configurar', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso Denegado',
          'Por favor habilita el acceso a ubicación en los ajustes de tu dispositivo'
        );
        return;
      }

      // Show loading
      Alert.alert('Obteniendo ubicación...', 'Por favor espera');

      // Get current location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const mapsUrl = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
      const message =
        `📍 Mi ubicación actual\n\n` +
        `${mapsUrl}\n\n` +
        `Compartida: ${new Date().toLocaleTimeString('es-CO')}\n\n` +
        `Enviado desde Alert-IO`;

      const phoneNumber = emergencyContact.phone.replace(/\s/g, '');
      const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;

      await Linking.openURL(smsUrl).catch((err) => {
        console.error('Error opening SMS:', err);
        // Fallback to share sheet
        Share.share({
          message,
          title: '📍 Mi Ubicación',
        });
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo obtener la ubicación');
    }
  }

  async function handleConfirmEmergency() {
    if (!user) return;

    setSosLoading(true);
    await stopAlarm();

    try {
      // Get location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          location = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
        }
      } catch (e) {
        console.warn('Failed to get location for SOS:', e);
      }

      // Open SMS to emergency contact with location
      if (emergencyContact) {
        const patientName = profile?.full_name || 'Un paciente';
        let message = `🚨 ${patientName} activó la alarma de emergencia\n\n`;

        if (location) {
          const mapsUrl = `https://maps.google.com/?q=${location.lat},${location.lng}`;
          message += `Esta es su ubicación:\n${mapsUrl}\n\n`;
        } else {
          message += `No se pudo obtener la ubicación.\n\n`;
        }

        message += `Enviado desde Alert-IO`;

        const phoneNumber = emergencyContact.phone.replace(/\s/g, '');
        const smsUrl = `sms:${phoneNumber}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;

        setTimeout(() => {
          Linking.openURL(smsUrl).catch((err) => {
            console.error('Error opening SMS:', err);
            // Fallback to share sheet if SMS fails
            Share.share({
              message,
              title: '🚨 EMERGENCIA - Mi Ubicación',
            });
          });
        }, 300);
      } else {
        Alert.alert(
          'Sin Contacto de Emergencia',
          'No tienes un contacto de emergencia configurado.\n\n¿Deseas configurarlo ahora?',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Configurar', onPress: () => navigation.navigate('Settings') },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error in SOS:', error);
      Alert.alert('Error', 'Hubo un problema. Llama al 123 directamente.');
    } finally {
      setSosLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola, {profile?.full_name}</Text>
          <Text style={styles.subtitle}>Alert-IO</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={handleProfileMenu}>
          <Ionicons name="shield-checkmark" size={32} color="#0EA5E9" />
        </TouchableOpacity>
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
            onPress={handleQuickShareLocation}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="paper-plane" size={24} color="#10B981" />
            </View>
            <Text style={styles.actionText}>Enviar Ubicación</Text>
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

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Location')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="settings-outline" size={24} color="#64748B" />
            </View>
            <Text style={styles.actionText}>Configurar Ubicación</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SOS Modal */}
      <Modal
        visible={sosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSOS}
      >
        <Animated.View
          style={[
            styles.modalOverlay,
            {
              opacity: pulseAnimation,
            },
          ]}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="alert-circle" size={80} color="#fff" />
            </View>

            <Text style={styles.modalTitle}>🚨 ALARMA SOS ACTIVA</Text>

            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
              <Text style={styles.countdownLabel}>
                {countdown === 1 ? 'segundo' : 'segundos'}
              </Text>
            </View>

            <Text style={styles.modalDescription}>
              La alerta se enviará automáticamente cuando el contador llegue a cero
            </Text>

            <TouchableOpacity
              style={styles.stopAlarmButton}
              onPress={handleStopAlarm}
              activeOpacity={0.8}
            >
              <View style={styles.stopAlarmButtonInner}>
                <Ionicons name="hand-left" size={48} color="#DC2626" />
                <Text style={styles.stopAlarmButtonText}>DETENER{'\n'}ALARMA</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelSOS}
            >
              <Text style={styles.cancelButtonText}>Fue un error - Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>
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
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    alignItems: 'center',
    width: '100%',
  },
  modalIconContainer: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 1,
  },
  countdownContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  countdownText: {
    fontSize: 96,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 96,
  },
  countdownLabel: {
    fontSize: 16,
    color: '#FEE2E2',
    fontWeight: '600',
    marginTop: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#FEE2E2',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 20,
    lineHeight: 24,
    fontWeight: '500',
  },
  stopAlarmButton: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  stopAlarmButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopAlarmButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 1,
    lineHeight: 28,
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
