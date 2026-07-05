import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/User';
import Escrow from '../models/Escrow';
import { processEvent } from '../services/indexer';

describe('End-to-End Smoke Test', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should run end-to-end smoke test successfully', async () => {
    // 1. Hit /health
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.db).toBe('connected');

    // 2. Create user via API
    const userWallet = 'GBX_SMOKE_TEST_WALLET_CLIENT';
    const userRes = await request(app)
      .put(`/api/v1/users/${userWallet}`)
      .send({
        displayName: 'Smoke Client',
        bio: 'Automated smoke test bio',
        role: 'client'
      });
    expect(userRes.status).toBe(200);
    expect(userRes.body.success).toBe(true);
    expect(userRes.body.data.displayName).toBe('Smoke Client');

    // Verify user is in MongoDB
    const dbUser = await User.findOne({ walletAddress: userWallet });
    expect(dbUser).toBeDefined();
    expect(dbUser?.displayName).toBe('Smoke Client');

    // 3. Simulate one fake event through indexer
    const mockCreatedEvent = {
      eventType: 'ContractCreated',
      escrowId: 5001,
      txHash: '0xsmokecreatedtx112233',
      ledgerSequence: 20000,
      payload: {
        client: userWallet,
        freelancer: 'GBX_SMOKE_TEST_WALLET_FREELANCER',
        totalAmount: '2500',
        milestones: [
          { milestoneId: 1, description: 'Milestone One', amount: '2500', status: 'Pending' }
        ]
      }
    };

    await processEvent(mockCreatedEvent);

    // 4. Confirm all data is visible in MongoDB
    const dbEscrow = await Escrow.findOne({ escrowId: 5001 });
    expect(dbEscrow).toBeDefined();
    expect(dbEscrow?.client).toBe(userWallet);
    expect(dbEscrow?.freelancer).toBe('GBX_SMOKE_TEST_WALLET_FREELANCER');
    expect(dbEscrow?.totalAmount).toBe('2500');
    expect(dbEscrow?.status).toBe('Created');
  });
});
