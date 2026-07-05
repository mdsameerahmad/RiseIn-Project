import { Request, Response, NextFunction } from 'express';
import ReputationCache from '../models/ReputationCache';

export const getReputation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const reputation = await ReputationCache.findOne({ walletAddress });
    if (!reputation) {
      res.status(404).json({
        success: false,
        error: 'Reputation cache not found for this wallet address'
      });
      return;
    }
    res.status(200).json({ success: true, data: reputation });
  } catch (error) {
    next(error);
  }
};
