import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { PublicoController } from './publico.controller';

/** Global: cualquier módulo puede guardar o resolver archivos. */
@Global()
@Module({
  controllers: [PublicoController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
