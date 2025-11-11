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
      console.log('Fetching session token for wallet:', walletAddress);
      setIsLoading(true);
      setError(null);

      // Fetch session token from backend
      const response = await api.post('/api/wallet/onramp-session-token/', {});
      const sessionToken = response.data.sessionToken;
      console.log('✅ Session token received');

      // Generate onramp URL with session token
      // Note: Your Coinbase project requires sessionToken for security
      const onrampURL = generateOnRampURL({
        sessionToken: sessionToken,
        // Optional: You can still pass appId but sessionToken takes precedence
        appId: import.meta.env.VITE_COINBASE_APP_ID || '40646732-b0cc-4432-9767-152c71112a6e',
      });

      console.log('✅ Opening Coinbase Onramp popup');

      // Open in a popup window
      const width = 450;
      const height = 730;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;

      const popup = window.open(
        onrampURL,
        'Coinbase Onramp',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Monitor popup for close event
      const checkPopup = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkPopup);
          console.log('ℹ️ Coinbase Onramp popup closed');
          setIsLoading(false);
          // Refresh balance when popup closes
          if (onSuccess) {
            setTimeout(onSuccess, 1000);
          }
        }
      }, 500);

      setIsLoading(false);
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
      style={{
        padding: '12px 24px',
        background: isLoading || error ? '#6B7280' : '#0052FF',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: isLoading || error ? 'not-allowed' : 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: isLoading || error ? 0.6 : 1
      }}
    >
      {isLoading ? (
        <>Loading...</>
      ) : error ? (
        <>Error - Click for details</>
      ) : (
        <>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="white"/>
          </svg>
          Fund Account with Credit Card
        </>
      )}
    </button>
  );
}
