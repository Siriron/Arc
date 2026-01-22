'use client'

import React, { useState, useEffect } from 'react';
import { Search, FileText, Shield, Clock, ExternalLink, CheckCircle2, XCircle, Copy, Check, AlertCircle } from 'lucide-react';
import { keccak256 } from 'js-sha3';

// ARC Testnet Configuration
const ARC_TESTNET_CONFIG = {
  chainId: '0x4CEF52',
  chainName: 'Arc Network Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app']
};

// Contract Configuration
const CONTRACT_ADDRESS = '0xd2d97209aFd34B9865fda1eA7B0c390395321B32';
const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "author", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "statementHash", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "StatementPublished",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "author", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "statementHash", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "StatementRevoked",
    "type": "event"
  }
];

// Event signatures
const EVENT_SIGNATURES = {
  StatementPublished: '0x' + keccak256('StatementPublished(address,bytes32,uint256)'),
  StatementRevoked: '0x' + keccak256('StatementRevoked(address,bytes32,uint256)')
};

// RPC Helper Functions
async function rpcCall(method, params = []) {
  const response = await fetch(ARC_TESTNET_CONFIG.rpcUrls[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    })
  });
  
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getBlockNumber() {
  const hex = await rpcCall('eth_blockNumber');
  return parseInt(hex, 16);
}

async function getLogs(params) {
  return await rpcCall('eth_getLogs', [params]);
}

// Hash a statement
function hashStatement(text) {
  return '0x' + keccak256(text);
}

// Main App Component
export default function ARCStatementRegistry() {
  const [page, setPage] = useState('home');
  const [addressInput, setAddressInput] = useState('');
  const [viewAddress, setViewAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const handleViewAddress = (addr) => {
    if (!addr || !addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Please enter a valid Ethereum address');
      return;
    }
    setViewAddress(addr.toLowerCase());
    setPage('viewer');
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('MetaMask not detected. Please install MetaMask.');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: ARC_TESTNET_CONFIG.chainId }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: ARC_TESTNET_CONFIG.chainId,
              chainName: ARC_TESTNET_CONFIG.chainName,
              nativeCurrency: ARC_TESTNET_CONFIG.nativeCurrency,
              rpcUrls: ARC_TESTNET_CONFIG.rpcUrls,
              blockExplorerUrls: ARC_TESTNET_CONFIG.blockExplorerUrls
            }]
          });
        } else {
          throw switchError;
        }
      }

      setWalletAddress(accounts[0].toLowerCase());
    } catch (error) {
      console.error('Wallet connection failed:', error);
      alert('Failed to connect wallet: ' + error.message);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
              <div>
                <h1 className="text-base sm:text-lg font-semibold">ARC Statement Registry</h1>
                <p className="text-xs text-slate-400 hidden sm:block">Read-only blockchain observability</p>
              </div>
            </div>
            <nav className="flex gap-2 sm:gap-4 text-xs sm:text-sm">
              <button onClick={() => setPage('home')} className={`px-2 sm:px-3 py-1 rounded ${page === 'home' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200'}`}>Home</button>
              <button onClick={() => setPage('publish')} className={`px-2 sm:px-3 py-1 rounded ${page === 'publish' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200'}`}>Publish</button>
              <button onClick={() => setPage('revoke')} className={`px-2 sm:px-3 py-1 rounded ${page === 'revoke' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-400 hover:text-slate-200'}`}>Revoke</button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {page === 'home' && <HomePage onViewAddress={handleViewAddress} addressInput={addressInput} setAddressInput={setAddressInput} />}
        {page === 'viewer' && <AddressViewer address={viewAddress} />}
        {page === 'publish' && <PublishPage walletAddress={walletAddress} connectWallet={connectWallet} disconnectWallet={disconnectWallet} />}
        {page === 'revoke' && <RevokePage walletAddress={walletAddress} connectWallet={connectWallet} disconnectWallet={disconnectWallet} />}
      </main>

      <footer className="border-t border-slate-800 mt-16 py-6 text-center text-xs sm:text-sm text-slate-500">
        <p>ARC Testnet · Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</p>
        <p className="text-xs mt-1">Read-only by default · No funds required · No approvals</p>
      </footer>
    </div>
  );
}

function HomePage({ onViewAddress, addressInput, setAddressInput }) {
  const [stats, setStats] = useState({ published: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const currentBlock = await getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);

      const publishedLogs = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + currentBlock.toString(16),
        topics: [EVENT_SIGNATURES.StatementPublished]
      });

      const revokedLogs = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + currentBlock.toString(16),
        topics: [EVENT_SIGNATURES.StatementRevoked]
      });

      setStats({ 
        published: publishedLogs.length, 
        revoked: revokedLogs.length 
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4 py-8 sm:py-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-100">Onchain Statement Registry</h2>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto px-4">
          View immutable statements published to the ARC testnet. No wallet required.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-medium text-slate-400">Statements Published</h3>
          </div>
          <p className="text-3xl font-bold text-slate-100">{loading ? '...' : stats.published}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <h3 className="text-sm font-medium text-slate-400">Statements Revoked</h3>
          </div>
          <p className="text-3xl font-bold text-slate-100">{loading ? '...' : stats.revoked}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-lg p-6 sm:p-8">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          View Address Activity
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          Enter any wallet address to view their published and revoked statements
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={() => addressInput && onViewAddress(addressInput)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition-colors text-sm sm:text-base"
          >
            View
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mt-12">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <FileText className="w-8 h-8 text-blue-400 mb-3" />
          <h4 className="font-semibold mb-2">Hash-Only Storage</h4>
          <p className="text-sm text-slate-400">Only cryptographic hashes are stored onchain. Original text remains private.</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <Shield className="w-8 h-8 text-green-400 mb-3" />
          <h4 className="font-semibold mb-2">No Funds Required</h4>
          <p className="text-sm text-slate-400">View all activity without connecting a wallet or holding tokens.</p>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <Clock className="w-8 h-8 text-purple-400 mb-3" />
          <h4 className="font-semibold mb-2">Immutable Records</h4>
          <p className="text-sm text-slate-400">All statements are permanently recorded on the ARC blockchain.</p>
        </div>
      </div>
    </div>
  );
}

function AddressViewer({ address }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchEvents();
    }
  }, [address]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const currentBlock = await getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 50000);

      const addressPadded = '0x' + address.slice(2).padStart(64, '0');

      const publishedLogs = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + currentBlock.toString(16),
        topics: [EVENT_SIGNATURES.StatementPublished, addressPadded]
      });

      const revokedLogs = await getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: '0x' + fromBlock.toString(16),
        toBlock: '0x' + currentBlock.toString(16),
        topics: [EVENT_SIGNATURES.StatementRevoked, addressPadded]
      });

      const parsedEvents = [
        ...publishedLogs.map(log => ({
          type: 'published',
          hash: log.topics[2],
          timestamp: parseInt(log.data.slice(2, 66), 16),
          blockNumber: parseInt(log.blockNumber, 16),
          txHash: log.transactionHash
        })),
        ...revokedLogs.map(log => ({
          type: 'revoked',
          hash: log.topics[2],
          timestamp: parseInt(log.data.slice(2, 66), 16),
          blockNumber: parseInt(log.blockNumber, 16),
          txHash: log.transactionHash
        }))
      ].sort((a, b) => b.timestamp - a.timestamp);

      setEvents(parsedEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-2">Address Activity</h2>
        <p className="text-xs sm:text-sm text-slate-400 font-mono break-all">{address}</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No events found for this address</p>
          <p className="text-sm text-slate-500 mt-2">This address has not published or revoked any statements</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, idx) => (
            <EventCard key={idx} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(event.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-6 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {event.type === 'published' ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span className="font-semibold capitalize text-sm sm:text-base">{event.type}</span>
        </div>
        <span className="text-xs text-slate-500">
          {event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : 'Unknown'}
        </span>
      </div>

      <div className="bg-slate-950 rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Statement Hash</span>
          <button onClick={copyHash} className="text-slate-400 hover:text-slate-200">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="font-mono text-xs sm:text-sm break-all text-slate-300">{event.hash}</p>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-slate-500">
        <span>Block: {event.blockNumber}</span>
        <a
          href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-blue-400"
        >
          View on Arcscan <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}function PublishPage({ walletAddress, connectWallet, disconnectWallet }) {
  const [statement, setStatement] = useState('');
  const [hash, setHash] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (statement) {
      setHash(hashStatement(statement));
    } else {
      setHash('');
    }
  }, [statement]);

  const handlePublish = async () => {
    if (typeof window === 'undefined' || !window.ethereum || !hash) return;

    setPublishing(true);
    setTxHash('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        alert('Please connect your wallet first');
        setPublishing(false);
        return;
      }

      // Encode: publishStatement(bytes32)
      const functionSelector = '0x' + keccak256('publishStatement(bytes32)').slice(0, 8);
      const data = functionSelector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: CONTRACT_ADDRESS,
          data: data,
          gas: '0x30D40' // 200,000 gas
        }]
      });

      setTxHash(tx);
      alert('Statement published! Transaction: ' + tx);
      setStatement('');
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish: ' + error.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">Publish Statement</h2>
        <p className="text-sm text-slate-400 mb-6">
          Enter your statement below. Only the cryptographic hash will be stored onchain.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Enter your statement here..."
              className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-32 text-sm"
            />
          </div>

          {hash && (
            <div className="bg-slate-950 border border-slate-700 rounded p-4">
              <p className="text-xs text-slate-500 mb-1">Statement Hash (stored onchain)</p>
              <p className="font-mono text-xs sm:text-sm break-all text-slate-300">{hash}</p>
            </div>
          )}

          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-medium transition-colors text-sm sm:text-base"
            >
              Connect Wallet to Publish
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-700 rounded p-3">
                <p className="text-xs text-slate-500 mb-1">Connected Wallet</p>
                <p className="font-mono text-xs sm:text-sm text-slate-300 break-all">{walletAddress}</p>
              </div>
              <button
                onClick={handlePublish}
                disabled={!statement || publishing}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:cursor-not-allowed py-3 rounded font-medium transition-colors text-sm sm:text-base"
              >
                {publishing ? 'Publishing...' : 'Publish Statement'}
              </button>
              <button
                onClick={disconnectWallet}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          )}

          {txHash && (
            <div className="bg-green-950 border border-green-800 rounded p-4">
              <p className="text-sm text-green-400 mb-2">✓ Transaction submitted</p>
              <a
                href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-300 hover:text-green-200 flex items-center gap-1 break-all"
              >
                {txHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevokePage({ walletAddress, connectWallet, disconnectWallet }) {
  const [hash, setHash] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [txHash, setTxHash] = useState('');

  const handleRevoke = async () => {
    if (typeof window === 'undefined' || !window.ethereum || !hash || !hash.match(/^0x[a-fA-F0-9]{64}$/)) {
      alert('Please enter a valid 32-byte hash (0x + 64 hex characters)');
      return;
    }

    setRevoking(true);
    setTxHash('');

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        alert('Please connect your wallet first');
        setRevoking(false);
        return;
      }

      // Encode: revokeStatement(bytes32)
      const functionSelector = '0x' + keccak256('revokeStatement(bytes32)').slice(0, 8);
      const data = functionSelector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: CONTRACT_ADDRESS,
          data: data,
          gas: '0x30D40' // 200,000 gas
        }]
      });

      setTxHash(tx);
      alert('Statement revoked! Transaction: ' + tx);
      setHash('');
    } catch (error) {
      console.error('Revoke failed:', error);
      alert('Failed to revoke: ' + error.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 sm:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4">Revoke Statement</h2>
        <p className="text-sm text-slate-400 mb-6">
          Enter the statement hash you want to revoke. You must be the original author.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Statement Hash</label>
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-950 border border-slate-700 rounded px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs sm:text-sm"
            />
          </div>

          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-medium transition-colors text-sm sm:text-base"
            >
              Connect Wallet to Revoke
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-950 border border-slate-700 rounded p-3">
                <p className="text-xs text-slate-500 mb-1">Connected Wallet</p>
                <p className="font-mono text-xs sm:text-sm text-slate-300 break-all">{walletAddress}</p>
              </div>
              <button
                onClick={handleRevoke}
                disabled={!hash || revoking}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed py-3 rounded font-medium transition-colors text-sm sm:text-base"
              >
                {revoking ? 'Revoking...' : 'Revoke Statement'}
              </button>
              <button
                onClick={disconnectWallet}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded text-sm transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          )}

          {txHash && (
            <div className="bg-red-950 border border-red-800 rounded p-4">
              <p className="text-sm text-red-400 mb-2">✓ Transaction submitted</p>
              <a
                href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-300 hover:text-red-200 flex items-center gap-1 break-all"
              >
                {txHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
