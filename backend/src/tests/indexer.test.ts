import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { processEvent } from '../services/indexer';
import Escrow from '../models/Escrow';
import EventLog from '../models/EventLog';

describe('Blockchain Event Indexer Verification', () => {
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

  beforeEach(async () => {
    await Escrow.deleteMany({});
    await EventLog.deleteMany({});
  });

  it('should process MilestoneApproved event, persist it once, and update milestone status', async () => {
    // 1. Setup initial Escrow with a milestone in 'Submitted' state
    const escrow = new Escrow({
      escrowId: 1001,
      client: 'client_wallet_address',
      freelancer: 'freelancer_wallet_address',
      totalAmount: '500',
      status: 'InProgress',
      milestones: [
        { milestoneId: 1, description: 'Milestone 1', amount: '500', status: 'Submitted' }
      ]
    });
    await escrow.save();

    // 2. Create mock decoded event for MilestoneApproved
    const mockEvent = {
      eventType: 'MilestoneApproved',
      escrowId: 1001,
      txHash: '0xmocktransactionhash1234567890',
      ledgerSequence: 15000,
      payload: {
        milestoneId: 1
      }
    };

    // 3. First execution
    await processEvent(mockEvent);

    // Assert EventLog is written
    const logs = await EventLog.find({ txHash: mockEvent.txHash });
    expect(logs.length).toBe(1);
    expect(logs[0].processed).toBe(true);

    // Assert Escrow milestone status is updated to 'Approved'
    const updatedEscrow = await Escrow.findOne({ escrowId: 1001 });
    expect(updatedEscrow).toBeDefined();
    expect(updatedEscrow?.milestones[0].status).toBe('Approved');

    // 4. Second execution (Test Idempotency)
    await processEvent(mockEvent);

    // Assert EventLog is NOT duplicated
    const logsAfterSecond = await EventLog.find({ txHash: mockEvent.txHash });
    expect(logsAfterSecond.length).toBe(1);
  });
});
