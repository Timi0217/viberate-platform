// Input validation utilities

export const validateEmail = (email: string): string | null => {
  if (!email) {
    return 'Email is required';
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }

  // Check for common typos
  const commonTypos = ['gamil.com', 'gmial.com', 'yahooo.com', 'hotmial.com'];
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && commonTypos.includes(domain)) {
    return 'Did you mean a different domain? Please check your email';
  }

  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return 'Password is required';
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (password.length > 128) {
    return 'Password must be less than 128 characters';
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character';
  }

  // Check for common weak passwords
  const weakPasswords = ['Password123!', 'Admin123!', 'Welcome123!'];
  if (weakPasswords.includes(password)) {
    return 'This password is too common. Please choose a different one';
  }

  return null;
};

export const validateUsername = (username: string): string | null => {
  if (!username) {
    return 'Username is required';
  }

  if (username.length < 3) {
    return 'Username must be at least 3 characters long';
  }

  if (username.length > 30) {
    return 'Username must be less than 30 characters';
  }

  // Allow only alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }

  return null;
};

export const validateWalletAddress = (address: string): string | null => {
  if (!address) {
    return 'Wallet address is required';
  }

  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'Invalid wallet address format. Must be 0x followed by 40 hexadecimal characters';
  }

  // EIP-55 checksum validation (simplified)
  // In production, use a library like ethers.js for proper checksum validation

  return null;
};

export const validateURL = (url: string): string | null => {
  if (!url) {
    return 'URL is required';
  }

  try {
    const urlObj = new URL(url);

    // Must be https in production
    if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
      return 'URL must use HTTP or HTTPS protocol';
    }

    // Warn about http (but allow it for development)
    if (urlObj.protocol === 'http:' && !urlObj.hostname.includes('localhost') && !urlObj.hostname.includes('127.0.0.1')) {
      return 'HTTPS is recommended for security. Are you sure you want to use HTTP?';
    }

    return null;
  } catch (e) {
    return 'Please enter a valid URL';
  }
};

export const validatePaymentAmount = (amount: string | number): string | null => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return 'Payment amount must be a valid number';
  }

  if (numAmount < 0) {
    return 'Payment amount cannot be negative';
  }

  if (numAmount === 0) {
    return 'Payment amount must be greater than zero';
  }

  if (numAmount > 10000) {
    return 'Payment amount cannot exceed $10,000 USDC';
  }

  // Check for reasonable decimal places (max 2 for currency)
  if ((numAmount.toString().split('.')[1]?.length || 0) > 2) {
    return 'Payment amount can have at most 2 decimal places';
  }

  return null;
};

export const sanitizeInput = (input: string): string => {
  // Remove any potential script tags or dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};
