import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { isAuthenticated, email, logout } = useAuth();

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Event Ticketing
      </Link>
      <nav>
        {isAuthenticated ? (
          <>
            <Link to="/admin">Admin</Link>
            <span className="muted">{email}</span>
            <button type="button" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/admin/login">Admin login</Link>
        )}
      </nav>
    </header>
  );
}
