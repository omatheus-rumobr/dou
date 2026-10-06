/**
 * Dados de demonstração do DOU.
 * Gera publicações fictícias para os últimos 90 dias (edições regulares e extras).
 * Substitua `DouData.dou` e `DouData.extra` pelos dados reais da sua API mantendo o mesmo formato.
 */
const DouData = (() => {
  // Gerador pseudoaleatório com semente fixa: os dados são os mesmos a cada carregamento.
  let semente = 20261005;
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647;
    return (semente - 1) / 2147483646;
  };
  const sortear = lista => lista[Math.floor(aleatorio() * lista.length)];
  const entre = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));

  const ORGAOS = [
    'Presidência da República',
    'Ministério da Saúde',
    'Ministério da Fazenda',
    'Ministério da Educação',
    'Ministério da Justiça e Segurança Pública',
    'Ministério do Trabalho e Emprego',
    'Ministério de Minas e Energia',
    'Ministério da Agricultura e Pecuária',
    'Banco Central do Brasil',
    'Agência Nacional de Vigilância Sanitária',
    'Agência Nacional de Energia Elétrica',
    'Instituto Nacional do Seguro Social'
  ];

  const TIPOS_POR_SECAO = {
    1: ['Portaria', 'Decreto', 'Resolução', 'Instrução Normativa', 'Lei'],
    2: ['Nomeação', 'Exoneração', 'Designação', 'Aposentadoria'],
    3: ['Aviso de Licitação', 'Extrato de Contrato', 'Edital', 'Aviso de Homologação']
  };

  const EMENTAS = {
    'Portaria': ['Estabelece procedimentos para a execução de programas no âmbito do órgão.', 'Aprova o regimento interno e dá outras providências.', 'Dispõe sobre a habilitação de unidades para o recebimento de recursos federais.'],
    'Decreto': ['Regulamenta dispositivos da legislação vigente e dá outras providências.', 'Altera o decreto que dispõe sobre a estrutura regimental do órgão.', 'Institui comitê interministerial para acompanhamento de políticas públicas.'],
    'Resolução': ['Dispõe sobre critérios técnicos e operacionais aplicáveis ao setor regulado.', 'Aprova normas complementares de fiscalização.', 'Atualiza os parâmetros de cálculo para o exercício corrente.'],
    'Instrução Normativa': ['Disciplina os procedimentos de prestação de informações ao órgão.', 'Estabelece regras para o cadastramento e a manutenção de registros.', 'Altera prazos de entrega de declarações obrigatórias.'],
    'Lei': ['Altera a legislação vigente para dispor sobre novas diretrizes nacionais.', 'Institui data comemorativa no calendário oficial.', 'Abre crédito especial ao Orçamento Fiscal da União.'],
    'Nomeação': ['Nomeia servidor para exercer cargo em comissão.', 'Nomeia candidatos aprovados em concurso público.'],
    'Exoneração': ['Exonera, a pedido, servidor do cargo em comissão que ocupa.', 'Exonera servidor de função comissionada executiva.'],
    'Designação': ['Designa servidor para exercer a função de substituto eventual.', 'Designa membros para compor comissão de avaliação.'],
    'Aposentadoria': ['Concede aposentadoria voluntária a servidor do quadro permanente.', 'Concede aposentadoria por invalidez nos termos da legislação vigente.'],
    'Aviso de Licitação': ['Pregão eletrônico para aquisição de equipamentos de tecnologia da informação.', 'Pregão eletrônico para contratação de serviços de manutenção predial.', 'Concorrência para execução de obras de engenharia.'],
    'Extrato de Contrato': ['Contratação de serviços continuados de apoio administrativo.', 'Aquisição de material de consumo para atendimento das unidades.', 'Prestação de serviços de comunicação de dados.'],
    'Edital': ['Torna pública a abertura de inscrições para processo seletivo.', 'Divulga o resultado final de chamamento público.'],
    'Aviso de Homologação': ['Homologa o resultado de pregão eletrônico e adjudica o objeto.', 'Homologa o resultado de concorrência pública.']
  };

  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const porExtenso = d => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const DIAS = 90;
  const dou = [];
  const extra = [];
  let id = 1;

  function criarAto(data, secao, edicao, pagina, ehExtra) {
    const tipo = sortear(TIPOS_POR_SECAO[secao]);
    const numero = entre(1, 2999).toLocaleString('pt-BR');
    return {
      id: id++,
      data,
      secao,
      edicao,
      extra: ehExtra,
      pagina,
      orgao: sortear(ORGAOS),
      tipo,
      titulo: `${tipo.toUpperCase()} Nº ${numero}, DE ${porExtenso(data).toUpperCase()}`,
      ementa: sortear(EMENTAS[tipo])
    };
  }

  for (let i = DIAS - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - i);
    const diaSemana = data.getDay();
    const numeroEdicao = 100 + Math.floor((data - new Date(data.getFullYear(), 0, 1)) / 86400000);

    // Edições regulares: dias úteis, três seções.
    if (diaSemana !== 0 && diaSemana !== 6) {
      [[1, 8, 18], [2, 6, 14], [3, 10, 20]].forEach(([secao, min, max]) => {
        let pagina = 1;
        for (let n = entre(min, max); n > 0; n--) {
          dou.push(criarAto(data, secao, String(numeroEdicao), pagina, false));
          pagina += entre(0, 2);
        }
      });
    }

    // Edições extras: ocorrem em cerca de 35% dos dias, inclusive fins de semana.
    if (aleatorio() < 0.35) {
      const qtdEdicoes = aleatorio() < 0.2 ? 2 : 1;
      for (let e = 0; e < qtdEdicoes; e++) {
        const letra = 'ABC'[e];
        const secao = aleatorio() < 0.75 ? 1 : 2;
        for (let n = entre(2, 8), pagina = 1; n > 0; n--, pagina++) {
          extra.push(criarAto(data, secao, `${numeroEdicao}-${letra}`, pagina, true));
        }
      }
    }
  }

  // Mais recentes primeiro.
  const ordenar = lista => lista.sort((a, b) => b.data - a.data || a.secao - b.secao || a.pagina - b.pagina);

  return {
    hoje,
    ORGAOS,
    dou: ordenar(dou),
    extra: ordenar(extra)
  };
})();
