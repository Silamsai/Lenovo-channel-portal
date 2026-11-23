'use client';

export function DemoCredentials() {
  function fill(email: string, pass: string) {
    const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
    const passInput = document.getElementById('login-password') as HTMLInputElement | null;
    if (emailInput && passInput) {
      emailInput.value = email;
      passInput.value = pass;
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  return (
    <details className="login-credentials">
      <summary>Demo login details</summary>
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Partner</strong>
            <button
              type="button"
              className="textbutton"
              style={{ fontSize: '12px' }}
              onClick={() => fill('partner@demo.example', 'PartnerDemo26!')}
            >
              Fill credentials
            </button>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            partner@demo.example
            <br />
            PartnerDemo26!
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Reviewer</strong>
            <button
              type="button"
              className="textbutton"
              style={{ fontSize: '12px' }}
              onClick={() => fill('reviewer@demo.example', 'ReviewerDemo26!')}
            >
              Fill credentials
            </button>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            reviewer@demo.example
            <br />
            ReviewerDemo26!
          </p>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Platform admin</strong>
            <button
              type="button"
              className="textbutton"
              style={{ fontSize: '12px' }}
              onClick={() => fill('admin@lenovo.com', 'lenovo@2026')}
            >
              Fill credentials
            </button>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '13px' }}>
            admin@lenovo.com
            <br />
            lenovo@2026
          </p>
        </div>
      </div>
    </details>
  );
}
