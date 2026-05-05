Prompt para implementar la aplicación de control financiero — Nexum

Quiero que implementes una aplicación web completa de control de flujos de dinero (préstamos, envíos, retornos y
pagos). A continuación te detallo todos los requisitos técnicos y funcionales.

---

## STACK TECNOLÓGICO

- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL 16 alpine (con pgcrypto para hashes), contenedor propio aislado
- **Frontend:** React + TypeScript + Vite + TailwindCSS (build estático servido por nginx)
- **Autenticación:** JWT con refresh tokens, bcrypt para contraseñas (cost factor 14)
- **Infraestructura:** Docker Compose con servicios aislados
- **Servidor objetivo:** macOS homelab con Docker, nginx proxy centralizado (`cv-proxy`) y SSL externo via Cloudflare Tunnel. La app se despliega en `nexum.joanmata.com`
- **Repositorio:** Carpeta `nexum/` es la raíz del repositorio GitHub

---

## ARQUITECTURA DOCKER

Crear un `docker-compose.yml` con los siguientes servicios y redes:

```yaml
services:
  db:          # PostgreSQL 16 alpine — solo en nexum-net (internal: true)
  backend:     # Node.js API — solo en nexum-net (internal: true)
  frontend:    # React build servido por nginx — solo en nexum-net (internal: true)
  nginx:       # Router HTTP-only (puerto 80 interno) — en nexum-net + proxy-net
               # Es el ÚNICO contenedor visible por el proxy central cv-proxy

networks:
  nexum-net:
    driver: bridge
    internal: true   # Totalmente aislada del exterior
  proxy-net:
    external: true   # Red compartida del homelab — solo nginx la usa
    name: proxy-net
```

Reglas de red Docker:
- `nexum-net` es `internal: true` — ningún contenedor en esta red puede acceder a internet ni al host directamente
- `proxy-net` es external — ya existe en el homelab, no crearla
- Solo el contenedor `nexum-nginx` está en ambas redes
- La base de datos NO tiene ningún puerto mapeado al host
- El backend NO tiene puertos mapeados al host
- Usar volúmenes nombrados para datos de PostgreSQL
- Container names: `nexum-db`, `nexum-backend`, `nexum-frontend`, `nexum-nginx`

---

## NGINX INTERNO (dentro del docker-compose de nexum)

El nginx interno de nexum actúa como router HTTP dentro de la red del compose.
NO maneja SSL (el SSL lo gestiona Cloudflare Tunnel + cv-proxy externo).

```nginx
# nexum/nginx/nginx.conf
server {
  listen 80;
  server_name _;

  # Cabeceras de seguridad (el proxy central ya añade HSTS)
  add_header X-Frame-Options DENY always;
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;

  # API backend
  location /api/ {
    proxy_pass http://nexum-backend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
  }

  # Frontend React (build estático)
  location / {
    proxy_pass http://nexum-frontend:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
  }
}
```

---

## NGINX DEL FRONTEND (sirve el build de React)

```nginx
# nexum/frontend/nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## SEGURIDAD — REQUISITOS CRÍTICOS

### Contraseñas y hashes
- Usar bcrypt con salt rounds = 14 para todas las contraseñas
- NUNCA almacenar contraseñas en texto plano ni en logs
- El hash de contraseña debe guardarse en columna `password_hash` de tipo `text`
- Las contraseñas deben tener mínimo 12 caracteres, con mayúsculas, minúsculas, números y símbolos

### Autenticación JWT
- Access token con expiración de 15 minutos
- Refresh token con expiración de 7 días, almacenado en base de datos (tabla `refresh_tokens`)
- Invalidar todos los refresh tokens de un usuario al cambiar contraseña
- Refresh tokens en httpOnly cookies, access tokens en memoria (no localStorage)
- Implementar rotación de refresh tokens: cada uso genera uno nuevo e invalida el anterior

### Rate limiting y protección
- Rate limit en login: máximo 5 intentos fallidos por IP en 15 minutos, luego bloqueo 30 minutos
- Rate limit general API: 100 requests/minuto por IP
- Cabeceras de seguridad con helmet.js: CSP, HSTS, X-Frame-Options, etc.
- Validación estricta de todos los inputs con Zod en backend
- Sanitización de datos antes de queries (usar parameterized queries, NUNCA interpolación)
- CORS restringido solo a `https://nexum.joanmata.com`

### Roles de usuario
Solo dos roles, sin excepciones:
- `admin`: acceso total incluyendo gestión de usuarios y configuración del sistema
- `operator`: acceso a todas las operaciones financieras pero SIN acceso a: gestión de usuarios, cambio de configuración del sistema, logs de auditoría de seguridad

### Gestión de usuarios (solo admin)
- El admin puede crear nuevos usuarios con un flujo de dos pasos:
  1. Admin genera un token de invitación de un solo uso (válido 24h)
  2. El invitado usa ese token para establecer su propia contraseña
- El admin puede cambiar la contraseña de cualquier usuario (requiere confirmar con la contraseña del propio admin)
- El admin puede desactivar usuarios (soft delete, nunca borrar)
- Máximo 10 usuarios activos (límite de seguridad)
- Implementar tabla `audit_log` que registre: quién, qué acción, cuándo, IP origen, para cualquier cambio en usuarios o configuración

---

## BASE DE DATOS — ESQUEMA COMPLETO

```sql
-- Usuarios del sistema
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator')),
  is_active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ
);

-- Refresh tokens
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personas que prestan dinero
CREATE TABLE lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Cuentas de salida (destinos de transferencia)
CREATE TABLE exit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_number VARCHAR(255),
  bank_name VARCHAR(255),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('EUR', 'USD')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos financieros principales
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'loan_received',
    'transfer_out',
    'return_received',
    'lender_payment',
    'exchange_fee',
    'transfer_fee',
    'other_expense',
    'cash_withdrawal',
    'reinvestment'
  )),
  amount NUMERIC(18,2) NOT NULL,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('EUR', 'USD')),
  exchange_rate NUMERIC(10,6),
  amount_in_usd NUMERIC(18,2),
  amount_in_eur NUMERIC(18,2),
  lender_id UUID REFERENCES lenders(id),
  exit_account_id UUID REFERENCES exit_accounts(id),
  description TEXT NOT NULL,
  reference_transaction_id UUID REFERENCES transactions(id),
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Calendario de eventos esperados
CREATE TABLE scheduled_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expected_date DATE NOT NULL,
  type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  estimated_amount NUMERIC(18,2),
  currency VARCHAR(3) CHECK (currency IN ('EUR', 'USD')),
  lender_id UUID REFERENCES lenders(id),
  is_completed BOOLEAN DEFAULT false,
  completed_transaction_id UUID REFERENCES transactions(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de auditoría de seguridad
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuración del sistema (solo admin puede modificar)
CREATE TABLE system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Crear índices en: `transactions.date`, `transactions.lender_id`, `transactions.type`, `lenders.name`,
`scheduled_events.expected_date`, `audit_log.created_at`.

---

## API REST — ENDPOINTS

### Auth
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`

### Usuarios (solo admin)
- `GET /api/users`
- `POST /api/users/invite`
- `POST /api/users/accept-invite`
- `PUT /api/users/:id/password`
- `PUT /api/users/:id/deactivate`

### Prestamistas
- `GET /api/lenders`
- `POST /api/lenders`
- `GET /api/lenders/:id`
- `GET /api/lenders/:id/stats`
- `PUT /api/lenders/:id`
- `DELETE /api/lenders/:id`

### Transacciones
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `PUT /api/transactions/:id`
- `DELETE /api/transactions/:id`
- `GET /api/transactions/summary`

### Dashboard / Estadísticas
- `GET /api/dashboard/overview`
- `GET /api/dashboard/cashflow`
- `GET /api/dashboard/currency-breakdown`

### Calendario
- `GET /api/calendar/events`
- `POST /api/calendar/events`
- `PUT /api/calendar/events/:id`
- `PUT /api/calendar/events/:id/complete`

### Cuentas de salida
- `GET /api/exit-accounts`
- `POST /api/exit-accounts`
- `PUT /api/exit-accounts/:id`

---

## FRONTEND — PÁGINAS Y COMPONENTES

### Layout general
- Sidebar izquierdo con navegación
- Header con nombre de usuario, rol y botón de logout
- Diseño limpio y profesional en tonos oscuros o neutros, números financieros siempre en verde (positivo) o rojo (negativo)

### Páginas requeridas

**1. Dashboard**
- Tarjetas KPI: Capital total gestionado (EUR y USD), Retornos recibidos, Comisiones totales, Saldo en bolsa
- Gráfico de barras: flujo de caja mensual (entradas vs salidas) últimos 12 meses
- Tabla de últimas 10 transacciones con enlaces
- Próximos eventos del calendario (próximos 30 días)

**2. Transacciones**
- Tabla con filtros por fecha, tipo, prestamista, moneda
- Botón "Nueva transacción" abre modal con formulario dinámico según tipo
- Exportar a CSV

**3. Prestamistas**
- Lista con tarjetas: capital prestado, devuelto, saldo pendiente
- Página de detalle con estadísticas e historial completo
- Gráfico de evolución del saldo pendiente

**4. Calendario**
- Vista mensual tipo calendario con indicadores de color
- Panel lateral al hacer click en un día
- Botón para crear evento programado y para marcarlo como completado

**5. Estadísticas**
- Distribución de capital por prestamista (pie chart)
- Comisiones acumuladas por mes
- Comparativa ingresos vs gastos por moneda
- Evolución del saldo en bolsa

**6. Cuentas de salida**
- Lista de cuentas con edición inline

**7. Gestión de usuarios (solo admin)**
- Lista de usuarios con rol, estado, último acceso
- Botón "Invitar usuario"
- Cambio de contraseña (requiere confirmar password propio)
- Toggle activar/desactivar
- Log de auditoría (últimas 50 entradas)

**8. Login**
- Formulario con username y password
- Mensaje de error genérico (nunca revelar si el usuario existe)
- Bloqueo temporal visible si supera intentos

---

## INICIALIZACIÓN

Al arrancar por primera vez:
1. Ejecutar todas las migraciones de base de datos automáticamente
2. Detectar si no existe ningún usuario `admin` activo
3. Si no existe: crear admin con credenciales desde variables de entorno `ADMIN_USERNAME` y `ADMIN_PASSWORD`
4. Mostrar en logs del backend (una sola vez): "Admin user created. Please change the password after first login."
5. Forzar cambio de contraseña en el primer login del admin (`must_change_password` en tabla users)

---

## VARIABLES DE ENTORNO (.env.example)

```bash
# Base de datos
POSTGRES_DB=nexum
POSTGRES_USER=nexum_user
POSTGRES_PASSWORD=<contraseña_fuerte_generada>
DATABASE_URL=postgresql://nexum_user:<password>@nexum-db:5432/nexum

# JWT
JWT_SECRET=<string_aleatorio_64_chars>
JWT_REFRESH_SECRET=<string_aleatorio_64_chars>

# Admin inicial
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<contraseña_temporal_segura>

# App
NODE_ENV=production
CORS_ORIGIN=https://nexum.joanmata.com
PORT=3000
```

---

## ESTRUCTURA DE CARPETAS (raíz del repo = nexum/)

```
nexum/
├── .gitignore
├── .env.example
├── docker-compose.yml
├── DEPLOY.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── db/
│       │   ├── client.ts
│       │   └── migrations/
│       ├── middleware/
│       ├── routes/
│       └── types/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       ├── components/
│       ├── hooks/
│       └── pages/
└── nginx/
    └── nginx.conf
```

---

## .gitignore OBLIGATORIO

```gitignore
# Secretos — NUNCA al repositorio
.env
*.env.local
*.env.production

# Dependencias
node_modules/
**/node_modules/

# Builds
dist/
build/
.next/

# Docker volumes locales
postgres-data/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/
```

---

## INSTRUCCIONES DE DESPLIEGUE (DEPLOY.md)

Incluir pasos para:
1. Clonar repo en `/Users/server_user/Documents/nexum`
2. Copiar `.env.example` a `.env` y rellenar valores
3. Verificar que la red `proxy-net` existe: `docker network ls | grep proxy-net`
   - Si no existe: `docker network create proxy-net`
4. Arrancar con `docker compose up -d --build`
5. Verificar logs: `docker compose logs -f nexum-backend`
6. El proxy central en `nginx-proxy/conf.d/nexum.conf` ya enruta `nexum.joanmata.com` → `nexum-nginx:80`
7. Backup de base de datos: `docker compose exec nexum-db pg_dump -U nexum_user nexum > backup_$(date +%Y%m%d).sql`
8. Actualizar sin downtime: `docker compose pull && docker compose up -d --build`

---

## NOTAS FINALES

- Todo el código debe estar en TypeScript estricto (`strict: true`)
- Usar `zod` para validación en el backend
- Usar `react-query` (TanStack Query) para el estado del servidor en el frontend
- Usar `recharts` para todos los gráficos
- Los importes negativos (gastos/comisiones) siempre en rojo; positivos en verde
- Todos los importes con separador de miles y 2 decimales
- La app debe funcionar en español (fechas, formatos numéricos con coma decimal)
- El tipo de cambio EUR/USD se introduce manualmente en cada transacción que lo requiera
- Implementar función utilitaria que calcule el equivalente en USD y EUR dado el tipo de cambio
- Todos los archivos deben estar en control de versiones (git) — ningún secreto en el repo
