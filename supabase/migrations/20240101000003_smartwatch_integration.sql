-- Smartwatch integration schema
-- Stores vital signs, fall detection, and health data from wearables

-- Enum for smartwatch types
CREATE TYPE smartwatch_type AS ENUM ('apple_watch', 'wear_os', 'other');

-- Enum for vital sign types
CREATE TYPE vital_sign_type AS ENUM (
  'heart_rate',
  'blood_pressure',
  'blood_oxygen',
  'respiratory_rate',
  'temperature',
  'sleep_hours',
  'steps',
  'distance_m'
);

-- Smartwatch devices (extends devices table)
CREATE TABLE smartwatch_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  device_type smartwatch_type NOT NULL,
  device_name TEXT NOT NULL,
  device_model TEXT,
  paired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(patient_id, device_name)
);

CREATE INDEX idx_smartwatch_devices_patient ON smartwatch_devices(patient_id);

-- Vital signs measurements
CREATE TABLE vital_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  smartwatch_device_id UUID REFERENCES smartwatch_devices(id) ON DELETE SET NULL,
  type vital_sign_type NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vital_signs_patient_type ON vital_signs(patient_id, type, measured_at DESC);
CREATE INDEX idx_vital_signs_measured_at ON vital_signs(measured_at DESC);

-- Blood pressure (special case with systolic/diastolic)
CREATE TABLE blood_pressure_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  smartwatch_device_id UUID REFERENCES smartwatch_devices(id) ON DELETE SET NULL,
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  pulse INTEGER,
  measured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blood_pressure_patient ON blood_pressure_readings(patient_id, measured_at DESC);

-- Fall detection events
CREATE TABLE fall_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  smartwatch_device_id UUID REFERENCES smartwatch_devices(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  alert_created BOOLEAN NOT NULL DEFAULT FALSE,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  user_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fall_detections_patient ON fall_detections(patient_id, detected_at DESC);
CREATE INDEX idx_fall_detections_alert_created ON fall_detections(alert_created, detected_at DESC);

-- Health anomalies detected by ML/algorithms
CREATE TABLE health_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  description TEXT NOT NULL,
  severity alert_severity NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL,
  alert_created BOOLEAN NOT NULL DEFAULT FALSE,
  alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_anomalies_patient ON health_anomalies(patient_id, detected_at DESC);
CREATE INDEX idx_health_anomalies_severity ON health_anomalies(severity, resolved, detected_at DESC);

-- Function to get latest vital signs for a patient
CREATE OR REPLACE FUNCTION get_latest_vital_signs(p_patient_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  type vital_sign_type,
  value DOUBLE PRECISION,
  unit TEXT,
  measured_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (vs.type)
    vs.type,
    vs.value,
    vs.unit,
    vs.measured_at
  FROM vital_signs vs
  WHERE vs.patient_id = p_patient_id
    AND vs.measured_at >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY vs.type, vs.measured_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect heart rate anomalies
CREATE OR REPLACE FUNCTION check_heart_rate_anomalies(
  p_patient_id UUID,
  p_heart_rate INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_afib BOOLEAN;
  v_is_anomaly BOOLEAN := FALSE;
BEGIN
  -- Get AFib status
  SELECT has_afib INTO v_has_afib
  FROM patient_risk_factors
  WHERE patient_id = p_patient_id;

  -- Check for dangerous heart rates
  IF p_heart_rate > 150 OR p_heart_rate < 40 THEN
    v_is_anomaly := TRUE;
  END IF;

  -- If patient has AFib, lower threshold for irregular rates
  IF v_has_afib AND (p_heart_rate > 120 OR p_heart_rate < 50) THEN
    v_is_anomaly := TRUE;
  END IF;

  RETURN v_is_anomaly;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies for new tables
ALTER TABLE smartwatch_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_pressure_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fall_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_anomalies ENABLE ROW LEVEL SECURITY;

-- Smartwatch devices policies
CREATE POLICY "Patients can manage own smartwatch devices"
  ON smartwatch_devices FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read smartwatch devices"
  ON smartwatch_devices FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Vital signs policies
CREATE POLICY "Patients can read own vital signs"
  ON vital_signs FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert own vital signs"
  ON vital_signs FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Consented users can read vital signs"
  ON vital_signs FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Blood pressure policies
CREATE POLICY "Patients can read own blood pressure"
  ON blood_pressure_readings FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert own blood pressure"
  ON blood_pressure_readings FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Consented users can read blood pressure"
  ON blood_pressure_readings FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Fall detection policies
CREATE POLICY "Patients can read own fall detections"
  ON fall_detections FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can update own fall detections"
  ON fall_detections FOR UPDATE
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read fall detections"
  ON fall_detections FOR SELECT
  USING (has_consent(patient_id, 'receive_alerts'));

-- Health anomalies policies
CREATE POLICY "Patients can read own health anomalies"
  ON health_anomalies FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read health anomalies"
  ON health_anomalies FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));
