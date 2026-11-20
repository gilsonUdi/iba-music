"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Users2, Mail, Lock, User, Phone, Eye, EyeOff, Loader2, CheckCircle2, LogOut } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { getConvite, entrarNaEquipePorConvite, cadastrarPorConvite } from "@/lib/firestore";
import { mensagemErro } from "@/lib/errors";
import {
  INSTRUMENTO_LABELS, ESTADO_CIVIL_LABELS,
  type Convite, type Instrumento, type EstadoCivil,
} from "@/lib/types";

const INSTRUMENTOS = Object.keys(INSTRUMENTO_LABELS) as Instrumento[];

/** Página pública do link de convite: o músico se cadastra e entra direto na equipe. */
export default function ConvitePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const { user, loading } = useAuth();
  const [convite, setConvite] = useState<Convite | null | undefined>(undefined);
  const [enviando, setEnviando] = useState(false);
  const [verSenha, setVerSenha] = useState(false);
  const [form, setForm] = useState({
    nome: "", email: "", senha: "", telefone: "",
    instrumentos: [] as Instrumento[], instrumentoPrincipal: "" as Instrumento | "", estadoCivil: "" as EstadoCivil | "",
    celulaNome: "", liderCelulaNome: "", liderCelulaTelefone: "",
  });

  useEffect(() => {
    getConvite(codigo).then(c => setConvite(c && c.ativo ? c : null)).catch(() => setConvite(null));
  }, [codigo]);

  function toggleInstrumento(i: Instrumento) {
    setForm(f => {
      const tem = f.instrumentos.includes(i);
      const lista = tem ? f.instrumentos.filter(x => x !== i) : [...f.instrumentos, i];
      const principal = tem && f.instrumentoPrincipal === i ? "" : f.instrumentoPrincipal;
      return { ...f, instrumentos: lista, instrumentoPrincipal: lista.length === 1 ? lista[0] : principal };
    });
  }

  async function entrarLogado() {
    if (!convite || !user) return;
    setEnviando(true);
    try {
      await entrarNaEquipePorConvite(user.uid, convite);
      toast.success(`Bem-vindo(a) à equipe ${convite.equipeName}!`);
      window.location.replace(`/equipes/${convite.equipeId}`);
    } catch (e) {
      toast.error(mensagemErro(e, "Não foi possível entrar na equipe"));
      setEnviando(false);
    }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (!convite) return;
    if (form.nome.trim().length < 3) { toast.error("Informe seu nome completo"); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { toast.error("E-mail inválido"); return; }
    if (form.senha.length < 6) { toast.error("A senha precisa de pelo menos 6 caracteres"); return; }
    if (!form.instrumentos.length) { toast.error("Escolha pelo menos um instrumento (ou Vocal)"); return; }
    setEnviando(true);
    try {
      await cadastrarPorConvite({
        nome: form.nome, email: form.email, senha: form.senha, telefone: form.telefone,
        instrumentos: form.instrumentos,
        instrumentoPrincipal: form.instrumentoPrincipal || undefined,
        estadoCivil: form.estadoCivil || undefined,
        celulaNome: form.celulaNome, liderCelulaNome: form.liderCelulaNome, liderCelulaTelefone: form.liderCelulaTelefone,
      }, convite);
      toast.success(`Cadastro feito! Bem-vindo(a) à equipe ${convite.equipeName}.`);
      // recarrega para o app reconhecer o perfil recém-criado
      window.location.replace(`/equipes/${convite.equipeId}`);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-in-use") {
        toast.error("Já existe uma conta com esse e-mail. Use “Já tenho conta” para entrar.");
      } else if (code === "auth/weak-password") {
        toast.error("Senha fraca: use pelo menos 6 caracteres.");
      } else {
        toast.error(mensagemErro(err, "Não foi possível concluir o cadastro"));
      }
      setEnviando(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex items-start sm:items-center justify-center p-4 py-10 overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-24 w-[28rem] h-[28rem] rounded-full bg-violet-600/40 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 w-[30rem] h-[30rem] rounded-full bg-fuchsia-600/30 blur-[110px]" />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 mb-3 rounded-full ring-4 ring-primary-500/30 overflow-hidden">
            <Image src="/logo.png" alt="IBA Music" width={64} height={64} className="object-cover" priority />
          </div>
          <p className="text-sm text-gray-500">IBA Music</p>
        </div>

        {convite === undefined || loading ? (
          <div className="card rounded-3xl p-8 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
        ) : convite === null ? (
          <div className="card rounded-3xl p-8 text-center space-y-3">
            <p className="text-lg font-semibold text-gray-900">Convite inválido ou expirado</p>
            <p className="text-sm text-gray-500">Peça um link novo ao líder da sua equipe.</p>
            <Link href="/login" className="btn-secondary inline-flex">Ir para o login</Link>
          </div>
        ) : (
          <div className="card rounded-3xl p-6 sm:p-7 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-100 mb-2">
                <Users2 size={22} className="text-primary-600" />
              </div>
              <p className="text-sm text-gray-500">Você foi convidado(a) para a equipe</p>
              <h1 className="text-2xl font-bold texto-neon">{convite.equipeName}</h1>
            </div>

            {user ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-gray-600">Entrando como <strong className="text-gray-900">{user.name}</strong></p>
                <button onClick={entrarLogado} disabled={enviando} className="btn-primary w-full py-3">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Entrar na equipe
                </button>
                <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
                  <LogOut size={12} /> Não é você? Sair
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={cadastrar} className="space-y-4">
                  <div>
                    <label className="label">Nome completo</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="input pl-9" placeholder="Seu nome" autoComplete="name" />
                    </div>
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input pl-9" placeholder="seu@email.com" autoComplete="email" />
                    </div>
                  </div>
                  <div>
                    <label className="label">Crie uma senha</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type={verSenha ? "text" : "password"} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} className="input pl-9 pr-9" placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                      <button type="button" onClick={() => setVerSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Mostrar senha">
                        {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">WhatsApp</label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="tel" value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} className="input pl-9" placeholder="(34) 99999-9999" autoComplete="tel" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Estado civil</label>
                      <select value={form.estadoCivil} onChange={e => setForm({ ...form, estadoCivil: e.target.value as EstadoCivil | "" })} className="input">
                        <option value="">—</option>
                        {Object.entries(ESTADO_CIVIL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">O que você toca?</label>
                    <div className="flex flex-wrap gap-2">
                      {INSTRUMENTOS.map(i => {
                        const sel = form.instrumentos.includes(i);
                        return (
                          <button key={i} type="button" onClick={() => toggleInstrumento(i)}
                            className={clsx("px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                              sel ? "bg-primary-500 text-white" : "bg-white/5 text-gray-600 hover:bg-white/10")}>
                            {INSTRUMENTO_LABELS[i]}
                          </button>
                        );
                      })}
                    </div>
                    {form.instrumentos.length > 1 && (
                      <div className="mt-2">
                        <label className="text-xs text-gray-500">Principal</label>
                        <select value={form.instrumentoPrincipal} onChange={e => setForm({ ...form, instrumentoPrincipal: e.target.value as Instrumento })} className="input py-2 mt-1">
                          <option value="">Escolha…</option>
                          {form.instrumentos.map(i => <option key={i} value={i}>{INSTRUMENTO_LABELS[i]}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <fieldset className="rounded-2xl border border-white/10 p-3 space-y-3">
                    <legend className="px-1 text-sm font-semibold text-gray-700">Sua célula</legend>
                    <div>
                      <label className="text-xs text-gray-500">Nome da célula</label>
                      <input value={form.celulaNome} onChange={e => setForm({ ...form, celulaNome: e.target.value })} className="input mt-1" placeholder="Ex.: Célula Vida Nova" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Líder de célula</label>
                        <input value={form.liderCelulaNome} onChange={e => setForm({ ...form, liderCelulaNome: e.target.value })} className="input mt-1" placeholder="Nome do líder" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">WhatsApp do líder</label>
                        <input type="tel" value={form.liderCelulaTelefone} onChange={e => setForm({ ...form, liderCelulaTelefone: e.target.value })} className="input mt-1" placeholder="(34) 99999-9999" />
                      </div>
                    </div>
                  </fieldset>
                  <button type="submit" disabled={enviando} className="btn-primary w-full py-3 text-base">
                    {enviando ? <><Loader2 size={16} className="animate-spin" /> Criando sua conta…</> : "Criar conta e entrar na equipe"}
                  </button>
                </form>
                <p className="text-center text-sm text-gray-500">
                  Já tem conta?{" "}
                  <Link href={`/login?next=${encodeURIComponent(`/convite/${codigo}`)}`} className="text-primary-600 font-semibold hover:underline">
                    Entrar
                  </Link>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
