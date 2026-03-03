# Alert-IO MVP

Alert-IO es una aplicación móvil (iOS/Android) para monitoreo de riesgo de ACV (accidente cerebrovascular), con un portal web mínimo para cuidadores y clínicos. Este MVP incluye:

- **Aplicación móvil principal** (React Native + Expo)
- **Portal web secundario** (Next.js) para alertas
- **Backend completo** (Supabase: Postgres + Auth + RLS + Edge Functions)
- **Integración con smartwatches** (Apple Watch + Wear OS) ⌚
- **Detección automática de caídas** 🚨
- **Monitoreo de signos vitales** (FC, presión arterial, SpO2, etc.) ❤️
- **Notificaciones push** (Expo Push)
- **Compartir ubicación** para emergencias

**IMPORTANTE:** Esta aplicación NO es una herramienta de diagnóstico médico. Es un sistema de monitoreo y alertas para apoyo a pacientes en riesgo de ACV.

---

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar en Desarrollo](#ejecutar-en-desarrollo)
- [Integración con Smartwatches](#integración-con-smartwatches)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Cuentas Demo](#cuentas-demo)
- [Flujo de Usuario](#flujo-de-usuario)
- [Pruebas End-to-End](#pruebas-end-to-end)
- [Limitaciones y Próximos Pasos](#limitaciones-y-próximos-pasos)

---

## 🏗️ Arquitectura

### Stack Tecnológico

- **Móvil**: React Native (Expo) + TypeScript
- **Web**: Next.js 14 (App Router) + TypeScript
- **Backend**: Supabase (Postgres, Auth, RLS, Edge Functions)
- **Smartwatch**: HealthKit (iOS) + Health Connect (Android)
- **Sensores**: Acelerómetro para detección de caídas
- **Notificaciones**: Expo Push Notifications
- **Validación**: Zod
- **Data Fetching**: TanStack Query (React Query)
- **Monorepo**: pnpm workspaces

### Base de Datos

- **Postgres** con Row Level Security (RLS)
- **Enums**: roles, estados de alerta, severidad, tipos de eventos, tipos de signos vitales
- **Tablas principales**:
  - `profiles` - Usuario + rol
  - `patients` - Datos del paciente
  - `patient_risk_factors` - Factores de riesgo (HTN, diabetes, AFib, etc.)
  - `medications` - Medicamentos
  - `allergies` - Alergias
  - `emergency_contacts` - Contactos de emergencia
  - `consents` - Permisos para cuidadores/clínicos
  - `events` - Línea de tiempo de eventos
  - `alerts` - Alertas generadas
  - `alert_recipients` - Destinatarios de alertas
  - `locations` - Última ubicación conocida
  - `devices` - Tokens de push notification
  - **`smartwatch_devices`** - Dispositivos vinculados ⌚
  - **`vital_signs`** - Signos vitales (FC, SpO2, pasos, etc.)
  - **`blood_pressure_readings`** - Lecturas de presión arterial
  - **`fall_detections`** - Caídas detectadas automáticamente
  - **`health_anomalies`** - Anomalías detectadas (FC anormal, crisis hipertensiva)

### Edge Functions (Supabase)

1. **create_alert** - Crea alertas desde SOS, BE-FAST, o reporte de síntomas
2. **update_alert_status** - Actualiza estado de alertas (acknowledged, escalated, closed)
3. **ingest_location** - Guarda ubicación del paciente
4. **ingest_vitals** - Recibe y almacena signos vitales desde smartwatches ⌚
5. **report_fall** - Maneja detección de caídas y crea alertas HIGH 🚨

### Lógica de Alertas

- **SOS**: siempre crea alerta HIGH
- **Caída detectada**: siempre crea alerta HIGH 🚨
- **BE-FAST check-in**:
  - Síntomas mayores (Face, Arm, Speech) → HIGH
  - 2+ síntomas menores (Balance, Eyes) O AFib + cualquier síntoma → MEDIUM
  - Otros casos → LOW (solo registra evento, sin alerta)
- **Reporte de síntomas**: MEDIUM por defecto
- **Anomalías de salud**:
  - FC >150 o <40 bpm → HIGH
  - Presión arterial >180/120 → HIGH (crisis hipertensiva)
  - FC anormal con AFib → MEDIUM

---

## 📦 Requisitos Previos

1. **Node.js** >= 18
2. **pnpm** >= 8 (instalar con `npm install -g pnpm`)
3. **Supabase CLI** (instalar con `brew install supabase/tap/supabase` o ver [docs](https://supabase.com/docs/guides/cli))
4. **Docker Desktop** (para Supabase local) - [Descargar aquí](https://www.docker.com/products/docker-desktop)
5. **Expo CLI** (se instala automáticamente)
6. **iOS Simulator** (macOS) o **Android Studio** para emuladores

### Para Smartwatch (Opcional)
- **iPhone físico** + **Apple Watch** pareado (HealthKit no funciona en simulador)
- **Android físico** con Wear OS (para Health Connect)

---

## 🚀 Instalación

### 1. Instalar dependencias

```bash
# En la raíz del proyecto
cd /Users/andrestheran/Desktop/HB
pnpm install
```

Esto instalará todas las dependencias del monorepo (móvil, web, shared).

### 2. Iniciar Docker Desktop

```bash
# Abrir Docker Desktop
open /Applications/Docker.app

# Esperar 30-60 segundos a que inicie
```

### 3. Iniciar Supabase local

```bash
# Iniciar Supabase (primera vez toma 5-10 minutos)
supabase start
```

**⚠️ Primera vez**: Descarga imágenes de Docker (~2GB). Espera pacientemente.

**✅ Cuando termine, verás**:

```
Started supabase local development setup.

╭──────────────────────────────────────╮
│ 🔧 Development Tools                 │
├─────────┬────────────────────────────┤
│ Studio  │ http://127.0.0.1:54323     │
╰─────────┴────────────────────────────╯

╭──────────────────────────────────────────────────────╮
│ 🌐 APIs                                              │
├────────────────┬─────────────────────────────────────┤
│ Project URL    │ http://127.0.0.1:54321              │
╰────────────────┴─────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────╮
│ 🔑 Authentication Keys                                       │
├─────────────┬────────────────────────────────────────────────┤
│ Publishable │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...       │
│ Secret      │ [Tu secret key - solo para desarrollo local]  │
╰─────────────┴────────────────────────────────────────────────╯
```

**🔑 IMPORTANTE**: Copia el **Publishable key** (equivalente al "anon key"). Lo necesitarás en el siguiente paso.

### 4. Verificar migraciones

```bash
# Ver migraciones aplicadas
supabase migration list

# Deberías ver 4 migraciones:
# - 20240101000000_initial_schema.sql
# - 20240101000001_rls_policies.sql
# - 20240101000002_helper_functions.sql
# - 20240101000003_smartwatch_integration.sql ⌚
```

---

## ⚙️ Configuración

### Variables de Entorno

Los archivos `.env` ya están creados con las claves correctas. Si necesitas actualizarlos:

#### Aplicación Móvil (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

#### Portal Web (`apps/web/.env`)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**⚠️ Reemplaza** el valor de `*_ANON_KEY` con el **Publishable key** que obtuviste al ejecutar `supabase start`.

---

## 💻 Ejecutar en Desarrollo

### Crear Usuarios Demo (Solo Primera Vez)

1. Abre Supabase Studio:
```bash
open http://127.0.0.1:54323
```

2. Ve a **Authentication** → **Users** → **Add user**

3. Crea estos 3 usuarios:

**Paciente**:
- Email: `patient_demo@acvguard.test`
- Password: `Password123!`
- ✅ Auto Confirm User: **activado**

**Cuidador**:
- Email: `caregiver_demo@acvguard.test`
- Password: `Password123!`
- ✅ Auto Confirm User: **activado**

**Clínico**:
- Email: `clinician_demo@acvguard.test`
- Password: `Password123!`
- ✅ Auto Confirm User: **activado**

### Ejecutar Aplicaciones

#### Terminal 1: Móvil (Expo)

```bash
pnpm mobile
```

Opciones:
- Presiona `i` para iOS Simulator
- Presiona `a` para Android Emulator
- Escanea QR con Expo Go en dispositivo físico

**⚠️ Para probar HealthKit**: Requiere iPhone físico con Apple Watch. Ejecutar:
```bash
npx expo run:ios --device
```

#### Terminal 2: Web (Next.js)

```bash
pnpm dev
```

Abre http://localhost:3000

---

## ⌚ Integración con Smartwatches

### Funcionalidades Implementadas

#### 1. **Monitoreo de Signos Vitales**
- ❤️ Frecuencia cardíaca
- 🩺 Presión arterial (sistólica/diastólica)
- 🫁 Oxígeno en sangre (SpO2)
- 👣 Pasos diarios
- 😴 Horas de sueño

#### 2. **Detección Automática de Caídas**
- Usa acelerómetro del dispositivo (10 Hz)
- Detecta patrón: impacto alto (>2.5G) + quietud (3 segundos)
- Crea alerta HIGH automáticamente
- Captura ubicación GPS
- Notifica contactos inmediatamente

#### 3. **Detección de Anomalías**
- FC >150 o <40 bpm → Anomalía HIGH
- Presión >180/120 mmHg → Crisis hipertensiva HIGH
- Con AFib: umbrales más sensibles

### Plataformas Soportadas

#### iOS - HealthKit ✅
- **Completamente implementado**
- Requiere iPhone físico (no funciona en simulador)
- Lee datos de Apple Watch automáticamente
- Permisos configurados en `app.json`

#### Android - Health Connect 🚧
- **Estructura implementada**
- Requiere integración final con Health Connect SDK
- Compatible con Wear OS watches

### Uso en la App

1. **Login como paciente**
2. **Ir a pestaña "Signos"** (2da pestaña)
3. **Vincular Smartwatch**: Detecta Apple Watch/Wear OS automáticamente
4. **Sincronizar Datos**: Lee HealthKit y sube a backend
5. **Activar Detección de Caídas**: Toggle para monitoreo continuo

### Documentación Completa

Ver **[SMARTWATCH_INTEGRATION.md](SMARTWATCH_INTEGRATION.md)** para:
- Arquitectura detallada
- Pruebas end-to-end
- Troubleshooting
- Queries SQL útiles
- Roadmap futuro

---

## 📁 Estructura del Proyecto

```
acv-guard/
├── apps/
│   ├── mobile/              # React Native (Expo) - MAIN APP
│   │   ├── src/
│   │   │   ├── contexts/    # AuthContext
│   │   │   ├── lib/         # Supabase, notifications, healthKit ⌚, fallDetection 🚨
│   │   │   ├── navigation/  # AppNavigator
│   │   │   └── screens/     # Auth, patient, alerts, settings
│   │   │       └── patient/
│   │   │           └── VitalsMonitorScreen.tsx  # Monitoreo de signos vitales ⌚
│   │   ├── App.tsx
│   │   ├── app.json         # Permisos HealthKit + sensores
│   │   └── package.json
│   │
│   └── web/                 # Next.js portal (minimal)
│       ├── src/
│       │   ├── app/         # App Router (login, dashboard, alert/[id])
│       │   └── lib/         # Supabase client
│       └── package.json
│
├── packages/
│   └── shared/              # Tipos, Zod schemas, enums
│       ├── src/
│       │   ├── enums.ts     # + SmartwatchType, VitalSignType
│       │   ├── types.ts     # + 5 interfaces smartwatch
│       │   ├── schemas.ts   # + 6 schemas smartwatch
│       │   └── index.ts
│       └── package.json
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20240101000000_initial_schema.sql
│   │   ├── 20240101000001_rls_policies.sql
│   │   ├── 20240101000002_helper_functions.sql
│   │   └── 20240101000003_smartwatch_integration.sql  # ⌚ 5 nuevas tablas
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── create_alert/
│   │   ├── update_alert_status/
│   │   ├── ingest_location/
│   │   ├── ingest_vitals/   # ⌚ Sincronizar signos vitales
│   │   └── report_fall/     # 🚨 Reportar caídas
│   └── seed.sql
│
├── package.json
├── pnpm-workspace.yaml
├── README.md
└── SMARTWATCH_INTEGRATION.md  # ⌚ Documentación completa de smartwatches
```

---

## 👥 Cuentas Demo

### Credenciales

| Rol       | Email                             | Contraseña    |
|-----------|-----------------------------------|---------------|
| Paciente  | patient_demo@acvguard.test        | Password123!  |
| Cuidador  | caregiver_demo@acvguard.test      | Password123!  |
| Clínico   | clinician_demo@acvguard.test      | Password123!  |

### Datos Precargados

Los usuarios se crean vacíos. El **paciente completa su perfil** durante el onboarding en la app móvil.

---

## 🔄 Flujo de Usuario

### Paciente

1. **Registro/Login** → Seleccionar rol "Paciente"
2. **Onboarding** (solo primera vez):
   - Paso 1: Datos personales (DOB, sexo, dirección, EPS, hospital)
   - Paso 2: Factores de riesgo
3. **Home Screen**:
   - Botón SOS grande (emergencia inmediata)
   - Botón "Revisión BE-FAST"
   - Acciones rápidas (compartir ubicación, ver historial)
4. **Pestaña "Signos"** ⌚:
   - Vincular smartwatch (Apple Watch/Wear OS)
   - Sincronizar datos de salud
   - Ver signos vitales en tiempo real
   - Activar/desactivar detección de caídas
5. **BE-FAST Check-in**:
   - Responder 5 preguntas (Balance, Eyes, Face, Arm, Speech)
   - Alertas automáticas según severidad
6. **Historial**: Ver eventos (check-ins, SOS, caídas, cambios de estado)

### Cuidador / Clínico

1. **Login** → Web o móvil
2. **Inbox de Alertas**:
   - Ver todas las alertas activas (incluye caídas detectadas 🚨)
   - Filtro por estado
   - Refresh automático cada 10s
3. **Detalle de Alerta**:
   - Tarjeta de emergencia del paciente
   - Factores de riesgo, medicamentos, alergias
   - **Signos vitales recientes** ⌚
   - Ubicación en mapa
   - Acciones: Reconocer / Escalar / Cerrar

---

## 🧪 Pruebas End-to-End

### Escenario 1: SOS Emergencia

1. Login como **paciente** (móvil)
2. Presiona **"SOS EMERGENCIA"**
3. Confirma
4. **Resultado**: Alerta HIGH creada, notificaciones enviadas
5. Login como **clínico** (web) → Ver alerta en inbox

### Escenario 2: Vincular Apple Watch y Sincronizar ⌚

**Requisitos**: iPhone físico + Apple Watch pareado

1. Login como **paciente** (iPhone)
2. Ir a pestaña **"Signos"**
3. Presionar **"Vincular Smartwatch"**
4. Aceptar permisos HealthKit
5. Presionar **"🔄 Sincronizar Datos"**
6. **Resultado**: Signos vitales aparecen en tarjetas
7. Verificar en DB: `SELECT * FROM vital_signs`

### Escenario 3: Detección de Caída 🚨

1. Activar **"Detección de Caídas"** en pestaña Signos
2. **Simular caída**: Agitar teléfono bruscamente y dejarlo quieto
3. **Resultado**:
   - Consola: "Fall detected!"
   - Alerta HIGH creada automáticamente
   - Notificaciones enviadas con ubicación
4. Login como **clínico** (web) → Ver alerta "fall_detection"

### Escenario 4: Anomalía de FC

1. Paciente con AFib en factores de riesgo
2. Simular FC alta (ingresar en HealthKit o modificar threshold)
3. Sincronizar datos
4. **Resultado**: Registro en `health_anomalies`, tipo "abnormal_heart_rate"

---

## 🚧 Limitaciones y Próximos Pasos

### Limitaciones del MVP

- **HealthKit solo en dispositivo físico**: No funciona en simulador iOS
- **Android Health Connect**: Solo estructura, requiere implementación final
- **Sin sincronización automática**: Usuario debe presionar "Sincronizar"
- **Detección de caídas básica**: No tan precisa como Apple Watch nativa
- **Sin gráficos de tendencia**: Solo valores actuales
- **Notificaciones push básicas**: Sin SMS/email alternativo
- **Sin videollamada**: No hay integración con telemedicina
- **No es herramienta diagnóstica**: Disclaimer legal requerido

### Próximos Pasos (Post-MVP)

#### Funcionalidades
- [ ] Health Connect completo para Android
- [ ] Wear OS app companion nativa
- [ ] Apple Watch app nativa (WatchOS)
- [ ] Gráficos de tendencia de signos vitales
- [ ] Sincronización automática en background
- [ ] SMS/email como canal alternativo
- [ ] Videollamada con médico
- [ ] Recordatorios de medicamentos
- [ ] Detección de AFib con ECG (HealthKit)

#### Infraestructura
- [ ] CI/CD para mobile (EAS Build)
- [ ] CI/CD para web (Vercel)
- [ ] Monitoreo (Sentry, DataDog)
- [ ] Métricas de negocio
- [ ] Backups automáticos
- [ ] Rate limiting
- [ ] WebSockets para notificaciones

#### Producción
- [ ] Supabase production
- [ ] Dominio + SSL
- [ ] Apple Developer + Google Play
- [ ] Compliance (HIPAA, GDPR, Ley 1581 Colombia)
- [ ] Auditoría de seguridad
- [ ] Plan de contingencia

---

## 🎯 Comandos Rápidos

```bash
# ===== Instalación =====
pnpm install                 # Instalar todo

# ===== Docker =====
open /Applications/Docker.app  # Abrir Docker Desktop

# ===== Supabase =====
supabase start               # Iniciar local
supabase stop                # Detener
supabase status              # Ver estado
supabase db reset            # Reset DB (reaplica migraciones)
open http://127.0.0.1:54323  # Abrir Studio

# ===== Desarrollo =====
pnpm dev                     # Web (Next.js)
pnpm mobile                  # Móvil (Expo)
npx expo run:ios --device    # Build nativo iOS (para HealthKit)

# ===== Verificación =====
pnpm lint                    # Lint todo
pnpm type-check              # TypeScript check
docker ps                    # Ver contenedores corriendo
```

---

## 📊 Resumen de URLs y Puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Supabase API | 54321 | http://127.0.0.1:54321 |
| Supabase Studio | 54323 | http://127.0.0.1:54323 |
| Supabase DB | 54322 | postgresql://postgres:postgres@127.0.0.1:54322/postgres |
| Web Portal | 3000 | http://localhost:3000 |
| Expo Dev | 8081 | http://localhost:8081 |

---

## 📖 Documentación Adicional

- **[SMARTWATCH_INTEGRATION.md](SMARTWATCH_INTEGRATION.md)** - Guía completa de integración con smartwatches
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev/)
- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [React Native Health](https://github.com/agencyenterprise/react-native-health)

---

## 📄 Licencia

Este proyecto es un MVP de demostración. Todos los derechos reservados.

---

**🎉 Alert-IO - Monitoreo proactivo que puede salvar vidas ⌚🚨❤️**
