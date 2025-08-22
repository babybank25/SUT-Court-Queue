import { CrudRepository } from '../crud';
import { database } from '../connection';
import { AppError } from '../../middleware';

// Mock the database connection
jest.mock('../connection');

const mockDatabase = database as jest.Mocked<typeof database>;

interface TestEntity {
  id: string;
  name: string;
  value: number;
  status: string;
}

describe('CrudRepository', () => {
  let repository: CrudRepository<TestEntity>;

  beforeEach(() => {
    repository = new CrudRepository<TestEntity>({
      tableName: 'test_entities',
      primaryKey: 'id'
    });
    
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new record', async () => {
      const newData = { name: 'Test Entity', value: 100, status: 'active' };
      const createdEntity = { id: '1', ...newData };

      mockDatabase.run.mockResolvedValue({ lastID: '1', changes: 1 });
      mockDatabase.get.mockResolvedValue(createdEntity);

      const result = await repository.create(newData);

      expect(result).toEqual(createdEntity);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'INSERT INTO test_entities (name, value, status) VALUES (?, ?, ?)',
        ['Test Entity', 100, 'active']
      );
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE id = ?',
        ['1']
      );
    });

    it('should throw error when creation fails', async () => {
      mockDatabase.run.mockResolvedValue({ lastID: null, changes: 0 });

      await expect(repository.create({ name: 'Test' }))
        .rejects
        .toThrow(new AppError('Failed to create record', 500, 'CREATE_FAILED'));
    });

    it('should handle database errors', async () => {
      mockDatabase.run.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.create({ name: 'Test' }))
        .rejects
        .toThrow(new AppError('Failed to create test_entities record', 500, 'DATABASE_ERROR'));
    });
  });

  describe('findById', () => {
    it('should find record by id', async () => {
      const entity = { id: '1', name: 'Test Entity', value: 100, status: 'active' };
      mockDatabase.get.mockResolvedValue(entity);

      const result = await repository.findById('1');

      expect(result).toEqual(entity);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE id = ?',
        ['1']
      );
    });

    it('should throw error when record not found', async () => {
      mockDatabase.get.mockResolvedValue(null);

      await expect(repository.findById('999'))
        .rejects
        .toThrow(new AppError('test_entities record not found', 404, 'NOT_FOUND'));
    });

    it('should handle database errors', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById('1'))
        .rejects
        .toThrow(new AppError('Failed to find test_entities record', 500, 'DATABASE_ERROR'));
    });
  });

  describe('findAll', () => {
    it('should find all records without conditions', async () => {
      const entities = [
        { id: '1', name: 'Entity 1', value: 100, status: 'active' },
        { id: '2', name: 'Entity 2', value: 200, status: 'inactive' }
      ];
      mockDatabase.all.mockResolvedValue(entities);

      const result = await repository.findAll();

      expect(result).toEqual(entities);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        'SELECT * FROM test_entities',
        []
      );
    });

    it('should find records with conditions', async () => {
      const entities = [
        { id: '1', name: 'Entity 1', value: 100, status: 'active' }
      ];
      mockDatabase.all.mockResolvedValue(entities);

      const result = await repository.findAll({ status: 'active' });

      expect(result).toEqual(entities);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE status = ?',
        ['active']
      );
    });

    it('should find records with multiple conditions', async () => {
      const entities = [
        { id: '1', name: 'Entity 1', value: 100, status: 'active' }
      ];
      mockDatabase.all.mockResolvedValue(entities);

      const result = await repository.findAll({ status: 'active', value: 100 });

      expect(result).toEqual(entities);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        'SELECT * FROM test_entities WHERE status = ? AND value = ?',
        ['active', 100]
      );
    });

    it('should find records with limit and offset', async () => {
      const entities = [
        { id: '1', name: 'Entity 1', value: 100, status: 'active' }
      ];
      mockDatabase.all.mockResolvedValue(entities);

      const result = await repository.findAll({}, 10, 20);

      expect(result).toEqual(entities);
      expect(mockDatabase.all).toHaveBeenCalledWith(
        'SELECT * FROM test_entities LIMIT ? OFFSET ?',
        [10, 20]
      );
    });

    it('should handle database errors', async () => {
      mockDatabase.all.mockRejectedValue(new Error('Database error'));

      await expect(repository.findAll())
        .rejects
        .toThrow(new AppError('Failed to fetch test_entities records', 500, 'DATABASE_ERROR'));
    });
  });

  describe('update', () => {
    it('should update record', async () => {
      const updateData = { name: 'Updated Entity', value: 150 };
      const updatedEntity = { id: '1', ...updateData, status: 'active' };

      mockDatabase.run.mockResolvedValue({ changes: 1 });
      mockDatabase.get.mockResolvedValue(updatedEntity);

      const result = await repository.update('1', updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'UPDATE test_entities SET name = ?, value = ? WHERE id = ?',
        ['Updated Entity', 150, '1']
      );
    });

    it('should throw error when record not found', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 0 });

      await expect(repository.update('999', { name: 'Updated' }))
        .rejects
        .toThrow(new AppError('test_entities record not found', 404, 'NOT_FOUND'));
    });

    it('should handle database errors', async () => {
      mockDatabase.run.mockRejectedValue(new Error('Database error'));

      await expect(repository.update('1', { name: 'Updated' }))
        .rejects
        .toThrow(new AppError('Failed to update test_entities record', 500, 'DATABASE_ERROR'));
    });
  });

  describe('delete', () => {
    it('should delete record', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 1 });

      const result = await repository.delete('1');

      expect(result).toBe(true);
      expect(mockDatabase.run).toHaveBeenCalledWith(
        'DELETE FROM test_entities WHERE id = ?',
        ['1']
      );
    });

    it('should throw error when record not found', async () => {
      mockDatabase.run.mockResolvedValue({ changes: 0 });

      await expect(repository.delete('999'))
        .rejects
        .toThrow(new AppError('test_entities record not found', 404, 'NOT_FOUND'));
    });

    it('should handle database errors', async () => {
      mockDatabase.run.mockRejectedValue(new Error('Database error'));

      await expect(repository.delete('1'))
        .rejects
        .toThrow(new AppError('Failed to delete test_entities record', 500, 'DATABASE_ERROR'));
    });
  });

  describe('count', () => {
    it('should count all records', async () => {
      mockDatabase.get.mockResolvedValue({ count: 5 });

      const result = await repository.count();

      expect(result).toBe(5);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_entities',
        []
      );
    });

    it('should count records with conditions', async () => {
      mockDatabase.get.mockResolvedValue({ count: 3 });

      const result = await repository.count({ status: 'active' });

      expect(result).toBe(3);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM test_entities WHERE status = ?',
        ['active']
      );
    });

    it('should return 0 when no result', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await repository.count();

      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database error'));

      await expect(repository.count())
        .rejects
        .toThrow(new AppError('Failed to count test_entities records', 500, 'DATABASE_ERROR'));
    });
  });

  describe('exists', () => {
    it('should return true when record exists', async () => {
      mockDatabase.get.mockResolvedValue({ id: '1' });

      const result = await repository.exists('1');

      expect(result).toBe(true);
      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT 1 FROM test_entities WHERE id = ? LIMIT 1',
        ['1']
      );
    });

    it('should return false when record does not exist', async () => {
      mockDatabase.get.mockResolvedValue(null);

      const result = await repository.exists('999');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockDatabase.get.mockRejectedValue(new Error('Database error'));

      await expect(repository.exists('1'))
        .rejects
        .toThrow(new AppError('Failed to check test_entities existence', 500, 'DATABASE_ERROR'));
    });
  });

  describe('transaction', () => {
    it('should execute callback in transaction', async () => {
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockDatabase.transaction.mockImplementation(async (callback) => {
        return await callback();
      });

      const result = await repository.transaction(mockCallback);

      expect(result).toBe('result');
      expect(mockDatabase.transaction).toHaveBeenCalledWith(mockCallback);
    });

    it('should handle transaction errors', async () => {
      const mockCallback = jest.fn().mockRejectedValue(new Error('Transaction failed'));
      mockDatabase.transaction.mockImplementation(async (callback) => {
        return await callback();
      });

      await expect(repository.transaction(mockCallback))
        .rejects
        .toThrow('Transaction failed');
    });
  });

  describe('custom primary key', () => {
    it('should use custom primary key', async () => {
      const customRepository = new CrudRepository<TestEntity>({
        tableName: 'custom_entities',
        primaryKey: 'uuid'
      });

      const entity = { uuid: 'abc-123', name: 'Test', value: 100, status: 'active' };
      mockDatabase.get.mockResolvedValue(entity);

      await customRepository.findById('abc-123');

      expect(mockDatabase.get).toHaveBeenCalledWith(
        'SELECT * FROM custom_entities WHERE uuid = ?',
        ['abc-123']
      );
    });
  });
});