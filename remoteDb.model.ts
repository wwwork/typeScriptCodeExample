import {BaseModel} from './base.model';

export enum RecordType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
}

export class RemoteDb extends BaseModel {
  static tableName = 'synchronize_remote_db';

  recordId: number;
  operationType: string;
  tableName: string;
}
