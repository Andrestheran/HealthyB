-- Seed data for ACV-Guard MVP
-- Creates demo accounts for testing

-- NOTE: In production, use proper password hashing via Supabase Auth API
-- For local dev, we'll insert test users directly

-- Demo user IDs (deterministic UUIDs for testing)
DO $$
DECLARE
  patient_id UUID := '11111111-1111-1111-1111-111111111111';
  caregiver_id UUID := '22222222-2222-2222-2222-222222222222';
  clinician_id UUID := '33333333-3333-3333-3333-333333333333';
BEGIN
  -- Insert auth users (via Supabase Auth in real setup)
  -- For local testing, you'll need to create these via signup or Supabase Studio

  -- Insert profiles
  INSERT INTO profiles (id, role, full_name, phone) VALUES
    (patient_id, 'patient', 'María García', '+573001234567'),
    (caregiver_id, 'caregiver', 'Carlos García', '+573007654321'),
    (clinician_id, 'clinician', 'Dr. Ana Martínez', '+573009876543')
  ON CONFLICT (id) DO NOTHING;

  -- Insert patient data
  INSERT INTO patients (id, date_of_birth, sex, address, eps, preferred_hospital) VALUES
    (patient_id, '1960-05-15', 'female', 'Calle 123 #45-67, Bogotá', 'Sanitas', 'Hospital Universitario San Ignacio')
  ON CONFLICT (id) DO NOTHING;

  -- Insert patient risk factors
  INSERT INTO patient_risk_factors (patient_id, has_htn, has_diabetes, has_afib, has_prior_stroke, smoker, dyslipidemia, notes) VALUES
    (patient_id, true, false, true, false, false, true, 'Hipertensión controlada con medicación')
  ON CONFLICT (patient_id) DO NOTHING;

  -- Insert medications
  INSERT INTO medications (patient_id, name, dose, schedule_text, is_anticoagulant, is_antiplatelet) VALUES
    (patient_id, 'Losartán', '50mg', 'Una vez al día en la mañana', false, false),
    (patient_id, 'Aspirina', '100mg', 'Una vez al día después del desayuno', false, true),
    (patient_id, 'Atorvastatina', '20mg', 'Una vez al día en la noche', false, false)
  ON CONFLICT DO NOTHING;

  -- Insert allergies
  INSERT INTO allergies (patient_id, substance, reaction) VALUES
    (patient_id, 'Penicilina', 'Erupción cutánea'),
    (patient_id, 'Mariscos', 'Urticaria')
  ON CONFLICT DO NOTHING;

  -- Insert emergency contacts
  INSERT INTO emergency_contacts (patient_id, full_name, relationship, phone, is_primary) VALUES
    (patient_id, 'Carlos García', 'Esposo', '+573007654321', true),
    (patient_id, 'Laura García', 'Hija', '+573005556666', false)
  ON CONFLICT DO NOTHING;

  -- Insert consents
  INSERT INTO consents (patient_id, caregiver_profile_id, clinician_profile_id, scope) VALUES
    (patient_id, caregiver_id, NULL, 'read_profile'),
    (patient_id, caregiver_id, NULL, 'read_events'),
    (patient_id, caregiver_id, NULL, 'receive_alerts'),
    (patient_id, NULL, clinician_id, 'read_profile'),
    (patient_id, NULL, clinician_id, 'read_events'),
    (patient_id, NULL, clinician_id, 'receive_alerts')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully';
  RAISE NOTICE 'Demo accounts:';
  RAISE NOTICE '  Patient: patient_demo@acvguard.test / Password123!';
  RAISE NOTICE '  Caregiver: caregiver_demo@acvguard.test / Password123!';
  RAISE NOTICE '  Clinician: clinician_demo@acvguard.test / Password123!';
  RAISE NOTICE '';
  RAISE NOTICE 'You must create these users in Supabase Auth manually or via signup flow';
  RAISE NOTICE 'Then update their profile IDs to match the UUIDs above';
END $$;
