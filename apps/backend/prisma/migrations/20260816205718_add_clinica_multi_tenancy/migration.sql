/*
  Warnings:

  - Added the required column `ID_Clinica` to the `ATENDIMENTOS` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ID_Clinica` to the `LISTA_ESPERA` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ID_Clinica` to the `LOGS_AUDITORIA` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ID_Clinica` to the `REGISTRO_CLINICOS` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ID_Clinica` to the `USUARIOS` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ATENDIMENTOS" ADD COLUMN     "ID_Clinica" UUID NOT NULL;

-- AlterTable
ALTER TABLE "LISTA_ESPERA" ADD COLUMN     "ID_Clinica" UUID NOT NULL;

-- AlterTable
ALTER TABLE "LOGS_AUDITORIA" ADD COLUMN     "ID_Clinica" UUID NOT NULL;

-- AlterTable
ALTER TABLE "REGISTRO_CLINICOS" ADD COLUMN     "ID_Clinica" UUID NOT NULL;

-- AlterTable
ALTER TABLE "USUARIOS" ADD COLUMN     "ID_Clinica" UUID NOT NULL;

-- CreateTable
CREATE TABLE "CLINICAS" (
    "ID_Clinica" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CLINICAS_pkey" PRIMARY KEY ("ID_Clinica")
);

-- CreateIndex
CREATE UNIQUE INDEX "CLINICAS_slug_key" ON "CLINICAS"("slug");

-- AddForeignKey
ALTER TABLE "USUARIOS" ADD CONSTRAINT "USUARIOS_ID_Clinica_fkey" FOREIGN KEY ("ID_Clinica") REFERENCES "CLINICAS"("ID_Clinica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "REGISTRO_CLINICOS" ADD CONSTRAINT "REGISTRO_CLINICOS_ID_Clinica_fkey" FOREIGN KEY ("ID_Clinica") REFERENCES "CLINICAS"("ID_Clinica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LOGS_AUDITORIA" ADD CONSTRAINT "LOGS_AUDITORIA_ID_Clinica_fkey" FOREIGN KEY ("ID_Clinica") REFERENCES "CLINICAS"("ID_Clinica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ATENDIMENTOS" ADD CONSTRAINT "ATENDIMENTOS_ID_Clinica_fkey" FOREIGN KEY ("ID_Clinica") REFERENCES "CLINICAS"("ID_Clinica") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LISTA_ESPERA" ADD CONSTRAINT "LISTA_ESPERA_ID_Clinica_fkey" FOREIGN KEY ("ID_Clinica") REFERENCES "CLINICAS"("ID_Clinica") ON DELETE RESTRICT ON UPDATE CASCADE;
