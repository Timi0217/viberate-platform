import { useEffect, useState } from 'react';
import { initOnRamp, CBPayInstanceType } from '@coinbase/cbpay-js';

interface CoinbaseOnrampProps {
  walletAddress: string;
  onSuccess?: () => void;
}

export function CoinbaseOnramp({ walletAddress, onSuccess }: CoinbaseOnrampProps) {
  const [onrampInstance, setOnrampInstance] = useState<CBPayInstanceType | null>(null);

  useEffect(() => {
    // Initialize Coinbase Onramp with callback pattern
    initOnRamp({
      appId: import.meta.env.VITE_COINBASE_APP_ID || 'viberate-demo',
      widgetParameters: {
        addresses: { [walletAddress]: ['base'] },
        assets: ['USDC'],
      },
      experienceLoggedIn: 'popup',
      experienceLoggedOut: 'popup',
      closeOnExit: true,
      closeOnSuccess: true,
      onSuccess: () => {
        console.log('Coinbase Onramp success!');
        if (onSuccess) onSuccess();
      },
      onExit: () => {
        console.log('Coinbase Onramp closed');
      },
      onEvent: (event) => {
        console.log('Coinbase Onramp event:', event);
      },
    }, (error, instance) => {
      if (error) {
        console.error('Failed to initialize Coinbase Onramp:', error);
        return;
      }
      setOnrampInstance(instance);
    });

    return () => {
      onrampInstance?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  const handleFundAccount = () => {
    if (onrampInstance) {
      onrampInstance.open();
    }
  };

  return (
    <button
      onClick={handleFundAccount}
      style={{
        padding: '12px 24px',
        background: '#0052FF',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="white"/>
      </svg>
      Fund Account with Credit Card
    </button>
  );
}
