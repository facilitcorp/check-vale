import { chamarApi, ErroDaApi, ErroRede } from "./api";

/**
 * Abre o PDF da inspeção (GET /api/inspecoes/:id/relatorio.pdf).
 * A rota exige token, então baixa como blob e abre por URL local.
 * Gerado no servidor: exige rede e a inspeção já sincronizada.
 */
export async function abrirRelatorio(inspecaoId: string): Promise<void> {
  // Abre a aba já no clique (senão o navegador do celular bloqueia o pop-up).
  const aba = window.open("", "_blank");
  try {
    const pdf = await chamarApi<Blob>(`/inspecoes/${inspecaoId}/relatorio.pdf`);
    const url = URL.createObjectURL(pdf);
    if (aba) aba.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    aba?.close();
    if (e instanceof ErroRede) throw new Error("O relatório precisa de internet. Tente quando houver sinal.");
    if (e instanceof ErroDaApi && e.status === 404) throw new Error("A verificação ainda está sincronizando. Tente em instantes.");
    throw e;
  }
}
