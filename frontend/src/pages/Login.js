import React, { useEffect, useState } from 'react';
import { Button, FormField } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import rahatOneLogo from '../assets/rahat-one-logo.svg';
import outfittersLogo from '../assets/outfitters-logo.svg';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 768px)');
    if (!mq) return;
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener?.('change', handler) ?? mq.addListener?.(handler);
    return () => mq.removeEventListener?.('change', handler) ?? mq.removeListener?.(handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.message);
      setLoading(false);
    }
    // If success, AuthContext handles redirect
  };

  return (
    <div className="login-page">
      {isMobile && (
        <div className="login-mobile-notice">
          This app is for <strong>employees only</strong> on mobile.
          HR staff should use a desktop browser.
        </div>
      )}
      <div className="login-card">
        <div className="login-header">
          <img src={rahatOneLogo} alt="RAHAT-ONE logo" className="login-logo" />
          <h1 className="login-title">RAHAT-ONE</h1>
          <p className="login-subtitle">HR Automation Platform</p>
          <div className="login-divider" />
          <div className="login-powered">
            <img src={outfittersLogo} alt="Outfitters" className="login-outfitters-logo" />
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <FormField
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@outfitters.com.pk"
            required
            disabled={loading}
          />

          <FormField
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            className="login-submit"
          >
            Sign In
          </Button>
        </form>

      </div>
    </div>
  );
}

export default Login;
