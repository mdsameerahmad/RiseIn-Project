import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  walletAddress: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  role?: 'client' | 'freelancer' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    walletAddress: { type: String, unique: true, index: true, required: true },
    displayName: { type: String },
    bio: { type: String },
    avatarUrl: { type: String },
    role: { type: String, enum: ['client', 'freelancer', 'both'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }
);

// Update updatedAt field on save/update
UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;
