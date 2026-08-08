/**
 * OTP email template -- rendered to HTML by Resend.
 */

interface OtpEmailProps {
  otp: string
  appName?: string
  action?: string
}

export function OtpEmail({ otp, appName = 'SWITCH', action = 'sign in' }: OtpEmailProps) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 480,
        margin: '0 auto',
        padding: '40px 24px',
        backgroundColor: '#ffffff',
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#09090b', marginBottom: 8 }}>
        {appName}
      </h1>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#18181b', marginBottom: 16 }}>
        Your {action} code
      </h2>
      <p style={{ fontSize: 14, color: '#71717a', marginBottom: 32 }}>
        Use the code below to {action} to your {appName} account. It expires in{' '}
        <strong>10 minutes</strong>.
      </p>
      <div
        style={{
          backgroundColor: '#f4f4f5',
          borderRadius: 8,
          padding: '24px 0',
          textAlign: 'center',
          marginBottom: 32,
        }}
      >
        <span
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 12,
            color: '#18181b',
            fontFamily: 'monospace',
          }}
        >
          {otp}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#a1a1aa' }}>
        If you did not request this code, you can safely ignore this email. Never share this code
        with anyone.
      </p>
      <hr style={{ border: 'none', borderTop: '1px solid #e4e4e7', margin: '24px 0' }} />
      <p style={{ fontSize: 11, color: '#a1a1aa', textAlign: 'center' }}>
        Copyright {appName}. All rights reserved.
      </p>
    </div>
  )
}
