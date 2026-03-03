import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '@alert-io/shared';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

// Patient screens
import { PatientOnboardingScreen } from '../screens/patient/PatientOnboardingScreen';
import { PatientHomeScreen } from '../screens/patient/PatientHomeScreen';
import { BeFastCheckScreen } from '../screens/patient/BeFastCheckScreen';
import { EventTimelineScreen } from '../screens/patient/EventTimelineScreen';
import { LocationShareScreen } from '../screens/patient/LocationShareScreen';
import { VitalsMonitorScreen } from '../screens/patient/VitalsMonitorScreen';
import { AIChatScreen } from '../screens/patient/AIChatScreen';

// Caregiver/Clinician screens
import { AlertsInboxScreen } from '../screens/alerts/AlertsInboxScreen';
import { AlertDetailScreen } from '../screens/alerts/AlertDetailScreen';

// Settings screen
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#e74c3c',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="Home"
        component={PatientHomeScreen}
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Vitals"
        component={VitalsMonitorScreen}
        options={{
          title: 'Signos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Timeline"
        component={EventTimelineScreen}
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Location"
        component={LocationShareScreen}
        options={{
          title: 'Ubicación',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AIChat"
        component={AIChatScreen}
        options={{
          title: 'Asistente',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbox-ellipses" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function CaregiverClinicianTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#e74c3c',
        tabBarInactiveTintColor: '#999',
      }}
    >
      <Tab.Screen
        name="Alerts"
        component={AlertsInboxScreen}
        options={{
          title: 'Alertas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user || !profile ? (
          // Auth stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : profile.role === Role.PATIENT ? (
          // Patient stack
          <>
            <Stack.Screen name="PatientOnboarding" component={PatientOnboardingScreen} />
            <Stack.Screen name="PatientTabs" component={PatientTabs} />
            <Stack.Screen name="BeFastCheck" component={BeFastCheckScreen} />
          </>
        ) : (
          // Caregiver/Clinician stack
          <>
            <Stack.Screen name="CaregiverClinicianTabs" component={CaregiverClinicianTabs} />
            <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
