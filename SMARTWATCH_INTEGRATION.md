# 🎗️ Integración con Smartwatches - Alert-IO

Esta guía documenta la integración completa con smartwatches (Apple Watch + Wear OS) añadida al MVP de Alert-IO.

---

## 📱 Funcionalidades Implementadas

### 1. **Monitoreo de Signos Vitales**
- Frecuencia cardíaca (Heart Rate)
- Presión arterial (Blood Pressure)
- Oxígeno en sangre (SpO2)
- Pasos diarios
- Horas de sueño
- Frecuencia respiratoria (opcional)
- Temperatura corporal (opcional)

### 2. **Detección Automática de Caídas**
- Usa el acelerómetro del dispositivo
- Detecta patrones de caída (impacto + quietud)
- Crea alertas HIGH automáticamente
- Captura ubicación al momento de la caída
- Notifica a contactos de emergencia inmediatamente

### 3. **Detección de Anomalías en Salud**
- **Frecuencia cardíaca anormal**:
  - >150 bpm o <40 bpm → Anomalía HIGH
  - Con AFib: >120 bpm o <50 bpm → Anomalía MEDIUM
- **Crisis hipertensiva**:
  - Sistólica >180 o Diastólica >120 → Anomalía HIGH

---

## 🏗️ Arquitectura

### Tablas de Base de Datos (Nuevas)

```sql
-- Dispositivos smartwatch vinculados
smartwatch_devices (
  id, patient_id, device_type, device_name, device_model,
  paired_at, last_sync, is_active
)

-- Signos vitales
vital_signs (
  id, patient_id, smartwatch_device_id, type, value, unit,
  measured_at, created_at
)

-- Lecturas de presión arterial (caso especial)
blood_pressure_readings (
  id, patient_id, smartwatch_device_id,
  systolic, diastolic, pulse, measured_at, created_at
)

-- Detecciones de caídas
fall_detections (
  id, patient_id, smartwatch_device_id, detected_at, confidence,
  lat, lng, accuracy_m, alert_created, alert_id,
  user_dismissed, dismissed_at, created_at
)

-- Anomalías de salud detectadas
health_anomalies (
  id, patient_id, anomaly_type, description, severity, data,
  detected_at, alert_created, alert_id, resolved, resolved_at
)
```

### Edge Functions (Nuevas)

1. **`ingest_vitals`** - Recibe y almacena signos vitales
   - Valida que el usuario sea el paciente
   - Guarda múltiples signos vitales en batch
   - Detecta anomalías automáticamente
   - Actualiza `last_sync` del smartwatch

2. **`report_fall`** - Maneja detección de caídas
   - Crea alerta HIGH inmediatamente
   - Guarda ubicación
   - Notifica a todos los contactos de emergencia
   - Crea registro en `fall_detections`

---

## 📲 Integración por Plataforma

### iOS - HealthKit

**Módulo**: `apps/mobile/src/lib/healthKit.ts`

**Permisos requeridos** (en `app.json`):
```json
"infoPlist": {
  "NSHealthShareUsageDescription": "Alert-IO necesita acceso a tus datos de salud...",
  "NSHealthUpdateUsageDescription": "Alert-IO necesita actualizar tus datos de salud..."
},
"entitlements": {
  "com.apple.developer.healthkit": true
}
```

**Datos que se pueden leer**:
- Heart Rate → `AppleHealthKit.getHeartRateSamples()`
- Blood Pressure → `AppleHealthKit.getBloodPressureSamples()`
- Oxygen Saturation → `AppleHealthKit.getOxygenSaturationSamples()`
- Steps → `AppleHealthKit.getStepCount()`
- Sleep Analysis → `AppleHealthKit.getSleepSamples()`

**Cómo funciona**:
1. Usuario abre pantalla "Signos Vitales"
2. App inicializa HealthKit y solicita permisos
3. Usuario vincula Apple Watch (automático si está pareado)
4. Usuario presiona "Sincronizar Datos"
5. App lee últimos datos (últimas 24 horas)
6. Envía a Edge Function `ingest_vitals`
7. Datos se guardan en DB y se muestran en UI

### Android - Health Connect (Placeholder)

**Módulo**: `apps/mobile/src/lib/healthKit.ts` (HealthConnectManager)

**Estado**: Implementación básica. Requiere:
- `@react-native-community/google-fit` o
- `react-native-health-connect`

**Datos disponibles**:
- Heart Rate
- Blood Pressure
- SpO2
- Steps
- Sleep Duration

**Por implementar en producción**:
1. Instalar dependencia Health Connect
2. Configurar permisos en `AndroidManifest.xml`
3. Implementar métodos de lectura
4. Detectar Wear OS watch pareado

---

## 🚨 Detección de Caídas

### Cómo Funciona

**Módulo**: `apps/mobile/src/lib/fallDetection.ts`

1. **Activación**:
   - Usuario activa en pantalla "Signos Vitales"
   - O se activa automáticamente al vincular smartwatch

2. **Monitoreo**:
   - Lee acelerómetro a 10 Hz (cada 100ms)
   - Calcula magnitud del vector de aceleración: `√(x² + y² + z²)`

3. **Detección de Patrón**:
   - **Impacto**: Magnitud > 2.5 G (umbral de caída)
   - **Quietud**: Después del impacto, magnitud cercana a 1.0 G por 3 segundos

4. **Cuando se Detecta Caída**:
   - Obtiene ubicación GPS
   - Llama Edge Function `report_fall`
   - Crea alerta HIGH
   - Notifica a contactos
   - Muestra notificación local: "¿Estás bien?" con countdown de 30s

5. **Usuario Puede Cancelar**:
   - Presiona "Estoy bien" en notificación
   - Se marca `user_dismissed = true`
   - No se crea alerta

### Cooldown

- **1 minuto** entre detecciones para evitar falsos positivos múltiples

### Limitaciones

- **No reemplaza detección nativa**: Apple Watch Series 4+ tiene detección de caídas nativa mucho más precisa
- **Falsos positivos**: Actividades bruscas (saltar, correr) pueden disparar detección
- **Batería**: Monitoreo continuo consume batería

---

## 🖥️ Pantalla de Monitoreo (Paciente)

**Ruta**: `apps/mobile/src/screens/patient/VitalsMonitorScreen.tsx`

### Elementos UI:

1. **Tarjeta de Smartwatch**:
   - Muestra smartwatch vinculado
   - Última sincronización
   - Botón "Vincular Smartwatch" si no hay ninguno

2. **Botón de Sincronización**:
   - "🔄 Sincronizar Datos"
   - Obtiene datos de HealthKit/Health Connect
   - Envía a backend

3. **Grid de Signos Vitales**:
   - 6 tarjetas: ❤️ Frecuencia Cardíaca, 🩺 Presión Arterial, 🫁 Oxígeno, 👣 Pasos, 😴 Sueño
   - Cada tarjeta muestra: valor + unidad + timestamp

4. **Detección de Caídas**:
   - Toggle para activar/desactivar
   - Indica si está activo

5. **Pull to Refresh**:
   - Refresca datos desde DB

---

## 🧪 Pruebas End-to-End

### Escenario 1: Vincular Apple Watch y Sincronizar Datos

1. **Requisitos**:
   - iPhone con Apple Watch pareado
   - Apple Watch con HealthKit activado
   - App instalada en iPhone

2. **Pasos**:
   - Login como paciente
   - Ir a pestaña "Signos"
   - Presionar "Vincular Smartwatch"
   - Aceptar permisos de HealthKit
   - Presionar "Sincronizar Datos"
   - Verificar que datos aparecen en tarjetas

3. **Resultado Esperado**:
   - Smartwatch aparece como "Apple Watch • Conectado"
   - Signos vitales muestran valores recientes
   - Timestamp indica cuándo fue la última lectura

### Escenario 2: Detección de Caída

1. **Setup**:
   - Activar "Detección de Caídas" en app
   - Tener GPS habilitado

2. **Simular Caída**:
   - Dejar caer el teléfono desde 1 metro (¡con cuidado!)
   - O agitar bruscamente el teléfono y dejarlo quieto

3. **Resultado Esperado**:
   - Consola muestra: "Fall detected!"
   - Alerta HIGH creada en DB
   - Notificaciones enviadas a contactos
   - (En producción: notificación local con countdown)

4. **Verificar en Web**:
   - Login como clínico
   - Ver inbox → nueva alerta HIGH "fall_detection"
   - Ver detalle → ubicación disponible

### Escenario 3: Anomalía de Frecuencia Cardíaca

1. **Setup**:
   - Paciente con AFib en factores de riesgo

2. **Simular**:
   - Usar HealthKit para ingresar lectura de FC = 160 bpm
   - O modificar función `check_heart_rate_anomalies` para threshold más bajo

3. **Resultado Esperado**:
   - Al sincronizar datos, se detecta anomalía
   - Registro en `health_anomalies`
   - (En producción: notificación al paciente/clínico)

---

## 📦 Dependencias Añadidas

### Mobile (`apps/mobile/package.json`)

```json
"react-native-health": "^1.19.0",
"expo-sensors": "~13.0.0"
```

### Instalación

```bash
cd apps/mobile
pnpm install

# Para iOS, instalar pods
cd ios
pod install
cd ..
```

---

## ⚙️ Configuración Adicional

### iOS - Permisos de HealthKit

**Automático con Expo**. Si usas bare workflow:

1. Agregar en `Info.plist`:
```xml
<key>NSHealthShareUsageDescription</key>
<string>Alert-IO necesita acceso a tus datos de salud...</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Alert-IO necesita actualizar tus datos de salud...</string>
```

2. Agregar capability en Xcode:
   - Target → Signing & Capabilities → + Capability → HealthKit

### Android - Permisos

```xml
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.BODY_SENSORS" />
```

---

## 🚀 Comandos para Ejecutar con Smartwatch

### Desarrollo Local

```bash
# Terminal 1: Supabase
supabase start

# Terminal 2: Mobile (iOS con HealthKit)
pnpm mobile
# Presiona 'i' para iOS
# Nota: HealthKit NO funciona en simulador, requiere dispositivo físico

# Terminal 3: Web
pnpm dev
```

### Testing en Dispositivo Real

```bash
# Instalar Expo Go en iPhone
# Escanear QR code desde terminal

# O build development
npx expo run:ios --device
```

---

## 🔒 Seguridad y Privacidad

### Datos de Salud

- **HealthKit** es propiedad del usuario y está encriptado end-to-end por Apple
- Alert-IO **solo lee** datos, no escribe
- Datos se sincronizan **bajo demanda** (no automáticamente en background por defecto)
- Usuario controla permisos granulares en Configuración iOS

### Row Level Security

- `vital_signs`, `blood_pressure_readings`, `fall_detections`: Solo paciente y usuarios con consentimiento
- Edge Functions usan `SECURITY DEFINER` para operaciones privilegiadas
- Validación estricta: paciente solo puede ingresar sus propios datos

---

## 🐛 Troubleshooting

### HealthKit no se inicializa

**Error**: `Error initializing HealthKit`

**Solución**:
1. Verificar que app corre en dispositivo físico (no simulador)
2. Verificar que HealthKit está habilitado en Settings → Privacy → Health
3. Verificar que app tiene capability HealthKit en Xcode

### Detección de caídas no funciona

**Error**: `Accelerometer not available`

**Solución**:
1. Verificar permisos de sensores en Settings
2. En iOS, algunos modelos antiguos no tienen acelerómetro
3. Verificar que `expo-sensors` está instalado correctamente

### Datos no se sincronizan

**Error**: `No hay datos nuevos disponibles`

**Solución**:
1. Verificar que Apple Watch está sincronizado con iPhone (Health app)
2. Hacer actividad física o registrar datos manualmente en Health app
3. Verificar que permisos de HealthKit están concedidos para todas las categorías

---

## 📊 Base de Datos - Queries Útiles

### Ver últimos signos vitales de un paciente

```sql
SELECT * FROM get_latest_vital_signs('patient-uuid-here', 24);
```

### Ver caídas detectadas (no descartadas)

```sql
SELECT * FROM fall_detections
WHERE user_dismissed = false
ORDER BY detected_at DESC;
```

### Ver anomalías no resueltas

```sql
SELECT * FROM health_anomalies
WHERE resolved = false
ORDER BY detected_at DESC;
```

### Ver smartwatches activos

```sql
SELECT
  sw.device_name,
  sw.device_type,
  p.full_name AS patient_name,
  sw.last_sync
FROM smartwatch_devices sw
JOIN profiles p ON p.id = sw.patient_id
WHERE sw.is_active = true
ORDER BY sw.last_sync DESC;
```

---

## 🎯 Roadmap Futuro

### Corto Plazo
- [ ] Health Connect completo para Android
- [ ] Wear OS app companion nativa
- [ ] Sincronización automática en background (respetando límites del OS)
- [ ] Notificación local avanzada para caídas (con countdown + botones)
- [ ] Gráficos de tendencia de signos vitales

### Mediano Plazo
- [ ] Apple Watch app nativa (WatchOS)
- [ ] Detección de AFib usando HealthKit ECG
- [ ] Recordatorios de medicamentos con confirmación
- [ ] Alertas proactivas por tendencias (FC aumentando gradualmente)

### Largo Plazo
- [ ] Machine Learning para detección de patrones pre-ACV
- [ ] Integración con dispositivos médicos certificados (FDA/CE)
- [ ] Algoritmos avanzados de detección de caídas (giroscopio + ML)
- [ ] Integración con servicios de emergencia (911/123)

---

## 📖 Referencias

- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [React Native Health Library](https://github.com/agencyenterprise/react-native-health)
- [Health Connect (Android)](https://developer.android.com/health-and-fitness/guides/health-connect)
- [Expo Sensors](https://docs.expo.dev/versions/latest/sdk/sensors/)

---

**🎗️ Esta integración convierte Alert-IO en una herramienta proactiva de monitoreo que puede salvar vidas.**
