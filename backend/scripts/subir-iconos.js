/**
 * Sube a Cloudflare R2 los iconos 3D que usa la portada, bajo la carpeta
 * "publico/iconos/". Así no viajan dentro del sitio y la página los pide
 * a la API, que los trae de Cloudflare.
 *
 *   node scripts/subir-iconos.js <carpeta con los png>
 */
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
require('dotenv').config();

const PREFIJO = 'publico/iconos/';

// Solo estos: el resto de la carpeta no se sube.
const ICONOS = [
  'file2.png',
  'copy.png',
  'payment.png',
  'file.png',
  'computer.png',
  'mobile.png',
  'videocam.png',
  'medal.png',
  'constancia.png',
  'calendar.png',
  'clock.png',
  'buld.png',
  'matematica.png',
  'pdf.png',
  'excel.png',
  'check.png',
];

const TIPOS = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

async function main() {
  const carpeta = process.argv[2];
  if (!carpeta) throw new Error('Indique la carpeta con los iconos');

  const cuenta = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  if (!cuenta || !bucket) throw new Error('Faltan las credenciales de R2 en .env');

  const cliente = new S3Client({
    region: 'auto',
    endpoint: `https://${cuenta}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  for (const nombre of ICONOS) {
    const origen = path.join(carpeta, nombre);
    if (!fs.existsSync(origen)) {
      console.log('  falta y se omite:', nombre);
      continue;
    }

    const cuerpo = fs.readFileSync(origen);
    await cliente.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: PREFIJO + nombre,
        Body: cuerpo,
        ContentType: TIPOS[path.extname(nombre).toLowerCase()] || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    console.log('  subido:', PREFIJO + nombre, '(' + Math.round(cuerpo.length / 1024) + ' KB)');
  }

  const lista = await cliente.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIJO }),
  );
  console.log('\nen Cloudflare bajo', PREFIJO + ':');
  (lista.Contents || []).forEach((o) => console.log('  ·', o.Key, Math.round(o.Size / 1024), 'KB'));
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
