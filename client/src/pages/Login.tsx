import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { brand } from '../config/brand';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-layout">
      <section className="login-brand">
        <b className="login-logo">{brand.name}</b>
        <div>
          <p className="eyebrow light">{brand.product}</p>
          <h1>
            {brand.loginHeadline.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </h1>
          <p className="login-tagline">{brand.loginTagline}</p>
        </div>
        <div className="login-path">{brand.journey.join('   →   ')}</div>
      </section>

      <section className="login-form-wrap">
        <form onSubmit={submit} className="login-form">
          <p className="eyebrow">{brand.programme}</p>
          <h2>Welcome to {brand.product}</h2>
          <p className="login-lead">Sign in to your workspace.</p>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              placeholder="partner@demo.example"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in →'}
          </button>

          {brand.showDemoLogins && (
            <details className="login-credentials" open>
              <summary>Demo login details</summary>
              <p>
                <strong>Partner</strong>
                <br />
                partner@demo.example
                <br />
                PartnerDemo26!
              </p>
              <p>
                <strong>Reviewer</strong>
                <br />
                reviewer@demo.example
                <br />
                ReviewerDemo26!
              </p>
            </details>
          )}
        </form>
      </section>
    </div>
  );
}
