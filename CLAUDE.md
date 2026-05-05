# CLAUDE.md — Nexum

Contexto del proyecto para Claude Code. Lee este archivo antes de modificar código.

## Descripción del proyecto

Aplicación web privada de control de flujos financieros (préstamos, transferencias, retornos, pagos). Stack: Node.js + Express + TypeScript / React + Vite + TailwindCSS / PostgreSQL 16 / Docker Compose.

URL de producción: `https://nexum.joanmata.com`
Repo: `https://github.com/joan-mata/nexum.git`
Deploy path: `/Users/server_user/Documents/nexum/`

## Arquitectura backend (MVC)

```
backend/src/
├── routes/         ← Solo Router de Express. Sin lógica. Mapea paths a controllers.
├── controllers/    ← Parsea request, valida con Zod, llama service, envía response.
├── services/       ← Lógica de negocio + queries PostgreSQL.
├── middleware/     ← auth.middleware.ts (JWT), admin.middleware.ts (role check)
├── db/
│   ├── pool.ts     ← Conexión PostgreSQL (pg.Pool)
│   ├── migrate.ts  ← Ejecuta migraciones + seed admin inicial
│   └── migrations/ ← Archivos SQL numerados (001_initial.sql)
├── types/          ← Interfaces TypeScript compartidas
└── index.ts        ← Entry point: crea app, arranca servidor
```

## Arquitectura frontend

```
frontend/src/
├── pages/          ← Una página por ruta (/dashboard, /transactions, etc.)
├── components/     ← Layout, ProtectedRoute, AdminRoute
├── api/            ← Un archivo por recurso, wraps sobre axios (client.ts)
└── hooks/          ← useAuth.tsx (contexto de autenticación)
```

## Convenciones de código

- **TypeScript strict** en backend y frontend. Sin `any` implícito.
- **Validación**: Zod en backend en cada controller. El frontend valida con HTML5 attrs.
- **Queries DB**: siempre parameterized (`$1, $2, ...`). Nunca interpolación de strings.
- **Naming archivos backend**: `kebab-case.capa.ts` (ej: `exit-accounts.controller.ts`)
- **Naming archivos frontend**: PascalCase para componentes/páginas, camelCase para api/hooks
- **Moneda**: siempre guardar `amount_in_eur` y `amount_in_usd`. El tipo de cambio se introduce manualmente.
- **Soft delete**: nunca borrar registros. Usar `is_active = false` en lenders/exit_accounts, `status = 'cancelled'` en transactions.
- **Sin comentarios de código** salvo para invariantes no obvios.

## Seguridad — reglas inamovibles

- Nunca almacenar tokens en localStorage. Refresh token en httpOnly cookie, access token en memoria.
- bcrypt con **cost factor 14** para todas las contraseñas.
- Máximo **10 usuarios activos** simultáneos.
- El endpoint `POST /api/users/accept-invite` es **público** (sin auth). El resto de `/api/users/*` requiere admin.
- Audit log obligatorio para cualquier cambio en usuarios o configuración del sistema.
- CORS solo hacia `https://nexum.joanmata.com` (configurable vía env `CORS_ORIGIN`).

## Variables de entorno

Ver `.env.example`. Variables críticas:
- `DATABASE_URL` — debe coincidir exactamente con `POSTGRES_USER` y `POSTGRES_PASSWORD`
- `JWT_SECRET` y `JWT_REFRESH_SECRET` — strings aleatorios distintos de 64 chars
- `CORS_ORIGIN` — URL completa con protocolo

## Docker

- **4 servicios**: `nexum-db`, `nexum-backend`, `nexum-frontend`, `nexum-nginx`
- **2 redes**: `nexum-net` (internal: true) y `proxy-net` (external, ya existe en homelab)
- Solo `nexum-nginx` está en ambas redes. El resto solo en `nexum-net`.
- La DB no tiene puertos mapeados al host. Tampoco el backend.
- El backend usa `depends_on: nexum-db: condition: service_healthy`.

## Cómo ejecutar en local (dev)

```bash
# Backend
cd backend
npm install
# Necesitas una DB postgres local o ajustar DATABASE_URL a una remota
npm run dev  # ts-node-dev, hot reload

# Frontend
cd frontend
npm install
npm run dev  # Vite, proxy a localhost:3000 para /api
```

## Cómo desplegar en producción

Ver `DEPLOY.md` para instrucciones completas.

```bash
docker compose up -d --build
docker compose logs -f nexum-backend
```

## Migraciones de base de datos

Las migraciones se ejecutan automáticamente al arrancar el backend (`initializeDatabase()` en `db/migrate.ts`). Para añadir una migración:

1. Crear `backend/src/db/migrations/002_descripcion.sql`
2. El sistema la detecta por orden alfabético y la aplica si no está en `schema_migrations`

## Endpoints API

| Grupo | Base path |
|---|---|
| Auth | `POST /api/auth/login`, `/refresh`, `/logout`, `/logout-all` |
| Usuarios (admin) | `GET/POST /api/users`, `/invite`, `/accept-invite`, `/:id/password`, `/:id/deactivate` |
| Prestamistas | `GET/POST /api/lenders`, `/:id`, `/:id/stats`, `PUT /:id`, `DELETE /:id` |
| Transacciones | `GET/POST /api/transactions`, `/summary`, `/:id`, `PUT /:id`, `DELETE /:id` |
| Dashboard | `GET /api/dashboard/overview`, `/cashflow`, `/currency-breakdown` |
| Calendario | `GET/POST /api/calendar/events`, `PUT /events/:id`, `PUT /events/:id/complete` |
| Cuentas salida | `GET/POST /api/exit-accounts`, `PUT /:id`, `DELETE /:id` |

## Páginas frontend

`/login`, `/accept-invite`, `/dashboard`, `/transactions`, `/lenders`, `/lenders/:id`, `/calendar`, `/statistics`, `/exit-accounts`, `/users` (solo admin)

## Patrones habituales

Al añadir un nuevo recurso CRUD:
1. `services/recurso.service.ts` — queries DB
2. `controllers/recurso.controller.ts` — validación Zod + llamada service
3. `routes/recurso.routes.ts` — router Express
4. Registrar en `index.ts`: `app.use('/api/recurso', recursoRoutes)`
5. `frontend/src/api/recurso.ts` — cliente axios
6. `frontend/src/pages/Recurso.tsx` — página React
7. Añadir ruta en `frontend/src/App.tsx`
8. Añadir item en el sidebar (`frontend/src/components/Layout.tsx`)
