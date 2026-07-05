import { Request, Response, NextFunction } from 'express';
import Dispute from '../models/Dispute';

export const createDispute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { escrowId, raisedBy, reason, evidenceUrls } = req.body;

    const dispute = new Dispute({
      escrowId,
      raisedBy,
      reason,
      evidenceUrls,
      status: 'Open'
    });

    await dispute.save();
    res.status(201).json({ success: true, data: dispute });
  } catch (error) {
    next(error);
  }
};
