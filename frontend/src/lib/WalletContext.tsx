'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connectWallet, getConnectedAddress, isFreighterInstalled } from './wallet';

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isInstalled: boolean;
  loading: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function initWallet() {
      const installed = await isFreighterInstalled();
      setIsInstalled(installed);

      if (installed) {
        const savedAddress = typeof window !== 'undefined' ? localStorage.getItem('freighter_address') : null;
        if (savedAddress) {
          const activeAddress = await getConnectedAddress();
          if (activeAddress === savedAddress) {
            setAddress(activeAddress);
          } else {
            localStorage.removeItem('freighter_address');
          }
        }
      }
      setLoading(false);
    }
    initWallet();
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const { publicKey } = await connectWallet();
      setAddress(publicKey);
      localStorage.setItem('freighter_address', publicKey);
      return publicKey;
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    localStorage.removeItem('freighter_address');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected: !!address,
        isInstalled,
        loading,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
