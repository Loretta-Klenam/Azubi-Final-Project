import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUserAuth } from "../context/UserAuthContext";

type Role = "user" | "admin";

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const initialRole: Role = searchParams.get("role") === "admin" ? "admin" : "user";
  const [role, setRole] = useState<Role>(initialRole);

  return (
    <div className="card-form login-page">
      <h1>Sign in</h1>
      <div className="role-tabs" role="tablist" aria-label="Sign in as">
        <button
          type="button"
          role="tab"
          aria-selected={role === "user"}
          className={role === "user" ? "role-tab role-tab--active" : "role-tab"}
          onClick={() => setRole("user")}
        >
          User
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={role === "admin"}
          className={role === "admin" ? "role-tab role-tab--active" : "role-tab"}
          onClick={() => setRole("admin")}
        >
          Admin
        </button>
      </div>
      {role === "user" ? <UserLoginForm /> : <AdminLoginForm />}
    </div>
  );
}

function UserLoginForm() {
  const { login, isAuthenticated, isConfigured } = useUserAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {!isConfigured && (
        <p className="error" role="alert">
          User sign-in is not configured for this local environment. Add
          `VITE_ATTENDEE_USER_POOL_ID` and `VITE_ATTENDEE_CLIENT_ID` to `frontend/.env.local`.
        </p>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting || !isConfigured}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
      <p className="muted">
        New here?{" "}
        <Link to={`/signup${redirectTo !== "/events" ? `?redirect=${redirectTo}` : ""}`}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

// Only allow same-site paths so ?redirect= can't be used to send users off-site.
function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/events";
  return value;
}

function AdminLoginForm() {
  const { login, completeNewPassword, needsNewPassword, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cognitoIsConfigured = Boolean(
    import.meta.env.VITE_COGNITO_USER_POOL_ID && import.meta.env.VITE_COGNITO_CLIENT_ID,
  );

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result === "success") navigate("/admin");
      // "newPasswordRequired" falls through to re-render with the
      // new-password form, driven by the `needsNewPassword` context value.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewPassword(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await completeNewPassword(newPassword);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set a new password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (needsNewPassword) {
    return (
      <form onSubmit={handleNewPassword}>
        <p className="muted">This is your first sign-in -- choose a permanent password.</p>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={12}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Set password"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleLogin}>
      {!cognitoIsConfigured && (
        <p className="error" role="alert">
          Admin sign-in is not configured for this local environment. Add the Cognito values from
          `.env.example` to `frontend/.env.local` and restart the dev server.
        </p>
      )}
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={submitting || !cognitoIsConfigured}>
        {submitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
