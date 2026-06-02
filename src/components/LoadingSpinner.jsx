import { C } from '../constants/colors';

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 16 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: `3px solid ${C.border}`,
        borderTopColor: C.teal,
        animation: 'spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 13, color: C.muted, fontFamily: 'Georgia,serif' }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
