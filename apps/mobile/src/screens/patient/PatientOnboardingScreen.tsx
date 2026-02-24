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
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Sex } from '@acv-guard/shared';

export function PatientOnboardingScreen({ navigation }: any) {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Patient profile
  const [dateOfBirth, setDateOfBirth] = useState('');
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

  async function handleComplete() {
    if (!user) return;

    setLoading(true);
    try {
      // Insert patient data
      const { error: patientError } = await supabase.from('patients').insert({
        id: user.id,
        date_of_birth: dateOfBirth,
        sex,
        address,
        eps,
        preferred_hospital: preferredHospital,
      });

      if (patientError) throw patientError;

      // Insert risk factors
      const { error: riskError } = await supabase.from('patient_risk_factors').insert({
        patient_id: user.id,
        has_htn: hasHtn,
        has_diabetes: hasDiabetes,
        has_afib: hasAfib,
        has_prior_stroke: hasPriorStroke,
        smoker,
        dyslipidemia,
        notes,
      });

      if (riskError) throw riskError;

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

        <TextInput
          style={styles.input}
          placeholder="Fecha de nacimiento (AAAA-MM-DD)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
        />

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

        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Atrás</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configurar Perfil</Text>
      <Text style={styles.subtitle}>Paso {step} de 2</Text>

      {step === 1 ? renderStep1() : renderStep2()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  textarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
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
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  sexButtonActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  sexButtonText: {
    fontSize: 14,
    color: '#666',
  },
  sexButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#e74c3c',
    borderColor: '#e74c3c',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  backButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
});
