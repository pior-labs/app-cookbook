import { useState } from 'react';
import { useAuth } from '../auth';

const GENERIC_ERROR = 'Could not start sign-in. Check your connection to Pior Labs Auth.';

/**
 * Shared sign-in flow for every login variant. There is a single SSO provider,
 * so each page only needs one button wired to this.
 */
export function useSignInFlow() {
  const { startSignIn } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    setSubmitting(true);

    try {
      await startSignIn();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  return { submitting, error, handleSignIn };
}

export type SignInFlow = ReturnType<typeof useSignInFlow>;

export function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="M4 10h11M11 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return <span className="lv-spin" aria-hidden="true" />;
}

/** The wordmark seal, styled entirely from theme tokens so it flips with the theme. */
export function Seal({ className }: { className?: string }) {
  return <span className={className ? `lv-seal ${className}` : 'lv-seal'}>C</span>;
}

/** Drifting mesh blobs + grain from the design system's effects.css. */
export function MeshBackdrop() {
  return (
    <>
      <div className="theme-mesh" aria-hidden="true">
        <div className="theme-blob b1" />
        <div className="theme-blob b2" />
        <div className="theme-blob b3" />
        <div className="theme-blob b4" />
        <div className="theme-blob b5" />
      </div>
      <div className="theme-grain" aria-hidden="true" />
    </>
  );
}

interface SignInButtonProps {
  flow: SignInFlow;
  className?: string;
  label?: string;
  errorId?: string;
}

export function SignInButton({
  flow,
  className,
  label = 'Continue with Pior Labs',
  errorId,
}: SignInButtonProps) {
  return (
    <button
      type="button"
      className={className ? `lv-btn ${className}` : 'lv-btn'}
      onClick={flow.handleSignIn}
      disabled={flow.submitting}
      aria-describedby={flow.error && errorId ? errorId : undefined}
    >
      <span>{flow.submitting ? 'Opening Pior Labs…' : label}</span>
      {flow.submitting ? <Spinner /> : <ArrowIcon />}
    </button>
  );
}

interface AuthErrorProps {
  id: string;
  message: string | null;
  className?: string;
}

export function AuthError({ id, message, className }: AuthErrorProps) {
  if (!message) return null;
  return (
    <p className={className ? `lv-error ${className}` : 'lv-error'} id={id} role="alert">
      <span aria-hidden="true">!</span>
      {message}
    </p>
  );
}
