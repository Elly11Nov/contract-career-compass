import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Contract Job Finder" },
      {
        name: "description",
        content:
          "Sign in to your Contract Job Finder dashboard to review scored contract and freelance vacancies across Europe.",
      },
      { property: "og:title", content: "Sign in — Contract Job Finder" },
      {
        property: "og:description",
        content: "Private access to your daily contract vacancy dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent. Check your email (and spam folder).");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="bg-card w-full max-w-sm rounded-lg border p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Contract Job Finder</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {mode === "signin"
            ? "Sign in to your dashboard."
            : mode === "signup"
              ? "Create your account."
              : "Enter your email and we'll send you a reset link."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </Button>
        </form>
        {mode === "signin" && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-3 w-full text-center text-sm"
            onClick={() => setMode("forgot")}
          >
            Forgot password?
          </button>
        )}
        {mode === "forgot" ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-4 w-full text-center text-sm"
            onClick={() => setMode("signin")}
          >
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mt-4 w-full text-center text-sm"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        )}
      </div>
    </div>
  );
}
