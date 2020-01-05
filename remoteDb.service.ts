import { BadRequestException, Injectable } from '@nestjs/common';
import { Logger } from '../core/logger';
import { RemoteDataBaseRepository } from '../repositories/remoteDataBase.repository';
import { RemoteDb } from '../models/remoteDb.model';
import { CacheService } from './cache.service';
import { configInstance } from '../core/config';

@Injectable()
export class RemoteDbService {
  constructor(
    private remoteDbRepo: RemoteDataBaseRepository,
    private logger: Logger,
    private readonly redis: CacheService
  ) {
  }

  // create temp  Union Tables from remote Tables
  async createUnionTables(): Promise<void> {
    try {
      const tables = configInstance.remoteDb.tables;
      for (const table in tables) {
        await this.remoteDbRepo.createUnionTempTable(tables[table]);
      }
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  // todo - add it to cron jobs
  async checkIsRemoteAvailable(): Promise<boolean> {
    try {
      // check accounts main
      const remoteTable = `${configInstance.remoteDb.tables.accounts}_main`;
      await this.remoteDbRepo.countDataFromRemoteTable(remoteTable);
      await this.redis.set(configInstance.remoteDb.redisName, '1', 3600, 'PX');
      this.logger.info(`----=======## Remote database available ##==========-----`);
      return true;
    } catch (e) {
      await this.redis.del(configInstance.remoteDb.redisName);
      this.logger.error(`----=======## Remote database unavailable ##==========-----`);
      return false;
    }
  }

  // if we have data to move
  // todo add it to cron jobs
  async SynchronizeWithRemoteDb(): Promise<RemoteDb[]> {
    try {
      const remoteDbAvailable = this.redis.get(configInstance.remoteDb.redisName);
      if (remoteDbAvailable) {
        const recordsToMove = await this.remoteDbRepo.getAvailableDataForSynchronize();
        if (recordsToMove.length) {
          for (const item of recordsToMove) {
            await this.remoteDbRepo.moveToRemoteTable(item);
          }
        }
        return recordsToMove;
      }
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
}
