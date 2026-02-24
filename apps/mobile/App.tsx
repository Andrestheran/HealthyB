import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { queryClient } from './src/lib/queryClient';
import { registerForPushNotificationsAsync, saveDeviceToken } from './src/lib/notifications';
import * as Notifications from 'expo-notifications';

export default function App() {
  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        console.log('Expo Push Token:', token);
        // Save token will be called after auth is established
      }
    });

    // Handle foreground notifications
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
    });

    // Handle notification taps
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      // Navigate to relevant screen based on notification data
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
