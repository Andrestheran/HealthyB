// Inlined from packages/shared — avoids workspace:* resolution issues in EAS Build
import { z } from 'zod';

// ---- ENUMS ----

export enum Role {
  PATIENT = 'patient',
  CAREGIVER = 'caregiver',
  CLINICIAN = 'clinician',
  ADMIN = 'admin'
}

export enum ConsentScope {
  READ_PROFILE = 'read_profile',
  READ_EVENTS = 'read_events',
  RECEIVE_ALERTS = 'receive_alerts'
}

export enum EventType {
  CHECKIN = 'checkin',
  SOS = 'sos',
  SYMPTOM_REPORT = 'symptom_report',
  LOCATION_PING = 'location_ping',
  ALERT_STATUS_CHANGE = 'alert_status_change'
}

export enum AlertStatus {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  ESCALATED = 'escalated',
  CLOSED = 'closed'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Sex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email'
}

export enum SmartwatchType {
  APPLE_WATCH = 'apple_watch',
  WEAR_OS = 'wear_os',
  OTHER = 'other'
}

export enum VitalSignType {
  HEART_RATE = 'heart_rate',
  BLOOD_PRESSURE = 'blood_pressure',
  BLOOD_OXYGEN = 'blood_oxygen',
  RESPIRATORY_RATE = 'respiratory_rate',
  TEMPERATURE = 'temperature',
  SLEEP_HOURS = 'sleep_hours',
  STEPS = 'steps',
  DISTANCE_M = 'distance_m'
}

// ---- TYPES ----

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

export interface BeFastSymptoms {
  balance: boolean;
  eyes: boolean;
  face: boolean;
  arm: boolean;
  speech: boolean;
  time_last_known_well: string | null;
  notes: string | null;
}

export interface SymptomReport {
  headache: boolean;
  dizziness: boolean;
  numbness: boolean;
  confusion: boolean;
  notes: string | null;
}

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

export interface PatientVitalsSnapshot {
  heart_rate: VitalSign | null;
  blood_pressure: BloodPressureReading | null;
  blood_oxygen: VitalSign | null;
  steps: VitalSign | null;
  sleep_hours: VitalSign | null;
}

export interface AIChatSession {
  id: string;
  patient_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
  archived: boolean;
}

export interface AIChatMessage {
  id: string;
  session_id: string;
  patient_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any>;
  created_at: string;
}

// ---- SCHEMAS ----

export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

export const signupSchema = loginSchema.extend({
  full_name: z.string().min(2, 'El nombre es requerido'),
  phone: z.string().min(10, 'Número de teléfono inválido'),
  role: z.nativeEnum(Role)
});

export const patientProfileSchema = z.object({
  full_name: z.string().min(2, 'El nombre es requerido'),
  phone: z.string().min(10, 'Número de teléfono inválido'),
  date_of_birth: z.string().min(1, 'La fecha de nacimiento es requerida'),
  sex: z.nativeEnum(Sex),
  address: z.string().min(5, 'La dirección es requerida'),
  eps: z.string().min(2, 'La EPS es requerida'),
  preferred_hospital: z.string().min(2, 'El hospital preferido es requerido')
});

export const riskFactorsSchema = z.object({
  has_htn: z.boolean(),
  has_diabetes: z.boolean(),
  has_afib: z.boolean(),
  has_prior_stroke: z.boolean(),
  smoker: z.boolean(),
  dyslipidemia: z.boolean(),
  notes: z.string().optional()
});

export const medicationSchema = z.object({
  name: z.string().min(1, 'El nombre del medicamento es requerido'),
  dose: z.string().min(1, 'La dosis es requerida'),
  schedule_text: z.string().min(1, 'El horario es requerido'),
  is_anticoagulant: z.boolean(),
  is_antiplatelet: z.boolean()
});

export const allergySchema = z.object({
  substance: z.string().min(1, 'La sustancia es requerida'),
  reaction: z.string().min(1, 'La reacción es requerida')
});

export const emergencyContactSchema = z.object({
  full_name: z.string().min(2, 'El nombre es requerido'),
  relationship: z.string().min(2, 'La relación es requerida'),
  phone: z.string().min(10, 'Número de teléfono inválido'),
  is_primary: z.boolean()
});

export const consentSchema = z.object({
  recipient_profile_id: z.string().uuid(),
  recipient_type: z.enum(['caregiver', 'clinician']),
  scopes: z.array(z.nativeEnum(ConsentScope)).min(1, 'Selecciona al menos un permiso')
});

export const beFastSchema = z.object({
  balance: z.boolean(),
  eyes: z.boolean(),
  face: z.boolean(),
  arm: z.boolean(),
  speech: z.boolean(),
  time_last_known_well: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  accuracy_m: z.number().optional().nullable()
});

export const symptomReportSchema = z.object({
  headache: z.boolean(),
  dizziness: z.boolean(),
  numbness: z.boolean(),
  confusion: z.boolean(),
  notes: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  accuracy_m: z.number().optional().nullable()
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().positive()
});

export const registerDeviceSchema = z.object({
  expo_push_token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web'])
});

export const pairSmartwatchSchema = z.object({
  device_type: z.nativeEnum(SmartwatchType),
  device_name: z.string().min(1, 'El nombre del dispositivo es requerido'),
  device_model: z.string().optional().nullable()
});

export const vitalSignSchema = z.object({
  type: z.nativeEnum(VitalSignType),
  value: z.number().positive(),
  unit: z.string().min(1),
  measured_at: z.string()
});

export const bloodPressureSchema = z.object({
  systolic: z.number().int().min(40).max(300, 'Valor de presión sistólica inválido'),
  diastolic: z.number().int().min(20).max(200, 'Valor de presión diastólica inválido'),
  pulse: z.number().int().positive().optional().nullable(),
  measured_at: z.string()
});

export const fallDetectionSchema = z.object({
  detected_at: z.string(),
  confidence: z.number().min(0).max(1),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  accuracy_m: z.number().positive().optional().nullable()
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PatientProfileInput = z.infer<typeof patientProfileSchema>;
export type RiskFactorsInput = z.infer<typeof riskFactorsSchema>;
export type MedicationInput = z.infer<typeof medicationSchema>;
export type AllergyInput = z.infer<typeof allergySchema>;
export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type BeFastInput = z.infer<typeof beFastSchema>;
export type SymptomReportInput = z.infer<typeof symptomReportSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type PairSmartwatchInput = z.infer<typeof pairSmartwatchSchema>;
export type VitalSignInput = z.infer<typeof vitalSignSchema>;
export type BloodPressureInput = z.infer<typeof bloodPressureSchema>;
export type FallDetectionInput = z.infer<typeof fallDetectionSchema>;
