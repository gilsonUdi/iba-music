"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) router.replace("/dashboard");
      else router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 animate-pulse-glow" />
    </div>
  );
}
