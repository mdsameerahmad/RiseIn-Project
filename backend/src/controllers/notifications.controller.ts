import { Request, Response, NextFunction } from 'express';
import Notification from '../models/Notification';

export const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { wallet } = req.query;
    if (!wallet) {
      res.status(400).json({ success: false, error: 'wallet query parameter is required' });
      return;
    }
    const notifications = await Notification.find({ walletAddress: String(wallet) }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};
