import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Aviso, Botao, Campo, Logo, Rotulo } from "../componentes/ui";
import { entrar } from "../dados/sessao";
import { ErroRede } from "../lib/api";

/** Tela 2 — login por e-mail e senha. SSO Microsoft fica para depois do MVP. */
export function Entrar() {
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
      navegar("/", { replace: true });
    } catch (err) {
      setErro(err instanceof ErroRede ? "Sem conexão. O primeiro acesso precisa de internet." : (err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-superficie px-6 pt-[12vh]">
      <div className="text-center">
        <Logo tamanho="lg" />
        <h1 className="mt-6 text-xl font-bold">Acesse sua conta</h1>
        <p className="mt-1 text-sm text-texto-suave">Comece a verificar seus veículos.</p>
      </div>
      <form onSubmit={enviar} className="mt-8 space-y-4" noValidate>
        <div>
          <Rotulo htmlFor="email">E-mail corporativo</Rotulo>
          <Campo id="email" type="email" inputMode="email" autoComplete="username" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Rotulo htmlFor="senha">Senha</Rotulo>
          <div className="relative">
            <Campo id="senha" type={ver ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} className="pr-12" required />
            <button type="button" aria-label={ver ? "Ocultar senha" : "Mostrar senha"} onClick={() => setVer(!ver)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-texto-suave">
              {ver ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        {erro && <Aviso tom="erro">{erro}</Aviso>}
        <Botao type="submit" carregando={enviando} disabled={!email || !senha}>
          Entrar
        </Botao>
      </form>
    </main>
  );
}
