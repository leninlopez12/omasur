import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { NotificationsController } from './notifications.controller';

/** Global: cualquier servicio puede emitir un aviso sin importar el módulo. */
@Global()
@Module({
  providers: [NotificationsService, PushService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
