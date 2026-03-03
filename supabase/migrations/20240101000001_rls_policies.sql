-- Row Level Security Policies for Alert-IO

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_risk_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has consent scope for a patient
CREATE OR REPLACE FUNCTION has_consent(p_patient_id UUID, p_scope consent_scope)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM consents
    WHERE patient_id = p_patient_id
    AND scope = p_scope
    AND (
      caregiver_profile_id = auth.uid() OR
      clinician_profile_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- Devices policies
CREATE POLICY "Users can manage own devices"
  ON devices FOR ALL
  USING (profile_id = auth.uid());

-- Patients policies
CREATE POLICY "Patients can read own data"
  ON patients FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Patients can update own data"
  ON patients FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Patients can insert own data"
  ON patients FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Consented users can read patient data"
  ON patients FOR SELECT
  USING (has_consent(id, 'read_profile'));

-- Patient risk factors policies
CREATE POLICY "Patients can manage own risk factors"
  ON patient_risk_factors FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read risk factors"
  ON patient_risk_factors FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Medications policies
CREATE POLICY "Patients can manage own medications"
  ON medications FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read medications"
  ON medications FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Allergies policies
CREATE POLICY "Patients can manage own allergies"
  ON allergies FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read allergies"
  ON allergies FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Emergency contacts policies
CREATE POLICY "Patients can manage own emergency contacts"
  ON emergency_contacts FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read emergency contacts"
  ON emergency_contacts FOR SELECT
  USING (has_consent(patient_id, 'read_profile'));

-- Consents policies
CREATE POLICY "Patients can manage own consents"
  ON consents FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Recipients can read their consents"
  ON consents FOR SELECT
  USING (
    caregiver_profile_id = auth.uid() OR
    clinician_profile_id = auth.uid()
  );

-- Events policies
CREATE POLICY "Patients can read own events"
  ON events FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read events"
  ON events FOR SELECT
  USING (has_consent(patient_id, 'read_events'));

-- Alerts policies
CREATE POLICY "Patients can read own alerts"
  ON alerts FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Recipients can read relevant alerts"
  ON alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM alert_recipients
      WHERE alert_id = alerts.id
      AND recipient_profile_id = auth.uid()
    )
  );

-- Alert recipients policies
CREATE POLICY "Recipients can read own alert recipients"
  ON alert_recipients FOR SELECT
  USING (recipient_profile_id = auth.uid());

CREATE POLICY "Patients can read alert recipients for their alerts"
  ON alert_recipients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM alerts
      WHERE alerts.id = alert_recipients.alert_id
      AND alerts.patient_id = auth.uid()
    )
  );

-- Locations policies
CREATE POLICY "Patients can read/update own location"
  ON locations FOR ALL
  USING (patient_id = auth.uid());

CREATE POLICY "Consented users can read location"
  ON locations FOR SELECT
  USING (has_consent(patient_id, 'receive_alerts'));
