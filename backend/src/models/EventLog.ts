import mongoose, { Schema, Document } from 'mongoose';

export interface IEventLog extends Document {
  eventType: string;
  escrowId: number;
  txHash: string;
  ledgerSequence: number;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: Date;
}

const EventLogSchema = new Schema<IEventLog>({
  eventType: { type: String, required: true },
  escrowId: { type: Number, required: true, index: true },
  txHash: { type: String, required: true },
  ledgerSequence: { type: Number, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  processed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for sorted event history queries
EventLogSchema.index({ escrowId: 1, createdAt: -1 });

// Ensure unique EventLog for (txHash + eventType) to enable idempotency in indexer
EventLogSchema.index({ txHash: 1, eventType: 1 }, { unique: true });

export const EventLog = mongoose.model<IEventLog>('EventLog', EventLogSchema);
export default EventLog;
