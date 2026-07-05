import { EventLog } from '../models/EventLog';
import { Escrow } from '../models/Escrow';
import { Dispute } from '../models/Dispute';
import { Notification } from '../models/Notification';
import { SyncState } from '../models/SyncState';
import { emitToWallet } from '../sockets';
import { getContractEvents, DecodedEvent } from './soroban';
import dotenv from 'dotenv';

dotenv.config();

const ESCROW_CONTRACT_ID = process.env.ESCROW_CONTRACT_ID || '';
const REPUTATION_CONTRACT_ID = process.env.REPUTATION_CONTRACT_ID || '';
const DISPUTE_CONTRACT_ID = process.env.DISPUTE_CONTRACT_ID || '';

const contractIds = [ESCROW_CONTRACT_ID, REPUTATION_CONTRACT_ID, DISPUTE_CONTRACT_ID].filter(Boolean);

export const processEvent = async (event: DecodedEvent): Promise<void> => {
  const { eventType, escrowId, txHash, ledgerSequence, payload } = event;

  const existingLog = await EventLog.findOne({ txHash, eventType });
  if (existingLog) {
    console.log(`Event ignored (duplicate check): ${eventType} for tx ${txHash}`);
    return;
  }

  const eventLog = new EventLog({
    eventType,
    escrowId,
    txHash,
    ledgerSequence,
    payload,
    processed: false
  });
  await eventLog.save();

  switch (eventType) {
    case 'ContractCreated': {
      const { client, freelancer, totalAmount, milestones } = payload;
      const mappedMilestones = Array.isArray(milestones)
        ? milestones.map((m: any) => ({
            milestoneId: Number(m.milestoneId),
            description: String(m.description || `Milestone ${m.milestoneId}`),
            amount: String(m.amount),
            status: m.status || 'Pending'
          }))
        : [];

      await Escrow.findOneAndUpdate(
        { escrowId },
        {
          $setOnInsert: {
            escrowId,
            client,
            freelancer,
            totalAmount: String(totalAmount),
            status: 'Created',
            milestones: mappedMilestones,
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      emitToWallet(client, 'escrow:created', { escrowId });
      emitToWallet(freelancer, 'escrow:created', { escrowId });
      break;
    }

    case 'Funded': {
      await Escrow.findOneAndUpdate(
        { escrowId },
        {
          $set: {
            status: 'Funded',
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'escrow:updated', { escrowId, status: 'Funded' });
        emitToWallet(escrow.freelancer, 'escrow:updated', { escrowId, status: 'Funded' });
      }
      break;
    }

    case 'MilestoneSubmitted': {
      const { milestoneId } = payload;
      await Escrow.updateOne(
        { escrowId, 'milestones.milestoneId': Number(milestoneId) },
        {
          $set: {
            'milestones.$.status': 'Submitted',
            'milestones.$.submittedAt': new Date(),
            status: 'InProgress',
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'milestone:submitted', { escrowId, milestoneId });
        const notif = new Notification({
          walletAddress: escrow.client,
          message: `Milestone #${milestoneId} has been submitted for escrow #${escrowId}.`,
          relatedEscrowId: escrowId,
          read: false
        });
        await notif.save();
      }
      break;
    }

    case 'MilestoneApproved': {
      const { milestoneId } = payload;
      await Escrow.updateOne(
        { escrowId, 'milestones.milestoneId': Number(milestoneId) },
        {
          $set: {
            'milestones.$.status': 'Approved',
            'milestones.$.approvedAt': new Date(),
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'milestone:approved', { escrowId, milestoneId });
        emitToWallet(escrow.freelancer, 'milestone:approved', { escrowId, milestoneId });
      }
      break;
    }

    case 'FundsReleased': {
      const { milestoneId } = payload;
      await Escrow.updateOne(
        { escrowId, 'milestones.milestoneId': Number(milestoneId) },
        {
          $set: {
            'milestones.$.status': 'Released',
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'escrow:updated', { escrowId, status: escrow.status });
        emitToWallet(escrow.freelancer, 'escrow:updated', { escrowId, status: escrow.status });

        const notif = new Notification({
          walletAddress: escrow.freelancer,
          message: `Funds for milestone #${milestoneId} of escrow #${escrowId} have been released.`,
          relatedEscrowId: escrowId,
          read: false
        });
        await notif.save();
      }
      break;
    }

    case 'DisputeRaised': {
      const { raisedBy, reason, evidenceUrls } = payload;
      await Escrow.findOneAndUpdate(
        { escrowId },
        {
          $set: {
            status: 'Disputed',
            lastSyncedTxHash: txHash,
            lastSyncedAt: new Date()
          }
        }
      );

      await Dispute.findOneAndUpdate(
        { escrowId },
        {
          $set: {
            raisedBy,
            reason,
            evidenceUrls: evidenceUrls || [],
            status: 'Open',
            createdAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'dispute:raised', { escrowId });
        emitToWallet(escrow.freelancer, 'dispute:raised', { escrowId });
      }
      break;
    }

    case 'DisputeResolved': {
      const { resolution } = payload;
      await Dispute.findOneAndUpdate(
        { escrowId },
        {
          $set: {
            status: 'Resolved',
            resolution,
            resolvedAt: new Date()
          }
        }
      );

      const escrow = await Escrow.findOne({ escrowId });
      if (escrow) {
        emitToWallet(escrow.client, 'dispute:resolved', { escrowId, resolution });
        emitToWallet(escrow.freelancer, 'dispute:resolved', { escrowId, resolution });
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  eventLog.processed = true;
  await eventLog.save();
};

export const indexerLoop = async (): Promise<void> => {
  try {
    let syncState = await SyncState.findOne();
    if (!syncState) {
      syncState = new SyncState({ lastLedger: 1 });
      await syncState.save();
    }

    const startLedger = syncState.lastLedger;
    const events = await getContractEvents(startLedger, contractIds);

    let maxLedger = startLedger;
    for (const event of events) {
      try {
        await processEvent(event);
        if (event.ledgerSequence > maxLedger) {
          maxLedger = event.ledgerSequence;
        }
      } catch (err) {
        console.error('Failed to process individual event:', err);
      }
    }

    if (maxLedger > startLedger) {
      syncState.lastLedger = maxLedger + 1;
      await syncState.save();
    }
  } catch (error) {
    console.error('Indexer loop error:', error);
  }
};

let indexerInterval: NodeJS.Timeout | null = null;

export const startIndexer = (intervalMs = 8000): void => {
  if (indexerInterval) {
    return;
  }
  indexerInterval = setInterval(indexerLoop, intervalMs);
};

export const stopIndexer = (): void => {
  if (indexerInterval) {
    clearInterval(indexerInterval);
    indexerInterval = null;
  }
};
