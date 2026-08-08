import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const POOL_ID = import.meta.env.VITE_ATTENDEE_USER_POOL_ID as string | undefined;
const CLIENT_ID = import.meta.env.VITE_ATTENDEE_CLIENT_ID as string | undefined;

// userPool is null when env vars are not set (local dev without a deployment)
const userPool =
  POOL_ID && CLIENT_ID
    ? new CognitoUserPool({ UserPoolId: POOL_ID, ClientId: CLIENT_ID })
    : null;

interface UserAuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  name: string | null;
  token: string | null;
  isConfigured: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const UserAuthContext = createContext<UserAuthContextValue | undefined>(undefined);

export function UserAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      const idToken = session.getIdToken();
      setToken(idToken.getJwtToken());
      // getUsername() resolves to the pool's internal SRP username (a UUID),
      // not the email, since this pool uses email as a sign-in alias.
      setEmail((idToken.payload.email as string | undefined) ?? currentUser.getUsername());
      setName((idToken.payload.name as string | undefined) ?? null);
      setIsLoading(false);
    });
  }, []);

  function signUp(fullName: string, signUpEmail: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(
          new Error(
            "Sign-up is not configured for this environment. Set VITE_ATTENDEE_USER_POOL_ID and VITE_ATTENDEE_CLIENT_ID.",
          ),
        );
        return;
      }
      const attributes = [new CognitoUserAttribute({ Name: "name", Value: fullName })];
      userPool.signUp(signUpEmail, password, attributes, [], (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  function confirmSignUp(confirmEmail: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error("Sign-up is not configured for this environment."));
        return;
      }
      const cognitoUser = new CognitoUser({ Username: confirmEmail, Pool: userPool });
      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  function resendConfirmationCode(resendEmail: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error("Sign-up is not configured for this environment."));
        return;
      }
      const cognitoUser = new CognitoUser({ Username: resendEmail, Pool: userPool });
      cognitoUser.resendConfirmationCode((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  function login(loginEmail: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(
          new Error(
            "Sign-in is not configured for this environment. Set VITE_ATTENDEE_USER_POOL_ID and VITE_ATTENDEE_CLIENT_ID.",
          ),
        );
        return;
      }
      const cognitoUser = new CognitoUser({ Username: loginEmail, Pool: userPool });
      const authDetails = new AuthenticationDetails({ Username: loginEmail, Password: password });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          const idToken = session.getIdToken();
          setToken(idToken.getJwtToken());
          setEmail((idToken.payload.email as string | undefined) ?? loginEmail);
          setName((idToken.payload.name as string | undefined) ?? null);
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
    setName(null);
  }

  const value = useMemo<UserAuthContextValue>(
    () => ({
      isAuthenticated: Boolean(token),
      isLoading,
      email,
      name,
      token,
      isConfigured: Boolean(userPool),
      signUp,
      confirmSignUp,
      resendConfirmationCode,
      login,
      logout,
    }),
    [token, isLoading, email, name],
  );

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- the useUserAuth hook belongs next to the context/provider it reads
export function useUserAuth(): UserAuthContextValue {
  const ctx = useContext(UserAuthContext);
  if (!ctx) throw new Error("useUserAuth must be used within a UserAuthProvider");
  return ctx;
}
