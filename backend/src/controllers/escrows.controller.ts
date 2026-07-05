import { Request, Response, NextFunction } from 'express';
import Escrow from '../models/Escrow';

export const getEscrows = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { wallet } = req.query;
    let query = {};
    if (wallet) {
      query = {
        $or: [
          { client: String(wallet) },
          { freelancer: String(wallet) }
        ]
      };
    }
    const escrows = await Escrow.find(query);
    res.status(200).json({ success: true, data: escrows });
  } catch (error) {
    next(error);
  }
};

export const getEscrowById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { escrowId } = req.params;
    const escrow = await Escrow.findOne({ escrowId: Number(escrowId) });
    if (!escrow) {
      res.status(404).json({ success: false, error: 'Escrow not found' });
      return;
    }
    res.status(200).json({ success: true, data: escrow });
  } catch (error) {
    next(error);
  }
};

export const attachMilestoneMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { escrowId } = req.params;
    const { milestoneId, description } = req.body;

    const escrow = await Escrow.findOne({ escrowId: Number(escrowId) });
    if (!escrow) {
      res.status(404).json({ success: false, error: 'Escrow not found' });
      return;
    }

    const milestoneIndex = escrow.milestones.findIndex(m => m.milestoneId === Number(milestoneId));
    if (milestoneIndex === -1) {
      res.status(404).json({ success: false, error: 'Milestone not found' });
      return;
    }

    escrow.milestones[milestoneIndex].description = description;
    await escrow.save();

    res.status(200).json({ success: true, data: escrow });
  } catch (error) {
    next(error);
  }
};
