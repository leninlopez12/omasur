-- CreateEnum
CREATE TYPE "RolStaff" AS ENUM ('ADMIN', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "Modalidad" AS ENUM ('ESTATAL', 'PARTICULAR', 'GRUPO_ESTUDIO');

-- CreateEnum
CREATE TYPE "NivelInstitucion" AS ENUM ('PRIMARIA', 'SECUNDARIA', 'AMBOS');

-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('PRIMARIA', 'SECUNDARIA');

-- CreateEnum
CREATE TYPE "Grado" AS ENUM ('TERCERO_PRIMARIA', 'CUARTO_PRIMARIA', 'QUINTO_PRIMARIA', 'SEXTO_PRIMARIA', 'PRIMERO_SECUNDARIA', 'SEGUNDO_SECUNDARIA', 'TERCERO_SECUNDARIA', 'CUARTO_SECUNDARIA', 'QUINTO_SECUNDARIA');

-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('BORRADOR', 'PENDIENTE_PAGO', 'EN_REVISION', 'APROBADA', 'OBSERVADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('YAPE', 'BCP');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('EN_REVISION', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('TUTOR_REGISTRADO', 'PAGO_ENVIADO', 'INSCRIPCION_ENVIADA', 'OBSERVACION_ABSUELTA', 'INSCRIPCION_APROBADA', 'INSCRIPCION_OBSERVADA');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "dni" TEXT,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "RolStaff" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tutor" (
    "id" TEXT NOT NULL,
    "dni" TEXT,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "institucion" TEXT NOT NULL DEFAULT '',
    "modalidad" "Modalidad" NOT NULL DEFAULT 'ESTATAL',
    "nivelInstitucion" "NivelInstitucion" NOT NULL DEFAULT 'AMBOS',
    "departamento" TEXT NOT NULL DEFAULT '',
    "region" TEXT NOT NULL DEFAULT '',
    "provincia" TEXT NOT NULL DEFAULT '',
    "distrito" TEXT NOT NULL DEFAULT '',
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'BORRADOR',
    "observacion" TEXT,
    "respuesta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "grado" "Grado" NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "categoria" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL DEFAULT 'YAPE',
    "monto" DOUBLE PRECISION NOT NULL,
    "operacion" TEXT,
    "archivoUrl" TEXT NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'EN_REVISION',
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoWhatsapp" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "enlace" TEXT NOT NULL DEFAULT '',
    "lleno" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoWhatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ajuste" (
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Ajuste_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tutorId" TEXT,
    "paraTutorId" TEXT,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuscripcionPush" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuscripcionPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "esStaff" BOOLEAN NOT NULL DEFAULT false,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_dni_key" ON "Admin"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_correo_key" ON "Admin"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "Tutor_dni_key" ON "Tutor"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Tutor_correo_key" ON "Tutor"("correo");

-- CreateIndex
CREATE INDEX "Tutor_estado_idx" ON "Tutor"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Student_dni_key" ON "Student"("dni");

-- CreateIndex
CREATE INDEX "Student_tutorId_idx" ON "Student"("tutorId");

-- CreateIndex
CREATE INDEX "Student_dni_idx" ON "Student"("dni");

-- CreateIndex
CREATE INDEX "Student_paymentId_idx" ON "Student"("paymentId");

-- CreateIndex
CREATE INDEX "Payment_tutorId_idx" ON "Payment"("tutorId");

-- CreateIndex
CREATE INDEX "GrupoWhatsapp_orden_idx" ON "GrupoWhatsapp"("orden");

-- CreateIndex
CREATE INDEX "Notificacion_paraTutorId_idx" ON "Notificacion"("paraTutorId");

-- CreateIndex
CREATE INDEX "Notificacion_leida_idx" ON "Notificacion"("leida");

-- CreateIndex
CREATE INDEX "Notificacion_createdAt_idx" ON "Notificacion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuscripcionPush_endpoint_key" ON "SuscripcionPush"("endpoint");

-- CreateIndex
CREATE INDEX "SuscripcionPush_adminId_idx" ON "SuscripcionPush"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacion_tokenHash_key" ON "TokenRecuperacion"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_correo_idx" ON "TokenRecuperacion"("correo");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_cuentaId_idx" ON "TokenRecuperacion"("cuentaId");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_expiraEn_idx" ON "TokenRecuperacion"("expiraEn");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "Tutor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_paraTutorId_fkey" FOREIGN KEY ("paraTutorId") REFERENCES "Tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

