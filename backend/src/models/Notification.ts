import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  walletAddress: string;
  message: string;
  relatedEscrowId?: number;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  walletAddress: { type: String, required: true, index: true },
  message: { type: String, required: true },
  relatedEscrowId: { type: Number },
  read: { type: Boolean, default: false, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Compound index on walletAddress and read status for fast unread counts
NotificationSchema.index({ walletAddress: 1, read: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
export default Notification;
