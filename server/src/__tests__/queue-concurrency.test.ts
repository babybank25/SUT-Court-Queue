import express from 'express';
import request from 'supertest';
import { initializeDatabase, closeDatabase } from '../database';
import queueRouter from '../routes/queue';

describe('Concurrent queue joins', () => {
  let app: express.Application;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    await initializeDatabase();
    app = express();
    app.use(express.json());
    app.use('/api/queue', queueRouter);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    await initializeDatabase();
  });

  it('assigns unique positions when multiple teams join concurrently', async () => {
    const teams = Array.from({ length: 5 }, (_, i) => ({
      name: `Team ${i + 1}`,
      members: 5,
    }));

    const responses = await Promise.all(
      teams.map(team =>
        request(app)
          .post('/api/queue/join')
          .send(team)
          .expect(201)
      )
    );

    const positions = responses.map(res => res.body.data.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(positions).size).toBe(teams.length);
  });
});
