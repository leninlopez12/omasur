# Puesta en producción — I OMASUR UNI 2026

Guía para poner el sistema en internet. Léala de arriba abajo la primera vez.

---

El dominio es **https://omasur.ipeh.edu.pe**. Ya está escrito en
`frontend/.env.production`, de donde sale la vista previa del enlace al
compartirlo. En el servidor hay que copiarlo además al `.env` como `SITIO_URL`
(punto 3): de ahí salen los enlaces de los correos.

---

## 1. Antes de nada: lo que solo puede hacer usted

Estas cosas no las puede dejar hechas el código. Sin ellas **no publique**.

### 1.0 Cuentas de supervisor

El administrador las crea desde **Ajustes › Supervisores**. No hace falta
tocar el `.env` para eso: escribe nombre, correo y DNI, el sistema genera una
contraseña temporal, se la muestra una vez y además se la manda por correo al
supervisor para que la cambie.

Las cuentas de **administrador** no se crean ni se borran desde la pantalla, a
propósito: si una pudiera eliminar a otra, bastaría entrar con una sola para
quedarse con el sistema. Se crean con las variables del `.env` (punto 1.1).

### 1.1 Contraseñas de la comisión

Hoy, en su computadora, las cuentas usan las claves de ejemplo:

| Cuenta | Correo | Clave actual |
|---|---|---|
| Administrador | `admin@ipeh.edu.pe` | `Omasur2026!` |
| Supervisor | `supervisor@ipeh.edu.pe` | `Supervisor2026!` |

Son públicas: están escritas en el código de ejemplo. **Cualquiera que abra el
sistema puede entrar como administrador con ellas.**

En producción el servidor ya **se niega a crear** una cuenta con esas claves y
lo avisa en el arranque. Ponga las suyas en el `.env`:

```
ADMIN_EMAIL="..."
ADMIN_PASSWORD="..."      <- larga, propia, no reutilizada
ADMIN_DNI="..."
SUPERVISOR_EMAIL="..."
SUPERVISOR_PASSWORD="..."
SUPERVISOR_DNI="..."
```

> Estas variables solo actúan **la primera vez**, con la base vacía. Si la
> cuenta ya existe, cambiarlas no hace nada: la contraseña se cambia desde
> "¿Olvidó su contraseña?" en la pantalla de ingreso.

### 1.2 Clave de sesiones (JWT_SECRET)

Genérela así y péguela en el `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Si alguien la conoce, puede fabricarse una sesión de administrador. Por eso,
con `NODE_ENV=production`, **el servidor no arranca** si falta o tiene menos de
32 caracteres: prefiere no levantarse a levantarse inseguro.

### 1.2b Dominio y certificado

Apunte `omasur.ipeh.edu.pe` al servidor y déle HTTPS. El sistema ya manda
`Strict-Transport-Security` en producción, así que el certificado tiene que
estar puesto **antes** de la primera visita.

### 1.3 Base de datos

Cree una base **nueva** para producción. No use la de su computadora: tiene
datos de prueba y las claves de ejemplo.

### 1.4 Bases del concurso

El botón de la portada solo aparece cuando hay un PDF cargado. Súbalo desde
**Ajustes › Bases del concurso**.

### 1.4b Límite de correos al día

Los avisos masivos (**Ajustes › Avisos por correo**) salen por la misma cuenta
de Gmail. Una cuenta gratuita admite unos **500 envíos por día**; si supera
eso, Gmail la bloquea por 24 horas y tampoco saldrán las recuperaciones de
contraseña. Con más de 400 tutores, conviene pasar a un servicio de envío
(Brevo, Resend) cambiando solo las variables `SMTP_*`.

### 1.5 Respaldos

Programe el respaldo diario (punto 6).

---

## 2. Qué se despliega

Un solo servicio. El servidor de la API entrega también la página web, así que
comparten dominio y no hace falta proxy ni configurar CORS.

```
  Navegador
      │
      ▼
  Servidor Node  ──►  /          la web (frontend/dist)
      │               /api/...   la API
      ├──►  PostgreSQL        tutores, estudiantes, pagos
      └──►  Cloudflare R2     comprobantes, fondos, QR, bases
```

---

## 3. Variables del servidor

Copie `backend/.env.example` a `backend/.env` y complete. Lo mínimo:

| Variable | Para qué |
|---|---|
| `NODE_ENV=production` | Activa el modo producción |
| `DATABASE_URL` | La base nueva |
| `JWT_SECRET` | Punto 1.2. **Sin ella el servidor no arranca** |
| `SITIO_URL=https://omasur.ipeh.edu.pe` | El enlace que va en los correos |
| `ADMIN_*`, `SUPERVISOR_*` | Punto 1.1 |
| `R2_*` | Cloudflare (comprobantes, fondos, QR, bases) |
| `SMTP_*` | Recuperación de contraseña |
| `TRUST_PROXY` | `true` solo detrás de un proxy |

### Sobre `TRUST_PROXY`

El límite de intentos de ingreso (5 cada 15 minutos) identifica a quien llama
por su dirección IP.

- En **Render, Railway, Vercel o detrás de Nginx**: `true`.
- Servidor propio sin proxy: `false`.

Mal puesto en `true` sin proxy, cualquiera puede falsear su IP y probar
contraseñas sin límite. Mal puesto en `false` detrás de un proxy, todos
comparten la misma IP y se bloquean entre sí.

---

## 4. Desplegar

```bash
# 1. Dependencias
cd backend  && npm ci
cd ../frontend && npm ci

# 2. Compilar la web
#    El dominio ya está en frontend/.env.production; si alguna vez cambia,
#    se edita ahí. De él sale la dirección de la imagen que se ve al
#    compartir el enlace por WhatsApp o Facebook.
npm run build                 # deja frontend/dist

# 3. Compilar la API
cd ../backend && npm run build

# 4. Crear las tablas en la base nueva
npm run prisma:deploy

# 5. Arrancar
npm run start:prod
```

En un servicio tipo Render:

- **Build:** `cd frontend && npm ci && npm run build && cd ../backend && npm ci && npm run build && npm run prisma:deploy`
- **Dominio de la web:** ya fijado en `frontend/.env.production` (`https://omasur.ipeh.edu.pe`).
- **Start:** `cd backend && npm run start:prod`

### Cada vez que publique un cambio

```bash
cd frontend && npm run build
cd ../backend && npm run build && npm run prisma:deploy && npm run start:prod
```

`prisma:deploy` aplica solo lo que falte; con la base al día no hace nada.
**Nunca use `prisma:push` en producción**: no deja registro y puede borrar
datos sin avisar.

---

## 5. Comprobar que quedó bien

Con el sistema arriba, desde otra computadora:

| Prueba | Esperado |
|---|---|
| Abrir la portada | Carga, con sus imágenes |
| Abrir `/ingresar` directo | Carga (no "404") |
| `/api/pagos` sin sesión | `401` |
| `/uploads/loquesea` | **No** devuelve archivos |
| Entrar como administrador | Con **su** clave, no la de ejemplo |
| "¿Olvidó su contraseña?" | Llega el correo, con enlace a `omasur.ipeh.edu.pe` |
| Subir un comprobante de prueba | Se ve en el panel del supervisor |
| Pegar el enlace en WhatsApp | Sale la portada como vista previa |

Después **borre** la inscripción de prueba.

---

## 6. Respaldos

Ya está el script. Guarda todas las tablas en un JSON y conserva los 30
últimos:

```bash
cd backend && npm run respaldo
```

Prográmelo **una vez al día**. En Windows, Programador de tareas; en Linux,
cron:

```
0 3 * * *  cd /ruta/backend && /usr/bin/npm run respaldo
```

Dos advertencias:

- El archivo lleva **datos personales** de tutores y estudiantes. Guárdelo en
  un lugar privado. Ya está excluido del repositorio.
- Un respaldo que nunca probó no es un respaldo. Abra uno y revise que los
  conteos cuadren.

---

## 7. Cosas que conviene saber

**Cloudflare R2 debe seguir privado.** Los comprobantes se entregan por
`/api/pagos/:id/archivo`, que revisa permisos en cada descarga: el tutor solo
ve los suyos, la comisión ve todos. Si abre el bucket al público, cualquiera
con la dirección vería los comprobantes de todos.

**La carpeta `uploads/` ya no se publica.** Estaba abierta sin sesión. Los
archivos que quedan ahí son copias viejas; los originales ya están en
Cloudflare.

**El disco del servidor se borra en cada despliegue** en servicios como
Render. Por eso todo archivo subido va a Cloudflare. Si `R2_*` queda vacío,
el sistema guarda en disco y **perderá los comprobantes**.

**Cierre las inscripciones** cuando pase la fecha, desde
**Ajustes › Inscripciones**. Bloquea altas y pagos nuevos sin tocar nada.

---

## 8. Pendientes suyos

- [ ] Apuntar `omasur.ipeh.edu.pe` al servidor y darle certificado HTTPS
- [ ] Contraseñas propias para administrador y supervisor (1.1)
- [ ] `JWT_SECRET` generado (1.2)
- [ ] `SITIO_URL=https://omasur.ipeh.edu.pe` en el `.env` (3)
- [ ] Base de datos nueva, vacía (1.3)
- [ ] Publicar el QR de Yape desde Ajustes (hoy usa la imagen de respaldo)
- [ ] Subir el PDF de las bases (1.4)
- [ ] Respaldo diario programado y probado (6)
- [ ] Borrar la cuenta de prueba `eingenieritos@gmail.com` (DNI 99887766)
- [ ] Pedir a la tutora de LAS MERCEDEZ (`uber@gmail.com`) el voucher de S/ 24
      que se perdió
- [ ] Poner el proyecto bajo control de versiones (`git init`), con el
      `.gitignore` que ya está puesto
