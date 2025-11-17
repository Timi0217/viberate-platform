// Input validation utilities for extension

export function validateWalletAddress(address: string): string | null {
    if (!address) {
        return 'Wallet address is required';
    }

    // Must start with 0x
    if (!address.startsWith('0x')) {
        return 'Wallet address must start with 0x';
    }

    // Must be exactly 42 characters (0x + 40 hex chars)
    if (address.length !== 42) {
        return 'Wallet address must be 42 characters (0x followed by 40 hex characters)';
    }

    // Must contain only valid hex characters
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return 'Wallet address contains invalid characters. Only 0-9 and a-f are allowed';
    }

    // EIP-55 checksum validation (basic)
    // In production, this should use a proper library like ethers.js
    const hasUpperCase = /[A-F]/.test(address.substring(2));
    const hasLowerCase = /[a-f]/.test(address.substring(2));

    if (hasUpperCase && hasLowerCase) {
        // Mixed case detected - this could be a checksum address
        // We should validate the checksum, but for now just accept it
        // TODO: Implement proper EIP-55 checksum validation
    }

    return null;
}

export function validateEmail(email: string): string | null {
    if (!email) {
        return 'Email is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }

    return null;
}

export function validatePassword(password: string): string | null {
    if (!password) {
        return 'Password is required';
    }

    if (password.length < 8) {
        return 'Password must be at least 8 characters';
    }

    return null;
}

export function validateUsername(username: string): string | null {
    if (!username) {
        return 'Username is required';
    }

    if (username.length < 3) {
        return 'Username must be at least 3 characters';
    }

    if (username.length > 30) {
        return 'Username must be less than 30 characters';
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return 'Username can only contain letters, numbers, underscores, and hyphens';
    }

    return null;
}
