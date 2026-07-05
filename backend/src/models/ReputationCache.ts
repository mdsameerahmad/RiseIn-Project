import mongoose, { Schema, Document } from 'mongoose';

export interface IReputationCache extends Document {
  walletAddress: string;
  completedContracts: number;
  averageRating: number;
  onTimePercentage: number;
  lastSyncedAt?: Date;
}

const ReputationCacheSchema = new Schema<IReputationCache>({
  walletAddress: { type: String, unique: true, index: true, required: true },
  completedContracts: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  onTimePercentage: { type: Number, default: 0 },
  lastSyncedAt: { type: Date }
});

export const ReputationCache = mongoose.model<IReputationCache>('ReputationCache', ReputationCacheSchema);
export default ReputationCache;
