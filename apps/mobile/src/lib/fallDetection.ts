// Fall detection using device accelerometer
// Monitors acceleration patterns to detect potential falls

import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import Constants from 'expo-constants';

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

class FallDetectionService {
  private subscription: any = null;
  private isMonitoring = false;
  private patientId: string | null = null;
  private smartwatchDeviceId: string | null = null;

  // Fall detection thresholds
  private readonly FALL_THRESHOLD = 2.5; // G-force threshold
  private readonly IMPACT_DURATION_MS = 500; // Time window for impact detection
  private readonly STILLNESS_THRESHOLD = 0.5; // G-force threshold for stillness
  private readonly STILLNESS_DURATION_MS = 3000; // Duration of stillness after impact

  private recentReadings: AccelerometerData[] = [];
  private lastFallDetectionTime = 0;
  private readonly COOLDOWN_MS = 60000; // 1 minute cooldown between detections

  constructor() {}

  async startMonitoring(patientId: string, smartwatchDeviceId?: string) {
    if (this.isMonitoring) {
      console.warn('Fall detection already running');
      return;
    }

    this.patientId = patientId;
    this.smartwatchDeviceId = smartwatchDeviceId || null;

    // Check if accelerometer is available
    const available = await Accelerometer.isAvailableAsync();
    if (!available) {
      console.error('Accelerometer not available on this device');
      return;
    }

    // Set update interval (100ms = 10Hz)
    Accelerometer.setUpdateInterval(100);

    // Subscribe to accelerometer updates
    this.subscription = Accelerometer.addListener((data) => {
      this.processAccelerometerData(data);
    });

    this.isMonitoring = true;
    console.log('Fall detection started');
  }

  stopMonitoring() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }

    this.isMonitoring = false;
    this.recentReadings = [];
    console.log('Fall detection stopped');
  }

  private processAccelerometerData(data: AccelerometerData) {
    // Calculate magnitude of acceleration vector
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // Store reading with timestamp
    this.recentReadings.push({
      ...data,
      magnitude,
      timestamp: Date.now(),
    } as any);

    // Keep only last 5 seconds of data
    const fiveSecondsAgo = Date.now() - 5000;
    this.recentReadings = this.recentReadings.filter((r: any) => r.timestamp > fiveSecondsAgo);

    // Detect fall pattern
    this.detectFallPattern(magnitude);
  }

  private async detectFallPattern(currentMagnitude: number) {
    // Cooldown check
    if (Date.now() - this.lastFallDetectionTime < this.COOLDOWN_MS) {
      return;
    }

    // Check for high-impact event (fall)
    if (currentMagnitude > this.FALL_THRESHOLD) {
      console.log('High impact detected:', currentMagnitude);

      // Wait a bit to check for stillness after impact
      setTimeout(async () => {
        const isStill = await this.checkStillness();

        if (isStill) {
          console.log('Fall detected! User appears to be still after impact.');
          this.lastFallDetectionTime = Date.now();
          await this.handleFallDetected();
        }
      }, this.IMPACT_DURATION_MS);
    }
  }

  private async checkStillness(): Promise<boolean> {
    // Check if user has been relatively still for the last few seconds
    const recentReadings = this.recentReadings.filter(
      (r: any) => r.timestamp > Date.now() - this.STILLNESS_DURATION_MS
    );

    if (recentReadings.length === 0) return false;

    const avgMagnitude =
      recentReadings.reduce((sum: number, r: any) => sum + r.magnitude, 0) / recentReadings.length;

    // Check if average magnitude is close to 1G (resting)
    return Math.abs(avgMagnitude - 1.0) < this.STILLNESS_THRESHOLD;
  }

  private async handleFallDetected() {
    if (!this.patientId) return;

    try {
      // Get location
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          location = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy_m: loc.coords.accuracy || 0,
          };
        }
      } catch (e) {
        console.warn('Failed to get location for fall detection:', e);
      }

      // Report fall to Edge Function
      const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/report_fall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          patient_id: this.patientId,
          smartwatch_device_id: this.smartwatchDeviceId,
          fall_data: {
            detected_at: new Date().toISOString(),
            confidence: 0.85, // High confidence from device accelerometer
            ...location,
          },
        }),
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Fall reported successfully:', result);
        // Show notification to user
        this.showFallDetectedAlert();
      } else {
        console.error('Failed to report fall:', result.error);
      }
    } catch (error) {
      console.error('Error handling fall detection:', error);
    }
  }

  private showFallDetectedAlert() {
    // In production, show a local notification with:
    // - "Fall detected! Are you OK?"
    // - Countdown timer (30 seconds)
    // - "I'm OK" button to dismiss
    // - "Call Emergency" button
    // If no response after 30s, automatically create HIGH alert

    console.log('FALL DETECTED ALERT - Would show notification here');

    // TODO: Implement with expo-notifications
    // Show local notification with action buttons
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      patientId: this.patientId,
      recentReadingsCount: this.recentReadings.length,
    };
  }
}

// Singleton instance
export const fallDetectionService = new FallDetectionService();
