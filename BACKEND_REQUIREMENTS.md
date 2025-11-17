# Backend Implementation Requirements

This document outlines the critical backend features that need to be implemented to complete the Viberate annotation platform.

## Table of Contents
1. [USDC Payment System](#usdc-payment-system)
2. [HttpOnly Cookie Authentication](#httponly-cookie-authentication)
3. [Audit Logging](#audit-logging)
4. [Assignment Approval Endpoints](#assignment-approval-endpoints)
5. [Security Enhancements](#security-enhancements)

---

## 1. USDC Payment System

### Overview
Implement automated USDC payments on the Base network when researchers approve annotations.

### Required Endpoints

#### POST `/api/assignments/{id}/approve/`
**Purpose**: Approve an assignment and trigger USDC payment

**Request Body**:
```json
{
  "payment_amount": 5.00
}
```

**Backend Logic**:
1. Verify the assignment exists and is in 'submitted' status
2. Verify the requester is the researcher who owns the task
3. Validate payment amount (must be > 0, reasonable limits)
4. Get annotator's wallet address from their profile
5. **Transfer USDC**:
   - Use Base network (not Ethereum mainnet - cheaper fees)
   - Transfer `payment_amount` USDC from platform wallet to annotator's `base_wallet_address`
   - Wait for transaction confirmation
6. Update assignment status to 'approved'
7. Store transaction hash in assignment record
8. Update annotator's USDC balance
9. Create audit log entry (see Audit Logging section)
10. Send notification to annotator

**Response**:
```json
{
  "id": 123,
  "status": "approved",
  "payment_amount": "5.00",
  "transaction_hash": "0xabc123...",
  "paid_at": "2025-01-11T10:30:00Z"
}
```

**Error Handling**:
- 400: Invalid payment amount
- 400: Annotator has no wallet connected
- 402: Insufficient funds in platform wallet
- 403: Only task owner can approve
- 404: Assignment not found
- 409: Assignment not in submittedstatus
- 500: Blockchain transaction failed (include error details)

### Implementation Details

#### Using Coinbase SDK (Recommended)
```python
from coinbase.wallet.client import Client
from decimal import Decimal

def transfer_usdc_payment(to_address: str, amount: Decimal) -> str:
    """
    Transfer USDC on Base network

    Returns: transaction hash
    """
    # Initialize Coinbase client with API credentials
    client = Client(settings.COINBASE_API_KEY, settings.COINBASE_API_SECRET)

    # Get Base USDC account
    account = client.get_account(settings.USDC_ACCOUNT_ID)

    # Create transaction
    tx = account.send_money(
        to=to_address,
        amount=str(amount),
        currency='USDC',
        network='base'  # Important: Use Base network for low fees
    )

    return tx['transaction']['hash']
```

#### Using web3.py (Alternative)
```python
from web3 import Web3
from decimal import Decimal

def transfer_usdc_web3(to_address: str, amount: Decimal) -> str:
    """
    Transfer USDC using web3.py

    Returns: transaction hash
    """
    # Connect to Base network
    w3 = Web3(Web3.HTTPProvider(settings.BASE_RPC_URL))

    # USDC contract on Base
    usdc_address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    usdc_abi = [...]  # ERC-20 ABI

    usdc_contract = w3.eth.contract(address=usdc_address, abi=usdc_abi)

    # Platform wallet (must have USDC balance)
    platform_address = settings.PLATFORM_WALLET_ADDRESS
    private_key = settings.PLATFORM_WALLET_PRIVATE_KEY

    # USDC has 6 decimals (not 18 like ETH)
    amount_in_units = int(amount * 1_000_000)

    # Build transaction
    nonce = w3.eth.get_transaction_count(platform_address)

    tx = usdc_contract.functions.transfer(
        to_address,
        amount_in_units
    ).build_transaction({
        'from': platform_address,
        'nonce': nonce,
        'gas': 100000,
        'gasPrice': w3.eth.gas_price
    })

    # Sign and send
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)

    # Wait for confirmation (at least 1 block)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    if receipt['status'] != 1:
        raise Exception(f"Transaction failed: {tx_hash.hex()}")

    return tx_hash.hex()
```

#### Environment Variables Needed
```env
# Base Network RPC
BASE_RPC_URL=https://mainnet.base.org

# Platform Wallet (holds USDC for payments)
PLATFORM_WALLET_ADDRESS=0x...
PLATFORM_WALLET_PRIVATE_KEY=...  # Store in secrets manager, NOT in code!

# USDC Contract on Base
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Coinbase API (if using Coinbase SDK)
COINBASE_API_KEY=...
COINBASE_API_SECRET=...
USDC_ACCOUNT_ID=...
```

#### Database Schema Updates
```sql
ALTER TABLE assignments
ADD COLUMN payment_amount DECIMAL(10, 2),
ADD COLUMN transaction_hash VARCHAR(66),
ADD COLUMN paid_at TIMESTAMP;

CREATE INDEX idx_assignments_transaction_hash
ON assignments(transaction_hash);
```

---

## 2. HttpOnly Cookie Authentication

### Overview
Replace localStorage token storage with secure httpOnly cookies to prevent XSS token theft.

### Implementation

#### Login Endpoint Changes
**POST `/api/auth/login/`**

**Current Response** (DON'T DO THIS):
```json
{
  "token": "abc123...",  // ❌ Frontend stores in localStorage
  "user": {...}
}
```

**New Response** (DO THIS):
```python
from django.http import JsonResponse

def login(request):
    # ... authenticate user ...

    token = create_token(user)

    response = JsonResponse({
        "user": {
            "id": user.id,
            "username": user.username,
            # ... other user fields
        }
    })

    # Set httpOnly cookie
    response.set_cookie(
        key='auth_token',
        value=token,
        httponly=True,      # ✓ JavaScript cannot access
        secure=True,        # ✓ Only sent over HTTPS
        samesite='Lax',     # ✓ CSRF protection
        max_age=7 * 24 * 60 * 60,  # 7 days
        domain=settings.COOKIE_DOMAIN  # Set appropriately
    )

    return response
```

#### Middleware for Cookie Authentication
```python
# middleware/cookie_auth.py
from django.utils.deprecation import MiddlewareMixin
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed

class CookieTokenAuthenticationMiddleware(MiddlewareMixin):
    def process_request(self, request):
        # Check for token in cookie
        token = request.COOKIES.get('auth_token')

        if token:
            # Set Authorization header from cookie
            request.META['HTTP_AUTHORIZATION'] = f'Token {token}'
```

#### CORS Settings
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "https://frontend-your-domain.vercel.app",
    "http://localhost:5173",  # Development
]

CORS_ALLOW_CREDENTIALS = True  # Required for cookies

# Session/Cookie settings
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True  # Only in production
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = True
```

#### Frontend Changes Needed
The frontend code has been updated to expect cookies instead of localStorage. **No frontend code changes needed** - the browser handles cookies automatically.

#### Logout Implementation
```python
def logout(request):
    response = JsonResponse({"message": "Logged out successfully"})

    # Delete the cookie
    response.delete_cookie('auth_token')

    return response
```

---

## 3. Audit Logging

### Overview
Log all financial transactions and critical actions for compliance and debugging.

### Database Schema

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,  -- 'payment', 'approval', 'rejection', etc.
    user_id INTEGER REFERENCES users(id),
    assignment_id INTEGER REFERENCES assignments(id),
    amount DECIMAL(10, 2),
    transaction_hash VARCHAR(66),
    ip_address INET,
    user_agent TEXT,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_transaction_hash ON audit_logs(transaction_hash);
```

### Implementation

```python
# utils/audit.py
from django.contrib.gis.geoip2 import GeoIP2
import json

def log_audit_event(
    event_type: str,
    user=None,
    assignment=None,
    amount=None,
    transaction_hash=None,
    request=None,
    response_data=None,
    error=None
):
    """
    Log audit event

    Args:
        event_type: Type of event ('payment', 'approval', 'rejection', etc.)
        user: User who performed the action
        assignment: Related assignment
        amount: Payment amount (if applicable)
        transaction_hash: Blockchain transaction hash
        request: Django request object
        response_data: Response data dictionary
        error: Error message if failed
    """
    from .models import AuditLog

    ip_address = None
    user_agent = None
    request_data = None

    if request:
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        request_data = {
            'method': request.method,
            'path': request.path,
            'query_params': dict(request.GET),
        }

    AuditLog.objects.create(
        event_type=event_type,
        user=user,
        assignment=assignment,
        amount=amount,
        transaction_hash=transaction_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        request_data=request_data,
        response_data=response_data,
        error_message=str(error) if error else None
    )

def get_client_ip(request):
    """Get client IP from request, accounting for proxies"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
```

### Usage in Approval Endpoint

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_assignment(request, assignment_id):
    try:
        assignment = Assignment.objects.get(id=assignment_id)
        payment_amount = request.data.get('payment_amount')

        # ... validation ...

        # Transfer USDC
        tx_hash = transfer_usdc_payment(
            to_address=assignment.annotator.base_wallet_address,
            amount=payment_amount
        )

        # Update assignment
        assignment.status = 'approved'
        assignment.payment_amount = payment_amount
        assignment.transaction_hash = tx_hash
        assignment.paid_at = timezone.now()
        assignment.save()

        # Log successful payment
        log_audit_event(
            event_type='payment_success',
            user=request.user,
            assignment=assignment,
            amount=payment_amount,
            transaction_hash=tx_hash,
            request=request,
            response_data={'status': 'approved'}
        )

        return Response({...})

    except Exception as e:
        # Log failed payment
        log_audit_event(
            event_type='payment_failure',
            user=request.user,
            assignment=assignment,
            amount=payment_amount,
            request=request,
            error=e
        )
        raise
```

### Audit Log Viewer (Admin Panel)

```python
# admin.py
from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = [
        'timestamp',
        'event_type',
        'user',
        'amount',
        'transaction_hash_short',
        'ip_address'
    ]
    list_filter = ['event_type', 'timestamp']
    search_fields = ['transaction_hash', 'user__username', 'ip_address']
    readonly_fields = [
        'timestamp', 'event_type', 'user', 'assignment',
        'amount', 'transaction_hash', 'ip_address', 'user_agent',
        'request_data', 'response_data', 'error_message'
    ]

    def transaction_hash_short(self, obj):
        if obj.transaction_hash:
            return f"{obj.transaction_hash[:10]}..."
        return "-"

    def has_add_permission(self, request):
        return False  # Audit logs should never be manually added

    def has_delete_permission(self, request, obj=None):
        return False  # Audit logs should never be deleted
```

---

## 4. Assignment Approval Endpoints

### Required Endpoints

#### GET `/api/assignments/`
**Purpose**: List assignments (filterable by status)

**Query Parameters**:
- `status` (optional): Filter by status ('submitted', 'approved', 'rejected', etc.)

**Response**:
```json
[
  {
    "id": 123,
    "task": {
      "id": 456,
      "title": "Classify sentiment",
      "data": {"text": "This is great!"}
    },
    "task_id": 456,
    "annotator": {
      "id": 789,
      "username": "annotator1"
    },
    "status": "submitted",
    "result": {"label": "positive", "confidence": 0.95},
    "submitted_at": "2025-01-11T10:00:00Z",
    "payment_amount": null,
    "transaction_hash": null
  }
]
```

#### POST `/api/assignments/{id}/reject/`
**Purpose**: Reject an assignment with optional reason

**Request Body**:
```json
{
  "reason": "Annotation quality does not meet standards"
}
```

**Backend Logic**:
1. Verify assignment exists and is in 'submitted' status
2. Verify requester is the researcher who owns the task
3. Update assignment status to 'rejected'
4. Store rejection reason
5. Create audit log entry
6. Send notification to annotator with feedback

**Response**:
```json
{
  "id": 123,
  "status": "rejected",
  "rejection_reason": "Annotation quality does not meet standards",
  "rejected_at": "2025-01-11T10:35:00Z"
}
```

**Error Handling**:
- 403: Only task owner can reject
- 404: Assignment not found
- 409: Assignment not in correct status

---

## 5. Security Enhancements

### Rate Limiting
Implement rate limiting on all endpoints, especially authentication and financial operations.

```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'login': '5/minute',  # Stricter for auth
        'payment': '10/minute'  # Stricter for payments
    }
}

# Custom throttle for sensitive operations
class PaymentRateThrottle(UserRateThrottle):
    rate = '10/minute'
```

### Input Validation
```python
from rest_framework import serializers
from decimal import Decimal

class ApproveAssignmentSerializer(serializers.Serializer):
    payment_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        max_value=Decimal('10000.00')
    )

    def validate_payment_amount(self, value):
        """Additional validation for payment amount"""
        if value <= 0:
            raise serializers.ValidationError(
                "Payment amount must be greater than zero"
            )

        if value > 10000:
            raise serializers.ValidationError(
                "Payment amount cannot exceed $10,000"
            )

        # Check for reasonable decimal places
        if value.as_tuple().exponent < -2:
            raise serializers.ValidationError(
                "Payment amount can have at most 2 decimal places"
            )

        return value
```

### HTTPS Enforcement
```python
# settings.py (Production)
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Security headers
SECURE_HSTS_SECONDS = 31536000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

### Wallet Address Validation
```python
from web3 import Web3

def validate_wallet_address(address: str) -> bool:
    """
    Validate Ethereum/Base wallet address

    Checks:
    1. Correct format (0x + 40 hex chars)
    2. EIP-55 checksum (if mixed case)
    """
    if not isinstance(address, str):
        return False

    # Check format
    if not Web3.is_address(address):
        return False

    # Check checksum if mixed case
    if address != address.lower() and address != address.upper():
        if not Web3.is_checksum_address(address):
            return False

    return True
```

---

## Priority Implementation Order

1. **HIGH PRIORITY** (Critical for MVP):
   - Assignment approval/rejection endpoints
   - Basic audit logging
   - Input validation

2. **MEDIUM PRIORITY** (Important for security):
   - HttpOnly cookie authentication
   - Rate limiting
   - HTTPS enforcement

3. **HIGH PRIORITY** (Needed for payments):
   - USDC payment integration
   - Comprehensive audit logging
   - Transaction monitoring

---

## Testing Requirements

### Unit Tests
```python
def test_approve_assignment_success():
    # Test successful approval and payment
    pass

def test_approve_assignment_insufficient_funds():
    # Test when platform wallet has insufficient USDC
    pass

def test_approve_assignment_no_wallet():
    # Test when annotator hasn't connected wallet
    pass

def test_reject_assignment():
    # Test successful rejection
    pass

def test_audit_log_created():
    # Test audit logs are created for all operations
    pass
```

### Integration Tests
- Test full payment flow on Base testnet
- Test cookie authentication with frontend
- Test rate limiting doesn't block legitimate requests
- Test CORS with actual frontend domain

---

## Monitoring & Alerts

### Required Monitoring
1. **Payment Failures**: Alert if payment transaction fails
2. **Low Balance**: Alert when platform wallet balance < threshold
3. **High Gas Fees**: Alert if Base network fees spike
4. **Failed Transactions**: Track failed blockchain transactions
5. **Audit Log Anomalies**: Alert on suspicious patterns

### Recommended Tools
- **Sentry**: Error tracking
- **DataDog/New Relic**: Application monitoring
- **Etherscan API**: Transaction monitoring
- **PagerDuty**: On-call alerts for payment failures

---

## Environment Setup Checklist

- [ ] Base network RPC endpoint configured
- [ ] Platform wallet created with USDC balance
- [ ] Private key stored securely (AWS Secrets Manager / HashiCorp Vault)
- [ ] USDC contract address verified for Base network
- [ ] Cookie domain configured correctly
- [ ] CORS origins whitelisted
- [ ] HTTPS certificates installed
- [ ] Rate limiting configured
- [ ] Audit logging database tables created
- [ ] Monitoring and alerts set up
- [ ] Test payments on Base testnet verified

---

## Cost Estimates

### Base Network Fees
- USDC transfer: ~$0.01-0.05 per transaction
- Much cheaper than Ethereum mainnet (~$5-50)

### Platform Costs
- Need to maintain USDC balance in platform wallet
- Need ETH balance for gas fees on Base network
- Monitoring tools: $50-200/month

---

## Security Checklist

- [ ] Private keys never committed to git
- [ ] Private keys stored in secure vault
- [ ] Rate limiting enabled on all endpoints
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention (use ORM)
- [ ] XSS prevention (frontend already handles)
- [ ] CSRF protection (httpOnly cookies + SameSite)
- [ ] Audit logs for all financial operations
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

---

## Support & Resources

### Documentation
- [Base Network Docs](https://docs.base.org/)
- [Coinbase SDK](https://developers.coinbase.com/)
- [Web3.py](https://web3py.readthedocs.io/)
- [Django REST Framework](https://www.django-rest-framework.org/)

### Smart Contract Addresses (Base Mainnet)
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Base RPC: `https://mainnet.base.org`
- Base Explorer: `https://basescan.org`

---

**Last Updated**: 2025-01-11
**Prepared By**: Claude Code Security Review
