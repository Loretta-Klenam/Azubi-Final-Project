import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;

// userPool is null when env vars are not set (local dev without a deployment)
const userPool =
  POOL_ID && CLIENT_ID
    ? new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID })
    : null;

type LoginResult = "success" | "newPasswordRequired";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  token: string | null;
  needsNewPassword: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState<CognitoUser | null>(null);

  useEffect(() => {
    if (!userPool) {
      setIsLoading(false);
      return;
    }
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) {
        setIsLoading(false);
        return;
      }
      setToken(session.getIdToken().getJwtToken());
      setEmail(currentUser.getUsername());
      setIsLoading(false);
    });
  }, []);

  function login(loginEmail: string, password: string): Promise<LoginResult> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error("Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID."));
        return;
      }
      const cognitoUser = new CognitoUser({ Username: loginEmail, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: loginEmail, Password: password });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          setToken(session.getIdToken().getJwtToken());
          setEmail(loginEmail);
          resolve("success");
        },
        onFailure: (err) => reject(err),
        // First login after admin creation: Cognito forces a permanent
        // password before issuing a real session. The caller must NOT
        // read `needsNewPassword` off context right after this resolves --
        // React hasn't necessarily re-rendered yet -- so we return the
        // outcome directly instead.
        newPasswordRequired: () => {
          setPendingUser(cognitoUser);
          setNeedsNewPassword(true);
          resolve("newPasswordRequired");
        },
      });
    });
  }

  function completeNewPassword(newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!pendingUser) {
        reject(new Error("No login in progress."));
        return;
      }
      pendingUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (session) => {
          setToken(session.getIdToken().getJwtToken());
          setEmail(pendingUser.getUsername());
          setNeedsNewPassword(false);
          setPendingUser(null);
          resolve();
        },
        onFailure: (err) => reject(err),
      });
    });
  }

  function logout() {
    userPool?.getCurrentUser()?.signOut();
    setToken(null);
    setEmail(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      isLoading,
      email,
      token,
      needsNewPassword,
      login,
      completeNewPassword,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- login/logout/completeNewPassword close over pendingUser, which is intentionally not a rerender trigger here
    [token, isLoading, email, needsNewPassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the useAuth hook belongs next to the context/provider it reads
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
