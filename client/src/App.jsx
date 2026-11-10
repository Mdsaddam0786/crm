import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './lib/AppContext.jsx';
import Layout from './components/Layout.jsx';
import { FullPageSpinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Listings from './pages/Listings.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import ListingForm from './pages/ListingForm.jsx';
import Contacts from './pages/Contacts.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const { user, canEdit } = useApp();
  const location = useLocation();

  if (user === undefined) return <FullPageSpinner />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to={location.state?.from?.pathname || '/'} replace />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="listings" element={<Listings />} />
        <Route path="listings/new" element={canEdit ? <ListingForm /> : <Navigate to="/listings" replace />} />
        <Route path="listings/:id" element={<ListingDetail />} />
        <Route path="listings/:id/edit" element={canEdit ? <ListingForm /> : <Navigate to="/listings" replace />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
