import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

export function BeFastCheckScreen({ navigation }: any) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(false);
  const [eyes, setEyes] = useState(false);
  const [face, setFace] = useState(false);
  const [arm, setArm] = useState(false);
  const [speech, setSpeech] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!user) return;

    setLoading(true);
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
        console.warn('Failed to get location:', e);
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
          source: 'befast',
          triggered_by: 'patient_checkin',
          payload: {
            balance,
            eyes,
            face,
            arm,
            speech,
            notes,
            time_last_known_well: new Date().toISOString(),
            ...location,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar revisión');
      }

      Alert.alert(
        'Revisión Enviada',
        result.alert_created
          ? 'Se ha creado una alerta y notificado a tus contactos'
          : 'Revisión guardada en tu historial',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al enviar revisión');
    } finally {
      setLoading(false);
    }
  }

  const symptoms = [
    {
      key: 'balance',
      label: 'Balance',
      description: '¿Tienes pérdida súbita del equilibrio o coordinación?',
      value: balance,
      setter: setBalance,
    },
    {
      key: 'eyes',
      label: 'Eyes (Ojos)',
      description: '¿Tienes visión borrosa o pérdida súbita de visión?',
      value: eyes,
      setter: setEyes,
    },
    {
      key: 'face',
      label: 'Face (Cara)',
      description: '¿Un lado de tu cara está caído o entumecido?',
      value: face,
      setter: setFace,
    },
    {
      key: 'arm',
      label: 'Arm (Brazo)',
      description: '¿Tienes debilidad o entumecimiento en un brazo?',
      value: arm,
      setter: setArm,
    },
    {
      key: 'speech',
      label: 'Speech (Habla)',
      description: '¿Tienes dificultad para hablar o entender?',
      value: speech,
      setter: setSpeech,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Revisión BE-FAST</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.instructions}>
          Responde las siguientes preguntas sobre síntomas que puedas estar experimentando:
        </Text>

        {symptoms.map((symptom) => (
          <View key={symptom.key} style={styles.symptomCard}>
            <View style={styles.symptomHeader}>
              <Text style={styles.symptomLabel}>{symptom.label}</Text>
              <TouchableOpacity
                style={[styles.toggle, symptom.value && styles.toggleActive]}
                onPress={() => symptom.setter(!symptom.value)}
              >
                <Text style={[styles.toggleText, symptom.value && styles.toggleTextActive]}>
                  {symptom.value ? 'SÍ' : 'NO'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.symptomDescription}>{symptom.description}</Text>
          </View>
        ))}

        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Notas adicionales (opcional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Enviar Revisión</Text>
          )}
        </TouchableOpacity>
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
  backButton: {
    fontSize: 16,
    color: '#0EA5E9',
    marginBottom: 12,
    fontWeight: '600',
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
  instructions: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 24,
    fontWeight: '500',
  },
  symptomCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  symptomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symptomLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: -0.3,
    flex: 1,
  },
  toggle: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    minWidth: 60,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: '#DC2626',
    backgroundColor: '#DC2626',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  toggleTextActive: {
    color: '#fff',
  },
  symptomDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#0F172A',
    fontWeight: '500',
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#10B981',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 30,
    elevation: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
