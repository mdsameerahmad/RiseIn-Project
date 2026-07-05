import mongoose, { Schema, Document } from 'mongoose';

export interface IDispute extends Document {
  escrowId: number;
  raisedBy: string;
  reason: string;
  evidenceUrls: string[];
  status: 'Open' | 'Resolved';
  resolution?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

const DisputeSchema = new Schema<IDispute>({
  escrowId: { type: Number, required: true, index: true },
  raisedBy: { type: String, required: true },
  reason: { type: String, required: true },
  evidenceUrls: { type: [String], default: [] },
  status: { type: String, enum: ['Open', 'Resolved'], default: 'Open', required: true },
  resolution: { type: String },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
export default Dispute;
