-- Primero obtén los UUIDs
SELECT id, email FROM auth.users WHERE email LIKE '%@acvguard.test';

-- Luego inserta (reemplaza 'UUID_AQUI' con los IDs reales):
INSERT INTO profiles (id, role, full_name, phone, emergency_contact_name, emergency_contact_phone)
VALUES 
  ('UUID_PATIENT', 'patient', 'Demo Patient', '+573001234567', 'Contact Name', '+573009876543'),
  ('UUID_CAREGIVER', 'caregiver', 'Demo Caregiver', '+573001234568', NULL, NULL),
  ('UUID_CLINICIAN', 'clinician', 'Dr. Demo', '+573001234569', NULL, NULL);