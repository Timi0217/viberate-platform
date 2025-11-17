"""
Coinbase CDP Wallet Service
Handles wallet creation, balance checking, and USDC transfers
"""
import os
import logging
from decimal import Decimal
from typing import Optional, Dict
from cdp import Cdp, Wallet

logger = logging.getLogger(__name__)


class WalletService:
    """Service for managing Coinbase CDP wallets"""

    _initialized = False

    @classmethod
    def initialize(cls):
        """Initialize the Coinbase CDP SDK with API credentials"""
        if cls._initialized:
            return

        try:
            # Get API credentials from environment variables
            api_key_name = os.getenv('COINBASE_CDP_API_KEY_NAME')
            api_key_private_key = os.getenv('COINBASE_CDP_API_KEY_PRIVATE')

            if not api_key_name or not api_key_private_key:
                logger.warning(
                    "Coinbase CDP API credentials not found. "
                    "Set COINBASE_CDP_API_KEY_NAME and COINBASE_CDP_API_KEY_PRIVATE environment variables."
                )
                return

            # Configure the CDP SDK
            Cdp.configure(api_key_name, api_key_private_key)
            cls._initialized = True
            logger.info("Coinbase CDP SDK initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Coinbase CDP SDK: {e}")
            raise

    @classmethod
    def create_wallet(cls, network: str = "base-mainnet") -> Dict[str, str]:
        """
        Create a new wallet on the specified network

        Args:
            network: Network to create wallet on (base-mainnet or base-sepolia)

        Returns:
            Dict containing wallet_id and address
        """
        cls.initialize()

        try:
            # Create a new wallet
            wallet = Wallet.create(network_id=network)

            # Get the default address
            address = wallet.default_address.address_id
            wallet_id = wallet.id

            # Export wallet data for storage (encrypted seed)
            wallet_data = wallet.export_data()

            logger.info(f"Created new wallet: {address} on {network}")

            return {
                'wallet_id': wallet_id,
                'address': address,
                'wallet_data': wallet_data,  # Store this securely in database
                'network': network
            }

        except Exception as e:
            logger.error(f"Failed to create wallet: {e}")
            raise

    @classmethod
    def get_balance(cls, wallet_data: str, asset: str = "usdc") -> Decimal:
        """
        Get the balance of a specific asset in the wallet

        Args:
            wallet_data: Encrypted wallet data from database
            asset: Asset symbol to check (default: usdc)

        Returns:
            Balance as Decimal
        """
        cls.initialize()

        try:
            # Import wallet from stored data
            wallet = Wallet.import_data(wallet_data)

            # Get balance for the specified asset
            balance = wallet.balance(asset)

            logger.info(f"Wallet {wallet.default_address.address_id} balance: {balance} {asset.upper()}")

            return Decimal(str(balance))

        except Exception as e:
            logger.error(f"Failed to get wallet balance: {e}")
            return Decimal('0')

    @classmethod
    def transfer_usdc(
        cls,
        from_wallet_data: str,
        to_address: str,
        amount: Decimal,
        gasless: bool = True
    ) -> Dict[str, str]:
        """
        Transfer USDC from one wallet to another

        Args:
            from_wallet_data: Encrypted wallet data of sender
            to_address: Recipient wallet address (0x...)
            amount: Amount of USDC to send
            gasless: Whether to use gasless transfer (default: True)

        Returns:
            Dict containing transaction hash and status
        """
        cls.initialize()

        try:
            # Import sender wallet
            wallet = Wallet.import_data(from_wallet_data)

            # Perform the transfer
            transfer = wallet.transfer(
                amount=float(amount),
                asset_id="usdc",
                destination=to_address,
                gasless=gasless
            )

            # Wait for transfer to complete
            transfer.wait()

            logger.info(
                f"Transferred {amount} USDC from {wallet.default_address.address_id} "
                f"to {to_address}. Tx hash: {transfer.transaction_hash}"
            )

            return {
                'transaction_hash': transfer.transaction_hash,
                'status': 'completed',
                'from_address': wallet.default_address.address_id,
                'to_address': to_address,
                'amount': str(amount)
            }

        except Exception as e:
            logger.error(f"Failed to transfer USDC: {e}")
            raise

    @classmethod
    def get_transaction_history(cls, wallet_data: str) -> list:
        """
        Get transaction history for a wallet

        Args:
            wallet_data: Encrypted wallet data from database

        Returns:
            List of transactions
        """
        cls.initialize()

        try:
            # Import wallet
            wallet = Wallet.import_data(wallet_data)

            # List transfers
            transfers = wallet.list_transfers()

            transactions = []
            for transfer in transfers:
                transactions.append({
                    'transaction_hash': transfer.transaction_hash,
                    'from_address': transfer.from_address_id,
                    'to_address': transfer.destination,
                    'amount': str(transfer.amount),
                    'asset': transfer.asset_id,
                    'status': transfer.status,
                })

            return transactions

        except Exception as e:
            logger.error(f"Failed to get transaction history: {e}")
            return []
