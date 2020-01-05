import { ModelClass, Page, QueryBuilder, raw, ref, Reference, Transaction} from 'objection';
import { RemoteDb } from '../models/remoteDb.model';
import { BaseRepository } from './base.repository';
import { Inject, Injectable } from '@nestjs/common';
import * as _ from 'lodash/fp';
import { configInstance } from '../core/config';

// todo add payments to remote database

@Injectable()
export class RemoteDataBaseRepository extends BaseRepository<RemoteDb> {
  constructor(
    @Inject('RemoteDb') protected modelClass: ModelClass<RemoteDb>, // private clinicRepo: ClinicRepository,
    // accounts repo is for insert/update main remote table
  ) {
    super();
  }
  // get task for sync from Sync table
  public async getAvailableDataForSynchronize() {
    try {
      return await this.findAll();
    } catch (e) {
      throw e;
    }
  }

  // universal query to move in to remote tables
  public async moveToRemoteTable(objectToMove: RemoteDb) {
    try {
      // @ts-ignore
      await this[objectToMove.operationType](objectToMove);
      // truncate table
      await this.removeDataFromSyncTable(objectToMove);
    } catch (e) {
      throw e;
    }
  }

  // @todo add  sequnce for accounts table
  public async createSequence(tableName: string, nextVal: number, drop?: boolean) {
    const queryRaw = this.modelClass.knex();
    if (drop) {
      await queryRaw.raw(`DROP SEQUENCE IF EXISTS ${tableName}_id_seq CASCADE;`);
    }
    await queryRaw.raw(`CREATE SEQUENCE IF NOT EXISTS ${tableName}_id_seq MINVALUE ${nextVal}`);
    await queryRaw.raw(`SELECT setval('${tableName}_id_seq', ${nextVal}, true); `);
    await queryRaw.raw(`ALTER TABLE ${tableName} ALTER COLUMN id SET DEFAULT nextval('${tableName}_id_seq');`);
    await queryRaw.raw(`ALTER SEQUENCE ${tableName}_id_seq OWNED BY ${tableName}.id; `);
  }

  public async createUnionTempTable(tableName: string) {
    // create TEMP TABLE FOR CURRENT SESSION
    const queryRaw = this.modelClass.knex();
    // select nextval
    await this.createSequence(`${tableName}_main`,true);
    // CREATE SEQUENCE FOR accounts temp TABLE BLOCK
    await this.createSequence(tableName, true);
    // add trigger to new Accounts table
    await queryRaw.raw(this.returnTriggerProcedure(tableName));
  }

  // ###################################################
  // ## REMOTE DB FLOW SUPPORT METHODs -----------------
  // ###################################################

  // create Universal trigger for TEMP table
  returnTriggerProcedure(tableName: string) {
    return `
    drop trigger  IF EXISTS fn_${tableName}_add_to_sync_table  on ${tableName};

      CREATE OR REPLACE FUNCTION public.fn_${tableName}_add_to_sync_table()
        RETURNS trigger AS
      $BODY$
      declare
          query text;
      BEGIN
        query := 'INSERT INTO synchronize_remote_db values (DEFAULT, $1.id, ''' || TG_OP || ''', '''|| TG_TABLE_NAME ||''', NOW())';
        raise notice 'Value: %', query ;
        EXECUTE query USING NEW;
      RETURN null;
      END;
      $BODY$
       LANGUAGE plpgsql VOLATILE STRICT
        COST 100;

      CREATE TRIGGER fn_${tableName}_add_to_sync_table
        AFTER INSERT OR UPDATE  ON public.${tableName}
        FOR EACH ROW
        EXECUTE PROCEDURE public.fn_${tableName}_add_to_sync_table();
      COMMIT;
      `;
  }

  // truncate data from sync Table
  public async removeDataFromSyncTable(objectToMove: RemoteDb) {
    const queryRaw = this.modelClass.knex();
    return await queryRaw.raw(`DELETE FROM ${RemoteDb.tableName} WHERE id = ${objectToMove.id}`);
  }

  public async countDataFromRemoteTable(table: string) {
    const queryRaw = this.modelClass.knex();
    return await queryRaw.raw(`SELECT COUNT(*) FROM ${table};`);
  }

  // prepareObject object for insert to db (shielding)
  async prepareObject(RemoteDbItem: RemoteDb) {
    for (const one in RemoteDbItem) {
      RemoteDbItem[one] =
        typeof RemoteDbItem[one] === 'object' && RemoteDbItem[one] !== null
          ? JSON.stringify(RemoteDbItem[one], null, '\t')
          : RemoteDbItem[one];
    }
    return RemoteDbItem;
  } // end prepareObject

  // call INSERT method depends on RemoteDb.operationType
  public async INSERT(objectToMove: RemoteDb) {
    const queryRaw = this.modelClass.knex();
    const dataToMoveIntoRemote = await queryRaw.raw(
      `SELECT * FROM ${objectToMove.tableName}  WHERE id = ${objectToMove.recordId};`
    );
    // const objectForInsert = dataToMoveIntoRemote.rows[0];
    const updateData = dataToMoveIntoRemote.rows[0];
    const columnsAndData = await this.generateColumnsForInsertQuery(updateData);
    // todo add method to return INSERT QUERY
    const idForUpdate = updateData.id;
    let query = `INSERT INTO "${objectToMove.tableName}_main" VALUES( ${columnsAndData} );`;
    // update table
    await queryRaw.raw(query);
    // todo need research about generates Ids
    // update ID
    query = `UPDATE "${objectToMove.tableName}_main" SET id = ${idForUpdate} WHERE ID = ${idForUpdate + 1}`;
    await queryRaw.raw(query);
  }

  // call UPDATE method depends on RemoteDb.operationType
  public async UPDATE(objectToMove: RemoteDb) {
    const queryRaw = this.modelClass.knex();
    // gets data to move into remote table
    const dataToMoveIntoRemote = await queryRaw.raw(
      `SELECT * FROM ${objectToMove.tableName}  WHERE id = ${objectToMove.recordId};`
    );
    const objectForInsert = dataToMoveIntoRemote.rows[0];
    // remove updated_at becouse in will be own updated_at
    let updateData = _.omit('updated_at', objectForInsert);
    updateData = await this.prepareObject(updateData);
    const updatedColums = await this.generateColumnsForQuery(updateData);
    const query = `update "${objectToMove.tableName}_main" set ${updatedColums} where "id" = ${updateData.id}`;
    // update table
    await queryRaw.raw(query);
  }
  // end UPDATE

  // generate columns for UPDATE query
  public async generateColumnsForQuery(updateData: RemoteDb) {
    let updatedColums = ' ';
    for (const one in updateData) {
      updatedColums += updateData[one] !== null ? ` "${one}" = '${updateData[one]}',` : ` "${one}" = ${updateData[one]},`;
    }
    // remove comma
    const queryCommaPosition = updatedColums.length - 1;
    updatedColums = updatedColums.substring(0, queryCommaPosition);
    return updatedColums;
  }

  // generate columns for INSERT  query
  public async generateColumnsForInsertQuery(RemoteDbItem: RemoteDb) {
    let updatedColums = '';
    for (const one in RemoteDbItem) {
      // updatedColums += ` ${RemoteDbItem[one]},`;
      if (typeof RemoteDbItem[one] === 'object' && RemoteDbItem[one] !== null) {
        updatedColums += ` '${JSON.stringify(RemoteDbItem[one], null, '\t')}',`;
      } else if (typeof RemoteDbItem[one] === 'string') {
        updatedColums += ` '${RemoteDbItem[one]}',`;
      } else {
        updatedColums += ` ${RemoteDbItem[one]},`;
      }
    }
    // remove comma
    const queryCommaPosition = updatedColums.length - 1;
    updatedColums = updatedColums.substring(0, queryCommaPosition);
    return updatedColums;
  }

}
