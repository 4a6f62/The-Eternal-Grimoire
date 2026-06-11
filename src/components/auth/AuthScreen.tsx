import React, { useState } from 'react';
import { db } from '../../lib/db';
import {
  generateSalt,
  generateTOTPSecret,
  deriveKey,
  encryptData,
  decryptData,
  verifyTOTPCode
} from '../../lib/security';
import { KeyRound, ShieldAlert, CheckCircle2, Copy, ArrowRight, LogIn, UserPlus } from 'lucide-react';

interface AuthScreenProps {
  onLoginSuccess: (username: string, sessionKey: CryptoKey) => void;
}

export function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'mfa_setup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Signup-specific MFA setup state
  const [tempSalt, setTempSalt] = useState('');
  const [tempSecret, setTempSecret] = useState('');
  const [copied, setCopied] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username.trim() || !password || !totpCode) {
        throw new Error('All fields, including the 2FA code, are required.');
      }

      // 1. Fetch user from db
      const user = await db.users.where('username').equalsIgnoreCase(username.trim()).first();
      if (!user) {
        throw new Error('Invalid username, password, or 2FA code.');
      }

      // 2. Derive candidate key from password and stored salt
      const candidateKey = await deriveKey(password, user.salt);

      // 3. Attempt to decrypt verification token
      let decryptedVerification = '';
      try {
        decryptedVerification = await decryptData(
          user.verificationCipher,
          user.verificationIv,
          candidateKey
        );
      } catch (err) {
        // Decryption failure means incorrect password
        throw new Error('Invalid username, password, or 2FA code.');
      }

      if (decryptedVerification !== 'authenticated') {
        throw new Error('Invalid username, password, or 2FA code.');
      }

      // 4. Decrypt TOTP secret
      const plainTotpSecret = await decryptData(
        user.encryptedTotpSecret,
        user.totpSecretIv,
        candidateKey
      );

      // 5. Verify entered TOTP code
      const isTotpValid = await verifyTOTPCode(plainTotpSecret, totpCode.trim());
      if (!isTotpValid) {
        throw new Error('Invalid username, password, or 2FA code.');
      }

      // Successful login
      onLoginSuccess(user.username, candidateKey);
    } catch (err: any) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const startSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // Check if user already exists
      const existingUser = await db.users.where('username').equalsIgnoreCase(username.trim()).first();
      if (existingUser) {
        throw new Error('Username already exists.');
      }

      // Generate salt and TOTP secret
      const salt = generateSalt();
      const mfaSecret = generateTOTPSecret();

      setTempSalt(salt);
      setTempSecret(mfaSecret);
      setMode('mfa_setup');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const completeSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!totpCode) {
        throw new Error('Please enter the 2FA verification code.');
      }

      // Verify the 2FA code before saving account
      const isTotpValid = await verifyTOTPCode(tempSecret, totpCode.trim());
      if (!isTotpValid) {
        throw new Error('Invalid 2FA verification code. Check your device time and code.');
      }

      // 1. Derive encryption key
      const key = await deriveKey(password, tempSalt);

      // 2. Encrypt the verification token
      const verification = await encryptData('authenticated', key);

      // 3. Encrypt the TOTP secret
      const encryptedSecret = await encryptData(tempSecret, key);

      // 4. Save to users table
      await db.users.put({
        username: username.trim(),
        salt: tempSalt,
        verificationCipher: verification.ciphertextHex,
        verificationIv: verification.ivHex,
        encryptedTotpSecret: encryptedSecret.ciphertextHex,
        totpSecretIv: encryptedSecret.ivHex,
        mfaEnabled: true
      });

      setSuccessMsg('Account created successfully!');
      
      // Auto-login after successful signup
      setTimeout(() => {
        onLoginSuccess(username.trim(), key);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(tempSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const otpauthUri = `otpauth://totp/CharacterVault:${username.trim()}?secret=${tempSecret}&issuer=CharacterVault`;

  return (
    <div className="w-full max-w-md bg-parchment-light p-10 paper-shadow classic-border relative mx-auto my-12 animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center border-b-2 border-dnd-gold/30 pb-4 mb-6">
        <h2 className="text-3xl text-dnd-red font-serif tracking-tight flex items-center justify-center gap-2">
          <KeyRound className="text-dnd-gold" size={28} />
          {mode === 'login' && 'Secure Gate'}
          {mode === 'signup' && 'Register Hero'}
          {mode === 'mfa_setup' && 'Secure 2FA'}
        </h2>
        <p className="text-xs italic text-ink/60 font-serif mt-1">
          {mode === 'login' && 'Verify credentials to access vault'}
          {mode === 'signup' && 'Create your master account'}
          {mode === 'mfa_setup' && 'Link authenticator app to enable MFA'}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-dnd-red/10 border-l-4 border-dnd-red text-dnd-red text-sm flex gap-2 items-center mb-6 animate-in slide-in-from-top-2">
          <ShieldAlert size={18} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-fel-green/10 border-l-4 border-fel-green text-fel-green text-sm flex gap-2 items-center mb-6 animate-in slide-in-from-top-2">
          <CheckCircle2 size={18} className="flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4 font-serif">
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">Username</label>
            <input
              type="text"
              required
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">Master Password</label>
            <input
              type="password"
              required
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">2FA Authenticator Code</label>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner tracking-widest text-center text-2xl font-sans"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dnd-red text-white py-3 font-bold uppercase hover:bg-ink transition-all cursor-pointer flex justify-center items-center gap-2 mt-6 shadow-md"
          >
            {loading ? 'Decrypting Vault...' : 'Unlock Vault'}
            <LogIn size={18} />
          </button>

          <p className="text-center text-sm text-ink/70 mt-6 pt-4 border-t border-dnd-gold/10">
            First time?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className="text-dnd-red font-bold hover:underline"
            >
              Register Master Key
            </button>
          </p>
        </form>
      )}

      {mode === 'signup' && (
        <form onSubmit={startSignup} className="space-y-4 font-serif">
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">Username</label>
            <input
              type="text"
              required
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. DungeonMaster"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">Master Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-ink/60 block mb-1 tracking-wider">Confirm Password</label>
            <input
              type="password"
              required
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dnd-red text-white py-3 font-bold uppercase hover:bg-ink transition-all cursor-pointer flex justify-center items-center gap-2 mt-6 shadow-md"
          >
            {loading ? 'Initializing Key...' : 'Next: Set Up 2FA'}
            <ArrowRight size={18} />
          </button>

          <p className="text-center text-sm text-ink/70 mt-6 pt-4 border-t border-dnd-gold/10">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className="text-dnd-red font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      )}

      {mode === 'mfa_setup' && (
        <form onSubmit={completeSignup} className="space-y-6 font-serif">
          <div className="bg-parchment-base border border-border-sepia p-4 rounded-sm space-y-4">
            <p className="text-sm leading-relaxed text-ink/80">
              Your master password is secure. Now setup 2FA. Copy the secret key below, or click the setup link to register it in your authenticator app:
            </p>
            
            <div className="flex gap-2 items-center">
              <code className="flex-grow bg-parchment-dark/50 border border-border-sepia/50 p-2 font-mono text-xs select-all text-center rounded-sm tracking-widest text-ink block font-bold">
                {tempSecret}
              </code>
              <button
                type="button"
                onClick={copySecret}
                className="p-2 border border-border-sepia hover:bg-dnd-gold hover:text-white transition-colors bg-parchment-light rounded-sm flex items-center justify-center text-ink flex-shrink-0 cursor-pointer"
                title="Copy Key"
              >
                {copied ? <CheckCircle2 size={16} className="text-fel-green" /> : <Copy size={16} />}
              </button>
            </div>

            <div className="text-center">
              <a
                href={otpauthUri}
                className="inline-block text-xs uppercase tracking-wider font-bold bg-dnd-gold/20 hover:bg-dnd-gold/40 text-ink px-4 py-2 border border-dnd-gold/50 rounded-sm transition-colors cursor-pointer"
              >
                Add to Mobile/Desktop Authenticator
              </a>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase block text-ink/60 mb-2 tracking-wider">Verify 2FA Code</label>
            <p className="text-xs text-ink/50 mb-2 italic">Enter the 6-digit code shown in your authenticator app to verify setup:</p>
            <input
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="w-full bg-parchment-base border border-border-sepia p-3 text-ink focus:outline-none focus:border-dnd-red shadow-inner tracking-widest text-center text-2xl font-sans"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setTotpCode('');
              }}
              className="flex-1 border border-border-sepia py-3 text-xs uppercase font-bold text-ink hover:bg-parchment-base transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-dnd-red text-white py-3 font-bold uppercase hover:bg-ink transition-all cursor-pointer flex justify-center items-center gap-2 shadow-md"
            >
              {loading ? 'Saving Secret...' : 'Activate 2FA'}
              <UserPlus size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
