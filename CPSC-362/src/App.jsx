import { useEffect, useState } from "react";
import "./App.css";
import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { supabase } from "./supabaseClient.js";

export default function App() {
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

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
    let isMounted = true;

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && isMounted) {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogin({ email, password, selectedRole }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error("Invalid email or password.");
    }

    try {
      const signedInProfile = await getProfile(data.user.id);

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

  if (initializing) {
    return (
      <main className="page" aria-live="polite">
        <p>Loading...</p>
      </main>
    );
  }

  if (profile) {
    return <DashboardPage profile={profile} onLogout={handleLogout} />;
  }

  return <LoginPage onLogin={handleLogin} onSignUp={handleSignUp} />;
}
