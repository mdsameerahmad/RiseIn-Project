'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/lib/WalletContext';

export default function Header() {
  const { address, isConnected, connect, disconnect, loading } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err: any) {
      alert(err.message || 'Failed to connect wallet');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-indigo-500 bg-clip-text text-xl font-bold tracking-tight text-transparent">
              RiseIn Escrow
            </span>
          </Link>
        </div>

        {/* Desktop Nav links */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
            Home
          </Link>
          {isConnected && (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link href="/create-escrow" className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                Create Escrow
              </Link>
              <Link href={`/profile/${address}`} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                My Profile
              </Link>
            </>
          )}
        </nav>

        {/* Connect Button (Desktop) */}
        <div className="hidden md:flex items-center gap-4">
          {isConnected && address ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-mono text-purple-400 border border-purple-500/20">
                {formatAddress(address)}
              </span>
              <button
                onClick={disconnect}
                className="rounded-lg bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all duration-200"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="relative inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 transition-all duration-200"
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>

        {/* Hamburger Menu (Mobile) */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white focus:outline-none"
            aria-controls="mobile-menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="sr-only">Open main menu</span>
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950 px-4 pt-2 pb-4 space-y-1">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-md px-3 py-2 text-base font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            Home
          </Link>
          {isConnected && (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/create-escrow"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                Create Escrow
              </Link>
              <Link
                href={`/profile/${address}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-md px-3 py-2 text-base font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                My Profile
              </Link>
            </>
          )}

          {/* Connect Button (Mobile) */}
          <div className="pt-4 border-t border-zinc-800 flex flex-col gap-3">
            {isConnected && address ? (
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-purple-400 px-3 py-1.5 rounded-full bg-zinc-900 border border-purple-500/20">
                  {formatAddress(address)}
                </span>
                <button
                  onClick={() => {
                    disconnect();
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  await handleConnect();
                  setMobileMenuOpen(false);
                }}
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 py-2.5 text-center text-sm font-semibold text-white shadow-lg hover:from-purple-600 hover:to-pink-600"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
