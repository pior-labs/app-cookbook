import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { BrowsePage } from './discovery/BrowsePage';
import { HomePage } from './discovery/HomePage';
import { MeshBackdrop } from './MeshBackdrop';
import { LoginGallery } from './login/LoginGallery';
import { LoginScreen } from './login/LoginScreen';
import { SessionLoading } from './login/SessionLoading';
import { OrganizePage } from './organize/OrganizePage';
import { FavoritesPage } from './preferences/FavoritesPage';
import { RecentPage } from './preferences/RecentPage';
import { EditRecipePage } from './recipes/EditRecipePage';
import { NewRecipePage } from './recipes/NewRecipePage';
import { RecipeDetailPage } from './recipes/RecipeDetailPage';
import { TrashPage } from './trash/TrashPage';

function isGalleryRequested() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('login-gallery');
}

// Routes are only mounted for an authenticated session, so losing the session
// returns to login rather than rendering a protected shell
// (technical design section 11.3).
//
// The ambient mesh is rendered once here rather than inside `AppShell`: the
// recipe detail, create, and edit screens deliberately drop the topbar, and the
// atmosphere should not disappear with it.
function AuthenticatedRoutes() {
  return (
    <div className="rc-app">
      <MeshBackdrop />
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
          <Route path="/trash" element={<TrashPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export function App() {
  const { loading, user } = useAuth();

  if (isGalleryRequested()) return <LoginGallery />;

  if (loading) return <SessionLoading />;
  if (!user) return <LoginScreen />;
  return <AuthenticatedRoutes />;
}
