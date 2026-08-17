import { useAuth } from './auth';
import { CookbookHome } from './CookbookHome';
import { LoginScreen } from './LoginScreen';

function SessionLoading() {
  return (
    <div className="cookbook-shell loading-screen" role="status" aria-live="polite">
      <div className="loading-mark">
        <span className="wordmark__seal">C</span>
        <p>Opening your cookbook…</p>
      </div>
    </div>
  );
}

export function App() {
  const { loading, user } = useAuth();

  if (loading) return <SessionLoading />;
  if (!user) return <LoginScreen />;
  return <CookbookHome />;
}
