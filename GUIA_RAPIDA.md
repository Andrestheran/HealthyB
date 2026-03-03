# 🚀 Guía Rápida - Alert-IO

## ⚡ Inicio Rápido (5 pasos)

### 1️⃣ Iniciar Docker
```bash
open /Applications/Docker.app
# Esperar 30 segundos
```

### 2️⃣ Iniciar Supabase
```bash
cd /Users/andrestheran/Desktop/HB
supabase start
```

**✅ Cuando termine, copia el "Publishable key"**

### 3️⃣ Las variables de entorno ya están configuradas
```bash
# apps/mobile/.env ✅
# apps/web/.env ✅
# Ambos archivos ya tienen las claves correctas
```

### 4️⃣ Crear usuarios (solo primera vez)

Abre: http://127.0.0.1:54323

**Authentication → Users → Add user**

Crear 3 usuarios:

```
📧 patient_demo@acvguard.test
🔐 Password123!
✅ Auto Confirm: ON

📧 caregiver_demo@acvguard.test
🔐 Password123!
✅ Auto Confirm: ON

📧 clinician_demo@acvguard.test
🔐 Password123!
✅ Auto Confirm: ON
```

### 5️⃣ Ejecutar apps

**Terminal 1 - Móvil**:
```bash
pnpm mobile
# Presiona 'i' para iOS o 'a' para Android
```

**Terminal 2 - Web**:
```bash
pnpm dev
# Abre http://localhost:3000
```

---

## 🧪 Prueba Rápida

### En la app móvil:
1. Login: `patient_demo@acvguard.test` / `Password123!`
2. Completa onboarding
3. Presiona **"SOS EMERGENCIA"**

### En el portal web:
1. Login: `clinician_demo@acvguard.test` / `Password123!`
2. ✅ Verás la alerta del paciente

---

## ⌚ Probar Smartwatch (Opcional)

**Requiere**: iPhone físico + Apple Watch

```bash
# Build nativo para iOS
npx expo run:ios --device
```

1. Login como paciente
2. Ir a pestaña **"Signos"**
3. **"Vincular Smartwatch"**
4. Aceptar permisos HealthKit
5. **"Sincronizar Datos"**
6. ✅ Ver signos vitales

---

## 🚨 Probar Detección de Caídas

1. Pestaña **"Signos"**
2. Activar **"Detección de Caídas"**
3. Agitar teléfono bruscamente + dejar quieto
4. ✅ Alerta HIGH creada automáticamente

---

## 🆘 Troubleshooting

### Docker no inicia
```bash
open /Applications/Docker.app
# Esperar 1 minuto completo
docker ps  # Verificar
```

### Supabase no arranca
```bash
supabase stop
supabase start
```

### App móvil no encuentra módulos
```bash
rm -rf node_modules
pnpm install
cd packages/shared && pnpm build
```

### HealthKit no funciona
⚠️ HealthKit NO funciona en simulador
✅ Usar iPhone físico: `npx expo run:ios --device`

---

## 📊 Verificar Estado

```bash
# Estado de Supabase
supabase status

# Contenedores de Docker
docker ps

# Logs
supabase logs
```

---

## 🔗 URLs Importantes

- 🎨 Studio: http://127.0.0.1:54323
- 🌐 API: http://127.0.0.1:54321
- 💻 Web: http://localhost:3000
- 📱 Expo: http://localhost:8081

---

## 📚 Más Información

- **README.md** - Documentación completa
- **SMARTWATCH_INTEGRATION.md** - Guía de smartwatches
- **apps/mobile/.env** - Variables móvil
- **apps/web/.env** - Variables web

---

**✅ ¡Listo para desarrollar!**
