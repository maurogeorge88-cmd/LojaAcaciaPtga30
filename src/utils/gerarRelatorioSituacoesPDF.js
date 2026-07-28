import jsPDF from 'jspdf';
import { STATUS_IRMAOS } from './constants';

// ── Helpers ───────────────────────────────────────────────────────────────────
const obterGrau = (irmao) => {
  if (irmao.mestre_instalado) return 'M.I.';
  if (irmao.data_exaltacao)   return 'Mestre';
  if (irmao.data_elevacao)    return 'Companheiro';
  if (irmao.data_iniciacao)   return 'Aprendiz';
  return '—';
};

// Cor de cada situação — mesma lógica de cor usada no resto do sistema
// (verde=regular, azul=licenciado, laranja=irregular/suspenso, vermelho/
// cinza=desligado/excluído/ex-ofício, cinza=falecido)
const corSituacao = (valor) => {
  const cores = {
    regular:    [16, 185, 129],  // verde
    licenciado: [59, 130, 246],  // azul
    irregular:  [245, 158, 11],  // laranja
    suspenso:   [245, 158, 11],  // laranja
    desligado:  [239, 68, 68],   // vermelho
    excluido:   [239, 68, 68],   // vermelho
    ex_oficio:  [107, 114, 128], // cinza
    falecido:   [107, 114, 128], // cinza
  };
  return cores[valor] || [107, 114, 128];
};

// Converte a foto (URL pública do Storage) em base64, pra poder ser embutida
// no PDF via addImage. Se falhar (sem foto, CORS, etc.), retorna null e o
// relatório usa um ícone-silhueta no lugar — nunca quebra o relatório inteiro
// por causa de uma foto.
const carregarImagemBase64 = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};

// ── Função principal ──────────────────────────────────────────────────────────
export const gerarRelatorioSituacoesPDF = async (irmaos, dadosLoja) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, M = 15;
  let y = 5;

  // ── Helpers de desenho ──────────────────────────────────────────────────────
  const txt = (text, x, yy, opts = {}) => doc.text(String(text), x, yy, opts);
  const linhaDupla = (yy) => {
    doc.setDrawColor(80); doc.setLineWidth(0.5); doc.line(M, yy, W - M, yy);
    doc.setLineWidth(0.2); doc.line(M, yy + 1, W - M, yy + 1);
  };
  const rodape = () => {
    const totalPg = doc.getNumberOfPages();
    for (let p = 1; p <= totalPg; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
      txt('SysMaçom-MG - Desenvolvedor: Mauro George', M, 290);
      txt(`Página ${p} de ${totalPg}`, W / 2, 290, { align: 'center' });
      txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, W - M, 290, { align: 'right' });
      doc.setTextColor(0);
    }
  };
  const ALTURA_LINHA = 13;
  const checkPage = (espaco = ALTURA_LINHA) => {
    if (y + espaco > 275) {
      doc.addPage();
      y = 15;
      rodape();
    }
  };

  // ── Pré-carregar todas as fotos em paralelo (uma vez só, antes de desenhar) ──
  const fotosBase64 = {};
  await Promise.all(
    irmaos
      .filter(i => i.foto_url)
      .map(async (i) => { fotosBase64[i.id] = await carregarImagemBase64(i.foto_url); })
  );

  // ── CABEÇALHO ─────────────────────────────────────────────────────────────
  const nomeLoja = dadosLoja?.nome || 'ARLS Acácia de Paranatinga nº 30';

  if (dadosLoja?.logo_url) {
    try {
      doc.addImage(dadosLoja.logo_url, 'PNG', (W - 26) / 2, y, 26, 26);
      y += 32;
    } catch (e) { y += 2; }
  }

  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(30);
  txt(nomeLoja, W / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80);
  txt(dadosLoja?.endereco || 'Avenida Brasil, 2.300, Centro — Paranatinga/MT', W / 2, y, { align: 'center' }); y += 5;
  linhaDupla(y); y += 7;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
  txt('RELATÓRIO DE SITUAÇÃO DOS IRMÃOS', W / 2, y, { align: 'center' }); y += 5;
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  txt(`Emitido em ${new Date().toLocaleDateString('pt-BR')}  •  Total de irmãos: ${irmaos.length}`, W / 2, y, { align: 'center' }); y += 6;
  linhaDupla(y); y += 8;
  doc.setTextColor(0);

  // ── Agrupar por situação (mesma ordem/lista oficial usada no cadastro) ──────
  const grupos = STATUS_IRMAOS.map(s => ({
    valor: s.value,
    label: s.label,
    irmaos: irmaos.filter(i => (i.situacao || 'regular').toLowerCase() === s.value),
  })).filter(g => g.irmaos.length > 0);

  grupos.forEach(grupo => {
    // Cabeçalho da situação — não pode ficar isolado no fim da página
    checkPage(20);
    const [r, g, b] = corSituacao(grupo.valor);
    doc.setFillColor(r, g, b);
    doc.rect(M, y - 5, W - M * 2, 8, 'F');
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    txt(`${grupo.label.toUpperCase()}  (${grupo.irmaos.length})`, M + 3, y);
    doc.setTextColor(0);
    y += 8;

    // Ordenar por nome
    const ordenados = [...grupo.irmaos].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    ordenados.forEach((irmao, idx) => {
      checkPage(ALTURA_LINHA);

      // Zebra
      if (idx % 2 === 0) {
        doc.setFillColor(248, 249, 251);
        doc.rect(M, y - 4, W - M * 2, ALTURA_LINHA, 'F');
      }

      // Foto (moldura quadrada arredondada) ou ícone-silhueta — jsPDF não
      // recorta imagens em círculo de forma confiável entre versões, então
      // usamos um quadrado arredondado com borda fina, mais simples e seguro.
      const fotoX = M + 3, fotoY = y - 3.5, tamanho = 9;
      const foto = fotosBase64[irmao.id];
      if (foto) {
        try {
          const formatoImg = foto.includes('image/png') ? 'PNG' : foto.includes('image/webp') ? 'WEBP' : 'JPEG';
          doc.addImage(foto, formatoImg, fotoX, fotoY, tamanho, tamanho);
          doc.setDrawColor(210);
          doc.setLineWidth(0.2);
          doc.roundedRect(fotoX, fotoY, tamanho, tamanho, 1, 1, 'S');
        } catch (e) {
          doc.setFillColor(210, 214, 220);
          doc.roundedRect(fotoX, fotoY, tamanho, tamanho, 1, 1, 'F');
        }
      } else {
        doc.setFillColor(210, 214, 220);
        doc.roundedRect(fotoX, fotoY, tamanho, tamanho, 1, 1, 'F');
        doc.setFontSize(7); doc.setTextColor(140);
        txt('—', fotoX + tamanho / 2, fotoY + tamanho / 2 + 1, { align: 'center' });
        doc.setTextColor(0);
      }

      // Nome
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(20);
      txt(irmao.nome || '—', M + 18, y);

      // CIM
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
      txt(`CIM: ${irmao.cim || '—'}`, 130, y);

      // Grau
      doc.setFont('helvetica', 'bold'); doc.setTextColor(60);
      txt(obterGrau(irmao), W - M - 3, y, { align: 'right' });
      doc.setTextColor(0);

      y += ALTURA_LINHA;
    });

    y += 3; // respiro entre grupos
  });

  rodape();
  doc.save(`Relatorio_Situacoes_Irmaos_${new Date().toISOString().split('T')[0]}.pdf`);
};
