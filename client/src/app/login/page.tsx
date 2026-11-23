import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { login } from '@/lib/actions';
import { brand } from '@/lib/brand';
import { getUser, homeFor } from '@/lib/session';
import { ActionForm, Submit } from '@/components/forms';
import { PasswordInput } from '@/components/PasswordInput';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getUser().catch(() => null);
  if (user) redirect(homeFor(user.role));

  return (
    <div className="login-layout">
      <section className="login-brand">
        <img className="login-logo" src={brand.logo} alt={brand.name} />
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
        <div className="login-form">
          <p className="eyebrow">{brand.programme}</p>
          <h2>Welcome to {brand.product}</h2>
          <p className="login-lead">Sign in to your workspace.</p>
          <ActionForm action={login}>
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" name="email" type="email" autoComplete="username" required placeholder="partner@demo.example" />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <PasswordInput id="login-password" name="password" />
            </div>
            <div className="login-submit">
              <Submit>Sign in →</Submit>
            </div>
          </ActionForm>

          {brand.showDemoLogins && (
            <details className="login-credentials">
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
              <p>
                <strong>Platform admin</strong>
                <br />
                admin@lenovo.com
                <br />
                lenovo@2026
              </p>
            </details>
          )}
        </div>
      </section>
    </div>
  );
}
