/**
 * MÓDULO ELEIÇÃO & POSSE
 * ARLS Acácia de Paranatinga nº 30
 * 
 * Fluxo: Configurar → Sessão Eleição → Sessão Posse → Documentos
 * Gera: Editais, Atas (Loja e Cartório), Listas de Presença, Requerimentos
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, UnderlineType, BorderStyle, WidthType,
  Table, TableRow, TableCell, ShadingType, VerticalAlign,
} from 'docx';
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


// ─── Geração de documentos Word (.docx) ────────────────────
// Logo da loja embutido em base64 (extraído do documento modelo)

const LOGO_LOJA_B64 = "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";

const b64ToBuffer = (b64) => {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
};

const DOC_CFG = {
  W: 11906, H: 16838,
  mLeft: 1701, mRight: 863, mTop: 720, mBottom: 720,
};

const gerarDocx = async (tipo, eleicao, chapas, presencas, dadosLoja, irmaos) => {

  const chapaEleita = chapas.filter(c => c.eleita);
  const vmConvocante = irmaos.find(i => i.id === eleicao.vm_convocante_id);
  const secretario   = irmaos.find(i => i.id === eleicao.secretario_id);
  const presidente   = irmaos.find(i => i.id === eleicao.presidente_eleito_id);
  const gestao       = eleicao.gestao || '';
  const nomeLoja     = `ACÁCIA DE PARANATINGA Nº ${dadosLoja.numero_loja || '30'}`;
  const enderecoLoja = dadosLoja.endereco || 'Avenida Brasil, nº 2.300, bairro Jardim Panorama';
  const cidadeUF     = `${dadosLoja.cidade || 'Paranatinga'}/${dadosLoja.estado || 'MT'}`;
  const presEleicao  = presencas.filter(p => p.sessao === 'eleicao');
  const presPosse    = presencas.filter(p => p.sessao === 'posse');

  const dadoIrmao = (irmaoId) => {
    const i = irmaos.find(x => x.id === irmaoId);
    if (!i) return '[Irmão não encontrado]';

    // Nome do pai e da mãe vêm da relação pais[] com campo tipo='pai'/'mae'
    const paisArr  = i.pais || [];
    const nomePai  = paisArr.find(p => p.tipo === 'pai')?.nome || null;
    const nomeMae  = paisArr.find(p => p.tipo === 'mae')?.nome || null;
    const filiacao = (nomePai && nomeMae)
      ? `filho de ${nomePai} e ${nomeMae}`
      : nomePai ? `filho de ${nomePai}`
      : nomeMae ? `filho de ${nomeMae}`
      : null;

    // Endereço: campos separados endereco + cidade + estado
    const endParts = [i.endereco, i.cidade, i.estado].filter(Boolean);
    const endereco = endParts.length > 0 ? `residente e domiciliado na ${endParts.join(', ')}` : null;

    return [
      i.nome,
      i.nacionalidade || 'brasileiro',
      i.estado_civil  || null,
      i.profissao     || null,
      i.cidade        ? `natural de ${i.cidade}` : null,  // naturalidade = cidade de nascimento
      i.data_nascimento ? `nascido em ${formatarData(i.data_nascimento)}` : null,
      filiacao,
      i.rg  ? `portador da Cédula de Identidade RG sob nº ${i.rg}` : null,
      i.cpf ? `CPF/MF nº ${i.cpf}` : null,
      endereco,
    ].filter(Boolean).join(', ');
  };

  // ─── Helpers ──────────────────────────────────────────────
  const ar = (txt, opts = {}) => new TextRun({
    text: String(txt ?? ''),
    font: 'Arial',
    size: opts.size || 24,
    bold: opts.bold || false,
    italics: opts.italic || false,
  });

  const pr = (runs, opts = {}) => new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: opts.line ?? 276 },
    indent: opts.firstLine ? { firstLine: 709 } : undefined,
    children: Array.isArray(runs) ? runs : [runs],
  });

  const prC = (runs, opts = {}) => pr(runs, { ...opts, align: AlignmentType.CENTER });
  const prL = (runs, opts = {}) => pr(runs, { ...opts, align: AlignmentType.LEFT });

  const assinatura = (nome, cargo) => [
    prC([ar('___________________________________________')], { before: 500, after: 40 }),
    prC([ar(nome, { bold: true })], { before: 0, after: 20 }),
    prC([ar(cargo)], { before: 0, after: 200 }),
  ];

  // ─── Cabeçalho ────────────────────────────────────────────
  const logoImg = () => new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [
      new ImageRun({
        type: 'jpg',
        data: b64ToBuffer(LOGO_LOJA_B64),
        transformation: { width: 108, height: 108 },
        floating: {
          horizontalPosition: { offset: 5140827 }, // centralizado na área útil
          verticalPosition:   { offset: 180000 },
          wrap: { type: 'none' },
          behindDocument: false,
        },
      }),
    ],
  });

  const cabecalho = () => [
    logoImg(),
    // Parágrafo vazio pequeno para empurrar o texto abaixo do logo
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [ar('')] }),
    prC([
      ar('AUG', { bold: true, size: 26 }),
      ar('∴', { size: 26 }),
      ar(' E RESP', { bold: true, size: 26 }),
      ar('∴', { size: 26 }),
      ar(' LOJA SIMB', { bold: true, size: 26 }),
      ar('∴', { size: 26 }),
      ar(` ${nomeLoja}`, { bold: true, size: 26 }),
    ], { before: 1440, after: 40, line: 276 }),  // before=1440 ≈ 2.5cm — desce abaixo do logo
    prC([ar(`Fundado em ${dadosLoja.data_fundacao ? formatarData(dadosLoja.data_fundacao) : '20/12/1997'}`, { bold: true, size: 22 })], { before: 0, after: 40 }),
    prC([ar('SOB OS AUSPÍCIOS DA SERENÍSSIMA GRANDE LOJA MAÇÔNICA DO ESTADO DE MATO GROSSO', { bold: true, size: 22 })], { before: 0, after: 280 }),
  ];

  // ─── Lista eleitos ─────────────────────────────────────────
  const listaEleitos = () => chapaEleita
    .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
    .map(c => pr([
      ar(`${c.cargo}: `, { bold: true }),
      ar(dadoIrmao(c.irmao_id) + ';'),
    ], { firstLine: true, before: 80, after: 80 }));

  const pageCfg = {
    size:   { width: DOC_CFG.W, height: DOC_CFG.H },
    margin: { top: DOC_CFG.mTop, right: DOC_CFG.mRight, bottom: DOC_CFG.mBottom, left: DOC_CFG.mLeft },
  };

  let children = [];

  // ══════════════════════════════════════════════════════════
  if (tipo === 'edital_eleicao') {
    children = [
      ...cabecalho(),
      prC([ar('Edital de Convocação para Eleição', { bold: true })], { before: 0, after: 200 }),
      pr([
        ar('Na qualidade de Venerável Mestre, Sr. '),
        ar(`${vmConvocante?.nome || '[VM]'} `, { bold: true }),
        ar(`, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica ${nomeLoja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Eleição do Corpo Administrativo da Augusta e Respeitável Loja Simbólica ${nomeLoja} – Gestão ${gestao}, a realizar-se no dia ${formatarData(eleicao.data_eleicao)}, às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.`),
      ], { firstLine: true, before: 0, after: 200 }),
      prC([ar(`${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${formatarDataExtenso(eleicao.data_edital_eleicao)}.`)], { before: 200, after: 0 }),
      ...assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'edital_posse') {
    children = [
      ...cabecalho(),
      prC([ar('Edital de Convocação para Posse', { bold: true })], { before: 0, after: 200 }),
      pr([
        ar('Na qualidade de Venerável Mestre, Sr. '),
        ar(`${vmConvocante?.nome || '[VM]'} `, { bold: true }),
        ar(`, os Mestres Maçons ativos e regulares do Quadro desta Augusta e Respeitável Loja Simbólica ${nomeLoja}, que estejam aptos ao exercício do voto nos termos da Constituição e do Regulamento Geral, estão CONVOCADOS, por este Edital, para a Sessão Ordinária de Posse do Corpo Administrativo da Augusta e Respeitável Loja Simbólica ${nomeLoja} – Gestão ${gestao}, a realizar-se no dia ${formatarData(eleicao.data_posse)}, às ${eleicao.hora_posse?.substring(0,5) || '20:00'} horas nas dependências do nosso Templo, conforme estabelece o Artigo 187 do Regulamento Geral.`),
      ], { firstLine: true, before: 0, after: 200 }),
      prC([ar(`${dadosLoja.cidade || 'Paranatinga'} – ${dadosLoja.estado || 'MT'}, ${formatarDataExtenso(eleicao.data_edital_posse)}.`)], { before: 200, after: 0 }),
      ...assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_loja') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const trechoVotacao = eleicao.tipo_votacao === 'aclamacao'
      ? 'por se tratar de chapa única, não houve composição de mesa eleitoral, motivo pelo qual, a votação foi por aclamação sendo aprovado a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.'
      : 'foi constituída mesa eleitoral, procedendo-se à votação por meio de escrutínio secreto, tendo sido eleita a chapa vencedora por maioria dos presentes, conforme constam suas assinaturas na folha de votação (anexo).';
    children = [
      pr([
        ar('ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ELEIÇÃO', { bold: true }),
        ar(` DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO `, { bold: true }),
        ar(gestao, { bold: true }),
      ], { align: AlignmentType.CENTER, before: 0, after: 240 }),
      pr([ar(`Aos ${formatarData(eleicao.data_eleicao)} da era vulgar, às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas, reuniram-se em Sessão ordinária, para eleição dos cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do Regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico e artigo 3º, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}, na sua sede, localizada na ${enderecoLoja}, cidade de ${cidadeUF}. Preenchidos os lugares em Loja, os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete, dispensando-se a Leitura da Ata e Expedientes. Constou-se na ordem do dia a eleição da diretoria da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}, bem como o Respeitabilíssimo Mestre determinou ao Irmão Secretário que procedesse a leitura do Edital de Convocação, no qual a convocação dos Irmãos Mestres da Loja para eleição da diretoria da Loja para o exercício de ${eleicao.gestao}. Os trabalhos foram presididos pelo Venerável Mestre (Presidente) ${vmConvocante?.nome || '[VM]'}, e pelos membros, ${oradorNome} e ${secretario?.nome || '[Secretário]'}, Orador e Secretário, respectivamente, ${trechoVotacao} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa única que ficou composta dos seguintes cargos e seus membros e comissões:`)],
        { firstLine: true, before: 0, after: 80 }),
      ...listaEleitos(),
      pr([ar(`Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_eleicao)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.`)],
        { firstLine: true, before: 160, after: 0 }),
      ...assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre'),
      ...assinatura(oradorNome, 'Orador'),
      ...assinatura(secretario?.nome || '[Secretário]', 'Secretário'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_eleicao_cartorio') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const trechoMesa = eleicao.tipo_votacao === 'aclamacao'
      ? `por se tratar de chapa única, não houve composição de mesa eleitoral. Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presEleicao.length} membros votantes, 1/3 do quórum mínimo exigido para aprovação pelo estatuto, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. Então, por ordem do Venerável Mestre (Presidente), foi votado por aclamação sendo aprovado a chapa única por todos os membros presentes, conforme constam suas assinaturas na folha de votação (anexo), sem nenhuma objeção ou abstenção.`
      : `foi constituída mesa eleitoral para o escrutínio secreto. Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presEleicao.length} membros votantes, declarados pelo Chanceler e Tesoureiro como aptos ao exercício do voto. A votação foi realizada e a chapa vencedora foi eleita por maioria dos presentes.`;
    children = [
      pr([
        ar('ATA DA SESSÃO ORDINÁRIA DE ELEIÇÃO', { bold: true }),
        ar(` DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO `, { bold: true }),
        ar(gestao, { bold: true }),
      ], { align: AlignmentType.CENTER, before: 0, after: 240 }),
      pr([ar(`Aos ${formatarData(eleicao.data_eleicao)} (E∴ V∴), às ${eleicao.hora_eleicao?.substring(0,5) || '20:00'} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de ${dadosLoja.cidade || 'Paranatinga'}, Estado de ${dadosLoja.estado || 'Mato Grosso'}, na ${enderecoLoja}, cidade de ${cidadeUF}, no Templo os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica ${nomeLoja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em SESSÃO ORDINÁRIA, para o fim especial de realizarem as eleições para os cargos de Venerável Mestre (Presidente) e Membros da Diretoria, em cumprimento ao disposto no artigo 187 do regulamento Geral da Ordem e em conformidade com os artigos 37 e 46 do Código Eleitoral Maçônico, e artigos 29, 30, 31, 32, 33, 34 do Estatuto da Augusta e Respeitável Loja Simbólica Acácia de Paranatinga nº ${dadosLoja.numero_loja || '30'}.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Presentes os irmãos que preencheram os cargos, estando todos revestidos de suas insígnias, sob a presidência do Venerável Mestre (Presidente) ${vmConvocante?.nome || '[VM]'}, e pelos membros, ${oradorNome} e ${secretario?.nome || '[Secretário]'}, Orador e Secretário, respectivamente, estando os demais cargos regularmente constituídos.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre, dispensando-se a Leitura da Ata e Expedientes. Após a abertura dos trabalhos foi determinado ao Irmão Secretário que procedesse a leitura do Edital de Convocação para Eleição, no qual constou a convocação dos Irmãos Mestres da Loja para eleição da diretoria da Loja para o Exercício ${gestao}.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Estavam presentes à sessão ${eleicao.num_votantes_eleicao || presEleicao.length} membros votantes, conforme a lista de presença, e que foram declarados pelos Irmãos Chanceler e Tesoureiro como aptos ao exercício do voto.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Então, por ordem do Venerável Mestre (Presidente) e ${trechoMesa} Em seguida o Venerável Mestre (Presidente) anunciou a aprovação da chapa única que ficou composta dos seguintes cargos e seus membros e comissões:`)],
        { firstLine: true, before: 0, after: 80 }),
      ...listaEleitos(),
      pr([ar(`Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_eleicao)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.`)],
        { firstLine: true, before: 160, after: 0 }),
      ...assinatura(vmConvocante?.nome || '[VM]', 'Venerável Mestre'),
      ...assinatura(oradorNome, 'Orador'),
      ...assinatura(secretario?.nome || '[Secretário]', 'Secretário'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'ata_posse') {
    const orador = chapaEleita.find(c => c.cargo === 'Orador');
    const oradorNome = orador ? (irmaos.find(i => i.id === orador.irmao_id)?.nome || '[Orador]') : '[Orador]';
    const vmEleito = chapaEleita.find(c => c.cargo === 'Veneravel Mestre' || c.cargo === 'Venerável Mestre');
    const vmEleitoNome = vmEleito ? (irmaos.find(i => i.id === vmEleito.irmao_id)?.nome || '[VM Eleito]') : '[VM Eleito]';
    children = [
      pr([
        ar('ATA DA SESSÃO ORDINÁRIA DE POSSE', { bold: true }),
        ar(` DA DIRETORIA DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO `, { bold: true }),
        ar(gestao, { bold: true }),
      ], { align: AlignmentType.CENTER, before: 0, after: 240 }),
      pr([ar(`Aos ${formatarData(eleicao.data_posse)} (E∴ V∴), às ${eleicao.hora_posse?.substring(0,5) || '20:00'} horas, atendendo à convocação feita por Edital, reuniram-se no Oriente de ${dadosLoja.cidade || 'Paranatinga'}, Estado de ${dadosLoja.estado || 'Mato Grosso'}, na ${enderecoLoja}, cidade de ${cidadeUF}, no Templo, os Mestres Maçons e membros ativos do Quadro da Augusta e Respeitável Loja Simbólica ${nomeLoja}, sob os auspícios da Sereníssima Grande Loja Maçônica do Estado de Mato Grosso – GLEMT, em SESSÃO ORDINÁRIA, para o fim especial de realizarem a POSSE da nova diretoria eleita para a Gestão ${gestao}.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Os trabalhos foram abertos em Grau de Mestre Maçom com um simples golpe de malhete pelo Venerável Mestre ${vmConvocante?.nome || '[VM]'}, dispensando-se a Leitura da Ata e Expedientes. Estavam presentes à sessão ${eleicao.num_votantes_posse || presPosse.length} membros, conforme lista de presença.`)],
        { firstLine: true, before: 0, after: 80 }),
      pr([ar(`Procedeu-se então à cerimônia de posse e instalação dos novos dirigentes para a Gestão ${gestao}, tomando posse os seguintes membros:`)],
        { firstLine: true, before: 0, after: 80 }),
      ...chapaEleita
        .sort((a, b) => ORDEM_CARGOS.indexOf(a.cargo) - ORDEM_CARGOS.indexOf(b.cargo))
        .map(c => pr([
          ar(`${c.cargo}: `, { bold: true }),
          ar(irmaos.find(i => i.id === c.irmao_id)?.nome || '[Irmão]'),
        ], { firstLine: true, before: 60, after: 60 })),
      pr([ar(`Esta Ata é o que foi deliberado em Assembleia da Loja, em ${formatarData(eleicao.data_posse)}, e é de responsabilidade dos dirigentes e de todos os participantes. Nada mais foi tratado. Eu, ${secretario?.nome || '[Secretário]'} (Secretário), lavrei a presente Ata que vai assinada pelo Venerável Mestre, Orador e Secretário. Os trabalhos foram encerrados com um simples golpe de malhete.`)],
        { firstLine: true, before: 160, after: 0 }),
      ...assinatura(vmConvocante?.nome || '[VM sainte]', 'Venerável Mestre Instalador'),
      ...assinatura(vmEleitoNome, 'Venerável Mestre Empossado'),
      ...assinatura(secretario?.nome || '[Secretário]', 'Secretário'),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'lista_presenca_eleicao' || tipo === 'lista_presenca_posse') {
    const sessaoNome = tipo === 'lista_presenca_eleicao' ? 'Eleição' : 'Posse';
    const dataDoc    = tipo === 'lista_presenca_eleicao' ? eleicao.data_eleicao : eleicao.data_posse;
    const lista      = tipo === 'lista_presenca_eleicao' ? presEleicao : presPosse;
    const thinBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
    const borders    = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
    const pad        = { top: 80, bottom: 80, left: 120, right: 120 };
    const CW         = [500, 4800, 1600, 2442];
    children = [
      ...cabecalho(),
      prC([ar(`Lista de Presença — Sessão de ${sessaoNome}`, { bold: true })], { before: 0, after: 80 }),
      prC([ar(`Gestão: ${gestao}     Data: ${formatarData(dataDoc)}`)], { before: 0, after: 160 }),
      new Table({
        width: { size: DOC_CFG.W - DOC_CFG.mLeft - DOC_CFG.mRight, type: WidthType.DXA },
        columnWidths: CW,
        rows: [
          new TableRow({ tableHeader: true, children: [
            new TableCell({ borders, width: { size: CW[0], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Nº', { bold: true })], { align: AlignmentType.CENTER })] }),
            new TableCell({ borders, width: { size: CW[1], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Nome', { bold: true })])] }),
            new TableCell({ borders, width: { size: CW[2], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('CIM', { bold: true })])] }),
            new TableCell({ borders, width: { size: CW[3], type: WidthType.DXA }, margins: pad, shading: { fill: 'D9D9D9', type: ShadingType.CLEAR }, children: [pr([ar('Assinatura', { bold: true })])] }),
          ]}),
          ...[...lista, ...Array(5).fill(null)].map((p, idx) => {
            const i = p ? irmaos.find(x => x.id === p.irmao_id) : null;
            return new TableRow({ children: [
              new TableCell({ borders, width: { size: CW[0], type: WidthType.DXA }, margins: pad, children: [pr([ar(p ? String(idx+1) : '')], { align: AlignmentType.CENTER })] }),
              new TableCell({ borders, width: { size: CW[1], type: WidthType.DXA }, margins: pad, children: [pr([ar(i?.nome || '')])] }),
              new TableCell({ borders, width: { size: CW[2], type: WidthType.DXA }, margins: pad, children: [pr([ar(i?.cim || '')])] }),
              new TableCell({ borders, width: { size: CW[3], type: WidthType.DXA }, margins: pad, children: [pr([ar('')])] }),
            ]});
          }),
        ],
      }),
      prL([ar(`Total de presentes: ${lista.length}`)], { before: 120, after: 0 }),
    ];
  }

  // ══════════════════════════════════════════════════════════
  else if (tipo === 'requerimento_eleicao' || tipo === 'requerimento_posse') {
    const tipoAta  = tipo === 'requerimento_eleicao' ? 'ELEIÇÃO' : 'POSSE DA DIRETORIA';
    const dataReq  = eleicao.data_posse || eleicao.data_eleicao;
    const secDados = secretario ? dadoIrmao(eleicao.secretario_id) : '[Secretário]';
    const trechoReg = tipo === 'requerimento_eleicao'
      ? ` em Pessoas Jurídicas dessa Serventia, junto ao registro sob nº ${dadosLoja.numero_registro_cartorio || '04, do Livro A-01'}, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.`
      : ` em Pessoas Jurídicas dessa Serventia, com base no que expressa o teor do disposto nos Art. 114 a 121 da Lei 6.015/73 que rege os Registros Públicos.`;
    children = [
      prL([ar(dadosLoja.nome_cartorio || 'ILMª. SRª. TABELIÃ DO CARTÓRIO DE NOTAS, PROTESTO DE TÍTULOS, REGISTRO CIVIL DAS PESSOAS NATURAIS E JURÍDICAS DE PARANATINGA - MT – 2º SERVIÇO NOTORIAL E REGISTRAL', { bold: true })],
        { before: 0, after: 200 }),
      pr([
        ar(`AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}`, { bold: true }),
        ar(', pessoa jurídica de direito privado, inscrita no CNPJ/MF '),
        ar(dadosLoja.cnpj || '[CNPJ]', { bold: true }),
        ar(`, com sede localizada na ${enderecoLoja}, cidade de ${cidadeUF}, representada pelo seu secretário, Sr. ${secDados}. Vem com o devido respeito à presença de Vossa Senhoria, `),
        ar('REQUERER', { bold: true }),
        ar(', que digne em proceder com a averbação da '),
        ar(`ATA DA ASSEMBLEIA GERAL ORDINÁRIA DE ${tipoAta} DA AUGUSTA E RESPEITÁVEL LOJA SIMBÓLICA ${nomeLoja}, PARA O PERÍODO ${gestao}`, { bold: true }),
        ar(trechoReg),
      ], { firstLine: true, before: 0, after: 200 }),
      prC([ar(`${dadosLoja.cidade || 'Paranatinga'}, ${formatarDataExtenso(dataReq)}.`)], { before: 200, after: 0 }),
      ...assinatura(presidente?.nome || '[Presidente]', 'Presidente'),
    ];
  }

  // ─── Montar documento ─────────────────────────────────────
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    sections: [{ properties: { page: pageCfg }, children }],
  });

  return Packer.toBlob(doc);
};

// ─── Download helper ──────────────────────────────────────────
const downloadDocx = (blob, nomeArquivo) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
};

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

  // Filtra irmãos aptos para um determinado ato (eleição ou posse)
  // Regra: situação deve ser regular/licenciado/irregular na data do ato
  // Exclui: falecido/desligado/excluido/ex_oficio/suspenso
  // E se tiver data_falecimento ou data_desligamento anterior à data do ato, também exclui
  const irmaosAptosParaAto = (dataAto) => {
    const situacoesAptas = ['regular', 'licenciado', 'irregular'];
    return (irmaos || []).filter(i => {
      // Situação deve ser apta
      const sit = (i.situacao || 'regular').toLowerCase();
      if (!situacoesAptas.includes(sit)) return false;
      // Se há data do ato, verifica datas de saída
      if (dataAto) {
        const dAto = new Date(dataAto + 'T00:00:00');
        if (i.data_falecimento) {
          const dFal = new Date(i.data_falecimento + 'T00:00:00');
          if (dFal <= dAto) return false;
        }
        if (i.data_desligamento) {
          const dDes = new Date(i.data_desligamento + 'T00:00:00');
          if (dDes <= dAto) return false;
        }
      }
      return true;
    });
  };

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
      const payload = {
        ...form,
        status: 'rascunho',
        vm_convocante_id:    form.vm_convocante_id    || null,
        secretario_id:       form.secretario_id       || null,
        presidente_eleito_id:form.presidente_eleito_id|| null,
        data_eleicao:        form.data_eleicao        || null,
        data_edital_eleicao: form.data_edital_eleicao || null,
        data_posse:          form.data_posse          || null,
        data_edital_posse:   form.data_edital_posse   || null,
        hora_eleicao:        form.hora_eleicao        || null,
        hora_posse:          form.hora_posse          || null,
      };
      const { data, error } = await supabase
        .from('eleicoes')
        .insert([payload])
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
    // Sanitiza strings vazias em campos BIGINT e DATE
    const camposSanitizados = Object.fromEntries(
      Object.entries(campos).map(([k, v]) => [k, v === '' ? null : v])
    );
    try {
      const { data, error } = await supabase
        .from('eleicoes')
        .update(camposSanitizados)
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
              {irmaosAptosParaAto(eleicaoSelecionada.data_eleicao)
                .filter(i => {
                  // Apenas Mestres: deve ter data_exaltacao anterior ou igual à data do ato
                  if (!i.data_exaltacao) return false;
                  if (eleicaoSelecionada.data_eleicao) {
                    return new Date(i.data_exaltacao + 'T00:00:00') <= new Date(eleicaoSelecionada.data_eleicao + 'T00:00:00');
                  }
                  return true;
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
              {irmaosAptosParaAto(eleicaoSelecionada.data_posse)
                .filter(i => {
                  if (!i.data_exaltacao) return false;
                  if (eleicaoSelecionada.data_posse) {
                    return new Date(i.data_exaltacao + 'T00:00:00') <= new Date(eleicaoSelecionada.data_posse + 'T00:00:00');
                  }
                  return true;
                })
                .map(i => {
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
