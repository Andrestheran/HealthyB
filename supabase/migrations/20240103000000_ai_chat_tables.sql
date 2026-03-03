-- Chat sessions table
CREATE TABLE ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_chat_sessions_patient ON ai_chat_sessions(patient_id, last_message_at DESC);

-- Chat messages table
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON ai_chat_messages(session_id, created_at);

-- RLS policies
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own sessions"
  ON ai_chat_sessions FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "Patients can view own messages"
  ON ai_chat_messages FOR SELECT
  USING (patient_id = auth.uid());

-- Helper function to get patient context
CREATE OR REPLACE FUNCTION get_patient_context_summary(p_patient_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'edad', EXTRACT(YEAR FROM AGE(p.date_of_birth)),
    'sexo', p.sex,
    'factores_riesgo', ARRAY_REMOVE(ARRAY[
      CASE WHEN rf.has_htn THEN 'hipertensión' END,
      CASE WHEN rf.has_diabetes THEN 'diabetes' END,
      CASE WHEN rf.has_afib THEN 'fibrilación auricular' END,
      CASE WHEN rf.has_prior_stroke THEN 'ACV previo' END,
      CASE WHEN rf.smoker THEN 'fumador' END,
      CASE WHEN rf.dyslipidemia THEN 'dislipidemia' END
    ], NULL),
    'medicamentos', COALESCE((
      SELECT jsonb_agg(name || ' ' || dose)
      FROM medications WHERE patient_id = p_patient_id
    ), '[]'::jsonb),
    'alergias', COALESCE((
      SELECT jsonb_agg(substance)
      FROM allergies WHERE patient_id = p_patient_id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM patients p
  LEFT JOIN patient_risk_factors rf ON rf.patient_id = p.id
  WHERE p.id = p_patient_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
