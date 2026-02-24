// Edge Function: report_fall
// Handles fall detection events from smartwatches and creates HIGH alerts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FallData {
  detected_at: string;
  confidence: number;
  lat?: number;
  lng?: number;
  accuracy_m?: number;
}

interface ReportFallInput {
  patient_id: string;
  smartwatch_device_id?: string;
  fall_data: FallData;
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const input: ReportFallInput = await req.json();
    const { patient_id, smartwatch_device_id, fall_data } = input;

    // Validate input
    if (!patient_id || !fall_data) {
      throw new Error('Missing required fields');
    }

    // Insert fall detection record
    const { data: fallDetection, error: fallError } = await supabase
      .from('fall_detections')
      .insert({
        patient_id,
        smartwatch_device_id: smartwatch_device_id || null,
        detected_at: fall_data.detected_at,
        confidence: fall_data.confidence,
        lat: fall_data.lat || null,
        lng: fall_data.lng || null,
        accuracy_m: fall_data.accuracy_m || null,
        alert_created: true,
      })
      .select()
      .single();

    if (fallError) throw fallError;

    // Create HIGH severity alert
    const { data: alert, error: alertError } = await supabase
      .from('alerts')
      .insert({
        patient_id,
        status: 'triggered',
        severity: 'high',
        triggered_by: 'fall_detection',
      })
      .select()
      .single();

    if (alertError) throw alertError;

    // Link fall detection to alert
    await supabase
      .from('fall_detections')
      .update({ alert_id: alert.id })
      .eq('id', fallDetection.id);

    // Create event
    const { data: event } = await supabase
      .from('events')
      .insert({
        patient_id,
        type: 'sos',
        payload: {
          alert_id: alert.id,
          fall_detection_id: fallDetection.id,
          confidence: fall_data.confidence,
          detected_at: fall_data.detected_at,
          lat: fall_data.lat,
          lng: fall_data.lng,
        },
      })
      .select()
      .single();

    // Save location if provided
    if (fall_data.lat && fall_data.lng) {
      await supabase.from('locations').upsert({
        patient_id,
        lat: fall_data.lat,
        lng: fall_data.lng,
        accuracy_m: fall_data.accuracy_m || 0,
      });
    }

    // Get recipients: emergency contacts + consented users
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
        priority: 'high',
        title: '🚨 ALERTA DE CAÍDA DETECTADA',
        body: 'Posible caída detectada. Ubicación disponible.',
        data: {
          alert_id: alert.id,
          patient_id,
          severity: 'high',
          type: 'fall_detection',
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

    // Send to Expo Push API
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
        fall_detection_id: fallDetection.id,
        event_id: event?.id,
        recipients_notified: pushMessages.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in report_fall:', error);
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
