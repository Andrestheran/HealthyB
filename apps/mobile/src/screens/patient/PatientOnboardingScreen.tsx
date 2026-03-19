import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Sex } from '@alert-io/shared';

export function PatientOnboardingScreen({ navigation }: any) {
  const { user, profile, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Patient profile
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [sex, setSex] = useState<Sex>(Sex.FEMALE);
  const [address, setAddress] = useState('');
  const [eps, setEps] = useState('');
  const [preferredHospital, setPreferredHospital] = useState('');

  // Step 2: Risk factors
  const [hasHtn, setHasHtn] = useState(false);
  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasAfib, setHasAfib] = useState(false);
  const [hasPriorStroke, setHasPriorStroke] = useState(false);
  const [smoker, setSmoker] = useState(false);
  const [dyslipidemia, setDyslipidemia] = useState(false);
  const [notes, setNotes] = useState('');

  // Step 3: Emergency contacts
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('familiar');

  async function handleComplete() {
    if (!user) return;

    // Validar que se haya llenado el contacto de emergencia
    if (!emergencyName || !emergencyPhone) {
      Alert.alert('Error', 'Por favor completa todos los campos del contacto de emergencia');
      return;
    }

    setLoading(true);
    try {
      // Format date as YYYY-MM-DD
      const formattedDate = dateOfBirth.toISOString().split('T')[0];

      // Upsert patient data (insert or update if exists)
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({
          id: user.id,
          date_of_birth: formattedDate,
          sex,
          address,
          eps,
          preferred_hospital: preferredHospital,
        }, { onConflict: 'id' });

      if (patientError) throw patientError;

      // Upsert risk factors
      const { error: riskError } = await supabase
        .from('patient_risk_factors')
        .upsert({
          patient_id: user.id,
          has_htn: hasHtn,
          has_diabetes: hasDiabetes,
          has_afib: hasAfib,
          has_prior_stroke: hasPriorStroke,
          smoker,
          dyslipidemia,
          notes,
        }, { onConflict: 'patient_id' });

      if (riskError) throw riskError;

      // Insert emergency contact
      const { error: emergencyError } = await supabase
        .from('emergency_contacts')
        .insert({
          patient_id: user.id,
          full_name: emergencyName,
          phone: emergencyPhone,
          relationship: emergencyRelationship,
        });

      if (emergencyError) throw emergencyError;

      // Refresh profile to update hasCompletedOnboarding
      await refreshProfile();

      Alert.alert('Éxito', 'Perfil completado exitosamente');
      navigation.replace('PatientTabs');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al guardar datos');
    } finally {
      setLoading(false);
    }
  }

  function renderStep1() {
    return (
      <>
        <Text style={styles.stepTitle}>Información Personal</Text>

        <View>
          <Text style={styles.label}>Fecha de nacimiento:</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {dateOfBirth.toLocaleDateString('es-CO', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                // On Android, dismiss picker immediately
                // On iOS, only dismiss when a date is selected
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                }
                if (selectedDate) {
                  setDateOfBirth(selectedDate);
                  // Close picker after selection on iOS too
                  setShowDatePicker(false);
                }
              }}
              maximumDate={new Date()}
            />
          )}
        </View>

        <View style={styles.sexContainer}>
          <Text style={styles.label}>Sexo:</Text>
          <View style={styles.sexButtons}>
            {[
              { value: Sex.FEMALE, label: 'Femenino' },
              { value: Sex.MALE, label: 'Masculino' },
              { value: Sex.OTHER, label: 'Otro' },
            ].map((s) => (
              <TouchableOpacity
                key={s.value}
                style={[styles.sexButton, sex === s.value && styles.sexButtonActive]}
                onPress={() => setSex(s.value)}
              >
                <Text style={[styles.sexButtonText, sex === s.value && styles.sexButtonTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Dirección"
          value={address}
          onChangeText={setAddress}
        />

        <TextInput
          style={styles.input}
          placeholder="EPS"
          value={eps}
          onChangeText={setEps}
        />

        <TextInput
          style={styles.input}
          placeholder="Hospital preferido"
          value={preferredHospital}
          onChangeText={setPreferredHospital}
        />

        <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
          <Text style={styles.buttonText}>Siguiente</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <Text style={styles.stepTitle}>Factores de Riesgo</Text>

        {[
          { label: 'Hipertensión', value: hasHtn, setter: setHasHtn },
          { label: 'Diabetes', value: hasDiabetes, setter: setHasDiabetes },
          { label: 'Fibrilación auricular (AFib)', value: hasAfib, setter: setHasAfib },
          { label: 'ACV o TIA previo', value: hasPriorStroke, setter: setHasPriorStroke },
          { label: 'Fumador', value: smoker, setter: setSmoker },
          { label: 'Dislipidemia', value: dyslipidemia, setter: setDyslipidemia },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.checkboxRow}
            onPress={() => item.setter(!item.value)}
          >
            <View style={[styles.checkbox, item.value && styles.checkboxActive]}>
              {item.value && <Text style={styles.checkboxCheck}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Notas adicionales (opcional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity style={styles.button} onPress={() => setStep(3)}>
          <Text style={styles.buttonText}>Siguiente</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <Text style={styles.stepTitle}>Contacto de Emergencia</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre completo"
          value={emergencyName}
          onChangeText={setEmergencyName}
        />

        <TextInput
          style={styles.input}
          placeholder="Teléfono (ej: +573001234567)"
          value={emergencyPhone}
          onChangeText={setEmergencyPhone}
          keyboardType="phone-pad"
        />

        <View style={styles.sexContainer}>
          <Text style={styles.label}>Relación:</Text>
          <View style={styles.sexButtons}>
            {[
              { value: 'familiar', label: 'Familiar' },
              { value: 'amigo', label: 'Amigo' },
              { value: 'cuidador', label: 'Cuidador' },
            ].map((rel) => (
              <TouchableOpacity
                key={rel.value}
                style={[
                  styles.sexButton,
                  emergencyRelationship === rel.value && styles.sexButtonActive,
                ]}
                onPress={() => setEmergencyRelationship(rel.value)}
              >
                <Text
                  style={[
                    styles.sexButtonText,
                    emergencyRelationship === rel.value && styles.sexButtonTextActive,
                  ]}
                >
                  {rel.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Completar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configurar Perfil</Text>
      <Text style={styles.subtitle}>Paso {step} de 3</Text>

      {step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()}
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
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 10,
    color: '#0F172A',
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 32,
    fontWeight: '500',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#0F172A',
    fontWeight: '500',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sexContainer: {
    marginBottom: 20,
  },
  sexButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  sexButton: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sexButtonActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
    elevation: 3,
    shadowColor: '#DC2626',
    shadowOpacity: 0.3,
  },
  sexButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  sexButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#DC2626',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    elevation: 4,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  backButtonText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: '600',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
});
