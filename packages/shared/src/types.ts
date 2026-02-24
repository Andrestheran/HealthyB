import type { Role, ConsentScope, EventType, AlertStatus, AlertSeverity, Sex, NotificationChannel, SmartwatchType, VitalSignType } from './enums';

// Database table types

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  created_at: string;
}

export interface Device {
  id: string;
  profile_id: string;
  expo_push_token: string;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  date_of_birth: string;
  sex: Sex;
  address: string;
  eps: string;
  preferred_hospital: string;
  created_at: string;
}

export interface PatientRiskFactors {
  patient_id: string;
  has_htn: boolean;
  has_diabetes: boolean;
  has_afib: boolean;
  has_prior_stroke: boolean;
  smoker: boolean;
  dyslipidemia: boolean;
  notes: string | null;
}

export interface Medication {
  id: string;
  patient_id: string;
  name: string;
  dose: string;
  schedule_text: string;
  is_anticoagulant: boolean;
  is_antiplatelet: boolean;
  created_at: string;
}

export interface Allergy {
  id: string;
  patient_id: string;
  substance: string;
  reaction: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  patient_id: string;
  full_name: string;
  relationship: string;
  phone: string;
  is_primary: boolean;
  created_at: string;
}

export interface Consent {
  id: string;
  patient_id: string;
  caregiver_profile_id: string | null;
  clinician_profile_id: string | null;
  scope: ConsentScope;
  created_at: string;
}

export interface Event {
  id: string;
  patient_id: string;
  type: EventType;
  payload: Record<string, any>;
  created_at: string;
}

export interface Alert {
  id: string;
  patient_id: string;
  status: AlertStatus;
  severity: AlertSeverity;
  triggered_by: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRecipient {
  id: string;
  alert_id: string;
  recipient_profile_id: string;
  channel: NotificationChannel;
  delivered_at: string | null;
  acknowledged_at: string | null;
}

export interface Location {
  patient_id: string;
  lat: number;
  lng: number;
  accuracy_m: number;
  updated_at: string;
}

// Composite types for UI

export interface PatientEmergencyCard {
  profile: Profile;
  patient: Patient;
  risk_factors: PatientRiskFactors;
  medications: Medication[];
  allergies: Allergy[];
  emergency_contacts: EmergencyContact[];
}

export interface AlertWithDetails extends Alert {
  patient_profile: Profile;
  patient: Patient;
  event: Event;
  location: Location | null;
}

// BE-FAST symptom data structure
export interface BeFastSymptoms {
  balance: boolean;
  eyes: boolean;
  face: boolean;
  arm: boolean;
  speech: boolean;
  time_last_known_well: string | null; // ISO timestamp
  notes: string | null;
}

// Symptom report data structure
export interface SymptomReport {
  headache: boolean;
  dizziness: boolean;
  numbness: boolean;
  confusion: boolean;
  notes: string | null;
}

// Smartwatch types
export interface SmartwatchDevice {
  id: string;
  patient_id: string;
  device_type: SmartwatchType;
  device_name: string;
  device_model: string | null;
  paired_at: string;
  last_sync: string | null;
  is_active: boolean;
}

export interface VitalSign {
  id: string;
  patient_id: string;
  smartwatch_device_id: string | null;
  type: VitalSignType;
  value: number;
  unit: string;
  measured_at: string;
  created_at: string;
}

export interface BloodPressureReading {
  id: string;
  patient_id: string;
  smartwatch_device_id: string | null;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measured_at: string;
  created_at: string;
}

export interface FallDetection {
  id: string;
  patient_id: string;
  smartwatch_device_id: string | null;
  detected_at: string;
  confidence: number;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  alert_created: boolean;
  alert_id: string | null;
  user_dismissed: boolean;
  dismissed_at: string | null;
  created_at: string;
}

export interface HealthAnomaly {
  id: string;
  patient_id: string;
  anomaly_type: string;
  description: string;
  severity: AlertSeverity;
  data: Record<string, any>;
  detected_at: string;
  alert_created: boolean;
  alert_id: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// Dashboard data for patient with vitals
export interface PatientVitalsSnapshot {
  heart_rate: VitalSign | null;
  blood_pressure: BloodPressureReading | null;
  blood_oxygen: VitalSign | null;
  steps: VitalSign | null;
  sleep_hours: VitalSign | null;
}
