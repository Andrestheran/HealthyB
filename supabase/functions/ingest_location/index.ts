// Edge Function: ingest_location
// Stores patient location and logs location event

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngestLocationInput {
  patient_id: string;
  lat: number;
  lng: number;
  accuracy_m: number;
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

    const input: IngestLocationInput = await req.json();
    const { patient_id, lat, lng, accuracy_m } = input;

    // Validate input
    if (!patient_id || lat === undefined || lng === undefined || accuracy_m === undefined) {
      throw new Error('Missing required fields');
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error('Invalid coordinates');
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
      throw new Error('Not authorized to update this location');
    }

    // Upsert location
    const { error: locationError } = await supabase
      .from('locations')
      .upsert({
        patient_id,
        lat,
        lng,
        accuracy_m,
      });

    if (locationError) throw locationError;

    // Log location event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        patient_id,
        type: 'location_ping',
        payload: {
          lat,
          lng,
          accuracy_m,
        },
      })
      .select()
      .single();

    if (eventError) throw eventError;

    return new Response(
      JSON.stringify({
        success: true,
        event_id: event?.id,
        message: 'Location updated',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in ingest_location:', error);
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
