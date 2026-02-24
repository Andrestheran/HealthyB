// HealthKit and Health Connect integration
// Provides unified API for iOS HealthKit and Android Health Connect

import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';
import { VitalSignType, SmartwatchType } from '@acv-guard/shared';

// Health permissions
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.BloodPressureDiastolic,
      AppleHealthKit.Constants.Permissions.BloodPressureSystolic,
      AppleHealthKit.Constants.Permissions.OxygenSaturation,
      AppleHealthKit.Constants.Permissions.RespiratoryRate,
      AppleHealthKit.Constants.Permissions.BodyTemperature,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
    ],
    write: [],
  },
};

export interface VitalSignReading {
  type: VitalSignType;
  value: number;
  unit: string;
  measured_at: string;
}

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  pulse?: number;
  measured_at: string;
}

export interface HealthData {
  vital_signs: VitalSignReading[];
  blood_pressure: BloodPressureReading | null;
}

class HealthKitManager {
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('HealthKit is only available on iOS');
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (error: string) => {
        if (error) {
          console.error('Error initializing HealthKit:', error);
          resolve(false);
        } else {
          this.isInitialized = true;
          resolve(true);
        }
      });
    });
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((error: any, available: boolean) => {
        if (error) {
          resolve(false);
        } else {
          resolve(available);
        }
      });
    });
  }

  async getLatestHeartRate(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    return new Promise((resolve) => {
      const options = {
        unit: 'bpm',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      AppleHealthKit.getHeartRateSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          const latest = results[results.length - 1];
          resolve({
            type: VitalSignType.HEART_RATE,
            value: latest.value,
            unit: 'bpm',
            measured_at: latest.startDate,
          });
        }
      });
    });
  }

  async getLatestBloodPressure(): Promise<BloodPressureReading | null> {
    if (!this.isInitialized) return null;

    return new Promise((resolve) => {
      const options = {
        unit: 'mmHg',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      AppleHealthKit.getBloodPressureSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          const latest = results[results.length - 1];
          resolve({
            systolic: latest.bloodPressureSystolicValue,
            diastolic: latest.bloodPressureDiastolicValue,
            measured_at: latest.startDate,
          });
        }
      });
    });
  }

  async getLatestOxygenSaturation(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    return new Promise((resolve) => {
      const options = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      AppleHealthKit.getOxygenSaturationSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          const latest = results[results.length - 1];
          resolve({
            type: VitalSignType.BLOOD_OXYGEN,
            value: latest.value * 100, // Convert to percentage
            unit: '%',
            measured_at: latest.startDate,
          });
        }
      });
    });
  }

  async getStepsToday(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    return new Promise((resolve) => {
      const options = {
        date: new Date().toISOString(),
      };

      AppleHealthKit.getStepCount(options, (error: any, results: any) => {
        if (error || !results) {
          resolve(null);
        } else {
          resolve({
            type: VitalSignType.STEPS,
            value: results.value,
            unit: 'steps',
            measured_at: new Date().toISOString(),
          });
        }
      });
    });
  }

  async getSleepHoursLastNight(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    return new Promise((resolve) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(20, 0, 0, 0); // 8 PM yesterday

      const today = new Date();
      today.setHours(10, 0, 0, 0); // 10 AM today

      const options = {
        startDate: yesterday.toISOString(),
        endDate: today.toISOString(),
      };

      AppleHealthKit.getSleepSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          // Calculate total sleep hours
          let totalMinutes = 0;
          results.forEach((sample: any) => {
            if (sample.value === 'ASLEEP' || sample.value === 'INBED') {
              const start = new Date(sample.startDate).getTime();
              const end = new Date(sample.endDate).getTime();
              totalMinutes += (end - start) / (1000 * 60);
            }
          });

          resolve({
            type: VitalSignType.SLEEP_HOURS,
            value: totalMinutes / 60,
            unit: 'hours',
            measured_at: today.toISOString(),
          });
        }
      });
    });
  }

  async getAllLatestVitals(): Promise<HealthData> {
    const [heartRate, bloodPressure, oxygenSaturation, steps, sleepHours] = await Promise.all([
      this.getLatestHeartRate(),
      this.getLatestBloodPressure(),
      this.getLatestOxygenSaturation(),
      this.getStepsToday(),
      this.getSleepHoursLastNight(),
    ]);

    const vital_signs: VitalSignReading[] = [];

    if (heartRate) vital_signs.push(heartRate);
    if (oxygenSaturation) vital_signs.push(oxygenSaturation);
    if (steps) vital_signs.push(steps);
    if (sleepHours) vital_signs.push(sleepHours);

    return {
      vital_signs,
      blood_pressure: bloodPressure,
    };
  }

  async getConnectedWatchInfo(): Promise<{ type: SmartwatchType; name: string; model: string } | null> {
    // For iOS, check if Apple Watch is paired
    // This is a simplified check - in production you'd use WatchConnectivity
    if (Platform.OS === 'ios') {
      const available = await this.isAvailable();
      if (available) {
        return {
          type: SmartwatchType.APPLE_WATCH,
          name: 'Apple Watch',
          model: 'Unknown', // Would need WatchConnectivity to get actual model
        };
      }
    }

    return null;
  }
}

// For Android - Health Connect integration (placeholder)
// In production, implement using @react-native-community/google-fit or react-native-health-connect
class HealthConnectManager {
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    // TODO: Implement Health Connect initialization
    console.warn('Health Connect not yet implemented');
    return false;
  }

  async getAllLatestVitals(): Promise<HealthData> {
    // TODO: Implement Health Connect data fetching
    return {
      vital_signs: [],
      blood_pressure: null,
    };
  }

  async getConnectedWatchInfo(): Promise<{ type: SmartwatchType; name: string; model: string } | null> {
    // TODO: Implement Wear OS watch detection
    return null;
  }
}

// Unified API
export const healthManager = Platform.OS === 'ios'
  ? new HealthKitManager()
  : new HealthConnectManager();
