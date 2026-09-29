import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { extname, join } from 'path';
import { Readable } from 'stream';

/** Prefijo con el que se marcan las claves guardadas en Cloudflare R2. */
const MARCA_R2 = 'r2:';
const VIGENCIA_ENLACE = 60 * 15; // 15 minutos

/**
 * Guarda los comprobantes en Cloudflare R2 cuando hay credenciales, y en la
 * carpeta `uploads/` cuando no las hay, para que el sistema funcione igual
 * mientras la cuenta de Cloudflare no esté lista.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly log = new Logger('Almacenamiento');
  private cliente: S3Client | null = null;
  private bucket = '';
  private urlPublicaBase = '';

  onModuleInit() {
    const cuenta = process.env.R2_ACCOUNT_ID;
    const clave = process.env.R2_ACCESS_KEY_ID;
    const secreto = process.env.R2_SECRET_ACCESS_KEY;
    this.bucket = process.env.R2_BUCKET || '';
    this.urlPublicaBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

    if (!cuenta || !clave || !secreto || !this.bucket) {
      this.log.warn('Sin credenciales de R2: los comprobantes se guardan en uploads/.');
      return;
    }

    this.cliente = new S3Client({
      region: 'auto',
      endpoint: `https://${cuenta}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: clave, secretAccessKey: secreto },
    });
    this.log.log(`Comprobantes en Cloudflare R2, bucket "${this.bucket}".`);
  }

  get usandoR2(): boolean {
    return this.cliente !== null;
  }

  /**
   * Guarda el archivo y devuelve la referencia que se almacena en la base.
   * Con R2 es `r2:<clave>`; sin R2, la ruta pública `/uploads/<archivo>`.
   */
  async guardar(archivo: Express.Multer.File, carpeta: string): Promise<string> {
    const extension = extname(archivo.originalname).toLowerCase();
    const nombre = `${carpeta}/${Date.now()}-${randomUUID()}${extension}`;

    if (!this.cliente) {
      const destino = join(process.cwd(), 'uploads');
      await fs.mkdir(destino, { recursive: true });
      const local = nombre.replace(/\//g, '-');
      await fs.writeFile(join(destino, local), archivo.buffer);
      return `/uploads/${local}`;
    }

    try {
      await this.cliente.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: nombre,
          Body: archivo.buffer,
          ContentType: archivo.mimetype,
        }),
      );
    } catch (error: any) {
      // Con credenciales o bucket mal configurados el tutor no debe ver un error crudo.
      this.log.error(`Fallo la subida a R2: ${error?.message ?? error}`);
      throw new ServiceUnavailableException(
        'No pudimos guardar su comprobante en este momento. Intente de nuevo en unos minutos.',
      );
    }

    return MARCA_R2 + nombre;
  }

  /**
   * Devuelve el archivo para que la API lo entregue ella misma. Así el enlace
   * que ve el navegador nunca caduca y cada descarga pasa por el control de
   * permisos, en vez de depender de una URL firmada que se puede reenviar.
   */
  async leer(referencia: string): Promise<{
    cuerpo: Readable;
    tipo: string;
    tamano?: number;
  } | null> {
    if (!referencia) return null;

    if (!referencia.startsWith(MARCA_R2)) {
      // Comprobantes antiguos que quedaron en disco antes de usar R2.
      const local = join(process.cwd(), referencia.replace(/^\/uploads\//, 'uploads/'));
      try {
        const datos = await fs.stat(local);
        return {
          cuerpo: createReadStream(local),
          tipo: this.tipoPorExtension(local),
          tamano: datos.size,
        };
      } catch {
        return null;
      }
    }

    if (!this.cliente) return null;
    const clave = referencia.slice(MARCA_R2.length);

    try {
      const objeto = await this.cliente.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: clave }),
      );
      return {
        cuerpo: objeto.Body as Readable,
        tipo: objeto.ContentType || this.tipoPorExtension(clave),
        tamano: objeto.ContentLength,
      };
    } catch (error: any) {
      this.log.warn(`No se pudo leer ${clave}: ${error?.message ?? error}`);
      return null;
    }
  }

  /** Enlace firmado. Solo se usa si el bucket se expone con dominio público. */
  async urlFirmada(referencia: string): Promise<string | null> {
    if (!referencia?.startsWith(MARCA_R2)) return referencia || null;
    const clave = referencia.slice(MARCA_R2.length);

    if (this.urlPublicaBase) return `${this.urlPublicaBase}/${clave}`;
    if (!this.cliente) return null;

    return getSignedUrl(this.cliente, new GetObjectCommand({ Bucket: this.bucket, Key: clave }), {
      expiresIn: VIGENCIA_ENLACE,
    });
  }

  /**
   * Borra el archivo, esté en R2 o en disco. Se usa al reemplazar un
   * comprobante para que en Cloudflare solo quede el vigente.
   */
  async eliminar(referencia: string | null | undefined): Promise<boolean> {
    if (!referencia) return false;

    if (!referencia.startsWith(MARCA_R2)) {
      const local = join(process.cwd(), referencia.replace(/^\/uploads\//, 'uploads/'));
      try {
        await fs.unlink(local);
        return true;
      } catch {
        return false;
      }
    }

    if (!this.cliente) return false;
    const clave = referencia.slice(MARCA_R2.length);

    try {
      await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }));
      this.log.log(`Comprobante anterior eliminado de R2: ${clave}`);
      return true;
    } catch (error: any) {
      // No es motivo para fallar la operación del tutor: se registra y sigue.
      this.log.warn(`No se pudo borrar ${clave} de R2: ${error?.message ?? error}`);
      return false;
    }
  }

  private tipoPorExtension(ruta: string): string {
    const ext = extname(ruta).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.pdf') return 'application/pdf';
    return 'image/jpeg';
  }
}
