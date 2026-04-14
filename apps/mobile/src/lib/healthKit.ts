// HealthKit and Health Connect integration
// Provides unified API for iOS HealthKit and Android Health Connect

import { Platform } from 'react-native';
import { VitalSignType, SmartwatchType } from '../shared';

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
  private AppleHealthKit: any = null;

  private async getKit() {
    if (!this.AppleHealthKit) {
      this.AppleHealthKit = require('react-native-health').default;
    }
    return this.AppleHealthKit;
  }

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    const kit = await this.getKit();
    const permissions = {
      permissions: {
        read: [
          kit.Constants.Permissions.HeartRate,
          kit.Constants.Permissions.BloodPressureDiastolic,
          kit.Constants.Permissions.BloodPressureSystolic,
          kit.Constants.Permissions.OxygenSaturation,
          kit.Constants.Permissions.RespiratoryRate,
          kit.Constants.Permissions.BodyTemperature,
          kit.Constants.Permissions.SleepAnalysis,
          kit.Constants.Permissions.Steps,
          kit.Constants.Permissions.DistanceWalkingRunning,
        ],
        write: [],
      },
    };

    return new Promise((resolve) => {
      kit.initHealthKit(permissions, (error: string) => {
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

    const kit = await this.getKit();
    return new Promise((resolve) => {
      kit.isAvailable((error: any, available: boolean) => {
        resolve(error ? false : available);
      });
    });
  }

  async getLatestHeartRate(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    const kit = await this.getKit();
    return new Promise((resolve) => {
      const options = {
        unit: 'bpm',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      kit.getHeartRateSamples(options, (error: any, results: any[]) => {
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

    const kit = await this.getKit();
    return new Promise((resolve) => {
      const options = {
        unit: 'mmHg',
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      kit.getBloodPressureSamples(options, (error: any, results: any[]) => {
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

    const kit = await this.getKit();
    return new Promise((resolve) => {
      const options = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      };

      kit.getOxygenSaturationSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
          const latest = results[results.length - 1];
          resolve({
            type: VitalSignType.BLOOD_OXYGEN,
            value: latest.value * 100,
            unit: '%',
            measured_at: latest.startDate,
          });
        }
      });
    });
  }

  async getStepsToday(): Promise<VitalSignReading | null> {
    if (!this.isInitialized) return null;

    const kit = await this.getKit();
    return new Promise((resolve) => {
      const options = { date: new Date().toISOString() };

      kit.getStepCount(options, (error: any, results: any) => {
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

    const kit = await this.getKit();
    return new Promise((resolve) => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(20, 0, 0, 0);

      const today = new Date();
      today.setHours(10, 0, 0, 0);

      const options = {
        startDate: yesterday.toISOString(),
        endDate: today.toISOString(),
      };

      kit.getSleepSamples(options, (error: any, results: any[]) => {
        if (error || !results || results.length === 0) {
          resolve(null);
        } else {
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

    return { vital_signs, blood_pressure: bloodPressure };
  }

  async getConnectedWatchInfo(): Promise<{ type: SmartwatchType; name: string; model: string } | null> {
    if (Platform.OS === 'ios') {
      const available = await this.isAvailable();
      if (available) {
        return { type: SmartwatchType.APPLE_WATCH, name: 'Apple Watch', model: 'Unknown' };
      }
    }
    return null;
  }
}

class HealthConnectManager {
  async initialize(): Promise<boolean> {
    return false;
  }

  async getAllLatestVitals(): Promise<HealthData> {
    return { vital_signs: [], blood_pressure: null };
  }

  async getConnectedWatchInfo(): Promise<{ type: SmartwatchType; name: string; model: string } | null> {
    return null;
  }
}

export const healthManager = Platform.OS === 'ios'
  ? new HealthKitManager()
  : new HealthConnectManager();
