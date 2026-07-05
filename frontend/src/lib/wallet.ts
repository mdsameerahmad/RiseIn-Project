import { isConnected, requestAccess, getAddress } from '@stellar/freighter-api';

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const result = await isConnected();
    return !!result?.isConnected;
  } catch (error) {
    console.error("Error checking Freighter status:", error);
    return false;
  }
}

export async function connectWallet(): Promise<{ publicKey: string }> {
  if (typeof window === 'undefined') {
    throw new Error("Cannot connect wallet on the server side.");
  }
  
  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error("Freighter wallet is not installed.");
  }

  try {
    const result = await requestAccess();
    if (result.error) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Access request failed');
    }
    if (!result.address) {
      throw new Error("Freighter wallet returned empty address.");
    }
    return { publicKey: result.address };
  } catch (error: any) {
    throw new Error(error.message || "Failed to connect to Freighter wallet.");
  }
}

export async function getConnectedAddress(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const installed = await isFreighterInstalled();
    if (!installed) return null;
    
    const result = await getAddress();
    if (result.error || !result.address) {
      return null;
    }
    return result.address;
  } catch {
    return null;
  }
}
