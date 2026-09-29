/**
 * Respaldo de la base en un archivo JSON.
 *
 *   node scripts/respaldo.js [carpeta]
 *
 * Guarda una copia de todas las tablas. No necesita pg_dump ni nada instalado
 * aparte del propio proyecto, así que corre igual en Windows y en el servidor.
 *
 * OJO: el archivo lleva datos personales de los tutores y sus estudiantes, y
 * las contraseñas cifradas. Guárdelo en un lugar privado, nunca en el
 * repositorio ni en una carpeta compartida.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// El orden importa para restaurar: primero lo que no depende de nadie.
const TABLAS = [
  'admin',
  'ajuste',
  'grupoWhatsapp',
  'tutor',
  'payment',
  'student',
  'notificacion',
  'tokenRecuperacion',
  'suscripcionPush',
];

async function main() {
  const carpeta = process.argv[2] || path.join(process.cwd(), 'respaldos');
  fs.mkdirSync(carpeta, { recursive: true });

  const datos = {};
  const conteo = {};

  for (const tabla of TABLAS) {
    if (!prisma[tabla]) continue; // Tabla que ya no existe en el esquema.
    datos[tabla] = await prisma[tabla].findMany();
    conteo[tabla] = datos[tabla].length;
  }

  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const destino = path.join(carpeta, `omasur-${marca}.json`);

  fs.writeFileSync(
    destino,
    JSON.stringify({ generado: new Date().toISOString(), conteo, datos }, null, 2),
  );

  const peso = (fs.statSync(destino).size / 1024).toFixed(0);
  console.log(`Respaldo guardado en ${destino} (${peso} KB)`);
  for (const [tabla, total] of Object.entries(conteo)) {
    console.log(`   ${tabla}: ${total}`);
  }

  // Se conservan los 30 más recientes; el resto se borra para no llenar el disco.
  const viejos = fs
    .readdirSync(carpeta)
    .filter((n) => n.startsWith('omasur-') && n.endsWith('.json'))
    .sort()
    .slice(0, -30);
  for (const nombre of viejos) fs.unlinkSync(path.join(carpeta, nombre));
  if (viejos.length) console.log(`   (se borraron ${viejos.length} respaldos antiguos)`);
}

main()
  .catch((error) => {
    console.error('No se pudo hacer el respaldo:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
