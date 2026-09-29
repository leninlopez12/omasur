-- CreateTable
CREATE TABLE "AvisoMasivo" (
    "id" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "enviados" INTEGER NOT NULL DEFAULT 0,
    "fallidos" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'ENVIANDO',
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "AvisoMasivo_pkey" PRIMARY KEY ("id")
);

