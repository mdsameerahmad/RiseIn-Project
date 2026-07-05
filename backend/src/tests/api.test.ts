import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import app from '../app';
import User from '../models/User';
import Escrow from '../models/Escrow';
import Notification from '../models/Notification';

describe('REST API Layer Verification', () => {
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
    await User.deleteMany({});
    await Escrow.deleteMany({});
    await Notification.deleteMany({});
  });

  describe('GET /api/v1/escrows', () => {
    it('should return empty list when no escrows exist', async () => {
      const res = await request(app).get('/api/v1/escrows');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('should filter escrows by wallet address when query is provided', async () => {
      const escrow1 = new Escrow({
        escrowId: 101,
        contractAddress: 'address1',
        client: 'client_wallet',
        freelancer: 'freelancer_wallet',
        totalAmount: '1000',
        status: 'Created',
        milestones: [{ milestoneId: 1, description: 'M1', amount: '1000', status: 'Pending' }]
      });

      const escrow2 = new Escrow({
        escrowId: 102,
        contractAddress: 'address2',
        client: 'other_client',
        freelancer: 'other_freelancer',
        totalAmount: '2000',
        status: 'Created',
        milestones: [{ milestoneId: 1, description: 'M1', amount: '2000', status: 'Pending' }]
      });

      await escrow1.save();
      await escrow2.save();

      // Retrieve with client_wallet
      const res = await request(app).get('/api/v1/escrows?wallet=client_wallet');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].escrowId).toBe(101);
    });
  });

  describe('GET /api/v1/escrows/:escrowId', () => {
    it('should return 404 for a non-existent escrow', async () => {
      const res = await request(app).get('/api/v1/escrows/999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Escrow not found');
    });

    it('should return the escrow details for a valid escrowId', async () => {
      const escrow = new Escrow({
        escrowId: 201,
        contractAddress: 'address201',
        client: 'client_wallet',
        freelancer: 'freelancer_wallet',
        totalAmount: '1500',
        status: 'Funded',
        milestones: []
      });
      await escrow.save();

      const res = await request(app).get('/api/v1/escrows/201');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.escrowId).toBe(201);
    });
  });

  describe('POST /api/v1/escrows/:escrowId/metadata', () => {
    it('should attach off-chain rich description to a milestone successfully', async () => {
      const escrow = new Escrow({
        escrowId: 301,
        client: 'client_wallet',
        freelancer: 'freelancer_wallet',
        totalAmount: '500',
        status: 'InProgress',
        milestones: [
          { milestoneId: 1, description: 'Initial Milestone', amount: '250', status: 'Pending' },
          { milestoneId: 2, description: 'Final Milestone', amount: '250', status: 'Pending' }
        ]
      });
      await escrow.save();

      const res = await request(app)
        .post('/api/v1/escrows/301/metadata')
        .send({
          milestoneId: 1,
          description: 'Updated Rich Description'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.milestones[0].description).toBe('Updated Rich Description');

      // Verify db update
      const updatedEscrow = await Escrow.findOne({ escrowId: 301 });
      expect(updatedEscrow?.milestones[0].description).toBe('Updated Rich Description');
    });

    it('should return 400 on validation failure', async () => {
      const res = await request(app)
        .post('/api/v1/escrows/301/metadata')
        .send({
          milestoneId: -1, // invalid milestoneId (negative)
          description: '' // empty description
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/users/:walletAddress', () => {
    it('should return 404 if user profile is not found', async () => {
      const res = await request(app).get('/api/v1/users/non_existent_wallet');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('User profile not found');
    });

    it('should return user profile if found', async () => {
      const user = new User({
        walletAddress: 'user_wallet_123',
        displayName: 'Bob The Builder',
        role: 'freelancer'
      });
      await user.save();

      const res = await request(app).get('/api/v1/users/user_wallet_123');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Bob The Builder');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const notification = new Notification({
        walletAddress: 'wallet_abc',
        message: 'Milestone Submitted!',
        relatedEscrowId: 101,
        read: false
      });
      await notification.save();

      const res = await request(app).patch(`/api/v1/notifications/${notification._id}/read`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.read).toBe(true);

      // Verify db
      const updatedNotification = await Notification.findById(notification._id);
      expect(updatedNotification?.read).toBe(true);
    });

    it('should return 404 for a non-existent notification ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).patch(`/api/v1/notifications/${fakeId}/read`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Notification not found');
    });
  });
});
