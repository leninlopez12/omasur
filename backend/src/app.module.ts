import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TutorsModule } from './tutors/tutors.module';
import { StudentsModule } from './students/students.module';
import { PaymentsModule } from './payments/payments.module';
import { CredentialsModule } from './credentials/credentials.module';
import { AdminModule } from './admin/admin.module';
import { ExamenModule } from './examen/examen.module';
import { ResultadosModule } from './resultados/resultados.module';
import { SettingsModule } from './settings/settings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { PermisosModule } from './permisos/permisos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PermisosModule,
    AuthModule,
    TutorsModule,
    StudentsModule,
    PaymentsModule,
    CredentialsModule,
    AdminModule,
    ExamenModule,
    ResultadosModule,
    SettingsModule,
    NotificationsModule,
    StorageModule,
    MailModule,
  ],
})
export class AppModule {}
