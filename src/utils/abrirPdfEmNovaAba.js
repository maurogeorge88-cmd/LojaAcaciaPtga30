import { jsPDF } from 'jspdf';

// ════════════════════════════════════════════════════════════════════════
// Ajustes globais de PDF (valem para TODOS os relatórios do sistema):
//  1) Abrir em NOVA ABA em vez de baixar direto (evita o conflito com o Acrobat
//     quando o "Salvar como" está ligado). Se a aba for bloqueada, baixa normal.
//  2) Rodapé "SysMaçom-MG - Desenvolvedor: Mauro George" em todas as páginas,
//     quando o próprio relatório ainda não o desenhou (sem duplicar).
// ════════════════════════════════════════════════════════════════════════

const RODAPE_DEV = 'SysMaçom-MG - Desenvolvedor: Mauro George';
const MARCA = 'Desenvolvedor: Mauro George';

let instalado = false;

const carimbarRodape = (doc) => {
  try {
    // o relatório já desenhou o rodapé do desenvolvedor? então não duplica
    const jaTem = (doc.internal.pages || []).some(pg => Array.isArray(pg) && pg.join('').includes(MARCA));
    if (jaTem) return;
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const total = doc.internal.getNumberOfPages();
    const fonteAnterior = doc.getFont();
    const tamAnterior = doc.getFontSize();
    const corAnterior = doc.getTextColor();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(RODAPE_DEV, W > 250 ? 12 : 10, H - 4.2);
    }
    doc.setPage(total);
    doc.setFont(fonteAnterior.fontName, fonteAnterior.fontStyle);
    doc.setFontSize(tamAnterior);
    doc.setTextColor(corAnterior);
  } catch (e) { /* nunca impede a geração do PDF */ }
};

const baixarDireto = (doc, nome) => {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = /\.pdf$/i.test(nome) ? nome : nome + '.pdf';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
};

export const instalarAbrirPdfEmNovaAba = () => {
  if (instalado || !jsPDF?.API) return;
  instalado = true;

  // jsPDF aplica os plugins (jsPDF.API) por cima dos métodos internos de cada documento,
  // então definir "save" aqui vale para todo relatório gerado com new jsPDF().
  jsPDF.API.save = function (nomeArquivo) {
    let nome = String(nomeArquivo || 'documento.pdf');
    if (!/\.pdf$/i.test(nome)) nome += '.pdf';
    carimbarRodape(this);
    try { this.setProperties({ title: nome.replace(/\.pdf$/i, '').replace(/_/g, ' ') }); } catch (e) { /* ignora */ }
    const blob = this.output('blob');

    // Escolhe a pasta (com o nome do arquivo sugerido), grava e só então termina.
    // Navegadores sem essa função (Firefox/Safari) ou com erro: download normal.
    if (typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function') {
      (async () => {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: nome,
            types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const w = await handle.createWritable();
          await w.write(blob);
          await w.close();
        } catch (e) {
          if (e && e.name === 'AbortError') return; // usuário cancelou
          try { baixarDireto(this, nome); } catch (e2) { /* ignora */ }
        }
      })();
    } else {
      baixarDireto(this, nome);
    }
    return this;
  };
};
