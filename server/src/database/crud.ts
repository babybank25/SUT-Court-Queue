import { database } from './connection';
import { AppError } from '../middleware';

export interface CrudOptions {
  tableName: string;
  primaryKey?: string;
}

export class CrudRepository<T = any> {
  protected tableName: string;
  protected primaryKey: string;

  constructor(options: CrudOptions) {
    this.tableName = options.tableName;
    this.primaryKey = options.primaryKey || 'id';
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map(() => '?').join(', ');
      
      const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
      const result = await database.run(sql, values);
      
      if (!result.lastID) {
        throw new AppError('Failed to create record', 500, 'CREATE_FAILED');
      }
      
      return await this.findById(result.lastID as string);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create ${this.tableName} record`, 500, 'DATABASE_ERROR');
    }
  }

  async findById(id: string | number): Promise<T> {
    try {
      const sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const record = await database.get<T>(sql, [id]);
      
      if (!record) {
        throw new AppError(`${this.tableName} record not found`, 404, 'NOT_FOUND');
      }
      
      return record;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to find ${this.tableName} record`, 500, 'DATABASE_ERROR');
    }
  }

  async findAll(conditions?: Partial<T>, limit?: number, offset?: number): Promise<T[]> {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];
      
      if (conditions && Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${key} = ?`)
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }
      
      if (limit) {
        sql += ` LIMIT ?`;
        params.push(limit);
        
        if (offset) {
          sql += ` OFFSET ?`;
          params.push(offset);
        }
      }
      
      return await database.all<T>(sql, params);
    } catch (error) {
      throw new AppError(`Failed to fetch ${this.tableName} records`, 500, 'DATABASE_ERROR');
    }
  }

  async update(id: string | number, data: Partial<T>): Promise<T> {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      
      const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE ${this.primaryKey} = ?`;
      const result = await database.run(sql, [...values, id]);
      
      if (result.changes === 0) {
        throw new AppError(`${this.tableName} record not found`, 404, 'NOT_FOUND');
      }
      
      return await this.findById(id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update ${this.tableName} record`, 500, 'DATABASE_ERROR');
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
      const result = await database.run(sql, [id]);
      
      if (result.changes === 0) {
        throw new AppError(`${this.tableName} record not found`, 404, 'NOT_FOUND');
      }
      
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete ${this.tableName} record`, 500, 'DATABASE_ERROR');
    }
  }

  async count(conditions?: Partial<T>): Promise<number> {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];
      
      if (conditions && Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${key} = ?`)
          .join(' AND ');
        sql += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }
      
      const result = await database.get<{ count: number }>(sql, params);
      return result?.count || 0;
    } catch (error) {
      throw new AppError(`Failed to count ${this.tableName} records`, 500, 'DATABASE_ERROR');
    }
  }

  async exists(id: string | number): Promise<boolean> {
    try {
      const sql = `SELECT 1 FROM ${this.tableName} WHERE ${this.primaryKey} = ? LIMIT 1`;
      const result = await database.get(sql, [id]);
      return !!result;
    } catch (error) {
      throw new AppError(`Failed to check ${this.tableName} existence`, 500, 'DATABASE_ERROR');
    }
  }

  // Transaction support
  async transaction<R>(callback: () => Promise<R>): Promise<R> {
    return await database.transaction(callback);
  }
}