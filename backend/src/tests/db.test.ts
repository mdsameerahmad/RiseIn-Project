import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User from '../models/User';

describe('Database and Model Verification', () => {
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
  });

  it('should connect to in-memory database successfully', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('should create and retrieve a User document', async () => {
    const userData = {
      walletAddress: 'GBX234567890123456789012345678901234567890123456',
      displayName: 'Alice Client',
      bio: 'Freelance client account',
      avatarUrl: 'https://example.com/avatar.png',
      role: 'client' as const
    };

    const newUser = new User(userData);
    const savedUser = await newUser.save();

    expect(savedUser._id).toBeDefined();
    expect(savedUser.walletAddress).toBe(userData.walletAddress);
    expect(savedUser.displayName).toBe(userData.displayName);

    const foundUser = await User.findOne({ walletAddress: userData.walletAddress });
    expect(foundUser).toBeDefined();
    expect(foundUser?.displayName).toBe(userData.displayName);
  });

  it('should enforce unique index on walletAddress', async () => {
    const user1Data = {
      walletAddress: 'GBX_DUPLICATE',
      displayName: 'Alice Client',
      role: 'client' as const
    };

    const user2Data = {
      walletAddress: 'GBX_DUPLICATE',
      displayName: 'Bob Freelancer',
      role: 'freelancer' as const
    };

    const user1 = new User(user1Data);
    await user1.save();

    // Ensure indexes are built in the in-memory database
    await User.syncIndexes();

    const user2 = new User(user2Data);
    await expect(user2.save()).rejects.toThrow();
  });
});
