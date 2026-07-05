import { rpc, scValToNative } from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const rpcServer = new rpc.Server(SOROBAN_RPC_URL);

export interface DecodedEvent {
  eventType: string;
  escrowId: number;
  txHash: string;
  ledgerSequence: number;
  payload: any;
}

export const getContractEvents = async (
  startLedger: number,
  contractIds: string[]
): Promise<DecodedEvent[]> => {
  try {
    const response = await rpcServer.getEvents({
      startLedger,
      filters: [
        {
          contractIds,
          type: 'contract'
        }
      ],
      limit: 100
    });

    const decodedEvents: DecodedEvent[] = response.events.map((event) => {
      let payload: any = {};
      try {
        if (event.value) {
          const valXdr = typeof (event.value as any).xdr === 'function' ? (event.value as any).xdr() : event.value;
          payload = scValToNative(valXdr);
        }
      } catch (err) {
        console.error('Failed to decode event value:', err);
      }

      let eventType = 'Unknown';
      let escrowId = 0;
      try {
        if (event.topic && event.topic.length > 0) {
          const nativeTopics = event.topic.map((t) => {
            const topicXdr = typeof (t as any).xdr === 'function' ? (t as any).xdr() : t;
            return scValToNative(topicXdr);
          });
          eventType = String(nativeTopics[0]);
          if (nativeTopics.length > 1) {
            escrowId = Number(nativeTopics[1]);
          }
        }
      } catch (err) {
        console.error('Failed to decode event topics:', err);
      }

      return {
        eventType,
        escrowId,
        txHash: event.txHash || '',
        ledgerSequence: Number(event.ledger) || 0,
        payload
      };
    });

    return decodedEvents;
  } catch (error) {
    console.error('Error fetching Soroban events:', error);
    return [];
  }
};
