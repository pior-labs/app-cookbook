import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppShell } from '@/components/AppShell';
import { CookModeProvider, useCookMode } from '@/components/CookMode';
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

// The later login concepts are a design study parked at /designs/login/1..4.
// They are lazy so neither their CSS nor the extra type family they set reaches
// the bundle every other screen loads.
const LoginDesigns = lazy(() => import('./designs/LoginDesigns'));

function isDesignStudy() {
  if (typeof window === 'undefined') return false;
  return /^\/designs\/login\//.test(window.location.pathname);
}

// Routes are only mounted for an authenticated session, so losing the session
// returns to login rather than rendering a protected shell
// (technical design section 11.3).
//
// Every screen is a child of one layout route, so the navigation rail is
// mounted once and does not remount between sections. The ambient mesh sits
// outside the router for the same reason: cook mode drops the rail, and the
// atmosphere should not blink when it does.
function AuthenticatedRoutes() {
  const { cooking } = useCookMode();

  return (
    <div className="cb-app" data-cooking={cooking ? 'true' : 'false'}>
      <MeshBackdrop />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export function App() {
  const { loading, user } = useAuth();

  // Both studies resolve before the auth branches: a concept has to be
  // openable signed out, which is the state it is designed for.
  if (isDesignStudy()) {
    return (
      <Suspense fallback={null}>
        <LoginDesigns />
      </Suspense>
    );
  }

  if (isGalleryRequested()) return <LoginGallery />;

  if (loading) return <SessionLoading />;
  if (!user) return <LoginScreen />;

  return (
    <CookModeProvider>
      <AuthenticatedRoutes />
    </CookModeProvider>
  );
}
