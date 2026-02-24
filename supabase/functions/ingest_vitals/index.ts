// Edge Function: ingest_vitals
// Receives and stores vital signs data from smartwatches/HealthKit/Health Connect

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VitalSignInput {
  type: string;
  value: number;
  unit: string;
  measured_at: string;
}

interface BloodPressureInput {
  systolic: number;
  diastolic: number;
  pulse?: number;
  measured_at: string;
}

interface IngestVitalsInput {
  patient_id: string;
  smartwatch_device_id?: string;
  vital_signs: VitalSignInput[];
  blood_pressure?: BloodPressureInput;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const input: IngestVitalsInput = await req.json();
    const { patient_id, smartwatch_device_id, vital_signs, blood_pressure } = input;

    // Validate input
    if (!patient_id) {
      throw new Error('Missing patient_id');
    }

    // Get current user ID
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Check authorization: must be the patient themselves
    if (user.id !== patient_id) {
      throw new Error('Not authorized');
    }

    const results = {
      vital_signs_inserted: 0,
      blood_pressure_inserted: false,
      anomalies_detected: [],
    };

    // Insert vital signs
    if (vital_signs && vital_signs.length > 0) {
      const vitalSignsToInsert = vital_signs.map((vs) => ({
        patient_id,
        smartwatch_device_id: smartwatch_device_id || null,
        type: vs.type,
        value: vs.value,
        unit: vs.unit,
        measured_at: vs.measured_at,
      }));

      const { error: vsError } = await supabase.from('vital_signs').insert(vitalSignsToInsert);

      if (vsError) throw vsError;
      results.vital_signs_inserted = vitalSignsToInsert.length;

      // Check for heart rate anomalies
      const heartRate = vital_signs.find((vs) => vs.type === 'heart_rate');
      if (heartRate) {
        const { data: isAnomaly, error: anomalyError } = await supabase.rpc('check_heart_rate_anomalies', {
          p_patient_id: patient_id,
          p_heart_rate: Math.round(heartRate.value),
        });

        if (!anomalyError && isAnomaly) {
          // Create health anomaly record
          const { error: haError } = await supabase.from('health_anomalies').insert({
            patient_id,
            anomaly_type: 'abnormal_heart_rate',
            description: `Frecuencia cardíaca anormal detectada: ${heartRate.value} bpm`,
            severity: heartRate.value > 150 || heartRate.value < 40 ? 'high' : 'medium',
            data: { heart_rate: heartRate.value, measured_at: heartRate.measured_at },
            detected_at: new Date().toISOString(),
          });

          if (!haError) {
            results.anomalies_detected.push('abnormal_heart_rate');
          }
        }
      }
    }

    // Insert blood pressure
    if (blood_pressure) {
      const { error: bpError } = await supabase.from('blood_pressure_readings').insert({
        patient_id,
        smartwatch_device_id: smartwatch_device_id || null,
        systolic: blood_pressure.systolic,
        diastolic: blood_pressure.diastolic,
        pulse: blood_pressure.pulse || null,
        measured_at: blood_pressure.measured_at,
      });

      if (bpError) throw bpError;
      results.blood_pressure_inserted = true;

      // Check for hypertension
      if (blood_pressure.systolic > 180 || blood_pressure.diastolic > 120) {
        const { error: haError } = await supabase.from('health_anomalies').insert({
          patient_id,
          anomaly_type: 'hypertensive_crisis',
          description: `Crisis hipertensiva detectada: ${blood_pressure.systolic}/${blood_pressure.diastolic} mmHg`,
          severity: 'high',
          data: blood_pressure,
          detected_at: new Date().toISOString(),
        });

        if (!haError) {
          results.anomalies_detected.push('hypertensive_crisis');
        }
      }
    }

    // Update smartwatch last_sync
    if (smartwatch_device_id) {
      await supabase
        .from('smartwatch_devices')
        .update({ last_sync: new Date().toISOString() })
        .eq('id', smartwatch_device_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ingest_vitals:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
