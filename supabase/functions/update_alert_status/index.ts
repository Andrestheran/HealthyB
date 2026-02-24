// Edge Function: update_alert_status
// Updates alert status and notifies involved parties

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateAlertStatusInput {
  alert_id: string;
  new_status: 'triggered' | 'acknowledged' | 'escalated' | 'closed';
  note?: string;
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

    const input: UpdateAlertStatusInput = await req.json();
    const { alert_id, new_status, note } = input;

    if (!alert_id || !new_status) {
      throw new Error('Missing required fields');
    }

    // Use the secure RPC function to update status
    const { data, error } = await supabase.rpc('update_alert_status_rpc', {
      p_alert_id: alert_id,
      p_new_status: new_status,
      p_note: note || null,
    });

    if (error) throw error;

    // Get alert details for notification
    const { data: alert } = await supabase
      .from('alerts')
      .select('patient_id, severity')
      .eq('id', alert_id)
      .single();

    // Get all recipients for this alert
    const { data: recipients } = await supabase
      .from('alert_recipients')
      .select('recipient_profile_id')
      .eq('alert_id', alert_id);

    const recipientIds = recipients?.map((r) => r.recipient_profile_id) || [];

    // Add patient to recipients
    if (alert?.patient_id) {
      recipientIds.push(alert.patient_id);
    }

    // Get devices for push notifications
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: devices } = await supabaseService
      .from('devices')
      .select('expo_push_token')
      .in('profile_id', recipientIds);

    // Send push notifications about status change
    const pushMessages: any[] = [];
    devices?.forEach((device) => {
      pushMessages.push({
        to: device.expo_push_token,
        sound: 'default',
        title: 'Actualización de Alerta',
        body: `Estado cambiado a: ${new_status}`,
        data: {
          alert_id,
          new_status,
        },
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
        alert_id,
        new_status,
        recipients_notified: pushMessages.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update_alert_status:', error);
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
