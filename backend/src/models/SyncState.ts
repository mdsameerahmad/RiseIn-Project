import mongoose, { Schema, Document } from 'mongoose';

export interface ISyncState extends Document {
  lastLedger: number;
}

const SyncStateSchema = new Schema<ISyncState>({
  lastLedger: { type: Number, required: true, default: 0 }
});

export const SyncState = mongoose.model<ISyncState>('SyncState', SyncStateSchema);
export default SyncState;
