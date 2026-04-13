import React, { useState } from 'react';
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
  const { login } = useAuth();

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

        <div className="login-credentials">
          <p className="login-credentials-label">Test Credentials</p>
          <p>Email: hr@outfitters.com.pk</p>
          <p>Password: hr123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
