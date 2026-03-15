# Business-Notificaciones

Microservicio de notificaciones en tiempo real para Business ERP. Gestiona notificaciones in-app via WebSocket (Socket.IO), push notifications moviles/web (VAPID, FCM), procesamiento de colas con BullMQ y persistencia en MongoDB. Desarrollado con TypeScript, Express y arquitectura limpia.

---

## Lenguaje y Stack Tecnologico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Lenguaje | TypeScript | 5.3.2 |
| Runtime | Node.js | >= 18 |
| Framework HTTP | Express | 4.18.2 |
| WebSocket | Socket.IO | 4.6.0 |
| Adapter Redis | @socket.io/redis-adapter | 8.2.1 |
| Base de datos | MongoDB | 6.3.0 |
| Cola de mensajes | BullMQ | 5.0.0 |
| Cache / Broker | Redis (ioredis) | 5.3.2 |
| Push Web | web-push (VAPID) | 3.6.6 |
| Push Mobile | firebase-admin (FCM) | 12.0.0 |
| Mensajeria async | KafkaJS | 2.2.4 |
| Validacion | Zod | 3.22.4 |
| Logging | Winston | 3.11.0 |
| Dev server | nodemon | 3.0.2 |
| Puerto | 3007 | - |

---

## Caracteristicas

- Notificaciones en tiempo real via WebSocket (Socket.IO) — sin polling
- Escalabilidad horizontal con @socket.io/redis-adapter: multiples instancias comparten conexiones
- Push notifications Web (VAPID) directamente al navegador, sin aplicacion instalada
- Push notifications Mobile via Firebase Cloud Messaging (FCM)
- Envio masivo (bulk) a multiples usuarios o grupos en una sola llamada
- Gestion de preferencias: cada usuario elige que tipos de notificaciones recibir
- Gestion de suscripciones WebSocket y push por dispositivo
- Sistema de colas con BullMQ — los envios pesados se procesan asincrona y confiablemente
- Historial con paginacion en MongoDB — consulta, marcado como leido, estadisticas
- Consumidor Kafka — recibe eventos de otros microservicios y genera notificaciones automaticamente

---

## Estructura del Proyecto

```
Business-Notificaciones/
├── src/
│   ├── index.ts                               # Punto de entrada
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Notification.ts               # Entidad notificacion
│   │   │   └── Subscription.ts               # Suscripcion push
│   │   ├── repositories/
│   │   │   └── INotificationRepository.ts
│   │   └── services/
│   │       └── NotificationDomainService.ts
│   ├── application/
│   │   ├── usecases/
│   │   │   ├── CreateNotification.ts         # Crear y enviar notificacion
│   │   │   ├── MarkAsRead.ts                 # Marcar como leida
│   │   │   ├── QueryNotifications.ts         # Consultar historial
│   │   │   ├── ManageSubscription.ts         # Alta/baja suscripcion
│   │   │   ├── UpdatePreferences.ts          # Preferencias de usuario
│   │   │   └── SendBulkNotifications.ts      # Envio masivo
│   │   └── dto/NotificationDTO.ts
│   ├── infrastructure/
│   │   ├── database/mongodb/
│   │   │   └── MongoNotificationRepository.ts
│   │   ├── websocket/
│   │   │   ├── SocketServer.ts               # Servidor Socket.IO
│   │   │   ├── WebSocketManager.ts           # Gestion de rooms/users
│   │   │   └── SocketIOHandler.ts            # Handlers de eventos
│   │   ├── push/
│   │   │   ├── VapidProvider.ts              # Notificaciones push Web
│   │   │   └── FCMProvider.ts                # Notificaciones push Mobile
│   │   ├── queue/bullmq/
│   │   │   ├── NotificationQueue.ts
│   │   │   └── workers/NotificationWorker.ts
│   │   ├── kafka/
│   │   │   ├── KafkaConsumer.ts              # Consume eventos externos
│   │   │   └── KafkaProducer.ts
│   │   └── http/express/
│   │       ├── routes.ts
│   │       └── middleware/auth.middleware.ts
│   └── shared/
│       ├── config/config.ts
│       └── utils/logger.ts
├── docker-compose.yml                         # MongoDB + Redis + Kafka
├── Dockerfile
├── nodemon.json
├── package.json
└── tsconfig.json
```

---

## Instalacion

### Requisitos previos

- Node.js >= 18
- MongoDB (local o Atlas)
- Redis >= 6
- Para push web: generar claves VAPID
- Para push mobile: cuenta Firebase con archivo de credenciales

### Pasos

```powershell
# 1. Entrar al directorio
cd C:\Proyectos\BusinessApp\Business-Notificaciones

# 2. Instalar dependencias
npm install

# 3. Generar claves VAPID para push web
npx web-push generate-vapid-keys

# 4. Configurar variables de entorno
copy .env.example .env
# Editar .env con tus credenciales
```

### Levantar infraestructura con Docker

```powershell
docker-compose up -d
```

---

## Variables de entorno (.env)

```env
# Servidor
PORT=3007
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/business_notificaciones
MONGODB_DB_NAME=business_notificaciones

# Redis (BullMQ + Socket.IO adapter)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# VAPID — Push notificaciones web
VAPID_PUBLIC_KEY=tu-clave-publica-vapid
VAPID_PRIVATE_KEY=tu-clave-privada-vapid
VAPID_SUBJECT=mailto:admin@businessapp.com

# Firebase FCM — Push notificaciones mobile
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\ntu-clave\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@proyecto.iam.gserviceaccount.com

# Socket.IO
SOCKET_IO_CORS_ORIGIN=http://localhost:4200,http://localhost:3000

# Kafka (opcional)
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=business-notificaciones
KAFKA_GROUP_ID=notificaciones-group

# Colas
QUEUE_NOTIFICATION_NAME=notifications
QUEUE_MAX_RETRIES=3
```

---

## Levantar el Microservicio

### Desarrollo

```powershell
cd C:\Proyectos\BusinessApp\Business-Notificaciones
npm run dev
```

Arranca en http://localhost:3007 (HTTP) y ws://localhost:3007 (WebSocket) con nodemon.

### Produccion

```powershell
npm run build
npm start
```

### Verificar que esta corriendo

```powershell
Invoke-RestMethod -Uri http://localhost:3007/health
```

---

## URLs Disponibles

| URL | Descripcion |
|-----|-------------|
| http://localhost:3007/health | Health check del servicio |
| http://localhost:3007/api/notifications | API REST de notificaciones |
| ws://localhost:3007 | WebSocket Socket.IO |

---

## Endpoints de la API

### Notificaciones

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/notifications | Crear y enviar una notificacion |
| POST | /api/notifications/bulk | Envio masivo de notificaciones |
| GET | /api/notifications | Consultar notificaciones del usuario |
| GET | /api/notifications/unread-count | Contador de no leidas |
| POST | /api/notifications/:id/read | Marcar como leida |
| POST | /api/notifications/read-all | Marcar todas como leidas |

### Suscripciones push

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /api/subscriptions | Registrar suscripcion push (VAPID/FCM) |
| DELETE | /api/subscriptions/:id | Eliminar suscripcion |
| GET | /api/subscriptions | Listar suscripciones del usuario |

### Preferencias

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /api/preferences | Obtener preferencias del usuario |
| PUT | /api/preferences | Actualizar preferencias de notificacion |

### Sistema

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | /health | Health check |

---

## Ejemplos de Request

### Crear notificacion

```json
POST /api/notifications
{
  "userId": "uuid-del-usuario",
  "type": "INFO",
  "title": "Pedido aprobado",
  "body": "Tu pedido #12345 fue aprobado y esta en proceso.",
  "channels": ["websocket", "push"],
  "data": { "orderId": "12345" }
}
```

### Envio masivo

```json
POST /api/notifications/bulk
{
  "userIds": ["uuid1", "uuid2", "uuid3"],
  "type": "ALERT",
  "title": "Mantenimiento programado",
  "body": "El sistema estara en mantenimiento manana de 2am a 4am.",
  "channels": ["websocket", "push"]
}
```

### Registrar suscripcion push web (VAPID)

```json
POST /api/subscriptions
{
  "type": "web-push",
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "clave-p256dh",
    "auth": "clave-auth"
  }
}
```

### Actualizar preferencias

```json
PUT /api/preferences
{
  "email": true,
  "push": true,
  "websocket": true,
  "types": {
    "INFO": true,
    "WARNING": true,
    "ALERT": true,
    "SUCCESS": true
  }
}
```

---

## WebSocket — Eventos Socket.IO

### Cliente se conecta

```javascript
// Ejemplo desde Angular/frontend
import { io } from 'socket.io-client';

const socket = io('http://localhost:3007', {
  auth: { token: 'Bearer <jwt-token>' }
});

// Escuchar nueva notificacion
socket.on('notification', (data) => {
  console.log('Nueva notificacion:', data);
});

// Marcar como leida
socket.emit('notification:read', { notificationId: '123' });
```

### Eventos disponibles

| Evento | Direccion | Descripcion |
|--------|-----------|-------------|
| notification | server → client | Nueva notificacion en tiempo real |
| notification:read | client → server | Marcar notificacion como leida |
| unread-count | server → client | Actualizacion del contador de no leidas |
| connected | server → client | Confirmacion de conexion exitosa |

---

## Tipos de Notificacion

| Tipo | Descripcion |
|------|-------------|
| INFO | Informacion general |
| SUCCESS | Operacion completada exitosamente |
| WARNING | Advertencia que requiere atencion |
| ALERT | Alerta urgente |
| ERROR | Error en el sistema |

---

## Scripts npm

| Comando | Descripcion |
|---------|-------------|
| npm run dev | Desarrollo con nodemon (hot-reload) |
| npm run build | Compilar TypeScript a dist/ |
| npm start | Ejecutar compilado (produccion) |
| npm test | Tests con Jest |
| npm run lint | Linting ESLint |
| npm run format | Formatear con Prettier |

---

## Docker

```powershell
# Levantar MongoDB + Redis + Kafka
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

---

## Licencia

Proyecto interno — Business ERP.
