import type { SignInFlow } from './useSignInFlow';

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
