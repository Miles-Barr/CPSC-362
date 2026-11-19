import { useEffect, useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

// App is the authentication controller. It talks to Supabase and decides
// whether the user should see the login page or the authenticated dashboard.
export default function App() {
  // A null profile means there is no authenticated application user yet.
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);

  // Passwords stay in Supabase Auth. Our public profiles table only contains
  // application data such as the username and trusted account role.
  async function getProfile(userId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isMounted = true;

    // Supabase stores the session in the browser. Restore it after a refresh
    // so a signed-in user does not have to log in again on every page load.
    async function restoreSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        try {
          const savedProfile = await getProfile(session.user.id);

          if (isMounted) {
            setProfile(savedProfile);
          }
        } catch {
          await supabase.auth.signOut();
        }
      }

      if (isMounted) {
        setInitializing(false);
      }
    }

    restoreSession();

    // Keep the UI synchronized when Supabase reports that the user signed out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && isMounted) {
        setProfile(null);
      }
    });

    // Remove the listener when App unmounts to prevent memory leaks.
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin({ email, password, selectedRole }) {
    // Supabase Auth validates the credentials and returns the authenticated ID.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error("Invalid email or password.");
    }

    try {
      const signedInProfile = await getProfile(data.user.id);

      // The role button is only a login choice. Authorization uses the role
      // stored in the database, so selecting Doctor cannot grant doctor access.
      if (signedInProfile.role !== selectedRole) {
        await supabase.auth.signOut();
        throw new Error("This account does not match the selected role.");
      }

      setProfile(signedInProfile);
    } catch (profileError) {
      await supabase.auth.signOut();

      if (profileError.message === "This account does not match the selected role.") {
        throw profileError;
      }

      throw new Error("This account does not have a valid profile.", {
        cause: profileError,
      });
    }
  }

  async function handleSignUp({ username, email, password }) {
    // The username becomes Auth metadata. A database trigger copies it into
    // public.profiles, where the new account receives the default patient role.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw new Error("Unable to create the account. Check your information and try again.", {
        cause: error,
      });
    }

    if (data.session) {
      const newProfile = await getProfile(data.user.id);
      setProfile(newProfile);
      return { requiresEmailConfirmation: false };
    }

    return { requiresEmailConfirmation: true };
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  // Conditional rendering keeps authentication state in one place while the
  // page components remain focused on displaying their own UI.
  if (initializing) {
    return (
      <main className="page" aria-live="polite">
        <p>Loading...</p>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="page">
        <section className="card" role="alert">
          <h1>Configuration required</h1>
          <p className="template-note">
            Supabase is not configured for this deployment. Add the Vite Supabase
            environment variables and redeploy the site.
          </p>
        </section>
      </main>
    );
  }

  if (profile) {
    return <DashboardPage profile={profile} onLogout={handleLogout} />;
  }

  return <LoginPage onLogin={handleLogin} onSignUp={handleSignUp} />;
}
