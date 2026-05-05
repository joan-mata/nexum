# Nexum — Control de flujos financieros

Aplicación web para gestión de préstamos, transferencias, retornos y pagos. Diseñada para uso privado en homelab con acceso seguro vía HTTPS.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Node.js 20 · Express · TypeScript (strict) |
| Base de datos | PostgreSQL 16 alpine |
| Frontend | React 18 · Vite · TailwindCSS · TanStack Query |
| Gráficos | Recharts |
| Infraestructura | Docker Compose |
| Proxy / SSL | nginx interno + cv-proxy homelab + Cloudflare Tunnel |

## Arquitectura

```
Internet → Cloudflare Tunnel → cv-proxy (nginx) → proxy-net
                                                       ↓
                                               nexum-nginx:80
                                                       ↓
                                           nexum-net (internal)
                                          ↙                   ↘
                              nexum-backend:3000        nexum-frontend:80
                                      ↓
                                nexum-db:5432
```

- `nexum-net` es `internal: true` — ningún contenedor tiene acceso directo a internet
- Solo `nexum-nginx` está en ambas redes (`nexum-net` + `proxy-net`)
- La DB y el backend no exponen puertos al host

## Quickstart

### Requisitos previos

- Docker y Docker Compose instalados
- Red `proxy-net` existente en el homelab
- Configuración del proxy central en `../nginx-proxy/conf.d/nexum.conf`

### Despliegue

```bash
# 1. Clonar el repositorio
git clone https://github.com/joan-mata/nexum.git
cd nexum

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con valores reales (ver sección Variables)

# 3. Verificar red proxy-net
docker network ls | grep proxy-net
# Si no existe: docker network create proxy-net

# 4. Arrancar
docker compose up -d --build

# 5. Verificar
docker compose logs -f nexum-backend
```

La app estará disponible en `https://nexum.joanmata.com`

### Variables de entorno

Copiar `.env.example` a `.env` y rellenar:

```bash
# Generar secrets seguros:
openssl rand -hex 32   # para JWT_SECRET
openssl rand -hex 32   # para JWT_REFRESH_SECRET (diferente al anterior)
openssl rand -base64 32  # para POSTGRES_PASSWORD
```

> ⚠️ Nunca commitear `.env`. Está en `.gitignore`.

### Primera vez

Al arrancar con DB vacía, el backend crea automáticamente el usuario admin con las credenciales de `ADMIN_USERNAME` / `ADMIN_PASSWORD` del `.env`. El sistema fuerza cambio de contraseña en el primer login.

## Estructura del proyecto

```
nexum/
├── backend/
│   ├── src/
│   │   ├── routes/          # Express router definitions
│   │   ├── controllers/     # HTTP handlers (request → service → response)
│   │   ├── services/        # Lógica de negocio + queries DB
│   │   ├── middleware/      # auth, admin check
│   │   ├── db/              # pool de conexión + migraciones
│   │   └── types/           # TypeScript interfaces
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           # Páginas de la app
│   │   ├── components/      # Componentes reutilizables
│   │   ├── api/             # Clientes HTTP por recurso
│   │   └── hooks/           # Hooks React (auth)
│   └── Dockerfile
├── nginx/
│   └── nginx.conf           # Router interno HTTP
├── docs/
│   └── prompt_init.md       # Especificación original del proyecto
├── docker-compose.yml
├── .env.example
└── DEPLOY.md                # Guía operacional detallada
```

## Operaciones habituales

```bash
# Logs en tiempo real
docker compose logs -f nexum-backend

# Backup de la base de datos
docker compose exec nexum-db pg_dump -U nexum_user nexum > backup_$(date +%Y%m%d_%H%M%S).sql

# Actualizar sin downtime
git pull && docker compose up -d --build

# Reiniciar un servicio
docker compose restart nexum-backend
```

## Seguridad

- Contraseñas: bcrypt con cost factor 14
- JWT access tokens: 15 minutos de vida
- Refresh tokens: 7 días, rotación automática, almacenados como hash SHA-256
- Rate limiting: 5 intentos de login por IP en 15 min → bloqueo 30 min; 100 req/min general
- CORS restringido a `https://nexum.joanmata.com`
- Cabeceras de seguridad: Helmet.js (CSP, HSTS, X-Frame-Options, etc.)
- Refresh tokens en `httpOnly` cookies (no accesibles desde JS)
- Auditoría completa de cambios en usuarios y configuración
- Máximo 10 usuarios activos en el sistema
- Red Docker interna sin acceso a internet

## Roles

| Rol | Acceso |
|---|---|
| `admin` | Todo: operaciones financieras + gestión de usuarios + configuración |
| `operator` | Operaciones financieras. Sin acceso a usuarios ni logs de auditoría |

## Licencia

Uso privado.
