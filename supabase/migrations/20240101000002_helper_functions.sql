-- Helper functions for Alert-IO

-- Function to update alert status (secured)
CREATE OR REPLACE FUNCTION update_alert_status_rpc(
  p_alert_id UUID,
  p_new_status alert_status,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_patient_id UUID;
  v_old_status alert_status;
  v_event_id UUID;
BEGIN
  -- Get alert info
  SELECT patient_id, status INTO v_patient_id, v_old_status
  FROM alerts
  WHERE id = p_alert_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alert not found';
  END IF;

  -- Check authorization: patient themselves OR consented user with receive_alerts
  IF auth.uid() != v_patient_id AND NOT has_consent(v_patient_id, 'receive_alerts') THEN
    RAISE EXCEPTION 'Not authorized to update this alert';
  END IF;

  -- Update alert status
  UPDATE alerts
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_alert_id;

  -- Create status change event
  INSERT INTO events (patient_id, type, payload)
  VALUES (
    v_patient_id,
    'alert_status_change',
    jsonb_build_object(
      'alert_id', p_alert_id,
      'old_status', v_old_status,
      'new_status', p_new_status,
      'note', p_note,
      'changed_by', auth.uid()
    )
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'alert_id', p_alert_id,
    'new_status', p_new_status,
    'event_id', v_event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get patient emergency card
CREATE OR REPLACE FUNCTION get_patient_emergency_card(p_patient_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Check authorization
  IF auth.uid() != p_patient_id AND NOT has_consent(p_patient_id, 'read_profile') THEN
    RAISE EXCEPTION 'Not authorized to view this patient';
  END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT row_to_json(profiles.*) FROM profiles WHERE id = p_patient_id),
    'patient', (SELECT row_to_json(patients.*) FROM patients WHERE id = p_patient_id),
    'risk_factors', (SELECT row_to_json(patient_risk_factors.*) FROM patient_risk_factors WHERE patient_id = p_patient_id),
    'medications', (SELECT COALESCE(jsonb_agg(row_to_json(medications.*)), '[]'::jsonb) FROM medications WHERE patient_id = p_patient_id),
    'allergies', (SELECT COALESCE(jsonb_agg(row_to_json(allergies.*)), '[]'::jsonb) FROM allergies WHERE patient_id = p_patient_id),
    'emergency_contacts', (SELECT COALESCE(jsonb_agg(row_to_json(emergency_contacts.*)), '[]'::jsonb) FROM emergency_contacts WHERE patient_id = p_patient_id ORDER BY is_primary DESC)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get alerts for current user
CREATE OR REPLACE FUNCTION get_my_alerts(p_status_filter alert_status DEFAULT NULL)
RETURNS TABLE (
  alert_id UUID,
  patient_id UUID,
  patient_name TEXT,
  status alert_status,
  severity alert_severity,
  triggered_by TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  event_payload JSONB,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.patient_id,
    p.full_name,
    a.status,
    a.severity,
    a.triggered_by,
    a.created_at,
    a.updated_at,
    e.payload,
    l.lat,
    l.lng
  FROM alerts a
  JOIN profiles p ON p.id = a.patient_id
  LEFT JOIN events e ON e.patient_id = a.patient_id
    AND e.type IN ('checkin', 'sos', 'symptom_report')
    AND e.created_at >= a.created_at - INTERVAL '5 minutes'
    AND e.created_at <= a.created_at
  LEFT JOIN locations l ON l.patient_id = a.patient_id
  WHERE EXISTS (
    SELECT 1 FROM alert_recipients ar
    WHERE ar.alert_id = a.id
    AND ar.recipient_profile_id = auth.uid()
  )
  AND (p_status_filter IS NULL OR a.status = p_status_filter)
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
