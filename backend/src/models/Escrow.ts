import mongoose, { Schema, Document } from 'mongoose';

export interface IMilestone {
  milestoneId: number;
  description: string;
  amount: string;
  status: 'Pending' | 'Submitted' | 'Approved' | 'Released';
  submittedAt?: Date;
  approvedAt?: Date;
}

export interface IEscrow extends Document {
  escrowId: number;
  contractAddress?: string;
  client: string;
  freelancer: string;
  totalAmount: string;
  status: 'Created' | 'Funded' | 'InProgress' | 'Completed' | 'Disputed' | 'Cancelled';
  milestones: IMilestone[];
  lastSyncedTxHash?: string;
  lastSyncedAt?: Date;
  createdAt: Date;
}

const MilestoneSchema = new Schema<IMilestone>({
  milestoneId: { type: Number, required: true },
  description: { type: String, required: true },
  amount: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Released'], default: 'Pending' },
  submittedAt: { type: Date },
  approvedAt: { type: Date }
}, { _id: false });

const EscrowSchema = new Schema<IEscrow>({
  escrowId: { type: Number, unique: true, index: true, required: true },
  contractAddress: { type: String },
  client: { type: String, required: true, index: true },
  freelancer: { type: String, required: true, index: true },
  totalAmount: { type: String, required: true },
  status: { type: String, enum: ['Created', 'Funded', 'InProgress', 'Completed', 'Disputed', 'Cancelled'], required: true },
  milestones: [MilestoneSchema],
  lastSyncedTxHash: { type: String },
  lastSyncedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export const Escrow = mongoose.model<IEscrow>('Escrow', EscrowSchema);
export default Escrow;
