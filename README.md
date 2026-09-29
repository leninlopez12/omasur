# I OMASUR UNI 2026 — Plataforma de inscripción

Sitio informativo + sistema de inscripción de delegaciones para la Olimpiada
Macrorregional Sur de Matemática, organizada por la IES Colegio de Alta Competencia
Ingenieritos del Perú "Eduardo de Habich" en convenio con la UNI.

```
OMASUR/
├── backend/    NestJS + Prisma + PostgreSQL   (API en :3001)
└── frontend/   React + Vite + Tailwind        (web en :5173)
```

## Puesta en marcha

La base `omasur` ya está creada y las credenciales configuradas en `backend/.env`.

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm run dev
```

Vite redirige `/api` y `/uploads` al backend, no hace falta configurar nada más.

Si mueve el proyecto a otro equipo, ajuste `DATABASE_URL` en `backend/.env` y ejecute
`npx prisma db push` para crear las tablas.

**Cuentas de la comisión:** se crean solas al arrancar la API, con los valores del
`.env`. Cambie ambas contraseñas antes de publicar el sitio.

**Todos ingresan con DNI y contraseña**, incluida la comisión.

| Rol           | DNI        | Contraseña        | Panel          |
| ------------- | ---------- | ----------------- | -------------- |
| Administrador | `10000001` | `Omasur2026!`     | `/admin`       |
| Supervisor    | `10000002` | `Supervisor2026!` | `/supervision` |

Esos dos DNI son provisionales: cámbielos por los reales en `ADMIN_DNI` y
`SUPERVISOR_DNI` del `.env`. Si la cuenta ya existe sin DNI, la API se lo asigna
sola al arrancar.

## Imágenes y logos

Todo va en `frontend/public/img/`. Mientras el archivo no exista se muestra un
recuadro guía; nada se rompe.

| Archivo               | Dónde aparece                              |
| --------------------- | ------------------------------------------ |
| `logo.png`            | Logo institucional en toda la web           |
| `concurso.jpg`        | Sección "El concurso"                       |
| `etapa.jpg`           | Sección "Cronograma"                        |
| `yape.jpg`            | QR de pago en "Inscripción"                 |
| `convenio-uni.png`    | Sección "Convenios institucionales"         |
| `convenio-drep.png`   | Sección "Convenios institucionales"         |
| `convenio-ugel.png`   | Sección "Convenios institucionales"         |

Los nombres de los archivos de convenios se editan en `frontend/src/lib/datos.js`
(constante `CONVENIOS`).

## Ajustes que maneja la comisión

Desde el panel del supervisor o del administrador, sección **Ajustes**, sin tocar código:

- **Inscripciones** — culminar el periodo de inscripción o reabrirlo. Al culminarlo se
  bloquea el registro de tutores, la carga de estudiantes, el comprobante y el envío;
  la comisión sigue revisando y aprobando las delegaciones ya enviadas, y las
  credenciales aprobadas siguen descargándose.
- **Grupo WhatsApp** — aperturar grupos, pegar el enlace de invitación, marcarlos
  como llenos (o reabrirlos) y eliminarlos. En la portada cada grupo se muestra como
  "Unirme al grupo", "Grupo lleno" o "Próximamente" según su estado. Si no hay
  ninguno, aparece una tarjeta de aviso.
- **Imágenes** (solo administrador) — fondo de la portada (recomendado 1920 × 1080 px)
  y fondo de la mitad izquierda del ingreso. Se publican detrás del granate, con un
  velo que mantiene el color institucional y la letra legible. Se pueden quitar para
  volver al fondo granate sólido.
- **Yape** — subir el QR de pago. Se publica al instante en la portada y en el paso
  de pago de la inscripción. Mientras no suban ninguno se usa
  `frontend/public/img/yape.jpg`.

El número del botón flotante de WhatsApp sí va en código: `WHATSAPP_DIRECTO` en
`frontend/src/lib/datos.js`, en formato internacional y sin el signo `+`.

## Secciones de la portada

1. El concurso (portada completa)
2. Talento matemático del sur del Perú
3. Categorías y mínimos
4. Cronograma
5. Convenios institucionales
6. Premiación
7. Inscripción
8. Grupo de WhatsApp

Más un botón flotante de WhatsApp para contacto directo.

El concurso tiene **dos etapas**: la primera es institucional (se rinde el examen
en cada colegio y clasifica el 30 % de cada grado) y la segunda es la final
macrorregional en Juliaca.

## Flujo de inscripción

**Antes del asistente:** el tutor crea su cuenta con sus datos personales
(DNI, nombres, apellidos, celular, correo y contraseña). **El tutor ingresa a su
panel con su DNI y contraseña**, igual que la comisión. Esta pantalla no tiene barra
de progreso porque es solo el registro.

Luego arranca el asistente de 4 pasos:

1. **Institución educativa** — nombre, modalidad, departamento, provincia y distrito.
2. **Estudiantes** — uno por uno, o descargando el Excel oficial, llenándolo y subiéndolo.
   La importación valida fila por fila y reporta cada rechazo con su motivo.
3. **Comprobante** — foto del pago por Yape (JPG, PNG o PDF).
4. **Confirmación** — se envía a revisión de la comisión.

Los estudiantes nunca se inscriben solos: todo pasa por el tutor responsable.

## Ubicación geográfica

Departamento → provincia → distrito se eligen siempre de listas, nunca se escriben.
Los datos están en `frontend/src/lib/ubigeo.json` (25 departamentos, 194 provincias
y 1857 distritos, según el ubigeo INEI). La región del tutor se guarda igual al
departamento elegido.

## Reglas aplicadas automáticamente

| Caso                        | Mínimo por grado | Mínimo total |
| --------------------------- | ---------------- | ------------ |
| Institución estatal         | 5                | 30           |
| Institución particular      | 10               | 60           |
| Un solo nivel               | según modalidad  | 15           |

Categorías A–I, de 3ro de primaria a 5to de secundaria. **El estudiante se identifica
con su DNI**: no existe ningún código aparte, ni en la credencial ni en los reportes.

**Costo de inscripción por estudiante:** S/ 12 en instituciones estatales (públicas)
y S/ 17 en particulares y grupos de estudio. Se calcula solo según la modalidad que
elige el tutor, y se configura en `backend/.env` con `PRECIO_ESTATAL` y
`PRECIO_PARTICULAR`.

## Pago por partes

El tutor no tiene que pagar todo de golpe. El paso del pago son **dos pantallas
separadas**, para que la página no quede larguísima:

**Pantalla 1 — ¿A quiénes paga ahora?** Un acordeón en dos niveles:

- Arriba, **Primaria** y **Secundaria**, cada uno con su atajo *Marcar todo / Quitar todo*.
- Dentro, **una fila por grado** (3ro de primaria, 4to de primaria…) que muestra "2 de 3" y
  se despliega al tocarla. Solo aparecen los grados que tienen estudiantes pendientes.
- Al abrir un grado sale la **lista de sus estudiantes**, con la casilla a la izquierda,
  el nombre y el DNI. Toda la fila es tocable, no solo la casilla.
- La casilla del grado marca o desmarca a todos los suyos, y muestra una raya cuando el
  grado está a medias.
- **El sistema calcula el monto**: marcados × precio de la modalidad. El tutor nunca escribe
  el importe, así que no hay forma de que se equivoque ni de que lo altere.

**Pantalla 2 — ¿Cómo pagó?** Elige **Yape** (con el QR y el número) o **BCP** (con el
titular, la cuenta y el CCI), adjunta la foto y envía. Arriba queda el recordatorio de a
cuántos cubre y por cuánto, con un botón para volver a cambiar la selección.

Los que quedan sin marcar siguen pendientes y se pagan después con otro comprobante. Arriba
del todo, una barra muestra **cuántos van cubiertos y cuánto falta**.

Todos los comprobantes quedan en un **historial** con su monto, método, fecha, estado y la
lista de estudiantes que cubre cada uno. Mientras no estén aprobados, el tutor puede
**cambiar la foto** o **anular** el comprobante; al anularlo, sus estudiantes vuelven a
quedar pendientes y el archivo se borra de Cloudflare.

### Del lado de la comisión

- Al **aprobar la delegación**, todos sus comprobantes en revisión pasan a aprobados.
- **Observar la delegación ya no rechaza los comprobantes**: el tutor perdería la selección
  de estudiantes, y la observación casi nunca es por el dinero.
- Para el dinero está `PATCH /api/admin/pagos/:id/revisar`, que aprueba o rechaza **un
  comprobante suelto**. Al rechazarlo, sus estudiantes vuelven a quedar pendientes y el
  tutor recibe el aviso con el motivo.
- Un comprobante aprobado queda bloqueado: no se puede anular ni cambiar su foto.

### La cuenta del BCP

Se carga desde **Ajustes → BCP** (administrador y supervisor): titular, número de cuenta y
CCI. Mientras esté vacía, el tutor ve un aviso y solo puede pagar por Yape.

## Credenciales

- El **tutor** descarga el PDF de toda su delegación desde su panel (dos por hoja).
- El **estudiante** la descarga con su DNI en `/credencial`.

En ambos casos se habilitan recién cuando la comisión aprueba la inscripción.

## Comprobantes en Cloudflare R2

Los comprobantes de pago se guardan en **Cloudflare R2**. Mientras no haya credenciales,
el sistema sigue funcionando igual y los guarda en `backend/uploads/`, así que puede
configurarlo cuando quiera sin detener las inscripciones.

### Paso a paso en Cloudflare

1. **Cree la cuenta** en <https://dash.cloudflare.com/sign-up> con su correo y una
   contraseña. Confirme el correo que le llega.
2. En el menú de la izquierda entre a **R2 Object Storage**.
3. La primera vez Cloudflare le pedirá **agregar una tarjeta** para activar R2. El plan
   gratuito cubre 10 GB de almacenamiento al mes, de sobra para los comprobantes, pero
   la tarjeta es obligatoria para habilitar el servicio.
4. Toque **Create bucket**, póngale de nombre `omasur-comprobantes` y déjelo en
   ubicación automática. **No lo haga público**: los comprobantes se sirven por la API,
   que verifica quién los pide.
5. Copie el **Account ID**. Aparece en la página principal de R2, a la derecha.
6. Entre a **Manage API tokens** (o *API* → *Manage R2 API Tokens*) y toque
   **Create API token**.
   - Permiso: **Object Read & Write** (incluye borrar, necesario para reemplazar
     comprobantes sin dejar archivos sueltos).
   - Alcance: **solo el bucket** `omasur-comprobantes`.
   - Vencimiento: sin vencimiento, o el que prefiera.
7. Al crearlo le muestra **una sola vez** el *Access Key ID* y el *Secret Access Key*.
   Cópielos antes de cerrar la ventana.

### Paso a paso en el sistema

Pegue los cuatro valores en `backend/.env`:

```bash
R2_ACCOUNT_ID="el Account ID del paso 5"
R2_ACCESS_KEY_ID="el Access Key ID del paso 7"
R2_SECRET_ACCESS_KEY="el Secret Access Key del paso 7"
R2_BUCKET="omasur-comprobantes"
```

Reinicie la API. En el arranque debe leer:

```
[Almacenamiento] Comprobantes en Cloudflare R2, bucket "omasur-comprobantes".
```

Si en cambio dice *"Sin credenciales de R2"*, revise que los cuatro valores estén completos.

### Cómo funciona

- **Un solo comprobante vigente por tutor.** Si el tutor se equivoca y sube otro, el
  anterior se borra de Cloudflare en el momento. En el bucket solo quedan los
  comprobantes en uso, nunca versiones sueltas.
- **Las imágenes se sirven desde Cloudflare a través de la API**, en la ruta
  `/api/pagos/<id>/archivo`. El enlace nunca caduca y cada descarga pasa por el control
  de permisos: el tutor solo ve el suyo, la comisión ve cualquiera, y sin sesión no se ve
  nada.
- **La clave interna del archivo nunca sale al navegador.** En la base se guarda
  `r2:comprobantes/…`, pero el cliente solo recibe la ruta de la API.
- Los comprobantes que ya estaban en `uploads/` **siguen funcionando** por la misma ruta:
  el sistema reconoce las dos formas y no hay que migrar nada.
- Si la subida a R2 falla, el pago **no se registra** y el tutor recibe un mensaje claro.
  Si falla la base de datos después de subir, el archivo recién subido se retira solo,
  para no dejar basura en el bucket.

`R2_PUBLIC_URL` es opcional y solo se usa si algún día decide exponer el bucket con un
dominio público.


## Consultas

Administrador y supervisor tienen en su sidebar una sección **Consultas** con dos vistas
de tabla, pensadas para buscar, no para revisar:

- **Tutores** — DNI, nombre, institución, ubicación, modalidad, cuántos alumnos lleva y en
  qué estado va. Se filtra por estado (borrador, pago adjuntado, en revisión, aprobada,
  observada) y se busca por nombre, DNI, institución o correo. Al tocar una fila se abre
  esa delegación.
- **Estudiantes** — DNI, nombre, grado y categoría, institución y el estado de su
  delegación. Se filtra por estado y por grado, y se busca por nombre, DNI o colegio. Cada fila con delegación aprobada trae el botón para **descargar su credencial**;
  el resto muestra "Al aprobarse".

## Iconos 3D de la portada

Los cuatro iconos de los pasos de inscripción **no están en el proyecto**: pesaban casi
6 MB y viajaban en cada compilación. Viven en Cloudflare, bajo `publico/iconos/`, y la
página los pide a `GET /api/publico/iconos/<archivo>`.

- Esa ruta **no pide sesión** (la portada la ve cualquiera), pero valida el nombre con una
  expresión estricta: solo letras, números y guiones más la extensión. Nadie puede salirse
  de esa carpeta y llegar a los comprobantes, que están en el mismo bucket.
- Responde con `Cache-Control: immutable` por un año, así el navegador los guarda y no
  vuelve a pedirlos.
- Los originales quedaron fuera del sitio, en `assets-3d/3D/icon/`.

Para subir otros iconos, deje los `.png` en una carpeta y corra:

```bash
cd backend && node scripts/subir-iconos.js "ruta/a/la/carpeta"
```

La lista de archivos que sube está al inicio del script (`ICONOS`); agregue ahí el nombre
del nuevo y vuelva a correrlo.

## Recuperar la contraseña por correo

Cualquiera que tenga cuenta —tutor, supervisor o administrador— puede volver a entrar sin
que nadie toque la base de datos:

1. En **Ingresar** toca *¿Olvidó su contraseña?*.
2. Escribe el correo con el que se registró.
3. Le llega un correo con un botón grande: **Crear nueva contraseña**.
4. Abre el enlace, escribe la contraseña dos veces y listo: vuelve a **Ingresar**.

Después del cambio se le manda un segundo correo avisando que la contraseña se modificó,
para que note cualquier movimiento raro en su cuenta.

### Se comprueba que el correo exista

Antes de mandar nada se busca el correo entre los tutores y entre las cuentas de la
comisión:

- **No está registrado** → responde 404 y la pantalla dice **"Ese correo no existe"**, con
  el enlace para inscribir la delegación. No se envía ningún mensaje.
- **Sí está** → se manda el enlace y la pantalla confirma a qué dirección fue
  (`ei***********@gmail.com`), para que el tutor verifique que es la suya.
- **Ya pidió tres en la última hora** → responde 429 y le dice que revise su correo y la
  carpeta de spam en vez de seguir pidiendo.
- **El correo no pudo salir** (SMTP caído) → responde 503, lo avisa en pantalla y **descarta
  el enlace**, para que no le gaste el cupo ni quede un enlace vivo que nadie recibió.

El correo se **limpia de espacios y se pasa a minúsculas antes de validarlo**: pegarlo desde
el celular con un espacio de más ya no lo rechaza como inválido. Lo mismo al registrarse.

> Decir si el correo existe o no permite que alguien pruebe direcciones para averiguar quién
> está inscrito. Se aceptó a propósito, porque para un tutor que se equivoca al escribir es
> mucho peor quedarse esperando un correo que nunca llega; el límite por IP es lo que impide
> hacer esa prueba en cantidad.

### Qué protege este flujo

- El enlace **vence en 60 minutos** (`RECUPERACION_MINUTOS`) y **sirve una sola vez**.
- Solo hay **un enlace vivo por cuenta**: al pedir uno nuevo, el anterior queda inservible.
- En la base de datos se guarda el **hash** del enlace, nunca el enlace en claro.
- Máximo **3 enlaces por correo cada hora** y **5 pedidos por IP cada 15 minutos**
  (después responde 429). Verificar y confirmar también están limitados.
- Al cambiar la contraseña se anulan todos los enlaces pendientes de esa cuenta.
- Los enlaces vencidos hace más de un día se borran solos.

### El logo en los correos

La cabecera granate lleva a la izquierda **I OMASUR UNI 2026 / Olimpiada Macro Regional Sur
de Matemática** y a la derecha el **escudo del colegio** sobre una placa blanca (el escudo
es rojo y sobre el granate no se leería).

El logo **viaja adjunto dentro del mensaje** (`cid`), no como enlace a una web. Así se ve
siempre: Gmail bloquea las imágenes traídas de afuera hasta que el lector las autorice, y un
enlace a `localhost` no le abriría a nadie.

- Archivo: `backend/assets/logo-correo.png` (260x260, 51 KB). Se puede apuntar a otro con
  `LOGO_CORREO` en el `.env`.
- Si el archivo no estuviera, la cabecera sale **solo con el texto**, sin imagen rota.
- La cabecera es común a todas las plantillas: cualquier correo que se agregue después
  —confirmación de inscripción, aviso de aprobación del supervisor— sale con el mismo logo
  sin tocar nada.

### Configurar el correo (gratis)

Sin `SMTP_*` configurado el sistema **no se cae**: escribe el correo en la consola de la API
(útil para probar). Para que salga de verdad, en `backend/.env`:

**Opción A — Gmail (500 correos al día).** Necesita verificación en dos pasos activada.

1. Entra a <https://myaccount.google.com/security> y activa la **verificación en 2 pasos**.
2. Entra a <https://myaccount.google.com/apppasswords>.
3. Escribe un nombre (por ejemplo `OMASUR`) y presiona **Crear**.
4. Copia las **16 letras** que aparecen y pégalas en `SMTP_PASS` (sin espacios).

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sucorreo@gmail.com
SMTP_PASS=las16letrasdelaclave
SMTP_FROM=I OMASUR UNI 2026 <sucorreo@gmail.com>
```

**Opción B — Brevo (300 correos al día, no necesita dominio propio).**

1. Crea la cuenta en <https://www.brevo.com> y confirma el correo.
2. Ve a **SMTP & API → SMTP** y presiona **Generate a new SMTP key**.
3. Usa el login y la clave que te muestra:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=el-login-que-da-brevo
SMTP_PASS=la-clave-smtp
SMTP_FROM=I OMASUR UNI 2026 <sucorreo@gmail.com>
```

Al arrancar la API dice en qué quedó: `Correo listo por smtp.gmail.com:587 como ...` o
`Sin credenciales SMTP: los correos se mostrarán en consola.`

> El enlace apunta a `FRONTEND_URL`. Cuando publiques la página, cambia esa variable a la
> dirección real o los correos seguirán mandando a `localhost`.
> Si la API queda detrás de un proxy (Render, Railway, Nginx), pon `TRUST_PROXY=true` para
> que el límite por IP lea la IP verdadera del visitante.

## Notificaciones del navegador (aunque cierren la página)

La comisión recibe los avisos como una app: llegan al sistema operativo aunque el panel
esté cerrado, mientras el navegador siga abierto. Usa **Web Push con service worker**
(`frontend/public/sw.js`) y claves VAPID.

- Al entrar al panel, mientras el permiso no esté concedido aparece una franja granate
  insistiendo con el botón **Activar avisos**. Vuelve a salir en cada carga hasta que
  acepten.
- Los avisos de **inscripción enviada** y **observación absuelta** se muestran con
  `requireInteraction`, así que se quedan en pantalla hasta que alguien los atienda.
- Al tocar la notificación se abre el panel, o se enfoca la pestaña si ya estaba abierta.
- Las suscripciones muertas (permiso revocado, navegador desinstalado) se borran solas
  cuando el servicio de push responde 404 o 410.

Las claves VAPID están en `backend/.env` (`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`).
Para regenerarlas:

```bash
cd backend && node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Sin esas claves el sistema sigue funcionando: solo se desactivan los avisos del navegador.

> El navegador solo abre su diálogo de permiso una vez. Si el usuario lo bloqueó, ningún
> sitio puede volver a pedirlo por código: la franja pasa a explicar cómo reactivarlo desde
> el candado de la barra de direcciones.

## Avisos en tiempo real

Administrador y supervisor reciben avisos cuando un tutor **crea su cuenta**, **sube su
comprobante de pago** o **envía su inscripción a revisión**.

El **tutor también recibe avisos** en su propio panel, con la misma campanita: cuando su
inscripción es aprobada y cuando es observada, con el motivo.

**Ciclo de observación:** si la comisión observa una delegación, el tutor ve el motivo en su
resumen junto a un formulario para explicar qué corrigió. Al absolverla, su inscripción
vuelve a **En revisión**, la comisión recibe un aviso prioritario y ve la respuesta del tutor
dentro del detalle de la delegación.

El aviso de **inscripción enviada a revisión** y el de **observación absuelta** son los prioritarios, porque es el único que
exige una decisión de la comisión:

- Su tarjeta flotante sale en granate, con la marca "Requiere aprobación" y un botón
  "Revisar ahora", y **no desaparece sola**: se queda hasta que la atiendan o la cierren.
- En la campanita aparece una franja granate con cuántas inscripciones esperan aprobación,
  que lleva directo a la sección "Por aprobar" ya filtrada.
- En la lista se distingue con borde granate y la etiqueta "Por aprobar".

- La **campanita** de la cabecera guarda los últimos 50 avisos, con contador de no
  leídos, botón para marcar todo como leído y un punto verde que indica si la conexión
  en vivo está activa.
- Al llegar un aviso nuevo salta una **tarjeta flotante** en la esquina, que se va sola
  a los 8 segundos.
- Al tocar cualquier aviso se abre la delegación que lo originó y queda marcado como leído.

El tiempo real usa **SSE** (), con latido cada 25 s y
reconexión automática a los 5 s si se corta. Los tutores no tienen acceso a estos avisos.

## Paneles

- **Tutor** (`/panel`): resumen y avance, estudiantes, comprobante, credenciales, sus datos.
- **Administrador** (`/admin`): tablero con métricas, revisión de inscripciones con el
  comprobante a la vista, aprobación u observación, y consolidado en Excel.
- **Supervisor** (`/supervision`): ver **El resumen del supervisor** más abajo. La sección
  "Por aprobar" lista solo las inscripciones enviadas y permite aprobarlas u observarlas.
  En "Ajustes" administra los grupos de WhatsApp y el QR de Yape.

## El resumen del supervisor

Regla de esta pantalla: **cada dato aparece una sola vez**. Antes lo aprobado y el total
iban en dos bloques distintos con las mismas etiquetas y se prestaba a confusión; ahora van
juntos, y el **verde siempre significa aprobado**.

De arriba abajo:

1. **Lo pendiente** — franja con lo único que el supervisor tiene que hacer hoy: cuántas
   delegaciones esperan su aprobación, con el botón para ir a revisarlas. Si no hay nada,
   la franja se pone verde y lo dice.
2. **Cuatro cifras** — estudiantes, tutores, colegios y Yape. Cada tarjeta muestra el número
   aprobado en grande, de cuánto sale, el porcentaje y una barra.
3. **Pagos por Yape** y **Tipo de colegio** — aprobado, en revisión y comprobantes; estatales
   y particulares con cuántos ya están aprobados.
4. **Departamentos** y **Provincias** — barras de dos tramos: el verde es lo aprobado y el
   granate lo que falta. Los números se leen "1 de 4", nunca pegados.
5. **Estudiantes por categoría** — las nueve categorías de la A a la I; las que aún no
   tienen inscritos quedan en gris.
6. **Delegaciones** — la tabla completa con institución, tutor, ubicación, tipo de colegio,
   alumnos y estado.

Se refresca solo cada 30 segundos, y el botón **Actualizar** fuerza la recarga.

## API

| Método | Ruta                                | Rol      |
| ------ | ----------------------------------- | -------- |
| POST   | `/api/auth/registro`                | público  |
| POST   | `/api/auth/login`                   | público  |
| GET    | `/api/auth/perfil`                  | sesión   |
| POST   | `/api/auth/recuperar`               | público  |
| GET    | `/api/auth/recuperar/:token`        | público  |
| POST   | `/api/auth/recuperar/confirmar`     | público  |
| GET    | `/api/alumnos/plantilla`            | público  |
| GET    | `/api/publico/iconos/:nombre`       | público  |
| GET    | `/api/ajustes`                      | público  |
| POST/PATCH/DELETE | `/api/ajustes/grupos`    | admin y supervisor |
| POST   | `/api/ajustes/yape`                 | admin y supervisor |
| POST   | `/api/ajustes/inscripciones`        | admin y supervisor |
| POST/DELETE | `/api/ajustes/imagenes/:tipo`  | admin |
| GET    | `/api/credenciales/consulta/:dni`   | público  |
| GET    | `/api/credenciales/dni/:dni`        | público  |
| GET    | `/api/tutores/resumen`              | tutor    |
| PATCH  | `/api/tutores/datos`                | tutor    |
| POST   | `/api/tutores/enviar`               | tutor    |
| POST   | `/api/tutores/absolver`             | tutor    |
| GET/POST/PATCH/DELETE | `/api/alumnos`       | tutor    |
| POST   | `/api/alumnos/importar`             | tutor    |
| GET    | `/api/alumnos/exportar`             | tutor    |
| POST   | `/api/pagos`                        | tutor    |
| PUT    | `/api/pagos/:id/archivo`            | tutor    |
| DELETE | `/api/pagos/:id`                    | tutor    |
| PATCH  | `/api/admin/pagos/:id/revisar`      | admin y supervisor |
| POST   | `/api/ajustes/bcp`                  | admin y supervisor |
| GET    | `/api/credenciales/delegacion`      | tutor    |
| GET/PATCH/POST | `/api/notificaciones`       | admin y supervisor |
| GET    | `/api/notificaciones/stream` (SSE)  | admin y supervisor |
| GET    | `/api/notificaciones/push/clave`    | admin y supervisor |
| POST   | `/api/notificaciones/push/suscribir` | admin y supervisor |
| GET    | `/api/admin/metricas`               | admin y supervisor |
| GET    | `/api/admin/tutores`                | admin y supervisor |
| GET    | `/api/admin/estudiantes`            | admin y supervisor |
| GET    | `/api/admin/inscripciones`          | admin y supervisor |
| PATCH  | `/api/admin/inscripciones/:id/revisar` | admin y supervisor |
| GET    | `/api/admin/exportar`               | admin y supervisor |
