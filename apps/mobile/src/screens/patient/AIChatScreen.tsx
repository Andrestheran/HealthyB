import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAIChat } from '../../hooks/useAIChat';
import { detectEmergencyKeywords, showEmergencyAlert } from '../../lib/emergencyDetection';
import { AIChatMessage } from '@alert-io/shared';

export function AIChatScreen({ navigation }: any) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { session, messages, messagesLoading, sendMessage, refetchMessages } =
    useAIChat(sessionId);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  async function handleSend() {
    if (!message.trim()) return;

    const trimmedMessage = message.trim();

    // Check for emergency keywords
    const hasEmergency = detectEmergencyKeywords(trimmedMessage);
    if (hasEmergency) {
      showEmergencyAlert(navigation);
    }

    // Clear input immediately for better UX
    const messageToSend = trimmedMessage;
    setMessage('');

    try {
      const result = await sendMessage.mutateAsync({
        message: messageToSend,
        currentSessionId: sessionId,
      });

      // Set session ID if this is the first message
      if (!sessionId && result.session_id) {
        setSessionId(result.session_id);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'No se pudo enviar el mensaje');
      // Restore message if there was an error
      setMessage(messageToSend);
    }
  }

  function renderEmptyState() {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>🤖</Text>
        <Text style={styles.emptyStateTitle}>Asistente de Salud</Text>
        <Text style={styles.emptyStateDescription}>
          Hola, soy tu asistente de salud. Puedo ayudarte a entender síntomas de ACV y responder
          preguntas sobre tu salud.
        </Text>

        <View style={styles.suggestedQuestions}>
          <Text style={styles.suggestedTitle}>Preguntas sugeridas:</Text>
          {[
            '¿Qué es BE-FAST?',
            '¿Cómo prevenir un ACV?',
            '¿Qué hacer en una emergencia?',
          ].map((q) => (
            <TouchableOpacity
              key={q}
              style={styles.suggestionButton}
              onPress={() => {
                setMessage(q);
                // Don't auto-send, let user review and send
              }}
            >
              <Text style={styles.suggestionText}>{q}</Text>
              <Ionicons name="arrow-forward" size={16} color="#3498db" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  function renderMessage({ item }: { item: AIChatMessage }) {
    const isUser = item.role === 'user';
    const hasEmergencyKeyword = item.metadata?.has_emergency_keyword;

    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {hasEmergencyKeyword && (
          <View style={styles.emergencyBadge}>
            <Text style={styles.emergencyBadgeText}>⚠️ Emergencia detectada</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    );
  }

  function renderInfoModal() {
    if (!showInfo) return null;

    return (
      <View style={styles.infoModal}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>Sobre el Asistente</Text>
            <TouchableOpacity onPress={() => setShowInfo(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.infoSection}>✅ Puedo ayudarte con:</Text>
          <Text style={styles.infoItem}>• Explicar síntomas de ACV (BE-FAST)</Text>
          <Text style={styles.infoItem}>• Consejos de prevención</Text>
          <Text style={styles.infoItem}>• Información sobre factores de riesgo</Text>

          <Text style={styles.infoSection}>❌ No puedo:</Text>
          <Text style={styles.infoItem}>• Diagnosticar enfermedades</Text>
          <Text style={styles.infoItem}>• Reemplazar a tu médico</Text>
          <Text style={styles.infoItem}>• Recetar medicamentos</Text>

          <Text style={styles.infoWarning}>
            ⚠️ En caso de emergencia, llama al 123 o presiona el botón SOS en la pantalla de
            inicio.
          </Text>

          <TouchableOpacity style={styles.infoButton} onPress={() => setShowInfo(false)}>
            <Text style={styles.infoButtonText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderInfoModal()}

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Asistente de Salud</Text>
          <Text style={styles.subtitle}>Información educativa sobre ACV</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.infoIcon}>
          <Ionicons name="information-circle-outline" size={28} color="#3498db" />
        </TouchableOpacity>
      </View>

      {messagesLoading && !messages.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Cargando conversación...</Text>
        </View>
      ) : messages.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      )}

      {sendMessage.isPending && (
        <View style={styles.typingIndicator}>
          <ActivityIndicator size="small" color="#666" />
          <Text style={styles.typingText}>El asistente está escribiendo...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe tu pregunta aquí..."
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          editable={!sendMessage.isPending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!message.trim() || sendMessage.isPending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!message.trim() || sendMessage.isPending}
        >
          <Ionicons
            name="send"
            size={24}
            color={!message.trim() || sendMessage.isPending ? '#ccc' : '#fff'}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.charCount}>
        {message.length}/500
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  infoIcon: {
    padding: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  suggestedQuestions: {
    width: '100%',
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  suggestionText: {
    fontSize: 14,
    color: '#3498db',
    flex: 1,
  },
  messageList: {
    padding: 15,
  },
  messageContainer: {
    marginBottom: 15,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#3498db',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  emergencyBadge: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  emergencyBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingBottom: 5,
  },
  typingText: {
    marginLeft: 10,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ddd',
  },
  charCount: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  infoModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  infoSection: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    paddingLeft: 10,
  },
  infoWarning: {
    fontSize: 13,
    color: '#e74c3c',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    lineHeight: 20,
  },
  infoButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
