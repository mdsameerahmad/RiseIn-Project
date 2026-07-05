import { Request, Response, NextFunction } from 'express';
import User from '../models/User';

export const getUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const user = await User.findOne({ walletAddress });
    if (!user) {
      res.status(404).json({ success: false, error: 'User profile not found' });
      return;
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const upsertUserProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const { displayName, bio, avatarUrl, role } = req.body;

    const user = await User.findOneAndUpdate(
      { walletAddress },
      {
        $set: {
          displayName,
          bio,
          avatarUrl,
          role,
          updatedAt: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
