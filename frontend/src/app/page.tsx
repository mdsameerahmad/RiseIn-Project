'use client';

import Link from 'next/link';
import { useWallet } from '@/lib/WalletContext';

export default function Home() {
  const { address, isConnected, connect, loading } = useWallet();

  const handleConnect = async () => {
    try {
      await connect();
    } catch (err: any) {
      alert(err.message || 'Failed to connect wallet');
    }
  };

  return (
    <div className="relative isolate overflow-hidden bg-zinc-950">
      {/* Background gradients */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-purple-500 to-pink-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Trustless Escrow for Decentralized Freelancing
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-400">
            Secure your payments with smart contracts. Clients fund milestones on-chain, and funds are automatically released upon approval. Dispute resolution built-in.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            {isConnected ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
              >
                Go to Dashboard
              </Link>
            ) : (
              <button
                onClick={handleConnect}
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? 'Connecting...' : 'Connect Wallet to Get Started'}
              </button>
            )}
            <a
              href="#how-it-works"
              className="text-sm font-semibold leading-6 text-zinc-300 hover:text-white transition-colors"
            >
              Learn how it works <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* How it works Section */}
      <div id="how-it-works" className="mx-auto max-w-7xl px-6 lg:px-8 py-24 sm:py-32 border-t border-zinc-900 bg-zinc-950/40">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            A simple, secure, and trustless process for both clients and freelancers.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {/* Step 1 */}
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm hover:border-purple-500/30 transition-all duration-300 group">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20 group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
                  1
                </span>
                Create Escrow & Milestones
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-400">
                <p className="flex-auto">
                  The client initializes a contract, specifies the freelancer's wallet, and sets up milestones with specific token amounts.
                </p>
              </dd>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm hover:border-pink-500/30 transition-all duration-300 group">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 ring-1 ring-pink-500/20 group-hover:bg-pink-500 group-hover:text-white transition-all duration-300">
                  2
                </span>
                Fund & Work
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-400">
                <p className="flex-auto">
                  The client locks the contract funds. The freelancer submits completed work for approval milestone by milestone.
                </p>
              </dd>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm hover:border-indigo-500/30 transition-all duration-300 group">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  3
                </span>
                Approve & Release
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-zinc-400">
                <p className="flex-auto">
                  The client approves each milestone, triggering the smart contract to instantly release the locked tokens directly to the freelancer.
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Decorative footer element */}
      <div
        className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-indigo-500 to-purple-500 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>
    </div>
  );
}
