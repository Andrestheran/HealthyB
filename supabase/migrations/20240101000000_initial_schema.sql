-- Initial schema for ACV-Guard MVP
-- Create enums first

CREATE TYPE role AS ENUM ('patient', 'caregiver', 'clinician', 'admin');
CREATE TYPE consent_scope AS ENUM ('read_profile', 'read_events', 'receive_alerts');
CREATE TYPE event_type AS ENUM ('checkin', 'sos', 'symptom_report', 'location_ping', 'alert_status_change');
CREATE TYPE alert_status AS ENUM ('triggered', 'acknowledged', 'escalated', 'closed');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');
CREATE TYPE sex AS ENUM ('male', 'female', 'other');
CREATE TYPE notification_channel AS ENUM ('push', 'sms', 'email');

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role role NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices for push notifications
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, expo_push_token)
);

-- Patients (extends profiles)
CREATE TABLE patients (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL,
  sex sex NOT NULL,
  address TEXT NOT NULL,
  eps TEXT NOT NULL,
  preferred_hospital TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Patient risk factors
CREATE TABLE patient_risk_factors (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  has_htn BOOLEAN NOT NULL DEFAULT FALSE,
  has_diabetes BOOLEAN NOT NULL DEFAULT FALSE,
  has_afib BOOLEAN NOT NULL DEFAULT FALSE,
  has_prior_stroke BOOLEAN NOT NULL DEFAULT FALSE,
  smoker BOOLEAN NOT NULL DEFAULT FALSE,
  dyslipidemia BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);

-- Medications
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  schedule_text TEXT NOT NULL,
  is_anticoagulant BOOLEAN NOT NULL DEFAULT FALSE,
  is_antiplatelet BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allergies
CREATE TABLE allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  substance TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergency contacts
CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Consents for caregivers and clinicians
CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  caregiver_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  clinician_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  scope consent_scope NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (caregiver_profile_id IS NOT NULL AND clinician_profile_id IS NULL) OR
    (caregiver_profile_id IS NULL AND clinician_profile_id IS NOT NULL)
  )
);

-- Events timeline
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type event_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_patient_created ON events(patient_id, created_at DESC);

-- Alerts
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  status alert_status NOT NULL DEFAULT 'triggered',
  severity alert_severity NOT NULL,
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_patient_status ON alerts(patient_id, status, created_at DESC);
CREATE INDEX idx_alerts_status_created ON alerts(status, created_at DESC);

-- Alert recipients
CREATE TABLE alert_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  recipient_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  delivered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ
);

CREATE INDEX idx_alert_recipients_alert ON alert_recipients(alert_id);
CREATE INDEX idx_alert_recipients_recipient ON alert_recipients(recipient_profile_id);

-- Locations (one per patient, upserted)
CREATE TABLE locations (
  patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
