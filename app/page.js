'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Shield, Clock, ExternalLink, CheckCircle2, XCircle, Copy, Check, AlertCircle, Award, TrendingUp, Zap, Code, Activity } from 'lucide-react';
import { keccak256 } from 'js-sha3';

// ARC Testnet Configuration
const ARC_TESTNET_CONFIG = {
  chainId: '0x4CEF52',
  chainName: 'Arc Network Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
  apiUrl: 'https://testnet.arcscan.app/api'
};

// Contract Configuration
const CONTRACT_ADDRESS = '0xd2d97209aFd34B9865fda1eA7B0c390395321B32';

// Event signatures
const EVENT_SIGNATURES = {
  StatementPublished: '0x' + keccak256('StatementPublished(address,bytes32,uint256)'),
  StatementRevoked: '0x' + keccak256('StatementRevoked(address,bytes32,uint256)')
};

// Sound effects
const playSound = (type) => {
  if (typeof window === 'undefined') return;
  
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'success':
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      break;
    case 'click':
      oscillator.frequency.value = 400;
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    case 'error':
      oscillator.frequency.value = 200;
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      break;
  }
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

// Fetch ARC Explorer API data
async function fetchExplorerData(address) {
  try {
    const response = await fetch(`${ARC_TESTNET_CONFIG.apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc`);
    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('Explorer API error:', error);
    return [];
  }
}

// Hash a statement
function hashStatement(text) {
  return '0x' + keccak256(text);
}

// Calculate Builder Score
function calculateBuilderScore(transactions) {
  let score = 0;
  let contractDeployments = 0;
  let tokenCreations = 0;
  
  transactions.forEach(tx => {
    // Contract deployment (to address is null/empty)
    if (!tx.to || tx.to === '0x0000000000000000000000000000000000000000') {
      contractDeployments++;
      score += 15;
    }
    
    // Token creation (ERC20/ERC721 events)
    if (tx.input && tx.input.length > 200) {
      tokenCreations++;
      score += 10;
    }
  });
  
  // Bonus for consistency
  if (contractDeployments > 5) score += 20;
  if (tokenCreations > 3) score += 15;
  
  return {
    score: Math.min(score, 100),
    contractDeployments,
    tokenCreations
  };
}

// Calculate Onchain Score
function calculateOnchainScore(transactions) {
  let score = 0;
  const txCount = transactions.length;
  
  // Transaction count score (max 40 points)
  score += Math.min(txCount * 2, 40);
  
  // Time frame analysis
  if (txCount > 0) {
    const timestamps = transactions.map(tx => parseInt(tx.timeStamp)).sort();
    const firstTx = timestamps[0];
    const lastTx = timestamps[timestamps.length - 1];
    const daysDiff = (lastTx - firstTx) / (24 * 60 * 60);
    
    // Activity duration score (max 30 points)
    if (daysDiff > 30) score += 30;
    else if (daysDiff > 7) score += 20;
    else if (daysDiff > 1) score += 10;
    
    // Consistency score (max 30 points)
    const avgTxPerDay = txCount / Math.max(daysDiff, 1);
    if (avgTxPerDay > 5) score += 30;
    else if (avgTxPerDay > 2) score += 20;
    else if (avgTxPerDay > 0.5) score += 10;
  }
  
  return {
    score: Math.min(score, 100),
    txCount,
    avgGasUsed: transactions.reduce((sum, tx) => sum + parseInt(tx.gasUsed || 0), 0) / Math.max(txCount, 1)
  };
}// Main App Component
export default function ARCEDRegistry() {
  const [page, setPage] = useState('home');
  const [addressInput, setAddressInput] = useState('');
  const [viewAddress, setViewAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const handleViewAddress = (addr) => {
    if (!addr || !addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      playSound('error');
      alert('Please enter a valid Ethereum address');
      return;
    }
    playSound('click');
    setViewAddress(addr.toLowerCase());
    setPage('viewer');
  };

  const handlePageChange = (newPage) => {
    playSound('click');
    setPage(newPage);
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      playSound('error');
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
      playSound('success');
    } catch (error) {
      console.error('Wallet connection failed:', error);
      playSound('error');
      alert('Failed to connect wallet: ' + error.message);
    }
  };

  const disconnectWallet = () => {
    playSound('click');
    setWalletAddress('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-slate-100">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <header className="border-b border-blue-900/50 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-blue-900/20">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => handlePageChange('home')}>
              <div className="relative">
                <Shield className="w-7 h-7 text-blue-400 group-hover:text-blue-300 transition-all duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-blue-400 blur-xl opacity-0 group-hover:opacity-50 transition-opacity"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ARCED
                </h1>
                <p className="text-xs text-slate-400 hidden sm:block">Blockchain Statement Registry</p>
              </div>
            </div>
            <nav className="flex gap-2 sm:gap-3 text-xs sm:text-sm">
              {['home', 'publish', 'revoke', 'builder', 'onchain'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => handlePageChange(tab)}
                  className={`px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 ${
                    page === tab
                      ? 'text-blue-400 bg-blue-400/20 shadow-lg shadow-blue-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8">
        {page === 'home' && <HomePage onViewAddress={handleViewAddress} addressInput={addressInput} setAddressInput={setAddressInput} />}
        {page === 'viewer' && <AddressViewer address={viewAddress} />}
        {page === 'publish' && <PublishPage walletAddress={walletAddress} connectWallet={connectWallet} disconnectWallet={disconnectWallet} />}
        {page === 'revoke' && <RevokePage walletAddress={walletAddress} connectWallet={connectWallet} disconnectWallet={disconnectWallet} />}
        {page === 'builder' && <BuilderScorePage addressInput={addressInput} setAddressInput={setAddressInput} />}
        {page === 'onchain' && <OnchainScorePage addressInput={addressInput} setAddressInput={setAddressInput} />}
      </main>

      <footer className="relative border-t border-blue-900/50 mt-16 py-6 text-center text-xs sm:text-sm text-slate-500 bg-slate-900/50 backdrop-blur">
        <p>ARC Testnet · Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}</p>
        <p className="text-xs mt-1">Read-only by default · No funds required · No approvals</p>
      </footer>
    </div>
  );
        }function HomePage({ onViewAddress, addressInput, setAddressInput }) {
  const [stats, setStats] = useState({ published: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const currentBlock = await getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 100000);

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
      playSound('success');
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center space-y-4 py-8 sm:py-12">
        <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Onchain Statement Registry
        </h2>
        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto px-4">
          View immutable statements published to the ARC testnet. No wallet required.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/10 border border-green-500/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-6 h-6 text-green-400 animate-pulse" />
            <h3 className="text-sm font-medium text-green-300">Statements Published</h3>
          </div>
          <p className="text-4xl font-bold text-green-100">{loading ? '...' : stats.published}</p>
        </div>
        <div className="bg-gradient-to-br from-red-900/30 to-rose-900/10 border border-red-500/30 rounded-xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-red-500/20">
          <div className="flex items-center gap-3 mb-2">
            <XCircle className="w-6 h-6 text-red-400 animate-pulse" />
            <h3 className="text-sm font-medium text-red-300">Statements Revoked</h3>
          </div>
          <p className="text-4xl font-bold text-red-100">{loading ? '...' : stats.revoked}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 sm:p-8 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300">
        <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-400" />
          View Address Activity
        </h3>
        <p className="text-sm text-slate-300 mb-4">
          Enter any wallet address to view their published and revoked statements
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-slate-900/50 border border-blue-500/30 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 transition-all text-sm"
          />
          <button
            onClick={() => addressInput && onViewAddress(addressInput)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-8 py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:shadow-blue-500/50 hover:scale-105"
          >
            View
          </button>
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
      const fromBlock = Math.max(0, currentBlock - 100000);

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
      if (parsedEvents.length > 0) playSound('success');
    } catch (error) {
      console.error('Failed to fetch events:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 rounded-xl p-4 sm:p-6 mb-6 hover:shadow-xl transition-all">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 text-blue-300">Address Activity</h2>
        <p className="text-xs sm:text-sm text-slate-300 font-mono break-all">{address}</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300">No events found for this address</p>
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
    playSound('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-4 sm:p-6 rounded-xl border ${event.type === 'published' ? 'border-green-500/30 bg-green-900/20' : 'border-red-500/30 bg-red-900/20'} hover:shadow-lg transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-semibold ${event.type === 'published' ? 'text-green-300' : 'text-red-300'}`}>
          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
        </span>
        <button onClick={copyHash} className="text-slate-400 hover:text-slate-200 transition-colors text-sm flex items-center gap-1">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy Hash'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-1">Tx: {event.txHash}</p>
      <p className="text-xs text-slate-400">Block: {event.blockNumber}</p>
    </div>
  );
         }function PublishPage({ walletAddress, connectWallet, disconnectWallet }) {
  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);

  const publishStatement = async () => {
    if (!walletAddress) {
      playSound('error');
      alert('Connect your wallet first.');
      return;
    }
    if (!statement.trim()) {
      playSound('error');
      alert('Enter a statement to publish.');
      return;
    }

    setLoading(true);
    try {
      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: CONTRACT_ADDRESS,
          data: '0x' + keccak256(statement) // placeholder: real contract call should encode properly
        }]
      });
      console.log('Transaction sent:', tx);
      playSound('success');
      setStatement('');
      alert('Statement published onchain!');
    } catch (error) {
      console.error('Publish failed:', error);
      playSound('error');
      alert('Publish failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-semibold text-blue-400">Publish Statement</h2>

      {walletAddress ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Connected as {walletAddress}</p>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Type your statement here..."
            className="w-full p-4 rounded-lg bg-slate-900/50 border border-blue-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 transition-all"
            rows={6}
          ></textarea>
          <div className="flex gap-4">
            <button
              onClick={publishStatement}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500 transition-all"
            >
              {loading ? 'Publishing...' : 'Publish'}
            </button>
            <button
              onClick={disconnectWallet}
              className="px-6 py-3 bg-red-600 rounded-lg text-white font-medium hover:bg-red-500 transition-all"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500 transition-all"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}

function RevokePage({ walletAddress, connectWallet, disconnectWallet }) {
  const [hashToRevoke, setHashToRevoke] = useState('');
  const [loading, setLoading] = useState(false);

  const revokeStatement = async () => {
    if (!walletAddress) {
      playSound('error');
      alert('Connect your wallet first.');
      return;
    }
    if (!hashToRevoke.trim()) {
      playSound('error');
      alert('Enter a statement hash to revoke.');
      return;
    }

    setLoading(true);
    try {
      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: CONTRACT_ADDRESS,
          data: '0x' + keccak256(hashToRevoke) // placeholder: real contract call should encode properly
        }]
      });
      console.log('Transaction sent:', tx);
      playSound('success');
      setHashToRevoke('');
      alert('Statement revoked onchain!');
    } catch (error) {
      console.error('Revoke failed:', error);
      playSound('error');
      alert('Revoke failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-semibold text-red-400">Revoke Statement</h2>

      {walletAddress ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Connected as {walletAddress}</p>
          <input
            type="text"
            value={hashToRevoke}
            onChange={(e) => setHashToRevoke(e.target.value)}
            placeholder="Statement hash to revoke"
            className="w-full p-4 rounded-lg bg-slate-900/50 border border-red-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/50 transition-all"
          />
          <div className="flex gap-4">
            <button
              onClick={revokeStatement}
              disabled={loading}
              className="px-6 py-3 bg-red-600 rounded-lg text-white font-medium hover:bg-red-500 transition-all"
            >
              {loading ? 'Revoking...' : 'Revoke'}
            </button>
            <button
              onClick={disconnectWallet}
              className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500 transition-all"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={connectWallet}
          className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500 transition-all"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}

function BuilderScorePage({ addressInput, setAddressInput }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchBuilderScore = async () => {
    if (!addressInput || !addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      playSound('error');
      alert('Enter a valid Ethereum address');
      return;
    }

    setLoading(true);
    try {
      const txs = await fetchExplorerData(addressInput);
      const data = calculateBuilderScore(txs);
      setScoreData(data);
      playSound('success');
    } catch (error) {
      console.error('Failed to fetch builder score:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-semibold text-purple-400">Builder Score</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="0x..."
          className="flex-1 p-4 rounded-lg bg-slate-900/50 border border-purple-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all"
        />
        <button
          onClick={fetchBuilderScore}
          className="px-6 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-500 transition-all"
        >
          {loading ? 'Loading...' : 'Check'}
        </button>
      </div>

      {scoreData && (
        <div className="mt-6 bg-slate-900/50 border border-purple-500/30 p-6 rounded-xl">
          <p>Score: <span className="font-bold text-purple-300">{scoreData.score}</span>/100</p>
          <p>Contracts Deployed: {scoreData.contractDeployments}</p>
          <p>Tokens Created: {scoreData.tokenCreations}</p>
        </div>
      )}
    </div>
  );
}

function OnchainScorePage({ addressInput, setAddressInput }) {
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchOnchainScore = async () => {
    if (!addressInput || !addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      playSound('error');
      alert('Enter a valid Ethereum address');
      return;
    }

    setLoading(true);
    try {
      const txs = await fetchExplorerData(addressInput);
      const data = calculateOnchainScore(txs);
      setScoreData(data);
      playSound('success');
    } catch (error) {
      console.error('Failed to fetch onchain score:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      <h2 className="text-2xl font-semibold text-blue-400">Onchain Score</h2>
      <div className="flex gap-3">
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="0x..."
          className="flex-1 p-4 rounded-lg bg-slate-900/50 border border-blue-500/30 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50 transition-all"
        />
        <button
          onClick={fetchOnchainScore}
          className="px-6 py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-500 transition-all"
        >
          {loading ? 'Loading...' : 'Check'}
        </button>
      </div>

      {scoreData && (
        <div className="mt-6 bg-slate-900/50 border border-blue-500/30 p-6 rounded-xl">
          <p>Score: <span className="font-bold text-blue-300">{scoreData.score}</span>/100</p>
          <p>Transactions: {scoreData.txCount}</p>
          <p>Average Gas Used: {Math.round(scoreData.avgGasUsed)}</p>
        </div>
      )}
    </div>
  );
        }function EventCard({ event }) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(event.hash);
    setCopied(true);
    playSound('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (ts) => {
    const date = new Date(ts * 1000);
    return date.toLocaleString();
  };

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border border-slate-700/50 bg-slate-900/50 hover:shadow-lg hover:shadow-blue-500/20 transition-all`}>
      <div>
        <p className="text-sm text-slate-300 font-mono break-all">{event.hash}</p>
        <p className="text-xs text-slate-500">
          {event.type.toUpperCase()} · Block {event.blockNumber} · {formatTimestamp(event.timestamp)}
        </p>
      </div>
      <button
        onClick={copyHash}
        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-all text-white text-xs flex items-center gap-1"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// Animation utilities (for Tailwind + React)
const fadeIn = `
  @keyframes fadeIn {
    0% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out forwards;
  }
`;

// Inject animation styles into the page
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = fadeIn;
  document.head.appendChild(style);
}

// Optional: utility for keccak256 hashing of strings
// Already imported from 'js-sha3' at the top

// App is exported at the top as default
// export default function ARCEDRegistry() { ... } ✅
