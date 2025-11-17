import { useState } from 'react';
import { generateOnRampURL } from '@coinbase/cbpay-js';
import api from './api';

interface CoinbaseOnrampProps {
  walletAddress: string;
  onSuccess?: () => void;
}

export function CoinbaseOnramp({ walletAddress, onSuccess }: CoinbaseOnrampProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFundAccount = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch session token from backend
      const response = await api.post('/api/wallet/onramp-session-token/', {});
      const sessionToken = response.data.sessionToken;

      // Generate onramp URL with session token
      // Note: Your Coinbase project requires sessionToken for security
      // Even with sessionToken, we still need to pass addresses to generateOnRampURL
      const onrampURL = generateOnRampURL({
        appId: import.meta.env.VITE_COINBASE_APP_ID || '40646732-b0cc-4432-9767-152c71112a6e',
        sessionToken: sessionToken,
        addresses: { [walletAddress]: ['base'] },
        assets: ['USDC'],
      });

      // Try to open in a popup window first
      const width = 450;
      const height = 730;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popup = window.open(
        onrampURL,
        'Coinbase Onramp',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Popup was blocked, open in new tab as fallback
        window.open(onrampURL, '_blank');
        setIsLoading(false);
        // Refresh balance after a delay (since we can't monitor tab close)
        if (onSuccess) {
          setTimeout(onSuccess, 5000);
        }
      } else {
        // Monitor popup for close event
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            setIsLoading(false);
            // Refresh balance when popup closes
            if (onSuccess) {
              setTimeout(onSuccess, 1000);
            }
          }
        }, 500);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Error opening Coinbase Onramp:', err);
      setError(err.response?.data?.error || err.message || 'Failed to open onramp');
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleFundAccount}
      disabled={isLoading || !!error}
      className="btn-fund-account"
      style={{
        padding: '9px 18px',
        background: isLoading || error ? '#9CA3AF' : '#007AFF',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isLoading || error ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        opacity: isLoading || error ? 0.6 : 1,
        transition: 'all 0.2s'
      }}
    >
      {isLoading ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
            <circle cx="12" cy="12" r="10" opacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
          Loading...
        </>
      ) : error ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Error
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          Add Funds
        </>
      )}
    </button>
  );
}
