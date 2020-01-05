import { Module, HttpModule, NestModule, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import * as fs from 'fs';

import { AuthenticationController } from './controllers/authentication.controller';
//// ..... 
import { RemoteDbService } from './services/remoteDb.service';

@Module({
  imports: [CoreModule],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}

@Module({
  imports: [CoreModule, ServiceModule, HttpModule, EventsModule],
  controllers: [
    AuthenticationController,
    //.....
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
    // check if remote databases avaliable
    const remoteAvailable = await this.remoteDataBaseService.checkIsRemoteAvailable();
    // remove old and create union temp tables from remote databases at each start
    if (remoteAvailable) {
      await this.remoteDataBaseService.createUnionTables();
    }
  }
}
