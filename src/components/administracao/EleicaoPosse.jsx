/**
 * MÓDULO ELEIÇÃO & POSSE
 * ARLS Acácia de Paranatinga nº 30
 * 
 * Fluxo: Configurar → Sessão Eleição → Sessão Posse → Documentos
 * Gera: Editais, Atas (Loja e Cartório), Listas de Presença, Requerimentos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { CARGOS_ADMINISTRATIVOS } from '../../utils/constants';

// ─── Utilitários ────────────────────────────────────────────────────────────

const formatarData = (d) => {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
};

const formatarDataExtenso = (d) => {
  if (!d) return '';
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const [ano, mes, dia] = d.split('-');
  return `${parseInt(dia)} de ${meses[parseInt(mes)-1]} de ${ano}`;
};

const ORDEM_CARGOS = CARGOS_ADMINISTRATIVOS;

// ─── Geração de DOCX ────────────────────────────────────────────────────────


// ─── Geração de documentos Word (.doc via HTML) ──────────
// Sem dependências externas — o Word e LibreOffice abrem HTML com mhtml

const gerarDocx = async (tipo, eleicao, chapas, presencas, dadosLoja, irmaos) => {

  const chapaEleita = chapas.filter(c => c.eleita);
  const vmConvocante = irmaos.find(i => i.id === eleicao.vm_convocante_id);
  const secretario   = irmaos.find(i => i.id === eleicao.secretario_id);
  const presidente   = irmaos.find(i => i.id === eleicao.presidente_eleito_id);
  const gestao       = eleicao.gestao || '';
  const gestaoSub    = gestao.replace('/', '_');
  const nomeLoja     = `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`;
  const enderecoLoja = dadosLoja.endereco ? `na ${dadosLoja.endereco}, ` : '';
  const cidadeUF     = `${dadosLoja.cidade || 'Paranatinga'}/${dadosLoja.estado || 'MT'}`;
  const presencasEleicao = presencas.filter(p => p.sessao === 'eleicao');
  const presencasPosse   = presencas.filter(p => p.sessao === 'posse');

  const dadoIrmao = (irmaoId) => {
    const i = irmaos.find(x => x.id === irmaoId);
    if (!i) return '[Irmão não encontrado]';
    return [
      i.nome,
      i.nacionalidade || 'brasileiro',
      i.estado_civil  || null,
      i.profissao     || null,
      i.naturalidade  ? `natural de ${i.naturalidade}` : null,
      i.data_nascimento ? `nascido em ${formatarData(i.data_nascimento)}` : null,
      (i.nome_pai && i.nome_mae) ? `filho de ${i.nome_pai} e ${i.nome_mae}` : i.nome_mae ? `filho de ${i.nome_mae}` : null,
      i.rg  ? `portador da Cédula de Identidade RG sob nº ${i.rg}` : null,
      i.cpf ? `CPF/MF nº ${i.cpf}` : null,
      i.endereco_completo ? `residente e domiciliado ${i.endereco_completo}` : null,
    ].filter(Boolean).join(', ');
  };

  const css = `
    body { font-family: Arial, sans-serif; font-size: 12pt; margin: 3cm 2cm 2cm 3cm; }
    p { text-align: justify; line-height: 1.5; margin: 6pt 0; text-indent: 1.25cm; }
    p.center { text-align: center; text-indent: 0; }
    p.left   { text-align: left;  text-indent: 0; }
    p.titulo { text-align: center; font-weight: bold; text-transform: uppercase; text-indent: 0; margin: 12pt 0; }
    p.subtitulo { text-align: center; font-weight: bold; text-indent: 0; margin: 4pt 0; }
    p.cargo  { text-align: justify; margin: 4pt 0; text-indent: 1.25cm; }
    p.assinatura { margin-top: 30pt; text-indent: 0; }
    p.assnom { margin: 2pt 0; text-indent: 0; font-weight: bold; }
    p.asscargo { margin: 2pt 0 20pt; text-indent: 0; }
    .linha { border-bottom: 1px solid #000; width: 280pt; display: inline-block; margin-bottom: 2pt; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
    th { background: #d9d9d9; font-weight: bold; font-size: 10pt; padding: 5pt 6pt; border: 1px solid #000; }
    td { font-size: 10pt; padding: 5pt 6pt; border: 1px solid #000; height: 18pt; }
  `;

  const cabecalho = () => `
    <p class="subtitulo">AUG∴ E RESP∴ LOJA SIMB∴ ${nomeLoja}</p>
    <p class="subtitulo">Fundada em ${dadosLoja.data_fundacao ? formatarData(dadosLoja.data_fundacao) : '20/12/1997'}</p>
    <p class="subtitulo" style="margin-bottom:18pt;">SOB OS AUSPÍCIOS DA SERENÍSSIMA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO</p>
  `;

  const assinatura = (nome, cargo) => `
    <p class="assinatura">___________________________________________</p>
    <p class="assnom">${nome}</p>
    <p class="asscargo">${cargo}</p>
  `;

  const listaEleitos = () => chapaEleita
    .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
    .map(c => `<p class="cargo"><strong>${c.cargo}:</strong> ${dadoIrmao(c.irmao_id)};</p>`)
    .join('');

  let corpo = '';

  // ═══════════════════════════════════════════════════════
  if (tipo === 'edital_eleicao') {
    corpo = `
      ${cabecalho()}
      <p class="titulo">Edital de Convocação para Eleição</p>
      <p>Na qualidade de Venerável Mestre, Sr. <strong>${vmConvocante?.nome || '[VM]'}</strong>, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica ${nomeLoja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Eleição do Corpo Administrativo da Augusta e Respeitável Loja Simbólica ${nomeLoja} – Gestão ${gestaoSub}, a realizar-se no dia ${formatarData(eleicao.data_eleicao)}, às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.</p>
      <p class="left" style="margin-top:20pt;">${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${formatarDataExtenso(eleicao.data_edital_eleicao)}.</p>
      ${assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre')}
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'edital_posse') {
    corpo = `
      ${cabecalho()}
      <p class="titulo">Edital de Convocação para Posse</p>
      <p>Na qualidade de Venerável Mestre, Sr. <strong>${vmConvocante?.nome || '[VM]'}</strong>, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica ${nomeLoja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Posse do Corpo Administrativo da Augusta e Respeitável Loja Simbólica ${nomeLoja} – Gestão ${gestaoSub}, a realizar-se no dia ${formatarData(eleicao.data_posse)}, às ${eleicao.hora_posse?.substring(0,5) || '20:00'} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.</p>
      <p class="left" style="margin-top:20pt;">${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${formatarDataExtenso(eleicao.data_edital_posse)}.</p>
      ${assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre')}
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_loja') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador' || c.cargo === 'orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const trechoVotacao = eleicao.tipo_votacao === 'aclamacao'
      ? `por se tratar de chapa única, não houve composição de mesa eleitoral, motivo pelo qual, a votação foi por aclamação sendo aprovada a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.`
      : `foi constituída mesa eleitoral, procedendo-se à votação por meio de escrutínio secreto, tendo sido eleita a chapa vencedora por maioria dos presentes, conforme constam suas assinaturas na folha de votação (anexo).`;

    corpo = `
      <p class="titulo">ATA DA SESSÃO ORDINÁRIA DE ELEIÇÃO DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO ${gestaoSub}</p>
      <p>Aos ${formatarData(eleicao.data_eleicao)} (E∴ V∴), às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de ${dadosLoja.cidade || 'Paranatinga'}, Estado de ${dadosLoja.estado || 'Mato Grosso'}, ${enderecoLoja}cidade de ${cidadeUF}, no Templo os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica ${nomeLoja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em <strong>SESSÃO ORDINÁRIA</strong>, para o fim especial de realizarem as eleições para os cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}.</p>
      <p>Presentes os irmãos que preencheram os cargos, estando todos revestidos de suas insígnias, sob a presidência do Venerável Mestre (Presidente) ${vmConvocante?.nome || '[VM]'}, e pelos membros, ${oradorNome} e ${secretario?.nome || '[Secretário]'}, Orador e Secretário, respectivamente, estando os demais cargos regularmente constituídos.</p>
      <p>Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre, dispensando-se a Leitura da Ata e Expedientes. Após a abertura dos trabalhos foi determinado ao Irmão Secretário que procedesse a leitura do Edital de Convocação para Eleição, no qual constou a convocação dos Irmãos Mestres da Loja para eleição da diretoria da Loja para o Exercício ${gestaoSub}.</p>
      <p>Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presencasEleicao.length} membros votantes, conforme a lista de presença, e que foram declarados pelos Irmãos Chanceler e Tesoureiro como aptos ao exercício do voto.</p>
      <p>Então, por ordem do Venerável Mestre (Presidente) e ${trechoVotacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa única que ficou composta dos seguintes cargos e seus membros e comissões:</p>
      ${listaEleitos()}
      <p>Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_eleicao)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.</p>
      ${assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre')}
      ${assinatura(oradorNome, 'Orador')}
      ${assinatura(secretario?.nome || '[Secretário]', 'Secretário')}
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_cartorio') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador' || c.cargo === 'orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const trechoMesa = eleicao.tipo_votacao === 'aclamacao'
      ? `por se tratar de chapa única, não houve composição de mesa eleitoral. Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presencasEleicao.length} membros votantes, 1/3 do quórum mínimo exigido para aprovação pelo estatuto, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente), foi votado por aclamação sendo aprovada a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.`
      : `foi constituída mesa eleitoral para o escrutínio secreto. Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presencasEleicao.length} membros votantes, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. A votação foi realizada e a chapa vencedora foi eleita por maioria dos presentes, conforme constam suas assinaturas na folha de votação (anexo).`;

    corpo = `
      <p class="titulo">ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO ${gestaoSub}</p>
      <p>Aos ${formatarData(eleicao.data_eleicao)} da era vulgar, às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas, reuniram-se em Sessão ordinária, para eleição dos cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do Regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico e artigo 3º, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}, na sua sede, localizada ${enderecoLoja}cidade de ${cidadeUF}. Preenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete, dispensando-se a Leitura da Ata e Expedientes. Constou-se na ordem do dia a eleição da diretoria da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}, bem como o Respeitabilíssimo Mestre determinou ao Irmão Secretário que procedesse a leitura do Edital de Convocação, no qual a convocação dos Irmãos Mestres da Loja para eleição da diretoria da Loja para o exercício de ${gestao}. Os trabalhos foram presididos pelo Venerável Mestre (Presidente) ${vmConvocante?.nome || '[VM]'}, e pelos membros, ${oradorNome} e ${secretario?.nome || '[Secretário]'}, Orador e Secretário, respectivamente, ${trechoMesa} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa que ficou composta dos seguintes cargos e seus membros e comissões:</p>
      ${listaEleitos()}
      <p>Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_eleicao)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.</p>
      ${assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre')}
      ${assinatura(oradorNome, 'Orador')}
      ${assinatura(secretario?.nome || '[Secretário]', 'Secretário')}
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'ata_posse') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador' || c.cargo === 'orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const vmEleito = chapaEleita.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
    const vmEleitoNome = vmEleito ? (irmaos.find(i => i.id === vmEleito.irmao_id)?.nome || '[VM Eleito]') : '[VM Eleito]';

    corpo = `
      <p class="titulo">ATA DA SESSÃO ORDINÁRIA DE POSSE DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO ${gestaoSub}</p>
      <p>Aos ${formatarData(eleicao.data_posse)} (E∴ V∴), às ${eleicao.hora_posse?.substring(0,5) || '20:00'} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de ${dadosLoja.cidade || 'Paranatinga'}, Estado de ${dadosLoja.estado || 'Mato Grosso'}, ${enderecoLoja}cidade de ${cidadeUF}, no Templo, os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica ${nomeLoja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em <strong>SESSÃO ORDINÁRIA</strong>, para o fim especial de realizarem a POSSE da nova diretoria eleita para a Gestão ${gestaoSub}.</p>
      <p>Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre ${vmConvocante?.nome || '[VM]'}, dispensando-se a Leitura da Ata e Expedientes. Estavam presentes à sessão ${eleicao.num_votantes_posse || presencasPosse.length} membros, conforme lista de presença.</p>
      <p>Procedeu-se então à cerimônia de posse e instalação dos novos dirigentes para a Gestão ${gestaoSub}, tomando posse os seguintes membros:</p>
      ${chapaEleita
        .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
        .map(c => `<p class="cargo"><strong>${c.cargo}:</strong> ${irmaos.find(i => i.id === c.irmao_id)?.nome || '[Irmão]'};</p>`)
        .join('')}
      <p>Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_posse)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.</p>
      ${assinatura(vmConvocante?.nome || '[VM sainte]', 'Venerável Mestre Instalador')}
      ${assinatura(vmEleitoNome, 'Venerável Mestre Empossado')}
      ${assinatura(secretario?.nome || '[Secretário]', 'Secretário')}
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'lista_presenca_eleicao' || tipo === 'lista_presenca_posse') {
    const sessaoNome = tipo === 'lista_presenca_eleicao' ? 'Eleição' : 'Posse';
    const dataDoc    = tipo === 'lista_presenca_eleicao' ? eleicao.data_eleicao : eleicao.data_posse;
    const lista      = tipo === 'lista_presenca_eleicao' ? presencasEleicao : presencasPosse;

    const linhas = [...lista, ...Array(5).fill(null)].map((p, idx) => {
      const i = p ? irmaos.find(x => x.id === p.irmao_id) : null;
      return `<tr>
        <td style="text-align:center;width:30pt;">${p ? idx + 1 : ''}</td>
        <td style="width:280pt;">${i?.nome || ''}</td>
        <td style="width:70pt;">${i?.cim || ''}</td>
        <td style="width:100pt;"></td>
      </tr>`;
    }).join('');

    corpo = `
      ${cabecalho()}
      <p class="titulo">Lista de Presença — Sessão de ${sessaoNome}</p>
      <p class="center">Gestão: ${gestao} &nbsp;&nbsp;&nbsp; Data: ${formatarData(dataDoc)}</p>
      <table>
        <thead><tr>
          <th style="width:30pt;">Nº</th>
          <th style="width:280pt;">Nome</th>
          <th style="width:70pt;">CIM</th>
          <th style="width:100pt;">Assinatura</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <p class="left" style="margin-top:10pt;">Total de presentes: ${lista.length}</p>
    `;
  }

  // ═══════════════════════════════════════════════════════
  else if (tipo === 'requerimento_eleicao' || tipo === 'requerimento_posse') {
    const tipoAta  = tipo === 'requerimento_eleicao' ? 'ELEIÇÃO' : 'POSSE DA DIRETORIA';
    const dataReq  = eleicao.data_posse || eleicao.data_eleicao;
    const secDados = secretario ? dadoIrmao(eleicao.secretario_id) : '[Secretário]';
    const trechoRegisto = tipo === 'requerimento_eleicao'
      ? ` em Pessoas Jurídicas dessa Serventia, junto ao registro sob nº ${dadosLoja.numero_registro_cartorio || '04, do Livro A-01'}, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.`
      : ` em Pessoas Jurídicas dessa Serventia, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.`;

    corpo = `
      <p class="left" style="font-weight:bold;">${dadosLoja.nome_cartorio || 'ILMª. SRª. TABELIÃ DO CARTÓRIO DE NOTAS, PROTESTO DE TÍTULOS, REGISTRO CIVIL DAS PESSOAS NATURAIS E JURÍDICAS DE PARANATINGA - MT – 2º SERVIÇO NOTORIAL E REGISTRAL'}</p>
      <p><strong>AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ/MF <strong>${dadosLoja.cnpj || '[CNPJ]'}</strong>, com sede localizada ${enderecoLoja}cidade de ${cidadeUF}, representada pelo seu secretário, Sr. ${secDados}. Vem com o devido respeito à presença de Vossa Senhoria, <strong>REQUERER</strong>, que digne em proceder com a averbação da <strong>ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ${tipoAta} DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO ${gestaoSub}</strong>${trechoRegisto}</p>
      <p class="left" style="margin-top:20pt;">${dadosLoja.cidade || 'Paranatinga'}, ${formatarDataExtenso(dataReq)}.</p>
      ${assinatura(presidente?.nome || '[Presidente]', 'Presidente')}
    `;
  }

  // ─── Montar HTML final ────────────────────────────────
  return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
    xmlns:w='urn:schemas-microsoft-com:office:word'
    xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <style>${css}</style>
    <!--[if gte mso 9]>
    <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
    <![endif]-->
  </head>
  <body>${corpo}</body>
  </html>`;
};

// ─── Download helper ─────────────────────────────────────
const downloadDocx = (htmlContent, nomeArquivo) => {
  const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
};


// ─── Estilos compartilhados ──────────────────────────────
const S = {
  btn: (cor = 'accent') => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: '600',
    color: cor === 'danger' ? 'white' : cor === 'surface' ? 'var(--color-text)' : 'white',
    background: cor === 'accent' ? 'var(--color-accent)' : cor === 'danger' ? 'var(--color-danger)' : cor === 'success' ? 'var(--color-success)' : 'var(--color-surface-2)',
    border: cor === 'surface' ? '1px solid var(--color-border)' : 'none',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
  }),
  card: { background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--color-border)' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem', boxSizing: 'border-box' },
  select: { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)', fontSize: '0.875rem' },
  badge: (cor) => ({
    display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '999px',
    fontSize: '0.75rem', fontWeight: '700',
    background: cor === 'gold' ? 'var(--color-accent-bg)' : cor === 'green' ? 'rgba(16,185,129,0.15)' : cor === 'blue' ? 'rgba(59,130,246,0.15)' : 'var(--color-surface-2)',
    color: cor === 'gold' ? 'var(--color-accent)' : cor === 'green' ? 'var(--color-success)' : cor === 'blue' ? '#3b82f6' : 'var(--color-text-muted)',
  }),
};

const STATUS_INFO = {
  rascunho:           { label: 'Rascunho',             cor: 'muted', emoji: '📝' },
  eleicao_realizada:  { label: 'Eleição Realizada',    cor: 'blue',  emoji: '✅' },
  posse_realizada:    { label: 'Posse Realizada',       cor: 'green', emoji: '🎖️' },
  registrado_cartorio:{ label: 'Registrado em Cartório',cor: 'gold',  emoji: '🏛️' },
};

// ════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function EleicaoPosse({ permissoes, irmaos, showSuccess, showError }) {
  const [eleicoes, setEleicoes] = useState([]);
  const [eleicaoSelecionada, setEleicaoSelecionada] = useState(null);
  const [chapas, setChapas] = useState([]);
  const [presencas, setPresencas] = useState([]);
  const [dadosLoja, setDadosLoja] = useState({});
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState('');
  const [etapa, setEtapa] = useState(1); // 1=config 2=eleição 3=posse 4=docs
  const [modalAberto, setModalAberto] = useState(false); // nova eleição
  const [loadingAcao, setLoadingAcao] = useState(false);

  // Form nova eleição
  const [form, setForm] = useState({
    gestao: '',
    tipo_votacao: 'aclamacao',
    data_eleicao: '',
    hora_eleicao: '20:00',
    data_edital_eleicao: '',
    data_posse: '',
    hora_posse: '20:00',
    data_edital_posse: '',
    vm_convocante_id: '',
    secretario_id: '',
    presidente_eleito_id: '',
    observacoes: '',
  });

  // Chapas em edição
  const [editandoChapas, setEditandoChapas] = useState(false);
  const [chapaForm, setChapaForm] = useState({}); // { cargo: irmao_id }
  const [nomesChapas, setNomesChapas] = useState({ A: 'Chapa A', B: 'Chapa B' });
  const [chapaVencedora, setChapaVencedora] = useState('A');

  const podeEditar = permissoes?.pode_editar_corpo_admin || false;
  const irmaosAtivos = (irmaos || []).filter(i => i.status === 'ativo');

  // ── Carregamento ─────────────────────────────────────────

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: loja } = await supabase.from('dados_loja').select('*').single();
      if (loja) setDadosLoja(loja);

      const { data: el } = await supabase
        .from('eleicoes')
        .select('*')
        .order('created_at', { ascending: false });
      setEleicoes(el || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarDetalhe = useCallback(async (id) => {
    const { data: ch } = await supabase
      .from('eleicao_chapas')
      .select('*')
      .eq('eleicao_id', id)
      .order('ordem');
    setChapas(ch || []);

    const { data: pr } = await supabase
      .from('eleicao_presencas')
      .select('*')
      .eq('eleicao_id', id);
    setPresencas(pr || []);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (eleicaoSelecionada) carregarDetalhe(eleicaoSelecionada.id);
  }, [eleicaoSelecionada, carregarDetalhe]);

  // ── Nova Eleição ─────────────────────────────────────────

  const salvarEleicao = async () => {
    if (!form.gestao || !form.data_eleicao) {
      showError('Preencha ao menos a Gestão e Data da Eleição.');
      return;
    }
    setLoadingAcao(true);
    try {
      const { data, error } = await supabase
        .from('eleicoes')
        .insert([{ ...form, status: 'rascunho' }])
        .select()
        .single();
      if (error) throw error;
      showSuccess('Eleição criada com sucesso!');
      setModalAberto(false);
      setForm({ gestao: '', tipo_votacao: 'aclamacao', data_eleicao: '', hora_eleicao: '20:00', data_edital_eleicao: '', data_posse: '', hora_posse: '20:00', data_edital_posse: '', vm_convocante_id: '', secretario_id: '', presidente_eleito_id: '', observacoes: '' });
      await carregar();
      setEleicaoSelecionada(data);
      setEtapa(1);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  const atualizarEleicao = async (campos) => {
    if (!eleicaoSelecionada) return;
    setLoadingAcao(true);
    try {
      const { data, error } = await supabase
        .from('eleicoes')
        .update(campos)
        .eq('id', eleicaoSelecionada.id)
        .select()
        .single();
      if (error) throw error;
      setEleicaoSelecionada(data);
      setEleicoes(prev => prev.map(e => e.id === data.id ? data : e));
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  // ── Chapas ──────────────────────────────────────────────

  const iniciarEdicaoChapas = () => {
    const mapa = {};
    chapas.forEach(c => { mapa[c.cargo] = c.irmao_id; });
    setChapaForm(mapa);
    setEditandoChapas(true);
  };

  const salvarChapas = async () => {
    setLoadingAcao(true);
    try {
      // Remove chapas antigas
      await supabase.from('eleicao_chapas').delete().eq('eleicao_id', eleicaoSelecionada.id);

      const novas = ORDEM_CARGOS
        .filter(cargo => chapaForm[cargo])
        .map((cargo, idx) => ({
          eleicao_id: eleicaoSelecionada.id,
          cargo,
          irmao_id: chapaForm[cargo],
          nome_chapa: eleicaoSelecionada.tipo_votacao === 'disputa' ? nomesChapas.A : 'Chapa Única',
          eleita: true,
          ordem: idx,
        }));

      if (novas.length) {
        const { error } = await supabase.from('eleicao_chapas').insert(novas);
        if (error) throw error;
      }

      // Atualiza presidente_eleito_id com o VM eleito
      const vmEleito = novas.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
      if (vmEleito) {
        await atualizarEleicao({ presidente_eleito_id: vmEleito.irmao_id });
      }

      showSuccess('Chapa salva!');
      setEditandoChapas(false);
      await carregarDetalhe(eleicaoSelecionada.id);
    } catch (e) {
      showError('Erro: ' + e.message);
    } finally {
      setLoadingAcao(false);
    }
  };

  // ── Presença ─────────────────────────────────────────────

  const togglePresenca = async (irmaoId, sessao) => {
    const existe = presencas.find(p => p.irmao_id === irmaoId && p.sessao === sessao);
    try {
      if (existe) {
        await supabase.from('eleicao_presencas').delete().eq('id', existe.id);
        setPresencas(prev => prev.filter(p => p.id !== existe.id));
      } else {
        const { data, error } = await supabase.from('eleicao_presencas')
          .insert([{ eleicao_id: eleicaoSelecionada.id, irmao_id: irmaoId, sessao }])
          .select().single();
        if (error) throw error;
        setPresencas(prev => [...prev, data]);
      }
    } catch (e) {
      showError('Erro: ' + e.message);
    }
  };

  const confirmarEleicao = async () => {
    const qtd = presencas.filter(p => p.sessao === 'eleicao').length;
    await atualizarEleicao({ status: 'eleicao_realizada', num_votantes_eleicao: qtd });
    showSuccess('Sessão de eleição confirmada!');
    setEtapa(3);
  };

  const confirmarPosse = async () => {
    const qtd = presencas.filter(p => p.sessao === 'posse').length;
    await atualizarEleicao({ status: 'posse_realizada', num_votantes_posse: qtd });

    // Atualizar corpo_administrativo com a nova gestão
    try {
      const ano = eleicaoSelecionada.gestao?.split('/')[0] || new Date().getFullYear();
      const chapaEl = chapas.filter(c => c.eleita);
      const inserir = chapaEl.map(c => ({
        irmao_id: c.irmao_id,
        cargo: c.cargo,
        ano_exercicio: String(ano),
      }));
      if (inserir.length) {
        await supabase.from('corpo_administrativo').insert(inserir);
      }
      showSuccess('Posse confirmada e corpo administrativo atualizado!');
    } catch (e) {
      showSuccess('Posse confirmada!');
    }
    setEtapa(4);
  };

  const marcarRegistrado = async () => {
    await atualizarEleicao({ status: 'registrado_cartorio' });
    showSuccess('Marcado como registrado em cartório!');
  };

  // ── Geração de documento ─────────────────────────────────

  const gerarDoc = async (tipo, nomeArq) => {
    setGerando(tipo);
    try {
      const buf = await gerarDocx(tipo, eleicaoSelecionada, chapas, presencas, dadosLoja, irmaos || []);
      downloadDocx(buf, nomeArq);
    } catch (e) {
      showError('Erro ao gerar documento: ' + e.message);
      console.error(e);
    } finally {
      setGerando('');
    }
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  if (loading) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
      Carregando...
    </div>
  );

  // ── Lista de eleições (sem seleção) ──────────────────────
  if (!eleicaoSelecionada) {
    return (
      <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-text)', margin: 0 }}>⚖️ Eleição & Posse</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Gestão de eleições, posses e documentos oficiais</p>
          </div>
          {podeEditar && (
            <button style={S.btn('accent')} onClick={() => setModalAberto(true)}>
              ➕ Nova Eleição
            </button>
          )}
        </div>

        {eleicoes.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
            <p>Nenhuma eleição registrada ainda.</p>
            {podeEditar && <button style={{ ...S.btn('accent'), marginTop: '1rem' }} onClick={() => setModalAberto(true)}>Registrar primeira eleição</button>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {eleicoes.map(el => {
              const st = STATUS_INFO[el.status] || STATUS_INFO.rascunho;
              return (
                <div key={el.id} style={{ ...S.card, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => { setEleicaoSelecionada(el); setEtapa(el.status === 'rascunho' ? 1 : el.status === 'eleicao_realizada' ? 3 : 4); }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text)' }}>Gestão {el.gestao}</span>
                      <span style={S.badge(st.cor)}>{st.emoji} {st.label}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {el.data_eleicao && `Eleição: ${formatarData(el.data_eleicao)}`}
                      {el.data_posse && ` · Posse: ${formatarData(el.data_posse)}`}
                      {` · ${el.tipo_votacao === 'aclamacao' ? 'Aclamação' : 'Disputa'}`}
                    </div>
                  </div>
                  <span style={{ color: 'var(--color-accent)', fontSize: '1.25rem' }}>›</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal nova eleição */}
        {modalAberto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <h3 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--color-text)', marginBottom: '1.5rem' }}>➕ Nova Eleição</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Gestão *</label>
                  <input style={S.input} placeholder="Ex: 2026/2027" value={form.gestao} onChange={e => setForm(p => ({ ...p, gestao: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Tipo de Votação *</label>
                  <select style={S.select} value={form.tipo_votacao} onChange={e => setForm(p => ({ ...p, tipo_votacao: e.target.value }))}>
                    <option value="aclamacao">Chapa Única (Aclamação)</option>
                    <option value="disputa">Disputa entre Chapas</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Data da Eleição *</label>
                  <input type="date" style={S.input} value={form.data_eleicao} onChange={e => setForm(p => ({ ...p, data_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Hora da Eleição</label>
                  <input type="time" style={S.input} value={form.hora_eleicao} onChange={e => setForm(p => ({ ...p, hora_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data do Edital de Eleição</label>
                  <input type="date" style={S.input} value={form.data_edital_eleicao} onChange={e => setForm(p => ({ ...p, data_edital_eleicao: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data da Posse</label>
                  <input type="date" style={S.input} value={form.data_posse} onChange={e => setForm(p => ({ ...p, data_posse: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Hora da Posse</label>
                  <input type="time" style={S.input} value={form.hora_posse} onChange={e => setForm(p => ({ ...p, hora_posse: e.target.value }))} />
                </div>
                <div>
                  <label style={S.label}>Data do Edital de Posse</label>
                  <input type="date" style={S.input} value={form.data_edital_posse} onChange={e => setForm(p => ({ ...p, data_edital_posse: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>VM Convocante (quem assina os editais)</label>
                  <select style={S.select} value={form.vm_convocante_id} onChange={e => setForm(p => ({ ...p, vm_convocante_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={S.label}>Secretário (quem lavra as atas)</label>
                  <select style={S.select} value={form.secretario_id} onChange={e => setForm(p => ({ ...p, secretario_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button style={S.btn('surface')} onClick={() => setModalAberto(false)}>Cancelar</button>
                <button style={S.btn('accent')} onClick={salvarEleicao} disabled={loadingAcao}>
                  {loadingAcao ? 'Salvando...' : '💾 Criar Eleição'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // DETALHE DA ELEIÇÃO
  // ─────────────────────────────────────────────────────────
  const st = STATUS_INFO[eleicaoSelecionada.status] || STATUS_INFO.rascunho;
  const presEleicao = presencas.filter(p => p.sessao === 'eleicao');
  const presPosse = presencas.filter(p => p.sessao === 'posse');
  const chapaEleita = chapas.filter(c => c.eleita);

  const ETAPAS = [
    { n: 1, label: 'Configuração' },
    { n: 2, label: 'Sessão Eleição' },
    { n: 3, label: 'Sessão Posse' },
    { n: 4, label: 'Documentos' },
  ];

  return (
    <div style={{ padding: '1.5rem', background: 'var(--color-bg)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button style={S.btn('surface')} onClick={() => setEleicaoSelecionada(null)}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--color-text)', margin: 0 }}>
              ⚖️ Gestão {eleicaoSelecionada.gestao}
            </h2>
            <span style={S.badge(st.cor)}>{st.emoji} {st.label}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {eleicaoSelecionada.tipo_votacao === 'aclamacao' ? 'Chapa Única — Aclamação' : 'Disputa entre Chapas'}
          </p>
        </div>
        {eleicaoSelecionada.status === 'posse_realizada' && podeEditar && (
          <button style={S.btn('success')} onClick={marcarRegistrado}>🏛️ Marcar Registrado em Cartório</button>
        )}
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        {ETAPAS.map((ep, idx) => (
          <button key={ep.n}
            style={{
              flex: 1, padding: '0.75rem 0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
              background: etapa === ep.n ? 'var(--color-accent)' : 'transparent',
              color: etapa === ep.n ? 'white' : 'var(--color-text-muted)',
              borderRight: idx < ETAPAS.length - 1 ? '1px solid var(--color-border)' : 'none',
              transition: 'all 0.2s',
            }}
            onClick={() => setEtapa(ep.n)}
          >
            {ep.n}. {ep.label}
          </button>
        ))}
      </div>

      {/* ── Etapa 1: Configuração e Chapa ── */}
      {etapa === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Datas */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', marginBottom: '1rem', color: 'var(--color-text)', fontSize: '0.95rem' }}>📅 Datas e Responsáveis</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {[
                { key: 'data_eleicao', label: 'Data da Eleição', type: 'date' },
                { key: 'hora_eleicao', label: 'Hora da Eleição', type: 'time' },
                { key: 'data_edital_eleicao', label: 'Data Edital Eleição', type: 'date' },
                { key: 'data_posse', label: 'Data da Posse', type: 'date' },
                { key: 'hora_posse', label: 'Hora da Posse', type: 'time' },
                { key: 'data_edital_posse', label: 'Data Edital Posse', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input type={f.type} style={S.input} disabled={!podeEditar}
                    value={eleicaoSelecionada[f.key] || ''}
                    onChange={e => setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value }))}
                    onBlur={e => podeEditar && atualizarEleicao({ [f.key]: e.target.value || null })}
                  />
                </div>
              ))}
              {[
                { key: 'vm_convocante_id', label: 'VM Convocante' },
                { key: 'secretario_id', label: 'Secretário' },
              ].map(f => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <select style={S.select} disabled={!podeEditar}
                    value={eleicaoSelecionada[f.key] || ''}
                    onChange={e => { setEleicaoSelecionada(p => ({ ...p, [f.key]: e.target.value })); podeEditar && atualizarEleicao({ [f.key]: e.target.value || null }); }}
                  >
                    <option value="">Selecione...</option>
                    {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Chapa */}
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                👥 {eleicaoSelecionada.tipo_votacao === 'disputa' ? 'Chapas' : 'Chapa'}
              </h3>
              {podeEditar && (
                editandoChapas
                  ? <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={S.btn('surface')} onClick={() => setEditandoChapas(false)}>Cancelar</button>
                      <button style={S.btn('accent')} onClick={salvarChapas} disabled={loadingAcao}>💾 Salvar</button>
                    </div>
                  : <button style={S.btn('accent')} onClick={iniciarEdicaoChapas}>✏️ Editar Chapa</button>
              )}
            </div>

            {editandoChapas ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ORDEM_CARGOS.map(cargo => (
                  <div key={cargo} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <label style={{ ...S.label, margin: 0 }}>{cargo}</label>
                    <select style={S.select} value={chapaForm[cargo] || ''}
                      onChange={e => setChapaForm(p => ({ ...p, [cargo]: e.target.value || undefined }))}>
                      <option value="">— sem designação —</option>
                      {irmaosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ) : chapaEleita.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Nenhum membro designado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {chapaEleita
                  .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
                  .map(c => {
                    const i = irmaosAtivos.find(x => x.id === c.irmao_id) || irmaos?.find(x => x.id === c.irmao_id);
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: '1rem', padding: '0.4rem 0.75rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontWeight: '600', color: 'var(--color-accent)', minWidth: '180px', fontSize: '0.8rem' }}>{c.cargo}</span>
                        <span style={{ color: 'var(--color-text)', fontSize: '0.875rem' }}>{i?.nome || '[Não encontrado]'}</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {podeEditar && chapaEleita.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btn('accent')} onClick={() => setEtapa(2)}>Avançar para Sessão de Eleição →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 2: Lista de presença — Eleição ── */}
      {etapa === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                ✅ Presença — Sessão de Eleição
                <span style={{ ...S.badge('blue'), marginLeft: '0.75rem' }}>{presEleicao.length} presentes</span>
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
              {irmaosAtivos
                .filter(i => {
                  // Apenas Mestres podem votar
                  return i.data_exaltacao;
                })
                .map(i => {
                  const marcado = presEleicao.some(p => p.irmao_id === i.id);
                  return (
                    <div key={i.id}
                      onClick={() => podeEditar && togglePresenca(i.id, 'eleicao')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: podeEditar ? 'pointer' : 'default',
                        background: marcado ? 'var(--color-accent-bg)' : 'var(--color-surface-2)',
                        border: `1px solid ${marcado ? 'var(--color-accent)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}>
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        background: marcado ? 'var(--color-accent)' : 'var(--color-bg)',
                        border: `2px solid ${marcado ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {marcado && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700' }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: marcado ? '600' : '400', color: 'var(--color-text)' }}>{i.nome}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM {i.cim}</div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {podeEditar && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(1)}>← Voltar</button>
              <button style={S.btn('success')} onClick={confirmarEleicao} disabled={presEleicao.length === 0}>
                ✅ Confirmar Eleição ({presEleicao.length} presentes)
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 3: Lista de presença — Posse ── */}
      {etapa === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '700', color: 'var(--color-text)', fontSize: '0.95rem', margin: 0 }}>
                🎖️ Presença — Sessão de Posse
                <span style={{ ...S.badge('green'), marginLeft: '0.75rem' }}>{presPosse.length} presentes</span>
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.4rem' }}>
              {irmaosAtivos.map(i => {
                const marcado = presPosse.some(p => p.irmao_id === i.id);
                return (
                  <div key={i.id}
                    onClick={() => podeEditar && togglePresenca(i.id, 'posse')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', cursor: podeEditar ? 'pointer' : 'default',
                      background: marcado ? 'rgba(16,185,129,0.1)' : 'var(--color-surface-2)',
                      border: `1px solid ${marcado ? 'var(--color-success)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      background: marcado ? 'var(--color-success)' : 'var(--color-bg)',
                      border: `2px solid ${marcado ? 'var(--color-success)' : 'var(--color-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {marcado && <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: '700' }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: marcado ? '600' : '400', color: 'var(--color-text)' }}>{i.nome}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>CIM {i.cim}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {podeEditar && eleicaoSelecionada.status !== 'posse_realizada' && eleicaoSelecionada.status !== 'registrado_cartorio' && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(2)}>← Voltar</button>
              <button style={S.btn('success')} onClick={confirmarPosse} disabled={presPosse.length === 0}>
                🎖️ Confirmar Posse ({presPosse.length} presentes)
              </button>
            </div>
          )}
          {(eleicaoSelecionada.status === 'posse_realizada' || eleicaoSelecionada.status === 'registrado_cartorio') && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button style={S.btn('surface')} onClick={() => setEtapa(2)}>← Voltar</button>
              <button style={S.btn('accent')} onClick={() => setEtapa(4)}>Ver Documentos →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 4: Documentos ── */}
      {etapa === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Alerta campos incompletos */}
          {!dadosLoja.cnpj && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text)' }}>
              ⚠️ CNPJ da loja não cadastrado. Preencha em <strong>Sistema → Dados da Loja</strong> para que os requerimentos fiquem completos.
            </div>
          )}

          {/* Grupo: Editais */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>📄 Editais de Convocação</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📄" label="Edital de Eleição" disabled={!eleicaoSelecionada.data_eleicao} gerando={gerando === 'edital_eleicao'}
                onClick={() => gerarDoc('edital_eleicao', `Edital_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📄" label="Edital de Posse" disabled={!eleicaoSelecionada.data_posse} gerando={gerando === 'edital_posse'}
                onClick={() => gerarDoc('edital_posse', `Edital_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          {/* Grupo: Listas de Presença */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>📋 Listas de Presença</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📋" label={`Presença Eleição (${presEleicao.length})`} disabled={presEleicao.length === 0} gerando={gerando === 'lista_presenca_eleicao'}
                onClick={() => gerarDoc('lista_presenca_eleicao', `Lista_Presenca_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📋" label={`Presença Posse (${presPosse.length})`} disabled={presPosse.length === 0} gerando={gerando === 'lista_presenca_posse'}
                onClick={() => gerarDoc('lista_presenca_posse', `Lista_Presenca_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          {/* Grupo: Atas */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>📜 Atas</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📜" label="Ata de Eleição (Loja)" disabled={chapaEleita.length === 0} gerando={gerando === 'ata_eleicao_loja'}
                onClick={() => gerarDoc('ata_eleicao_loja', `Ata_Eleicao_Loja_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata de Eleição (Cartório)" disabled={chapaEleita.length === 0} gerando={gerando === 'ata_eleicao_cartorio'}
                onClick={() => gerarDoc('ata_eleicao_cartorio', `Ata_Eleicao_Cartorio_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📜" label="Ata de Posse" disabled={chapaEleita.length === 0 || !eleicaoSelecionada.data_posse} gerando={gerando === 'ata_posse'}
                onClick={() => gerarDoc('ata_posse', `Ata_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          {/* Grupo: Requerimentos */}
          <div style={S.card}>
            <h3 style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '1rem' }}>📩 Requerimentos ao Cartório</h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <BotaoDoc emoji="📩" label="Requerimento — Eleição" disabled={chapaEleita.length === 0} gerando={gerando === 'requerimento_eleicao'}
                onClick={() => gerarDoc('requerimento_eleicao', `Requerimento_Eleicao_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
              <BotaoDoc emoji="📩" label="Requerimento — Posse" disabled={chapaEleita.length === 0} gerando={gerando === 'requerimento_posse'}
                onClick={() => gerarDoc('requerimento_posse', `Requerimento_Posse_${eleicaoSelecionada.gestao?.replace('/', '_')}.docx`)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button style={S.btn('surface')} onClick={() => setEtapa(3)}>← Voltar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: Botão de documento ─────────────────
function BotaoDoc({ emoji, label, onClick, disabled, gerando }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || gerando}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.6rem 1.1rem', fontSize: '0.85rem', fontWeight: '600',
        color: disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
        background: disabled ? 'var(--color-surface-2)' : 'var(--color-surface-3)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !gerando) e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = disabled ? 'var(--color-text-muted)' : 'var(--color-text)'; }}
    >
      {gerando ? '⏳' : emoji} {gerando ? 'Gerando...' : label}
    </button>
  );
}
