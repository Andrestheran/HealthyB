import { Alert, Linking } from 'react-native';

export const EMERGENCY_KEYWORDS_ES = [
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

export function detectEmergencyKeywords(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return EMERGENCY_KEYWORDS_ES.some((keyword) => lowerMessage.includes(keyword));
}

export function showEmergencyAlert(navigation: any) {
  Alert.alert(
    '🚨 Síntomas de Emergencia Detectados',
    'Los síntomas que describes requieren atención médica inmediata.\n\n¿Qué deseas hacer?',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Activar SOS',
        style: 'destructive',
        onPress: () => {
          navigation.navigate('Home');
          // SOS logic would be triggered from Home screen
        },
      },
      {
        text: 'Llamar 123',
        onPress: () => Linking.openURL('tel:123'),
      },
    ]
  );
}
