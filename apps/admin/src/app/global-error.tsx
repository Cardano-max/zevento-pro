'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '800px', margin: '40px auto' }}>
          <h2 style={{ color: '#dc2626', marginBottom: '16px' }}>Global Error (Debug Mode)</h2>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
            <strong>Message:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px', color: '#7f1d1d' }}>{error.message}</pre>
          </div>
          {error.stack && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <strong>Stack:</strong>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '8px', fontSize: '12px', color: '#475569' }}>{error.stack}</pre>
            </div>
          )}
          <button
            onClick={reset}
            style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
