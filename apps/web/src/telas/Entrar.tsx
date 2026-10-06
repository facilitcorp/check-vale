import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import type { Saude } from "@checkvale/shared";
import { Aviso, Botao, Campo, Logo, Rotulo } from "../componentes/ui";
import { cadastrar, entrar } from "../dados/sessao";
import { chamarApi, ErroRede } from "../lib/api";

const SENHA_MINIMA = 8;

/**
 * Tela 2 — login por e-mail e senha. SSO Microsoft fica para depois do MVP.
 * Em /cadastro vira o autocadastro temporário (só aparece se a API liberar).
 */
export function Entrar({ modo = "entrar" }: { modo?: "entrar" | "cadastro" }) {
  const navegar = useNavigate();
  const cadastro = modo === "cadastro";
  /** null = ainda perguntando à API. */
  const [autocadastro, setAutocadastro] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    chamarApi<Saude>("/saude").then((s) => setAutocadastro(s.autocadastro), () => setAutocadastro(false));
  }, []);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (cadastro && senha.length < SENHA_MINIMA) return setErro(`A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`);
    setEnviando(true);
    try {
      await (cadastro ? cadastrar : entrar)(email, senha);
      navegar("/", { replace: true });
    } catch (err) {
      setErro(err instanceof ErroRede ? "Sem conexão. O primeiro acesso precisa de internet." : (err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (cadastro && autocadastro === false) return <Navigate to="/entrar" replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-superficie px-6 pt-[12vh]">
      <div className="text-center">
        <Logo tamanho="lg" />
        <h1 className="mt-6 text-xl font-bold">{cadastro ? "Crie seu cadastro" : "Acesse sua conta"}</h1>
        <p className="mt-1 text-sm text-texto-suave">{cadastro ? "Escolha um e-mail e uma senha. Você já entra em seguida." : "Comece a verificar seus veículos."}</p>
      </div>
      <form onSubmit={enviar} className="mt-8 space-y-4" noValidate>
        <div>
          <Rotulo htmlFor="email">E-mail corporativo</Rotulo>
          <Campo id="email" type="email" inputMode="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Rotulo htmlFor="senha">Senha</Rotulo>
          <div className="relative">
            <Campo id="senha" type={ver ? "text" : "password"} autoComplete={cadastro ? "new-password" : "current-password"} placeholder={cadastro ? `Mínimo de ${SENHA_MINIMA} caracteres` : "Digite sua senha"} value={senha} onChange={(e) => setSenha(e.target.value)} className="pr-12" required />
            <button type="button" aria-label={ver ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVer(!ver)} className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-texto-suave">
              {ver ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={enviando} disabled={!email || !senha}>
          {cadastro ? "Criar cadastro e entrar" : "Entrar"}
        </Botao>
      </form>
      {cadastro ? (
        <p className="mt-6 text-center text-sm text-texto-suave">
          Já tem conta? <Link to="/entrar" className="font-medium text-marca underline">Entrar</Link>
        </p>
      ) : (
        autocadastro && (
          <p className="mt-6 text-center text-sm text-texto-suave">
            Ainda não tem conta? <Link to="/cadastro" className="font-medium text-marca underline">Crie seu cadastro</Link>
          </p>
        )
      )}
    </main>
  );
}
