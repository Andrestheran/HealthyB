-- Seed data for Alert-IO MVP
-- Instructions for setting up demo accounts

DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Alert-IO - Database Ready!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Open Supabase Studio: http://127.0.0.1:54323';
  RAISE NOTICE '';
  RAISE NOTICE '2. Go to Authentication -> Users -> Add User';
  RAISE NOTICE '';
  RAISE NOTICE '3. Create these 3 test users:';
  RAISE NOTICE '';
  RAISE NOTICE '   PATIENT:';
  RAISE NOTICE '     Email: patient_demo@acvguard.test';
  RAISE NOTICE '     Password: Password123!';
  RAISE NOTICE '     [x] Auto Confirm User';
  RAISE NOTICE '';
  RAISE NOTICE '   CAREGIVER:';
  RAISE NOTICE '     Email: caregiver_demo@acvguard.test';
  RAISE NOTICE '     Password: Password123!';
  RAISE NOTICE '     [x] Auto Confirm User';
  RAISE NOTICE '';
  RAISE NOTICE '   CLINICIAN:';
  RAISE NOTICE '     Email: clinician_demo@acvguard.test';
  RAISE NOTICE '     Password: Password123!';
  RAISE NOTICE '     [x] Auto Confirm User';
  RAISE NOTICE '';
  RAISE NOTICE '4. Users will create their profiles when they';
  RAISE NOTICE '   first sign up in the app!';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Database migrations applied successfully!';
  RAISE NOTICE '==============================================';
END $$;
