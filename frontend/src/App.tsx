import { BrowserRouter, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEventFormPage from "./pages/admin/AdminEventFormPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminRegistrationsPage from "./pages/admin/AdminRegistrationsPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventsListPage from "./pages/EventsListPage";
import TicketPage from "./pages/TicketPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <main className="page">
          <Routes>
            <Route path="/" element={<EventsListPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/tickets/:registrationId" element={<TicketPage />} />

            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events/new"
              element={
                <ProtectedRoute>
                  <AdminEventFormPage mode="create" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events/:eventId/edit"
              element={
                <ProtectedRoute>
                  <AdminEventFormPage mode="edit" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events/:eventId/registrations"
              element={
                <ProtectedRoute>
                  <AdminRegistrationsPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
