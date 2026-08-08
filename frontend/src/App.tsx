import { BrowserRouter, Route, Routes } from "react-router-dom";
import Hero from "@/components/Hero";
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
        <Routes>
          {/* Landing page — has its own nav inside Hero */}
          <Route path="/" element={<Hero />} />

          {/* Event pages — use shared NavBar */}
          <Route
            path="/events"
            element={
              <>
                <NavBar />
                <main className="page">
                  <EventsListPage />
                </main>
              </>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <>
                <NavBar />
                <main className="page">
                  <EventDetailPage />
                </main>
              </>
            }
          />
            <Route path="/tickets/:registrationId" element={<><NavBar /><main className="page"><TicketPage /></main></>} />

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
      </BrowserRouter>
    </AuthProvider>
  );
}
