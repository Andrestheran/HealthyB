import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AIChatMessage, AIChatSession } from '@alert-io/shared';
import Constants from 'expo-constants';

export function useAIChat(sessionId?: string | null) {
  const queryClient = useQueryClient();

  // Fetch active session
  const { data: session } = useQuery({
    queryKey: ['ai_chat_session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error) throw error;
      return data as AIChatSession;
    },
    enabled: !!sessionId,
  });

  // Fetch messages
  const {
    data: messages,
    refetch: refetchMessages,
    isLoading: messagesLoading,
  } = useQuery({
    queryKey: ['ai_chat_messages', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as AIChatMessage[];
    },
    enabled: !!sessionId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({
      message,
      currentSessionId,
    }: {
      message: string;
      currentSessionId?: string | null;
    }) => {
      const supabaseUrl =
        Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai_chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message,
          session_id: currentSessionId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar mensaje');
      }
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai_chat_messages', data.session_id] });
      queryClient.invalidateQueries({ queryKey: ['ai_chat_session', data.session_id] });
    },
  });

  return {
    session,
    messages: messages || [],
    messagesLoading,
    sendMessage,
    refetchMessages,
  };
}
