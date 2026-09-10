# TaskFlow API

TaskFlow es una REST API moderna para gestión de tareas y proyectos en equipo. Diseñada para ser simple, rápida y segura.

## Características principales

- CRUD completo de tareas con prioridades, fechas límite, tags y estados
- Organización por proyectos con gestión de miembros y permisos
- Autenticación JWT (RS256) con access y refresh tokens
- Paginación cursor-based para manejo eficiente de datos
- Rate limiting: 100 requests/minuto por usuario autenticado
- Webhooks para integración con sistemas externos
- SDKs oficiales para JavaScript/TypeScript y Python

## Stack tecnológico

- **Runtime:** Node.js 20 LTS
- **Framework:** Express 4.x
- **Base de datos:** PostgreSQL 15 con extensión pg_vector
- **Caché:** Redis 7
- **Autenticación:** JWT RS256 con refresh tokens
- **Testing:** Jest + Supertest
- **CI/CD:** GitHub Actions

## Requisitos

- Node.js >= 20.0.0
- PostgreSQL >= 15
- Redis >= 7
- npm >= 10

## Instalación

```bash
git clone https://github.com/taskflow/api.git
cd api
npm install
cp .env.template .env
npm run db:migrate
npm run dev
```

El servidor corre en `http://localhost:3000`.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila TypeScript a JavaScript |
| `npm test` | Ejecuta tests |
| `npm run db:migrate` | Ejecuta migraciones de base de datos |
| `npm run lint` | Verifica estilo de código |
| `npm run typecheck` | Valida tipos sin compilar |

## Documentación

- [Getting Started](./getting-starter.md) — Guía de inicio rápido con ejemplos
- [API Reference](./api-reference.md) — Referencia completa de endpoints

## Autenticación

TaskFlow usa **Bearer tokens JWT** para todas las requests a endpoints protegidos.

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **Access token:** expira en 15 minutos
- **Refresh token:** expira en 7 días

## Rate Limiting

100 requests por minuto por usuario autenticado. Los headers de respuesta informan el estado:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706793600
```

## Licencia

MIT
