import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { login } from '@/lib/actions';
import { brand } from '@/lib/brand';
import { getUser, homeFor } from '@/lib/session';
import { ActionForm, Submit } from '@/components/forms';
import { PasswordInput } from '@/components/PasswordInput';
import { DemoCredentials } from '@/components/DemoCredentials';
import { LuChartNoAxesCombined, LuPlay, LuUsers } from 'react-icons/lu';

const journeyIcons = [LuChartNoAxesCombined, LuPlay, LuUsers];

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const user = await getUser().catch(() => null);
  if (user) redirect(homeFor(user.role));

  return (
    <div className="login-layout">
      <section className="login-brand">
        <div className="login-lockup">
          <img className="login-logo" src={brand.logo} alt={brand.name} />
          <span className="login-lockup-divider" aria-hidden="true" />
          <span className="login-product">{brand.product}</span>
        </div>

        <div className="login-hero">
          <h1>
            {brand.loginHeadline.map((line, i) => (
              <span key={line} className={i === brand.loginHeadline.length - 1 ? 'accent' : undefined}>
                {line}
              </span>
            ))}
          </h1>
          <p className="login-tagline">{brand.loginTagline}</p>

          <span className="login-rule" aria-hidden="true" />
          <ul className="login-journey">
            {brand.journey.map((step, i) => {
              const Icon = journeyIcons[i % journeyIcons.length];
              return (
                <li key={step}>
                  <Icon aria-hidden="true" />
                  <span>{step}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="login-form-wrap">
        <div className="login-form">
          <p className="login-eyebrow">{brand.programme}</p>
          <h2>Welcome to {brand.product}</h2>
          <p className="login-lead">Sign in to your workspace.</p>
          <ActionForm action={login}>
            <div className="field">
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" name="email" type="email" autoComplete="username" required placeholder="you@company.com" />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password</label>
              <PasswordInput id="login-password" name="password" />
            </div>
            <div className="login-submit">
              <Submit>Sign in →</Submit>
            </div>
          </ActionForm>

          <p className="muted small spaced">No account yet? Ask your programme administrator to create one for you.</p>
          <DemoCredentials />
        </div>
      </section>
    </div>
  );
}
