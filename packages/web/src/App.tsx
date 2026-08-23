import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { BrowsePage } from './discovery/BrowsePage';
import { HomePage } from './discovery/HomePage';
import { LoginScreen } from './LoginScreen';
import { LoginGallery } from './login/LoginGallery';
import { OrganizePage } from './organize/OrganizePage';
import { FavoritesPage } from './preferences/FavoritesPage';
import { RecentPage } from './preferences/RecentPage';
import { EditRecipePage } from './recipes/EditRecipePage';
import { NewRecipePage } from './recipes/NewRecipePage';
import { RecipeDetailPage } from './recipes/RecipeDetailPage';

function isGalleryRequested() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('login-gallery');
}

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

// Routes are only mounted for an authenticated session, so losing the session
// returns to login rather than rendering a protected shell
// (technical design section 11.3).
function AuthenticatedRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/recipes" element={<BrowsePage />} />
        <Route path="/recipes/new" element={<NewRecipePage />} />
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
        <Route path="/recipes/:id/edit" element={<EditRecipePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/recent" element={<RecentPage />} />
        <Route path="/organize" element={<OrganizePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export function App() {
  const { loading, user } = useAuth();

  if (isGalleryRequested()) return <LoginGallery />;

  if (loading) return <SessionLoading />;
  if (!user) return <LoginScreen />;
  return <AuthenticatedRoutes />;
}
