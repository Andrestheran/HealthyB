import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '@acv-guard/shared';

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

// Caregiver/Clinician screens
import { AlertsInboxScreen } from '../screens/alerts/AlertsInboxScreen';
import { AlertDetailScreen } from '../screens/alerts/AlertDetailScreen';

// Settings screen
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function PatientTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={PatientHomeScreen} options={{ title: 'Inicio' }} />
      <Tab.Screen name="Vitals" component={VitalsMonitorScreen} options={{ title: 'Signos' }} />
      <Tab.Screen name="Timeline" component={EventTimelineScreen} options={{ title: 'Historial' }} />
      <Tab.Screen name="Location" component={LocationShareScreen} options={{ title: 'Ubicación' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}

function CaregiverClinicianTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Alerts" component={AlertsInboxScreen} options={{ title: 'Alertas' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
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
