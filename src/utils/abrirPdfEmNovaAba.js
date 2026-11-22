import { jsPDF } from 'jspdf';

// ════════════════════════════════════════════════════════════════════════
// Todos os relatórios do sistema usam doc.save(...). Aqui trocamos esse
// comportamento: em vez de baixar direto (o que, com "Salvar como" ligado,
// faz o Acrobat tentar abrir o arquivo antes de terminar de gravar), o PDF
// abre em uma NOVA ABA. O usuário salva depois, pelo visualizador, na pasta
// que quiser. Se o navegador bloquear a nova aba, volta ao download normal.
// ════════════════════════════════════════════════════════════════════════

let instalado = false;

export const instalarAbrirPdfEmNovaAba = () => {
  if (instalado || !jsPDF?.API?.save) return;
  instalado = true;
  const salvarOriginal = jsPDF.API.save;

  jsPDF.API.save = function (nomeArquivo, opcoes) {
    try {
      const nome = String(nomeArquivo || 'documento.pdf');
      // o título aparece na aba do navegador
      try { this.setProperties({ title: nome.replace(/\.pdf$/i, '').replace(/_/g, ' ') }); } catch (e) { /* ignora */ }
      const blob = this.output('blob');
      const url = URL.createObjectURL(blob);
      const aba = window.open(url, '_blank');
      if (!aba) { URL.revokeObjectURL(url); throw new Error('Nova aba bloqueada pelo navegador'); }
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
      return this;
    } catch (e) {
      return salvarOriginal.call(this, nomeArquivo, opcoes);
    }
  };
};
