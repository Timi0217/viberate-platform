import { useEffect, useState } from 'react';
import { initOnRamp, CBPayInstanceType } from '@coinbase/cbpay-js';

interface CoinbaseOnrampProps {
  walletAddress: string;
  onSuccess?: () => void;
}

export function CoinbaseOnramp({ walletAddress, onSuccess }: CoinbaseOnrampProps) {
  const [onrampInstance, setOnrampInstance] = useState<CBPayInstanceType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let instance: CBPayInstanceType | null = null;

    async function initializeOnramp() {
      try {
        console.log('Initializing Coinbase Onramp for wallet:', walletAddress);
        setIsLoading(true);
        setError(null);

        // Initialize Coinbase Onramp with widgetParameters
        // Note: sessionToken is NOT supported by initOnRamp, only by generateOnRampURL
        initOnRamp({
          appId: import.meta.env.VITE_COINBASE_APP_ID || '40646732-b0cc-4432-9767-152c71112a6e',
          widgetParameters: {
            addresses: { [walletAddress]: ['base'] },
            assets: ['USDC']
          },
          experienceLoggedIn: 'popup',
          experienceLoggedOut: 'popup',
          closeOnExit: true,
          closeOnSuccess: true,
          onSuccess: () => {
            console.log('✅ Coinbase Onramp purchase successful!');
            if (onSuccess) onSuccess();
          },
          onExit: () => {
            console.log('ℹ️ Coinbase Onramp closed');
          },
          onEvent: (event) => {
            console.log('📊 Coinbase Onramp event:', event);
          },
        }, (error, inst) => {
          if (error) {
            console.error('❌ Failed to initialize Coinbase Onramp:', error);
            setError('Failed to initialize Coinbase Onramp');
            setIsLoading(false);
            return;
          }
          console.log('✅ Coinbase Onramp initialized successfully');
          instance = inst;
          setOnrampInstance(inst);
          setIsLoading(false);
        });
      } catch (err: any) {
        console.error('❌ Error initializing onramp:', err);
        setError('Failed to initialize onramp');
        setIsLoading(false);
      }
    }

    initializeOnramp();

    return () => {
      instance?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const handleFundAccount = () => {
    if (onrampInstance) {
      onrampInstance.open();
    } else if (error) {
      alert(error);
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
