import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useUserAuth } from "../context/UserAuthContext";

export default function NavBar() {
  const { isAuthenticated: isAdmin, email: adminEmail, logout: adminLogout } = useAuth();
  const {
    isAuthenticated: isUser,
    name: userName,
    email: userEmail,
    logout: userLogout,
  } = useUserAuth();

  return (
    <header className="navbar">
      <Link to="/" className="brand" aria-label="Evendor home">
        evendor
      </Link>
      <nav>
        <Link to="/events" className="navbar-link">
          Discover
        </Link>
        <Link to="/faqs" className="navbar-link">
          FAQs
        </Link>
        {isAdmin ? (
          <>
            <Link to="/admin" className="navbar-link">
              Admin
            </Link>
            <span className="muted">{adminEmail}</span>
            <button type="button" className="navbar-action" onClick={adminLogout}>
              Log out
            </button>
          </>
        ) : isUser ? (
          <>
            <Link to="/my-tickets" className="navbar-link">
              My tickets
            </Link>
            <span className="muted">{userName ?? userEmail}</span>
            <button type="button" className="navbar-action" onClick={userLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/signup" className="navbar-link">
              Sign up
            </Link>
            <Link to="/login" className="navbar-action">
              Log in
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
