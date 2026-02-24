// Database enums matching Supabase schema

export enum Role {
  PATIENT = 'patient',
  CAREGIVER = 'caregiver',
  CLINICIAN = 'clinician',
  ADMIN = 'admin'
}

export enum ConsentScope {
  READ_PROFILE = 'read_profile',
  READ_EVENTS = 'read_events',
  RECEIVE_ALERTS = 'receive_alerts'
}

export enum EventType {
  CHECKIN = 'checkin',
  SOS = 'sos',
  SYMPTOM_REPORT = 'symptom_report',
  LOCATION_PING = 'location_ping',
  ALERT_STATUS_CHANGE = 'alert_status_change'
}

export enum AlertStatus {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  ESCALATED = 'escalated',
  CLOSED = 'closed'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum Sex {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export enum NotificationChannel {
  PUSH = 'push',
  SMS = 'sms',
  EMAIL = 'email'
}

export enum SmartwatchType {
  APPLE_WATCH = 'apple_watch',
  WEAR_OS = 'wear_os',
  OTHER = 'other'
}

export enum VitalSignType {
  HEART_RATE = 'heart_rate',
  BLOOD_PRESSURE = 'blood_pressure',
  BLOOD_OXYGEN = 'blood_oxygen',
  RESPIRATORY_RATE = 'respiratory_rate',
  TEMPERATURE = 'temperature',
  SLEEP_HOURS = 'sleep_hours',
  STEPS = 'steps',
  DISTANCE_M = 'distance_m'
}
