// Edge Function: create_alert
// Handles SOS, BE-FAST check-ins, and symptom reports
// Determines severity, creates alerts, notifies recipients via Expo Push

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateAlertInput {
  patient_id: string;
  source: 'sos' | 'befast' | 'symptom_report';
  triggered_by: string;
  payload: Record<string, any>;
}

// Alert severity logic
function determineSeverity(source: string, payload: any): 'low' | 'medium' | 'high' {
  if (source === 'sos') {
    return 'high';
  }

  if (source === 'befast') {
    const { face, arm, speech, balance, eyes } = payload;
    const majorSymptoms = [face, arm, speech].filter(Boolean).length;
    const minorSymptoms = [balance, eyes].filter(Boolean).length;

    // Major symptoms = HIGH
    if (majorSymptoms >= 1) {
      return 'high';
    }

    // 2+ minor symptoms OR AFib + any symptom = MEDIUM
    // Note: AFib check requires patient_risk_factors, handled in query
    if (minorSymptoms >= 2) {
      return 'medium';
    }

    // Otherwise just log, no alert (but we'll create LOW for tracking)
    return 'low';
  }

  // symptom_report defaults to medium if any symptoms present
  return 'medium';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const input: CreateAlertInput = await req.json();
    const { patient_id, source, triggered_by, payload } = input;

    // Validate input
    if (!patient_id || !source || !triggered_by) {
      throw new Error('Missing required fields');
    }

    // Check if patient has AFib (for severity calculation)
    const { data: riskFactors } = await supabase
      .from('patient_risk_factors')
      .select('has_afib')
      .eq('patient_id', patient_id)
      .single();

    const hasAfib = riskFactors?.has_afib || false;

    // Adjust severity for BE-FAST with AFib
    let severity = determineSeverity(source, payload);
    if (source === 'befast' && hasAfib && severity === 'low') {
      const hasAnySymptom = Object.values(payload).some(
        (v) => typeof v === 'boolean' && v === true
      );
      if (hasAnySymptom) {
        severity = 'medium';
      }
    }

    // Skip creating alert if severity is low and no major symptoms
    // For MVP, we'll create all alerts but could filter here
    if (severity === 'low' && source === 'befast') {
      // Just log event, no alert
      const { data: event } = await supabase
        .from('events')
        .insert({
          patient_id,
          type: 'checkin',
          payload,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          alert_created: false,
          event_id: event?.id,
          message: 'Check-in logged, no alert triggered',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create alert
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        patient_id,
        status: 'triggered',
        severity,
        triggered_by,
      })
      .select()
      .single();

    if (alertError) throw alertError;

    // Create event
    const eventType = source === 'sos' ? 'sos' : source === 'befast' ? 'checkin' : 'symptom_report';
    const { data: event } = await supabase
      .from('events')
      .insert({
        patient_id,
        type: eventType,
        payload: { ...payload, alert_id: alert.id },
      })
      .select()
      .single();

    // Save location if provided
    if (payload.lat && payload.lng) {
      await supabase
        .from('locations')
        .upsert({
          patient_id,
          lat: payload.lat,
          lng: payload.lng,
          accuracy_m: payload.accuracy_m || 0,
        });

      // Log location event
      await supabase.from('events').insert({
        patient_id,
        type: 'location_ping',
        payload: {
          lat: payload.lat,
          lng: payload.lng,
          accuracy_m: payload.accuracy_m,
        },
      });
    }

    // Get recipients: emergency contacts + consented caregivers/clinicians with receive_alerts
    const { data: emergencyContacts } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('patient_id', patient_id);

    const { data: consentedUsers } = await supabase
      .from('consents')
      .select('caregiver_profile_id, clinician_profile_id')
      .eq('patient_id', patient_id)
      .eq('scope', 'receive_alerts');

    const recipientIds: string[] = [];
    consentedUsers?.forEach((c) => {
      if (c.caregiver_profile_id) recipientIds.push(c.caregiver_profile_id);
      if (c.clinician_profile_id) recipientIds.push(c.clinician_profile_id);
    });

    // Get devices for push notifications
    const { data: devices } = await supabase
      .from('devices')
      .select('profile_id, expo_push_token')
      .in('profile_id', recipientIds);

    // Send push notifications
    const pushMessages: any[] = [];
    devices?.forEach((device) => {
      pushMessages.push({
        to: device.expo_push_token,
        sound: 'default',
        title: '🚨 Alerta Alert-IO',
        body: `Nueva alerta ${severity.toUpperCase()} - ${source}`,
        data: {
          alert_id: alert.id,
          patient_id,
          severity,
        },
      });

      // Insert alert recipient record
      supabase.from('alert_recipients').insert({
        alert_id: alert.id,
        recipient_profile_id: device.profile_id,
        channel: 'push',
        delivered_at: new Date().toISOString(),
      });
    });

    // Send to Expo Push API (best effort)
    if (pushMessages.length > 0) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushMessages),
        });
      } catch (error) {
        console.error('Failed to send push notifications:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alert_id: alert.id,
        event_id: event?.id,
        severity,
        recipients_notified: pushMessages.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in create_alert:', error);
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
