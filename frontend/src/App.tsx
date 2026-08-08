import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Hero from "@/components/Hero";
import NavBar from "./components/NavBar";
import PageLayout from "./components/PageLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ProtectedUserRoute from "./components/ProtectedUserRoute";
import { AuthProvider } from "./context/AuthContext";
import { UserAuthProvider } from "./context/UserAuthContext";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminEventFormPage from "./pages/admin/AdminEventFormPage";
import AdminRegistrationsPage from "./pages/admin/AdminRegistrationsPage";
import EventDetailPage from "./pages/EventDetailPage";
import EventsListPage from "./pages/EventsListPage";
import FaqPage from "./pages/FaqPage";
import LoginPage from "./pages/LoginPage";
import MyTicketsPage from "./pages/MyTicketsPage";
import SignUpPage from "./pages/SignUpPage";
import TicketPage from "./pages/TicketPage";

export default function App() {
  return (
    <AuthProvider>
      <UserAuthProvider>
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
                <PageLayout scrim="light">
                  <EventsListPage />
                </PageLayout>
              </>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <>
                <NavBar />
                <PageLayout scrim="light">
                  <EventDetailPage />
                </PageLayout>
              </>
            }
          />
          <Route
            path="/tickets/:registrationId"
            element={
              <>
                <NavBar />
                <PageLayout>
                  <TicketPage />
                </PageLayout>
              </>
            }
          />
          <Route
            path="/faqs"
            element={
              <>
                <NavBar />
                <PageLayout>
                  <FaqPage />
                </PageLayout>
              </>
            }
          />
          <Route
            path="/login"
            element={
              <>
                <NavBar />
                <PageLayout>
                  <LoginPage />
                </PageLayout>
              </>
            }
          />
          <Route
            path="/signup"
            element={
              <>
                <NavBar />
                <PageLayout>
                  <SignUpPage />
                </PageLayout>
              </>
            }
          />
          {/* Kept for old links/bookmarks; the real form now lives at /login */}
          <Route path="/admin/login" element={<Navigate to="/login?role=admin" replace />} />
          <Route
            path="/my-tickets"
            element={
              <ProtectedUserRoute>
                <NavBar />
                <PageLayout>
                  <MyTicketsPage />
                </PageLayout>
              </ProtectedUserRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <NavBar />
                <PageLayout>
                  <AdminDashboardPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/new"
            element={
              <ProtectedRoute>
                <NavBar />
                <PageLayout>
                  <AdminEventFormPage mode="create" />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:eventId/edit"
            element={
              <ProtectedRoute>
                <NavBar />
                <PageLayout>
                  <AdminEventFormPage mode="edit" />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/events/:eventId/registrations"
            element={
              <ProtectedRoute>
                <NavBar />
                <PageLayout>
                  <AdminRegistrationsPage />
                </PageLayout>
              </ProtectedRoute>
            }
          />
          </Routes>
        </BrowserRouter>
      </UserAuthProvider>
    </AuthProvider>
  );
}
