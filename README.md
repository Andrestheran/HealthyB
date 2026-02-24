# ACV-Guard MVP

ACV-Guard es una aplicación móvil (iOS/Android) para monitoreo de riesgo de ACV (accidente cerebrovascular), con un portal web mínimo para cuidadores y clínicos. Este MVP incluye:

- **Aplicación móvil principal** (React Native + Expo)
- **Portal web secundario** (Next.js) para alertas
- **Backend completo** (Supabase: Postgres + Auth + RLS + Edge Functions)
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
- **Notificaciones**: Expo Push Notifications
- **Validación**: Zod
- **Data Fetching**: TanStack Query (React Query)
- **Monorepo**: pnpm workspaces + Turborepo

### Base de Datos

- **Postgres** con Row Level Security (RLS)
- **Enums**: roles, estados de alerta, severidad, tipos de eventos
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

### Edge Functions (Supabase)

1. **create_alert** - Crea alertas desde SOS, BE-FAST, o reporte de síntomas
2. **update_alert_status** - Actualiza estado de alertas (acknowledged, escalated, closed)
3. **ingest_location** - Guarda ubicación del paciente

### Lógica de Alertas

- **SOS**: siempre crea alerta HIGH
- **BE-FAST check-in**:
  - Síntomas mayores (Face, Arm, Speech) → HIGH
  - 2+ síntomas menores (Balance, Eyes) O AFib + cualquier síntoma → MEDIUM
  - Otros casos → LOW (solo registra evento, sin alerta)
- **Reporte de síntomas**: MEDIUM por defecto

---

## 📦 Requisitos Previos

1. **Node.js** >= 18
2. **pnpm** >= 8 (instalar con `npm install -g pnpm`)
3. **Supabase CLI** (instalar con `brew install supabase/tap/supabase` o ver [docs](https://supabase.com/docs/guides/cli))
4. **Docker** (para Supabase local)
5. **Expo CLI** (se instala automáticamente)
6. **iOS Simulator** (macOS) o **Android Studio** para emuladores

---

## 🚀 Instalación

### 1. Clonar e instalar dependencias

```bash
# En la raíz del proyecto
pnpm install
```

Esto instalará todas las dependencias del monorepo (móvil, web, shared).

### 2. Iniciar Supabase local

```bash
# En la raíz del proyecto
supabase start
```

Este comando:
- Descarga imágenes de Docker necesarias (primera vez)
- Inicia Postgres, Auth, Storage, Edge Functions
- Aplica migraciones automáticamente
- Muestra credenciales locales

**Guarda las credenciales que se muestran**, especialmente:
- `API URL`: http://127.0.0.1:54321
- `anon key`: (clave larga)
- `service_role key`: (solo para Edge Functions)

### 3. Crear cuentas demo (opcional pero recomendado)

Las cuentas demo se deben crear manualmente en Supabase Studio:

1. Abre Supabase Studio: http://localhost:54323
2. Ve a **Authentication** → **Users**
3. Crea los siguientes usuarios:

   - **Paciente**:
     - Email: `patient_demo@acvguard.test`
     - Password: `Password123!`

   - **Cuidador**:
     - Email: `caregiver_demo@acvguard.test`
     - Password: `Password123!`

   - **Clínico**:
     - Email: `clinician_demo@acvguard.test`
     - Password: `Password123!`

4. Ejecuta el seed SQL para datos de prueba:

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql
```

O copia/pega el contenido de `supabase/seed.sql` en el SQL Editor de Studio.

---

## ⚙️ Configuración

### Variables de Entorno

#### Aplicación Móvil (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

#### Portal Web (`apps/web/.env`)

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

**IMPORTANTE**: Reemplaza `tu-anon-key-aqui` con la clave `anon key` que se mostró al ejecutar `supabase start`.

### Archivos .env.example

Ya existen archivos `.env.example` en cada app. Cópialos y renómbralos:

```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env
```

Luego edita y agrega las credenciales.

---

## 💻 Ejecutar en Desarrollo

### Móvil (Expo)

En una terminal:

```bash
pnpm mobile
```

Esto inicia el servidor Expo. Opciones:
- Presiona `i` para abrir en iOS Simulator
- Presiona `a` para abrir en Android Emulator
- Escanea el QR con Expo Go en tu dispositivo físico

**Nota sobre notificaciones**: Las notificaciones push requieren dispositivo físico. En simuladores/emuladores no funcionarán.

### Web (Next.js)

En otra terminal:

```bash
pnpm dev
```

Abre http://localhost:3000 en tu navegador.

### Supabase Edge Functions (opcional para desarrollo)

Las Edge Functions ya están disponibles en Supabase local. Para ver logs:

```bash
supabase functions serve create_alert --env-file ./supabase/.env.local
```

---

## 📁 Estructura del Proyecto

```
acv-guard/
├── apps/
│   ├── mobile/              # React Native (Expo)
│   │   ├── src/
│   │   │   ├── contexts/    # AuthContext
│   │   │   ├── lib/         # Supabase client, notificaciones
│   │   │   ├── navigation/  # AppNavigator
│   │   │   └── screens/     # Pantallas (auth, patient, alerts, settings)
│   │   ├── App.tsx
│   │   ├── app.json
│   │   └── package.json
│   │
│   └── web/                 # Next.js portal
│       ├── src/
│       │   ├── app/         # App Router (login, dashboard, alert/[id])
│       │   └── lib/         # Supabase client
│       └── package.json
│
├── packages/
│   └── shared/              # Tipos, esquemas Zod, enums
│       ├── src/
│       │   ├── enums.ts
│       │   ├── types.ts
│       │   ├── schemas.ts
│       │   └── index.ts
│       └── package.json
│
├── supabase/
│   ├── config.toml
│   ├── migrations/          # Migraciones SQL
│   │   ├── 20240101000000_initial_schema.sql
│   │   ├── 20240101000001_rls_policies.sql
│   │   └── 20240101000002_helper_functions.sql
│   ├── functions/           # Edge Functions (Deno)
│   │   ├── create_alert/
│   │   ├── update_alert_status/
│   │   └── ingest_location/
│   └── seed.sql
│
├── package.json             # Root con workspaces
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 👥 Cuentas Demo

### Credenciales

| Rol       | Email                             | Contraseña    |
|-----------|-----------------------------------|---------------|
| Paciente  | patient_demo@acvguard.test        | Password123!  |
| Cuidador  | caregiver_demo@acvguard.test      | Password123!  |
| Clínico   | clinician_demo@acvguard.test      | Password123!  |

### Datos Precargados (Paciente Demo)

- **Nombre**: María García
- **Factores de riesgo**: Hipertensión, AFib, Dislipidemia
- **Medicamentos**: Losartán, Aspirina, Atorvastatina
- **Alergias**: Penicilina, Mariscos
- **Contactos de emergencia**: 2 contactos
- **Consentimientos**: Cuidador y Clínico tienen permisos completos

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
4. **BE-FAST Check-in**:
   - Responder 5 preguntas (Balance, Eyes, Face, Arm, Speech)
   - Opcional: notas
   - Se captura ubicación automáticamente
5. **Alertas automáticas**:
   - Se crean según severidad
   - Notificaciones push a contactos + cuidadores/clínicos con consentimiento
6. **Historial**: Ver eventos (check-ins, SOS, cambios de estado)
7. **Ubicación**: Compartir ubicación manualmente o habilitar fondo

### Cuidador / Clínico

1. **Login** → Web o móvil
2. **Inbox de Alertas**:
   - Ver todas las alertas activas
   - Filtro por estado
   - Refresh automático cada 10s
3. **Detalle de Alerta**:
   - Tarjeta de emergencia del paciente
   - Factores de riesgo, medicamentos, alergias
   - Ubicación en mapa (si disponible)
   - Acciones:
     - "Reconocer" (triggered → acknowledged)
     - "Escalar" (acknowledged → escalated)
     - "Cerrar" (acknowledged → closed)
4. **Notificaciones push** cuando:
   - Nueva alerta
   - Cambio de estado

---

## 🧪 Pruebas End-to-End

### Escenario 1: SOS Emergencia

1. Login como **paciente** (móvil)
2. En Home, presiona el botón **"SOS EMERGENCIA"**
3. Confirma
4. Resultado esperado:
   - Alerta HIGH creada
   - Notificación enviada a cuidador + clínico
5. Login como **clínico** (web o móvil)
6. Ver inbox → debe aparecer nueva alerta HIGH
7. Abrir detalle → ver tarjeta de emergencia
8. "Reconocer Alerta"
9. Login como **paciente** → ver en historial el cambio de estado

### Escenario 2: BE-FAST con Síntoma Mayor

1. Login como **paciente** (móvil)
2. Home → "Revisión BE-FAST"
3. Marca **Face = SÍ** (síntoma mayor)
4. Enviar
5. Resultado esperado:
   - Alerta HIGH creada (Face es síntoma mayor)
   - Notificaciones enviadas
6. Clínico recibe alerta en inbox
7. Puede ver detalles del check-in y tomar acción

### Escenario 3: BE-FAST sin Síntomas Mayores

1. Login como **paciente**
2. BE-FAST → marca solo **Balance = SÍ, Eyes = SÍ** (2 menores)
3. Enviar
4. Resultado esperado:
   - Alerta MEDIUM (2+ síntomas menores)
   - Si el paciente tiene AFib en factores de riesgo → MEDIUM
5. Si solo 1 síntoma menor → solo registra evento (no alerta)

### Escenario 4: Ubicación

1. Login como **paciente**
2. "Compartir Ubicación Ahora"
3. Aceptar permisos
4. Ubicación guardada
5. Login como **clínico** → ver alerta con ubicación
6. Clic "Abrir en Google Maps" → debe abrir mapa con coordenadas

---

## 🚧 Limitaciones y Próximos Pasos

### Limitaciones del MVP

- **Solo ubicación manual**: No hay tracking continuo en segundo plano (iOS/Android limitan esto)
- **Notificaciones push**: Solo Expo Push (no SMS/email)
- **Sin smartwatch**: Detección de caídas y monitoreo continuo requiere integración con wearables
- **Sin diagnóstico**: Esta app NO diagnostica ACV, solo registra síntomas y alerta
- **Onboarding simplificado**: Faltan pasos (agregar medicamentos manualmente, consentimientos detallados)
- **Sin verificación de identidad**: No hay KYC para clínicos
- **Sin HIPAA/compliance**: Este MVP no cumple regulaciones médicas para producción

### Próximos Pasos (Post-MVP)

#### Funcionalidades
- [ ] Integración con smartwatch (Apple Watch, Wear OS)
- [ ] SMS/email como canal de notificación alternativo
- [ ] Videollamada con médico desde la app
- [ ] Histórico de signos vitales (presión arterial, frecuencia cardíaca)
- [ ] Recordatorios de medicamentos
- [ ] Onboarding completo (medicamentos, consentimientos granulares)
- [ ] Búsqueda de clínicos por especialidad
- [ ] Dashboard de administrador

#### Infraestructura
- [ ] CI/CD para mobile (EAS Build + Submit)
- [ ] CI/CD para web (Vercel/Netlify)
- [ ] Monitoreo y logging (Sentry, DataDog)
- [ ] Métricas de negocio (alertas creadas, tiempo de respuesta)
- [ ] Backups automáticos de DB
- [ ] Rate limiting en Edge Functions
- [ ] WebSockets para notificaciones en tiempo real (en lugar de polling)

#### Producción
- [ ] Supabase production instance
- [ ] Dominio custom + SSL
- [ ] Apple Developer + Google Play Developer accounts
- [ ] Revisión legal y compliance (HIPAA, GDPR, Ley 1581 Colombia)
- [ ] Pruebas de penetración y auditoría de seguridad
- [ ] Plan de contingencia y DR

#### UX/UI
- [ ] Diseño profesional con Figma
- [ ] Internacionalización (i18n) más idiomas
- [ ] Modo oscuro
- [ ] Accesibilidad (a11y) completo
- [ ] Animaciones y transiciones

---

## 📞 Soporte

Este es un MVP de demostración. Para preguntas o issues:

- Revisa el código en `/apps` y `/packages`
- Consulta la documentación de [Supabase](https://supabase.com/docs)
- Consulta la documentación de [Expo](https://docs.expo.dev/)

---

## 📄 Licencia

Este proyecto es un MVP de demostración. Todos los derechos reservados.

---

## 🎯 Comandos Rápidos

```bash
# Instalar todo
pnpm install

# Supabase
supabase start           # Iniciar local
supabase stop            # Detener
supabase status          # Ver estado
supabase db reset        # Reset DB (reaplica migraciones)

# Desarrollo
pnpm dev                 # Web (Next.js)
pnpm mobile              # Móvil (Expo)

# Build
pnpm build               # Build web para producción

# Linting y type-check
pnpm lint                # Lint todo el monorepo
pnpm type-check          # TypeScript check
```

---

## 📊 Variables de Entorno (Resumen)

| Variable | Ubicación | Descripción |
|----------|-----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | URL de Supabase (local o producción) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Anon key de Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | `apps/web/.env` | URL de Supabase (local o producción) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `apps/web/.env` | Anon key de Supabase |

Para Edge Functions (solo si ejecutas manualmente):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

---

**¡Éxito con ACV-Guard! 🚑📱**
