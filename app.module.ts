import { Module, HttpModule, NestModule, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as fs from 'fs';

import { AuthenticationController } from './controllers/authentication.controller';
import { PharmaciesController } from './controllers/pharmacies.controller';
import { ClinicsController } from './controllers/clinics.controller';
import { HealthController } from './controllers/health.controller';
import { CommonController } from './controllers/common.controller';
import { JobsController } from './controllers/jobs.controller';
import { MeController } from './controllers/me.controller';
import { AccountsController } from './controllers/old/accounts.controller';
import { AccountsDischargeSummaryController } from './controllers/accounts.controller';
import { OldAppointmentController } from './controllers/old/appointment.controller';
import { ReasonsForVisitController } from './controllers/reasons-for-visit.controller';
import { AppointmentsController } from './controllers/old/appointments.controller';
import { ClinicController } from './controllers/old/clinic.controller';
import { CountriesController } from './controllers/old/countries.controller';
import { OldClinicsController } from './controllers/old/old-clinics.controller';
import { SchedulesController } from './controllers/old/schedules.controller';
import { PatientsController } from './controllers/patients.controller';
import { ProvidersController } from './controllers/providers.controller';
import { CoreModule } from './core';
import { AuthGuard } from './guards/auth.guard';
import { EnvelopeInterceptor } from './interceptors/envelope.interceptor';
import { ServiceModule } from './services';
import { JobsService } from './services/micro/jobs.service';
import { WaitingRoomController } from './controllers/waiting.room.controller';
import { FtpUsersController } from './controllers/ftp-users.controller';
import { CardController } from './controllers/card.controller';
import { NewAppointmentsController } from './controllers/new-appointments.controller';
import { EventsModule } from './events/events.module';
import { ChatController } from './controllers/chat.controller';
import { ChatGateway } from './events/chat.gateway';
import { UrgentController } from './controllers/urgent.controller';
import { LoggerMiddleware } from './core/logger';
import { WhiteLabelController } from './controllers/white-label.controller';
import { Config } from './core/config';
import { MedicalLicenseController } from './controllers/medical-license.controller';
import { NotificationController } from './controllers/notification.controller';
import { InviteController } from './controllers/invite.controller';
import { ContactController } from './controllers/contact.controller';
import { TranslationsController } from './controllers/translations.controller';
import { TimezonesController } from './controllers/timezones.controller';
import { SingleSignOnController } from './controllers/single-sign-on.controller';
import {RemoteDbService} from './services/remoteDb.service';

@Module({
  imports: [CoreModule],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}

@Module({
  imports: [CoreModule, ServiceModule, HttpModule, EventsModule],
  controllers: [
    AccountsController,
    ReasonsForVisitController,
    AuthenticationController,
    CountriesController,
    PharmaciesController,
    ClinicsController,
    OldClinicsController,
    OldAppointmentController,
    ClinicController,
    SchedulesController,
    AppointmentsController,
    JobsController,
    HealthController,
    PatientsController,
    MeController,
    ProvidersController,
    CommonController,
    WaitingRoomController,
    FtpUsersController,
    CardController,
    NewAppointmentsController,
    AccountsDischargeSummaryController,
    ChatController,
    UrgentController,
    WhiteLabelController,
    MedicalLicenseController,
    NotificationController,
    InviteController,
    ContactController,
    TranslationsController,
    TimezonesController,
    SingleSignOnController
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: EnvelopeInterceptor
    },
    ChatGateway
  ]
})
export class ApplicationModule implements NestModule, OnModuleInit {
  constructor(private config: Config, private remoteDataBaseService: RemoteDbService) {
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    this.createVideoTempFolder();
    // create union  temp tables from remote tables
    const remoteAvailable = await this.remoteDataBaseService.checkIsRemoteAvailable();
    if (remoteAvailable) {
      await this.remoteDataBaseService.createUnionTables();
    }
  }

  private createVideoTempFolder() {
    const videoTempExists = fs.existsSync(this.config.videoTempFullPath);
    if (!videoTempExists) {
      fs.mkdirSync(this.config.videoTempFullPath);
    }
  }
}
