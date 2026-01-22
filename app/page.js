'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Shield, FileText, Clock, Search, ExternalLink, Code, Award, Zap, TrendingUp, Activity } from 'lucide-react';
import { keccak256 } from 'js-sha3';
import { hashStatement, getLogs, getBlockNumber, EVENT_SIGNATURES, CONTRACT_ADDRESS, ARC_TESTNET_CONFIG, fetchExplorerData, calculateBuilderScore, calculateOnchainScore } from './utils';
import './globals.css';

export default function Home() {
  const [page, setPage] = useState('home');
  const [walletAddress, setWalletAddress] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [viewAddress, setViewAddress] = useState('');

  const handlePageChange = (newPage) => {
    setPage(newPage);
    playSound('click');
  };

  const handleViewAddress = (addr) => {
    setViewAddress(addr);
    setPage('viewer');
  };

  const playSound = (type) => {
    // Placeholder: Implement your sound logic
    console.log('Sound:', type);
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
      </div>      <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-900/30 to-purple-900/20 border border-blue-500/30 rounded-xl p-6 sm:p-8 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300">
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

      <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto mt-12">
        <div className="bg-gradient-to-br from-blue-900/20 to-slate-900/20 border border-blue-500/20 rounded-xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20">
          <FileText className="w-8 h-8 text-blue-400 mb-3" />
          <h4 className="font-semibold mb-2 text-slate-100">Hash-Only Storage</h4>
          <p className="text-sm text-slate-400">Only cryptographic hashes are stored onchain. Original text remains private.</p>
        </div>
        <div className="bg-gradient-to-br from-green-900/20 to-slate-900/20 border border-green-500/20 rounded-xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-green-500/20">
          <Shield className="w-8 h-8 text-green-400 mb-3" />
          <h4 className="font-semibold mb-2 text-slate-100">No Funds Required</h4>
          <p className="text-sm text-slate-400">View all activity without connecting a wallet or holding tokens.</p>
        </div>
        <div className="bg-gradient-to-br from-purple-900/20 to-slate-900/20 border border-purple-500/20 rounded-xl p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20">
          <Clock className="w-8 h-8 text-purple-400 mb-3" />
          <h4 className="font-semibold mb-2 text-slate-100">Immutable Records</h4>
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
}function EventCard({ event }) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    navigator.clipboard.writeText(event.hash);
    setCopied(true);
    playSound('success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-gradient-to-br ${event.type === 'published' ? 'from-green-900/20 to-emerald-900/10 border-green-500/30' : 'from-red-900/20 to-rose-900/10 border-red-500/30'} border rounded-xl p-4 sm:p-6 hover:scale-[1.02] transition-all duration-300 hover:shadow-xl`}>
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {event.type === 'published' ? (
            <CheckCircle2 className="w-5 h-5 text-green-400 animate-pulse" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400 animate-pulse" />
          )}
          <span className="font-semibold capitalize text-sm sm:text-base">{event.type}</span>
        </div>
        <span className="text-xs text-slate-400">
          {event.timestamp ? new Date(event.timestamp * 1000).toLocaleString() : 'Unknown'}
        </span>
      </div>

      <div className="bg-slate-950/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400">Statement Hash</span>
          <button onClick={copyHash} className="text-slate-400 hover:text-slate-200 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="font-mono text-xs sm:text-sm break-all text-slate-200">{event.hash}</p>
      </div>

      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-slate-400">
        <span>Block: {event.blockNumber}</span>
        <a
          href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
        >
          View on Arcscan <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

function PublishPage({ walletAddress, connectWallet, disconnectWallet }) {
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
        playSound('error');
        return;
      }

      const functionSelector = '0x' + keccak256('publishStatement(bytes32)').slice(0, 8);
      const data = functionSelector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: CONTRACT_ADDRESS,
          data: data,
          gas: '0x30D40'
        }]
      });

      setTxHash(tx);
      playSound('success');
      alert('Statement published! Transaction: ' + tx);
      setStatement('');
    } catch (error) {
      console.error('Publish failed:', error);
      playSound('error');
      alert('Failed to publish: ' + error.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl p-6 sm:p-8 hover:shadow-2xl transition-all">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-green-300">Publish Statement</h2>
        <p className="text-sm text-slate-300 mb-6">
          Enter your statement below. Only the cryptographic hash will be stored onchain.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Your Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Enter your statement here..."
              className="w-full bg-slate-900/50 border border-green-500/30 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-400/50 transition-all min-h-32 text-sm"
            />
          </div>

          {hash && (
            <div className="bg-slate-950/50 border border-green-500/30 rounded-lg p-4 animate-fadeIn">
              Statement Hash (stored onchain)
              {hash}
            </div>
          )}

          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
            >
              Connect Wallet to Publish
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-950/50 border border-green-500/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Connected Wallet</p>
                <p className="font-mono text-xs sm:text-sm text-green-300 break-all">{walletAddress}</p>
              </div>
              <button
                onClick={handlePublish}
                disabled={!statement || publishing}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
              >
                {publishing ? 'Publishing...' : 'Publish Statement'}
              </button>
              <button
                onClick={disconnectWallet}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
              >
                Disconnect Wallet
              </button>
            </div>
          )}

          {txHash && (
            <div className="bg-green-950/50 border border-green-500/50 rounded-lg p-4 animate-fadeIn">
              <p className="text-sm text-green-400 mb-2">✓ Transaction submitted</p>
              <a
                href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-300 hover:text-green-200 flex items-center gap-1 break-all transition-colors"
              >
                {txHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}function RevokePage({ walletAddress, connectWallet, disconnectWallet }) {
  const [hash, setHash] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [txHash, setTxHash] = useState('');

  const handleRevoke = async () => {
    if (typeof window === 'undefined' || !window.ethereum || !hash || !hash.match(/^0x[a-fA-F0-9]{64}$/)) {
      playSound('error');
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
        playSound('error');
        return;
      }

      const functionSelector = '0x' + keccak256('revokeStatement(bytes32)').slice(0, 8);
      const data = functionSelector + hash.slice(2);

      const tx = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: CONTRACT_ADDRESS,
          data: data,
          gas: '0x30D40'
        }]
      });

      setTxHash(tx);
      playSound('success');
      alert('Statement revoked! Transaction: ' + tx);
      setHash('');
    } catch (error) {
      console.error('Revoke failed:', error);
      playSound('error');
      alert('Failed to revoke: ' + error.message);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="bg-gradient-to-br from-red-900/20 to-rose-900/10 border border-red-500/30 rounded-xl p-6 sm:p-8 hover:shadow-2xl transition-all">
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-red-300">Revoke Statement</h2>
        <p className="text-sm text-slate-300 mb-6">
          Enter the statement hash you want to revoke. You must be the original author.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-300">Statement Hash</label>
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-900/50 border border-red-500/30 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/50 transition-all font-mono text-xs sm:text-sm"
            />
          </div>

          {!walletAddress ? (
            <button
              onClick={connectWallet}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
            >
              Connect Wallet to Revoke
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-950/50 border border-red-500/30 rounded-lg p-3">
                <p className="text-xs text-slate-400 mb-1">Connected Wallet</p>
                <p className="font-mono text-xs sm:text-sm text-red-300 break-all">{walletAddress}</p>
              </div>
              <button
                onClick={handleRevoke}
                disabled={!hash || revoking}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
              >
                {revoking ? 'Revoking...' : 'Revoke Statement'}
              </button>
              <button
                onClick={disconnectWallet}
                className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm transition-all"
              >
                Disconnect Wallet
              </button>
            </div>
          )}

          {txHash && (
            <div className="bg-red-950/50 border border-red-500/50 rounded-lg p-4 animate-fadeIn">
              <p className="text-sm text-red-400 mb-2">✓ Transaction submitted</p>
              <a
                href={`${ARC_TESTNET_CONFIG.blockExplorerUrls[0]}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-300 hover:text-red-200 flex items-center gap-1 break-all transition-colors"
              >
                {txHash} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}function BuilderScorePage({ addressInput, setAddressInput }) {
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [address, setAddress] = useState('');

  const analyzeAddress = async () => {
    if (!addressInput || !addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      playSound('error');
      alert('Please enter a valid Ethereum address');
      return;
    }

    playSound('click');
    setLoading(true);
    setAddress(addressInput);

    try {
      const transactions = await fetchExplorerData(addressInput);
      const builderScore = calculateBuilderScore(transactions);
      setScoreData(builderScore);
      playSound('success');
    } catch (error) {
      console.error('Failed to analyze address:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 border border-purple-500/30 rounded-xl p-6 sm:p-8 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 flex items-center gap-3 text-purple-300">
          <Code className="w-8 h-8" />
          Builder Score
        </h2>
        <p className="text-sm text-slate-300 mb-6">
          Analyze contract deployments, token creation, and builder activity
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 transition-all text-sm"
          />
          <button
            onClick={analyzeAddress}
            disabled={loading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 px-8 py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {scoreData && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/30 rounded-xl p-8 text-center">
            <Award className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-bounce" />
            <h3 className="text-5xl font-bold text-purple-300 mb-2">{scoreData.score}/100</h3>
            <p className="text-slate-400">Builder Score</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-900/20 to-cyan-900/10 border border-blue-500/30 rounded-xl p-6">
              <Zap className="w-8 h-8 text-blue-400 mb-3" />
              <h4 className="text-2xl font-bold text-blue-300">{scoreData.contractDeployments}</h4>
              <p className="text-sm text-slate-400">Contract Deployments</p>
            </div>
            <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl p-6">
              <TrendingUp className="w-8 h-8 text-green-400 mb-3" />
              <h4 className="text-2xl font-bold text-green-300">{scoreData.tokenCreations}</h4>
              <p className="text-sm text-slate-400">Token Creations</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OnchainScorePage({ addressInput, setAddressInput }) {
  const [loading, setLoading] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [address, setAddress] = useState('');

  const analyzeAddress = async () => {
    if (!addressInput || !addressInput.match(/^0x[a-fA-F0-9]{40}$/)) {
      playSound('error');
      alert('Please enter a valid Ethereum address');
      return;
    }

    playSound('click');
    setLoading(true);
    setAddress(addressInput);

    try {
      const transactions = await fetchExplorerData(addressInput);
      const onchainScore = calculateOnchainScore(transactions);
      setScoreData(onchainScore);
      playSound('success');
    } catch (error) {
      console.error('Failed to analyze address:', error);
      playSound('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border border-cyan-500/30 rounded-xl p-6 sm:p-8 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 flex items-center gap-3 text-cyan-300">
          <Activity className="w-8 h-8" />
          Onchain Score
        </h2>
        <p className="text-sm text-slate-300 mb-6">
          Analyze transaction history, activity patterns, and onchain engagement
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-slate-900/50 border border-cyan-500/30 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all text-sm"
          />
          <button
            onClick={analyzeAddress}
            disabled={loading}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 px-8 py-3 rounded-lg font-medium transition-all duration-300 text-sm sm:text-base shadow-lg hover:shadow-xl hover:scale-105"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>

      {scoreData && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-cyan-900/30 to-blue-900/20 border border-cyan-500/30 rounded-xl p-8 text-center">
            <Award className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-bounce" />
            <h3 className="text-5xl font-bold text-cyan-300 mb-2">{scoreData.score}/100</h3>
            <p className="text-slate-400">Onchain Score</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/10 border border-purple-500/30 rounded-xl p-6">
              <TrendingUp className="w-8 h-8 text-purple-400 mb-3" />
              <h4 className="text-2xl font-bold text-purple-300">{scoreData.txCount}</h4>
              <p className="text-sm text-slate-400">Total Transactions</p>
            </div>
            <div className="bg-gradient-to-br from-orange-900/20 to-amber-900/10 border border-orange-500/30 rounded-xl p-6">
              <Zap className="w-8 h-8 text-orange-400 mb-3" />
              <h4 className="text-2xl font-bold text-orange-300">{Math.round(scoreData.avgGasUsed)}</h4>
              <p className="text-sm text-slate-400">Avg Gas Used</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
