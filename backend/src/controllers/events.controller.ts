import { Request, Response, NextFunction } from 'express';
import EventLog from '../models/EventLog';

export const getEventsByEscrowId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { escrowId } = req.params;
    const events = await EventLog.find({ escrowId: Number(escrowId) }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};
