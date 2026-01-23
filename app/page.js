'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  FileText,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { keccak256 } from 'js-sha3';

/* ===================== CONFIG ===================== */

const ARC_TESTNET_CONFIG = {
  chainId: '0x4CEF52',
  chainName: 'Arc Network Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
  apiUrl: 'https://testnet.arcscan.app/api'
};

const CONTRACT_ADDRESS = '0xd2d97209aFd34B9865fda1eA7B0c390395321B32';

const EVENT_SIGNATURES = {
  StatementPublished: '0x' + keccak256('StatementPublished(address,bytes32,uint256)'),
  StatementRevoked: '0x' + keccak256('StatementRevoked(address,bytes32,uint256)')
};

/* ===================== UTILS ===================== */

async function rpcCall(method: string, params: any[] = []) {
  const res = await fetch(ARC_TESTNET_CONFIG.rpcUrls[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getBlockNumber() {
  const hex = await rpcCall('eth_blockNumber');
  return parseInt(hex, 16);
}

async function getLogs(params: any) {
  return rpcCall('eth_getLogs', [params]);
}

async function fetchExplorerData(address: string) {
  try {
    const res = await fetch(
      `${ARC_TESTNET_CONFIG.apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`
    );
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

/* ===================== MAIN ===================== */

export default function ARCEDRegistry() {
  const [page, setPage] = useState('home');
  const [addressInput, setAddressInput] = useState('');
  const [viewAddress, setViewAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const handleViewAddress = (addr: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      alert('Invalid address');
      return;
    }
    setViewAddress(addr.toLowerCase());
    setPage('viewer');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setPage('home')}
        >
          <Shield className="text-blue-400" />
          <span className="font-bold">ARCED</span>
        </div>
        <nav className="flex gap-2 text-sm">
          {['home', 'publish', 'revoke', 'builder', 'onchain'].map(t => (
            <button
              key={t}
              onClick={() => setPage(t)}
              className={`px-3 py-1 rounded ${
                page === t ? 'bg-blue-600' : 'bg-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="p-6">
        {page === 'home' && (
          <HomePage
            addressInput={addressInput}
            setAddressInput={setAddressInput}
            onViewAddress={handleViewAddress}
          />
        )}
        {page === 'viewer' && <AddressViewer address={viewAddress} />}
        {page === 'publish' && (
          <PublishPage
            walletAddress={walletAddress}
            setWalletAddress={setWalletAddress}
          />
        )}
        {page === 'revoke' && (
          <RevokePage
            walletAddress={walletAddress}
            setWalletAddress={setWalletAddress}
          />
        )}
        {page === 'builder' && (
          <BuilderScorePage
            addressInput={addressInput}
            setAddressInput={setAddressInput}
          />
        )}
        {page === 'onchain' && (
          <OnchainScorePage
            addressInput={addressInput}
            setAddressInput={setAddressInput}
          />
        )}
      </main>
    </div>
  );
}

/* ===================== HOME ===================== */

function HomePage({ addressInput, setAddressInput, onViewAddress }: any) {
  const [stats, setStats] = useState({ published: 0, revoked: 0 });

  useEffect(() => {
    (async () => {
      const current = await getBlockNumber();
      const from = Math.max(0, current - 100000);

      const pub = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + current.toString(16),
        topics: [EVENT_SIGNATURES.StatementPublished]
      });

      const rev = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + current.toString(16),
        topics: [EVENT_SIGNATURES.StatementRevoked]
      });

      setStats({ published: pub.length, revoked: rev.length });
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-center">Onchain Statement Registry</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-900/30 p-4 rounded">
          <CheckCircle2 className="text-green-400" />
          <div className="text-2xl">{stats.published}</div>
        </div>
        <div className="bg-red-900/30 p-4 rounded">
          <XCircle className="text-red-400" />
          <div className="text-2xl">{stats.revoked}</div>
        </div>
      </div>

      <div className="space-y-2">
        <input
          value={addressInput}
          onChange={e => setAddressInput(e.target.value)}
          placeholder="0x..."
          className="w-full bg-slate-900 p-3 rounded"
        />
        <button
          onClick={() => onViewAddress(addressInput)}
          className="w-full bg-blue-600 py-2 rounded"
        >
          View Address
        </button>
      </div>
    </div>
  );
}

/* ===================== VIEWER ===================== */

function AddressViewer({ address }: any) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    (async () => {
      setLoading(true);
      const current = await getBlockNumber();
      const from = Math.max(0, current - 100000);
      const padded = '0x' + address.slice(2).padStart(64, '0');

      const pub = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + current.toString(16),
        topics: [EVENT_SIGNATURES.StatementPublished, padded]
      });

      const rev = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + current.toString(16),
        topics: [EVENT_SIGNATURES.StatementRevoked, padded]
      });

      setEvents([
        ...pub.map((l: any) => ({ type: 'published', hash: l.topics[2] })),
        ...rev.map((l: any) => ({ type: 'revoked', hash: l.topics[2] }))
      ]);
      setLoading(false);
    })();
  }, [address]);

  if (loading) return <div className="text-center">Loading…</div>;
  if (!events.length)
    return (
      <div className="text-center text-slate-400">
        <AlertCircle className="mx-auto" />
        No events
      </div>
    );

  return (
    <div className="space-y-3 max-w-xl mx-auto">
      {events.map((e, i) => (
        <EventCard key={i} event={e} />
      ))}
    </div>
  );
}

/* ===================== EVENT CARD ===================== */

function EventCard({ event }: any) {
  return (
    <div
      className={`p-4 rounded border ${
        event.type === 'published'
          ? 'border-green-500/30 bg-green-900/20'
          : 'border-red-500/30 bg-red-900/20'
      }`}
    >
      <div className="flex items-center gap-2">
        {event.type === 'published' ? (
          <CheckCircle2 className="text-green-400" />
        ) : (
          <XCircle className="text-red-400" />
        )}
        <span className="font-mono text-xs break-all">{event.hash}</span>
      </div>
    </div>
  );
}/* ===================== PUBLISH ===================== */

function PublishPage({ walletAddress, setWalletAddress }: any) {
  const [statement, setStatement] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [txHash, setTxHash] = useState('');

  const connectWallet = async () => {
    if (!window.ethereum) return alert('MetaMask not found');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWalletAddress(accounts[0].toLowerCase());
  };

  const handlePublish = async () => {
    if (!statement) return alert('Enter statement');
    if (!window.ethereum) return;

    setPublishing(true);
    setTxHash('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const hash = '0x' + keccak256(statement);
      const selector = '0x' + keccak256('publishStatement(bytes32)').slice(0, 8);
      const data = selector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: accounts[0], to: CONTRACT_ADDRESS, data }]
      });

      setTxHash(tx);
      setStatement('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Publish Statement</h2>

      <textarea
        value={statement}
        onChange={e => setStatement(e.target.value)}
        className="w-full bg-slate-900 p-3 rounded"
        rows={4}
        placeholder="Your private statement (hash only)"
      />

      {!walletAddress ? (
        <button onClick={connectWallet} className="w-full bg-blue-600 py-2 rounded">
          Connect Wallet
        </button>
      ) : (
        <>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="w-full bg-green-600 py-2 rounded"
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          <button
            onClick={() => setWalletAddress('')}
            className="w-full bg-slate-700 py-2 rounded"
          >
            Disconnect
          </button>
        </>
      )}

      {txHash && (
        <a
          href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-xs break-all text-green-400"
        >
          {txHash}
        </a>
      )}
    </div>
  );
}

/* ===================== REVOKE ===================== */

function RevokePage({ walletAddress, setWalletAddress }: any) {
  const [hash, setHash] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [txHash, setTxHash] = useState('');

  const connectWallet = async () => {
    if (!window.ethereum) return alert('MetaMask not found');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    setWalletAddress(accounts[0].toLowerCase());
  };

  const handleRevoke = async () => {
    if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return alert('Invalid hash');
    if (!window.ethereum) return;

    setRevoking(true);
    setTxHash('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const selector = '0x' + keccak256('revokeStatement(bytes32)').slice(0, 8);
      const data = selector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: accounts[0], to: CONTRACT_ADDRESS, data }]
      });

      setTxHash(tx);
      setHash('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Revoke Statement</h2>

      <input
        value={hash}
        onChange={e => setHash(e.target.value)}
        placeholder="0x… statement hash"
        className="w-full bg-slate-900 p-3 rounded font-mono"
      />

      {!walletAddress ? (
        <button onClick={connectWallet} className="w-full bg-blue-600 py-2 rounded">
          Connect Wallet
        </button>
      ) : (
        <>
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className="w-full bg-red-600 py-2 rounded"
          >
            {revoking ? 'Revoking…' : 'Revoke'}
          </button>
          <button
            onClick={() => setWalletAddress('')}
            className="w-full bg-slate-700 py-2 rounded"
          >
            Disconnect
          </button>
        </>
      )}

      {txHash && (
        <a
          href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-xs break-all text-red-400"
        >
          {txHash}
        </a>
      )}
    </div>
  );
}

/* ===================== BUILDER SCORE ===================== */

function BuilderScorePage({ addressInput, setAddressInput }: any) {
  const [score, setScore] = useState<number | null>(null);

  const analyze = async () => {
    const txs = await fetchExplorerData(addressInput);
    let s = 0;
    txs.forEach((tx: any) => {
      if (!tx.to) s += 15;
      if (tx.input && tx.input.length > 200) s += 10;
    });
    setScore(Math.min(100, s));
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Builder Score</h2>

      <input
        value={addressInput}
        onChange={e => setAddressInput(e.target.value)}
        placeholder="0x…"
        className="w-full bg-slate-900 p-3 rounded"
      />

      <button onClick={analyze} className="w-full bg-purple-600 py-2 rounded">
        Analyze
      </button>

      {score !== null && <div className="text-3xl text-center">{score}/100</div>}
    </div>
  );
}

/* ===================== ONCHAIN SCORE ===================== */

function OnchainScorePage({ addressInput, setAddressInput }: any) {
  const [score, setScore] = useState<number | null>(null);

  const analyze = async () => {
    const txs = await fetchExplorerData(addressInput);
    let s = Math.min(40, txs.length * 2);
    setScore(s);
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold">Onchain Score</h2>

      <input
        value={addressInput}
        onChange={e => setAddressInput(e.target.value)}
        placeholder="0x…"
        className="w-full bg-slate-900 p-3 rounded"
      />

      <button onClick={analyze} className="w-full bg-cyan-600 py-2 rounded">
        Analyze
      </button>

      {score !== null && <div className="text-3xl text-center">{score}/100</div>}
    </div>
  );
        }
        
