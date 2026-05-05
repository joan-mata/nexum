# Nexum — Guía de despliegue

## Requisitos previos

- Docker y Docker Compose instalados en el servidor
- Red `proxy-net` existente (gestionada por cv-proxy)
- Acceso SSH al servidor

## Pasos de despliegue

### 1. Clonar el repositorio

```bash
cd /Users/server_user/Documents
git clone <repo-url> nexum
cd nexum
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
nano .env  # Rellenar todos los valores reales
```

Variables críticas a configurar:
- `POSTGRES_PASSWORD`: contraseña fuerte (mínimo 32 caracteres aleatorios)
- `JWT_SECRET`: string aleatorio de 64 caracteres
- `JWT_REFRESH_SECRET`: string aleatorio de 64 caracteres diferente al anterior
- `ADMIN_PASSWORD`: contraseña temporal segura (mínimo 12 chars, mayúsculas + minúsculas + números + símbolos)
- `DATABASE_URL`: debe coincidir con POSTGRES_USER y POSTGRES_PASSWORD

Generar secrets seguros:
```bash
# JWT secrets
openssl rand -hex 32  # Ejecutar dos veces, uno para JWT_SECRET y otro para JWT_REFRESH_SECRET

# Postgres password
openssl rand -base64 32
```

### 3. Verificar red proxy-net

```bash
docker network ls | grep proxy-net
```

Si no existe:
```bash
docker network create proxy-net
```

### 4. Arrancar los servicios

```bash
docker compose up -d --build
```

### 5. Verificar que todo está corriendo

```bash
docker compose ps
docker compose logs -f nexum-backend
```

El backend mostrará en los logs:
- `Migrations completed successfully`
- `Admin user created. Please change the password after first login.` (solo en el primer arranque)
- `Server running on port 3000`

### 6. Acceder a la aplicación

La configuración del proxy central en `nginx-proxy/conf.d/nexum.conf` ya enruta:
`nexum.joanmata.com` → `nexum-nginx:80`

Acceder desde el navegador: `https://nexum.joanmata.com`

Credenciales iniciales:
- Usuario: valor de `ADMIN_USERNAME` en `.env`
- Contraseña: valor de `ADMIN_PASSWORD` en `.env`
- **Cambiar la contraseña inmediatamente tras el primer login**

## Operaciones habituales

### Ver logs en tiempo real

```bash
docker compose logs -f nexum-backend
docker compose logs -f nexum-nginx
```

### Backup de base de datos

```bash
docker compose exec nexum-db pg_dump -U nexum_user nexum > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar backup

```bash
cat backup_20240101.sql | docker compose exec -T nexum-db psql -U nexum_user nexum
```

### Actualizar la aplicación

```bash
git pull
docker compose up -d --build
```

### Parar todos los servicios

```bash
docker compose down
```

### Parar y eliminar volúmenes (DESTRUYE TODOS LOS DATOS)

```bash
docker compose down -v
```

## Estructura de red

```
Internet → Cloudflare Tunnel → cv-proxy (nginx) → proxy-net → nexum-nginx:80
                                                                    ↓
                                                              nexum-net (internal)
                                                            ↙            ↘
                                                  nexum-backend:3000   nexum-frontend:80
                                                          ↓
                                                    nexum-db:5432
```

## Seguridad

- Los refresh tokens se almacenan en base de datos con hash SHA-256
- Los access tokens expiran en 15 minutos
- Los refresh tokens expiran en 7 días con rotación automática
- Rate limit: 5 intentos de login por IP en 15 minutos
- Rate limit general: 100 requests/minuto por IP
- La base de datos no tiene puertos expuestos al host
- La red `nexum-net` es interna (sin acceso a internet)

## Troubleshooting

### El backend no arranca
```bash
docker compose logs nexum-backend
# Verificar que nexum-db está healthy
docker compose ps nexum-db
```

### Error de conexión a base de datos
```bash
# Verificar DATABASE_URL en .env
docker compose exec nexum-backend env | grep DATABASE_URL
```

### El proxy no enruta correctamente
```bash
# Verificar que nexum-nginx está en proxy-net
docker network inspect proxy-net | grep nexum
```
