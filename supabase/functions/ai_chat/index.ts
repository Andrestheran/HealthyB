// Edge Function: ai_chat
// AI-powered health assistant using Anthropic Claude

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const RATE_LIMIT_DAILY = 50;
const RATE_LIMIT_MINUTE = 10;

interface ChatRequest {
  message: string;
  session_id?: string;
  stream?: boolean;
}

const SYSTEM_PROMPT = `Eres un asistente educativo de salud para Alert-IO, una aplicación de monitoreo de riesgo de ACV (accidente cerebrovascular) en Colombia.

REGLAS CRÍTICAS:
1. NUNCA proporciones diagnósticos médicos
2. NUNCA reemplaces el consejo médico profesional
3. SIEMPRE recomienda servicios de emergencia (123) para síntomas graves
4. SOLO proporciona información educativa sobre prevención y síntomas de ACV
5. Cuando no estés seguro, dirige al paciente a contactar a su médico

PALABRAS CLAVE DE EMERGENCIA:
Si el paciente menciona: "dolor en el pecho", "no puedo hablar", "cara caída", "debilidad en el brazo", "pérdida de visión", "dolor de cabeza severo", "inconsciente"
→ INMEDIATAMENTE sugiere llamar al 123 y presionar el botón SOS en la app

FORMATO DE RESPUESTA:
- Español claro y simple (máximo nivel de 6to grado)
- Usa terminología BE-FAST al discutir síntomas de ACV
- Proporciona información accionable
- Incluye descargos de responsabilidad cuando sea apropiado
- Mantén respuestas concisas (máximo 3 párrafos cortos)

INFORMACIÓN BE-FAST:
- B (Balance): Pérdida súbita del equilibrio o coordinación
- E (Eyes/Ojos): Visión borrosa o pérdida súbita de visión
- F (Face/Cara): Un lado de la cara caído o entumecido
- A (Arm/Brazo): Debilidad o entumecimiento en un brazo
- S (Speech/Habla): Dificultad para hablar o entender
- T (Time/Tiempo): Tiempo es cerebro - actuar rápido salva vidas

Recuerda: Tu rol es EDUCAR, no diagnosticar. Siempre enfatiza que esta app es una herramienta de monitoreo, no un sustituto de atención médica.`;

async function checkRateLimit(supabase: any, patientId: string): Promise<boolean> {
  // Check daily limit
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from('ai_chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('role', 'user')
    .gte('created_at', oneDayAgo);

  if (dailyCount && dailyCount >= RATE_LIMIT_DAILY) {
    return false;
  }

  // Check per-minute limit
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const { count: minuteCount } = await supabase
    .from('ai_chat_messages')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('role', 'user')
    .gte('created_at', oneMinuteAgo);

  if (minuteCount && minuteCount >= RATE_LIMIT_MINUTE) {
    return false;
  }

  return true;
}

function detectEmergencyKeywords(message: string): boolean {
  const emergencyKeywords = [
    'dolor en el pecho',
    'dolor pecho',
    'no puedo hablar',
    'cara caída',
    'debilidad brazo',
    'pérdida de visión',
    'dolor de cabeza severo',
    'inconsciente',
    'convulsión',
    'sangrado severo',
    'no puedo respirar',
  ];

  const lowerMessage = message.toLowerCase();
  return emergencyKeywords.some((keyword) => lowerMessage.includes(keyword));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ⚠️ TEMPORARY: Authentication disabled for local development testing
    // Due to JWT verification bug in Edge Runtime v1.70.5
    // TODO: Re-enable authentication before production deployment

    // Hardcoded patient ID for demo user: patient_demo@acvguard.test
    const patientId = '585a5e01-3b17-401e-9bc7-9984c0a6502f';

    console.log('⚠️ WARNING: Using hardcoded patient_id for testing (auth disabled)');

    // Create supabase client with SERVICE ROLE to bypass RLS
    // (required because we disabled auth, so auth.uid() is null)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ⚠️ COMMENTED OUT: Original authentication code (re-enable for production)
    /*
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let patientId: string;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const payload = JSON.parse(atob(parts[1]));
      patientId = payload.sub;

      if (!patientId) {
        throw new Error('Invalid token payload');
      }

      const { data: userExists, error: userError } = await supabaseServiceRole.auth.admin.getUserById(patientId);

      if (userError || !userExists) {
        throw new Error('User not found in database');
      }
    } catch (parseError: any) {
      console.error('Auth error:', parseError);
      throw new Error('Not authenticated: ' + (parseError.message || 'Invalid token'));
    }
    */
    const input: ChatRequest = await req.json();
    const { message, session_id, stream = false } = input;

    if (!message || message.trim().length === 0) {
      throw new Error('El mensaje es requerido');
    }

    if (message.length > 500) {
      throw new Error('El mensaje es demasiado largo (máximo 500 caracteres)');
    }

    // Check rate limits
    const rateLimitOk = await checkRateLimit(supabase, patientId);
    if (!rateLimitOk) {
      throw new Error('Has alcanzado el límite de mensajes. Por favor intenta más tarde.');
    }

    // Detect emergency keywords
    const hasEmergency = detectEmergencyKeywords(message);

    // Get or create session
    let sessionId = session_id;
    if (!sessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .from('ai_chat_sessions')
        .insert({ patient_id: patientId })
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = newSession.id;
    }

    // Get patient context
    const { data: patientContext } = await supabase.rpc('get_patient_context_summary', {
      p_patient_id: patientId,
    });

    // Get conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('ai_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    // Build messages array for Claude
    const messages = [
      ...(history || []).map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
      {
        role: 'user',
        content: `[Contexto del paciente: ${JSON.stringify(patientContext)}]\n\nPregunta: ${message}`,
      },
    ];

    // Call Anthropic API (or use mock for testing without credits)
    let assistantMessage: string;

    // ⚠️ TEMPORARY: Mock responses for MVP demo (no API credits needed)
    // TODO: Remove mock and use real API when credits are available
    const USE_MOCK = true; // Set to false when API key has credits

    if (USE_MOCK) {
      console.log('⚠️ Using MOCK response (Anthropic API disabled for testing)');

      // Generate contextual mock response based on keywords
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('be-fast') || lowerMessage.includes('befast')) {
        assistantMessage = `BE-FAST es un acrónimo que te ayuda a recordar los síntomas principales de un ACV (Accidente Cerebrovascular):

• **B** (Balance): Pérdida súbita del equilibrio o coordinación
• **E** (Eyes/Ojos): Visión borrosa o pérdida súbita de visión
• **F** (Face/Cara): Un lado de la cara caído o entumecido
• **A** (Arm/Brazo): Debilidad o entumecimiento en un brazo
• **S** (Speech/Habla): Dificultad para hablar o entender
• **T** (Time/Tiempo): Tiempo es cerebro - actuar rápido salva vidas

Si notas cualquiera de estos síntomas, llama al 123 inmediatamente. Cada minuto cuenta.`;
      } else if (lowerMessage.includes('prevenir') || lowerMessage.includes('prevencion')) {
        assistantMessage = `Para prevenir un ACV, te recomiendo:

1. **Controla tu presión arterial** - Es el factor de riesgo más importante
2. **Mantén una dieta saludable** - Reduce sal, grasas saturadas y azúcares
3. **Haz ejercicio regularmente** - Al menos 30 minutos al día
4. **No fumes** - El cigarrillo aumenta mucho el riesgo
5. **Controla la diabetes** si la tienes
6. **Toma tus medicamentos** según indicación médica

Recuerda: Alert-IO te ayuda a monitorear estos factores, pero siempre consulta con tu médico para un plan personalizado.`;
      } else if (hasEmergency) {
        assistantMessage = `⚠️ **ATENCIÓN: Detecté síntomas de emergencia en tu mensaje.**

Por favor:
1. **Llama al 123 AHORA**
2. **Presiona el botón SOS rojo** en la pantalla principal de Alert-IO
3. **No conduzcas** - espera la ambulancia o que alguien te lleve

Los síntomas de ACV requieren atención médica inmediata. Cada minuto cuenta para salvar tu vida y reducir daños permanentes.

¿Necesitas que contacte a tu persona de emergencia?`;
      } else if (lowerMessage.includes('sintoma') || lowerMessage.includes('síntoma')) {
        assistantMessage = `Los síntomas principales de un ACV incluyen:

• Cara caída o entumecida en un lado
• Debilidad o pérdida de sensibilidad en brazo o pierna
• Dificultad para hablar o entender
• Visión borrosa o pérdida de visión
• Mareos o pérdida de equilibrio
• Dolor de cabeza severo sin causa conocida

**Importante**: Si experimentas cualquiera de estos síntomas, aunque sea leve, llama al 123. No esperes a que empeore.

Recuerda usar BE-FAST para identificarlos rápidamente.`;
      } else {
        assistantMessage = `Hola, soy tu asistente de salud de Alert-IO. Estoy aquí para ayudarte con información educativa sobre prevención y síntomas de ACV.

Puedo responder preguntas sobre:
• Síntomas de ACV (BE-FAST)
• Prevención y factores de riesgo
• Cuándo buscar ayuda médica
• Cómo usar las funciones de Alert-IO

**Importante**: No proporciono diagnósticos médicos. Para emergencias, llama al 123 o presiona el botón SOS.

¿En qué puedo ayudarte hoy?`;
      }
    } else {
      // Real Anthropic API call
      if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY no está configurada');
      }

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages,
        }),
      });

      if (!anthropicResponse.ok) {
        const error = await anthropicResponse.text();
        console.error('Anthropic API error:', error);
        throw new Error('Error al comunicarse con el servicio de IA');
      }

      const result = await anthropicResponse.json();
      assistantMessage = result.content[0].text;
    }

    // Save user message
    await supabase.from('ai_chat_messages').insert({
      session_id: sessionId,
      patient_id: patientId,
      role: 'user',
      content: message,
      metadata: { has_emergency_keyword: hasEmergency },
    });

    // Save assistant message
    await supabase.from('ai_chat_messages').insert({
      session_id: sessionId,
      patient_id: patientId,
      role: 'assistant',
      content: assistantMessage,
    });

    // Update session
    await supabase
      .from('ai_chat_sessions')
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (history?.length || 0) + 2,
      })
      .eq('id', sessionId);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        message: assistantMessage,
        has_emergency_keyword: hasEmergency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in ai_chat:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Error interno del servidor',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
