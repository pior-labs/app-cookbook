import { useState } from 'react';
import { useAuth } from '../auth';

const GENERIC_ERROR = 'Could not start sign-in. Check your connection to Pior Labs Auth.';

/**
 * Shared sign-in flow for the login screen and the concept gallery. There is a
 * single SSO provider, so a page only needs one button wired to this.
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
