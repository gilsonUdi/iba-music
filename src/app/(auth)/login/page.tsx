"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "@/lib/auth";
import { getUser } from "@/lib/firestore";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    try {
      const cred = await signIn(data.email, data.password);
      const appUser = await getUser(cred.uid);
      // ?next= traz a pessoa de volta à página que abriu (ex.: link da equipe).
      // Só aceita caminhos internos ("/..." mas não "//..." nem "/\\...").
      const next = new URLSearchParams(window.location.search).get("next") ?? "";
      const interno = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
      const dest = appUser?.senhaTemporaria ? "/alterar-senha" : interno ? next : "/dashboard";
      window.location.replace(dest);
    } catch {
      toast.error("E-mail ou senha incorretos");
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center p-4 overflow-hidden">
      {/* luzes de palco */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-violet-600/40 blur-[100px] animate-pulse" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-fuchsia-600/30 blur-[110px]" />
      <div className="relative w-full max-w-md animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-full ring-4 ring-primary-500/30 animate-pulse-glow">
            <Image src="/logo.png" alt="IBA Music" width={80} height={80} className="rounded-full object-cover" priority />
          </div>
          <h1 className="text-4xl font-bold texto-neon">IBA Music</h1>
          <p className="text-gray-500 mt-2">Ministério de louvor · faça login para continuar</p>
        </div>

        {/* Card */}
        <div className="card rounded-3xl p-7 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...register("email")}
                  type="email"
                  placeholder="seu@email.com"
                  className="input pl-9"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••"
                  className="input pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Não tem acesso? Fale com o seu pastor.
        </p>
      </div>
    </div>
  );
}
