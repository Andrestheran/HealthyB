import { z } from 'zod';
import { Role, ConsentScope, EventType, AlertStatus, AlertSeverity, Sex, SmartwatchType, VitalSignType } from './enums';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

export const signupSchema = loginSchema.extend({
  full_name: z.string().min(2, 'El nombre es requerido'),
  phone: z.string().min(10, 'Número de teléfono inválido'),
  role: z.nativeEnum(Role)
});

// Patient onboarding schemas
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

// BE-FAST check-in schema
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

// Symptom report schema
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

// Location schema
export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().positive()
});

// Edge Function schemas
export const createAlertInputSchema = z.object({
  patient_id: z.string().uuid(),
  source: z.enum(['sos', 'befast', 'symptom_report']),
  triggered_by: z.string(),
  payload: z.record(z.any())
});

export const updateAlertStatusInputSchema = z.object({
  alert_id: z.string().uuid(),
  new_status: z.nativeEnum(AlertStatus),
  note: z.string().optional().nullable()
});

export const ingestLocationInputSchema = z.object({
  patient_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy_m: z.number().positive()
});

// Device registration schema
export const registerDeviceSchema = z.object({
  expo_push_token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web'])
});

// Smartwatch schemas
export const pairSmartwatchSchema = z.object({
  device_type: z.nativeEnum(SmartwatchType),
  device_name: z.string().min(1, 'El nombre del dispositivo es requerido'),
  device_model: z.string().optional().nullable()
});

export const vitalSignSchema = z.object({
  type: z.nativeEnum(VitalSignType),
  value: z.number().positive(),
  unit: z.string().min(1),
  measured_at: z.string() // ISO timestamp
});

export const bloodPressureSchema = z.object({
  systolic: z.number().int().min(40).max(300, 'Valor de presión sistólica inválido'),
  diastolic: z.number().int().min(20).max(200, 'Valor de presión diastólica inválido'),
  pulse: z.number().int().positive().optional().nullable(),
  measured_at: z.string() // ISO timestamp
});

export const fallDetectionSchema = z.object({
  detected_at: z.string(), // ISO timestamp
  confidence: z.number().min(0).max(1),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  accuracy_m: z.number().positive().optional().nullable()
});

export const ingestVitalSignsInputSchema = z.object({
  patient_id: z.string().uuid(),
  smartwatch_device_id: z.string().uuid().optional().nullable(),
  vital_signs: z.array(vitalSignSchema),
  blood_pressure: bloodPressureSchema.optional().nullable()
});

export const reportFallInputSchema = z.object({
  patient_id: z.string().uuid(),
  smartwatch_device_id: z.string().uuid().optional().nullable(),
  fall_data: fallDetectionSchema
});

// Export inferred types
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
export type CreateAlertInput = z.infer<typeof createAlertInputSchema>;
export type UpdateAlertStatusInput = z.infer<typeof updateAlertStatusInputSchema>;
export type IngestLocationInput = z.infer<typeof ingestLocationInputSchema>;
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;
export type PairSmartwatchInput = z.infer<typeof pairSmartwatchSchema>;
export type VitalSignInput = z.infer<typeof vitalSignSchema>;
export type BloodPressureInput = z.infer<typeof bloodPressureSchema>;
export type FallDetectionInput = z.infer<typeof fallDetectionSchema>;
export type IngestVitalSignsInput = z.infer<typeof ingestVitalSignsInputSchema>;
export type ReportFallInput = z.infer<typeof reportFallInputSchema>;
