import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/UserAuthContext";

export default function SignUpPage() {
  const { signUp, confirmSignUp, login, isAuthenticated, isConfigured } = useUserAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"details" | "confirm">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/events" replace />;

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signUp(name, email, password);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create an account.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await confirmSignUp(email, code);
      await login(email, password);
      navigate("/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-form login-page">
      <h1>Create your account</h1>
      {!isConfigured && (
        <p className="error" role="alert">
          Sign-up is not configured for this local environment. Add `VITE_ATTENDEE_USER_POOL_ID`
          and `VITE_ATTENDEE_CLIENT_ID` to `frontend/.env.local`.
        </p>
      )}
      {step === "details" ? (
        <form onSubmit={handleSignUp}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting || !isConfigured}>
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirm}>
          <p className="muted">We sent a confirmation code to {email}. Enter it below.</p>
          <label>
            Confirmation code
            <input value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm account"}
          </button>
        </form>
      )}
      <p className="muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
