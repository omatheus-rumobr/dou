/* ===================== Utilitários ===================== */
const fmtData = d => d.toLocaleDateString('pt-BR');
const fmtNum = n => n.toLocaleString('pt-BR');
const fmtDec = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeSecao = ato => `Seção ${ato.secao}${ato.extra ? ' – Extra' : ''}`;

function renderKpis(container, kpis) {
  container.innerHTML = kpis.map(k => `
    <div class="col-6 col-xl-3">
      <div class="kpi d-flex justify-content-between align-items-start gap-2">
        <div class="min-w-0">
          <div class="kpi-rotulo">${k.rotulo}</div>
          <div class="kpi-valor ${k.texto ? 'texto' : ''}">${escapar(k.valor)}</div>
        </div>
        <i class="bi ${k.icone} kpi-icone"></i>
      </div>
    </div>`).join('');
}

/* ===================== Modal de detalhes ===================== */
const modalAto = new bootstrap.Modal(document.getElementById('modal-ato'));
let atoSelecionado = null;

function abrirAto(ato) {
  atoSelecionado = ato;
  // Campos ausentes na origem (ex.: órgão e página na API do DOU) são omitidos.
  const campos = [
    ['Data de publicação', fmtData(ato.data)],
    ['Edição', ato.edicao],
    ['Seção', nomeSecao(ato)],
    ['Página', ato.pagina],
    ['Órgão', ato.orgao],
    ['Tipo de ato', ato.tipo]
  ].filter(([, v]) => v != null && v !== '');
  document.getElementById('modal-ato-titulo').textContent = ato.titulo;
  document.getElementById('modal-ato-corpo').innerHTML = `
    <div class="row g-3 mb-3">
      ${campos.map(([r, v]) => `
        <div class="col-6 col-md-4">
          <div class="detalhe-rotulo">${r}</div>
          <div class="detalhe-valor">${escapar(v)}</div>
        </div>`).join('')}
    </div>
    ${ato.conteudo
      ? `<div class="detalhe-rotulo">Conteúdo</div>
         <p class="mb-0 conteudo-ato">${escapar(ato.conteudo)}</p>`
      : `<div class="detalhe-rotulo">Ementa</div>
         <p class="mb-0">${escapar(ato.ementa)}</p>`}`;

  const link = document.getElementById('modal-ato-link');
  link.classList.toggle('d-none', !ato.url);
  if (ato.url) link.href = ato.url;
  else link.removeAttribute('href');

  modalAto.show();
}

document.getElementById('modal-ato-copiar').addEventListener('click', async e => {
  if (!atoSelecionado) return;
  const a = atoSelecionado;
  const ref = `${[a.titulo, a.orgao].filter(Boolean).join(' – ')}. Diário Oficial da União, edição ${a.edicao}, ${nomeSecao(a)}`
    + `${a.pagina ? `, p. ${a.pagina}` : ''}, ${fmtData(a.data)}.${a.url ? ` Disponível em: ${a.url}` : ''}`;
  try {
    await navigator.clipboard.writeText(ref);
    e.currentTarget.innerHTML = '<i class="bi bi-check2 me-1"></i>Copiado!';
  } catch {
    e.currentTarget.innerHTML = '<i class="bi bi-x me-1"></i>Não foi possível copiar';
  }
  const botao = e.currentTarget;
  setTimeout(() => { botao.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copiar referência'; }, 2000);
});

/* ===================== Listagens (DOU e DOU Extra) ===================== */
// `colunas` define as células finais de cada linha e o layout do CSV (ver COLUNAS_DOU).
function criarListagem(prefixo, base, colunas) {
  const el = id => document.getElementById(`${prefixo}-${id}`);
  // Filtros são opcionais: a aba pode não ter todos os campos (ex.: DOU sem órgão).
  const valor = id => el(id)?.value ?? '';
  const FILTROS = ['busca', 'secao', 'tipo', 'orgao', 'de', 'ate'].filter(id => el(id));
  const POR_PAGINA = 15;
  let pagina = 1;
  let filtrados = base;

  // Preenche os selects a partir dos próprios dados.
  const preencher = (select, valores) => {
    if (!select) return;
    select.insertAdjacentHTML('beforeend', valores.map(v => `<option value="${escapar(v)}">${escapar(v)}</option>`).join(''));
  };
  preencher(el('secao'), [...new Set(base.map(nomeSecao))].sort());
  preencher(el('tipo'), [...new Set(base.map(a => a.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  preencher(el('orgao'), [...new Set(base.map(a => a.orgao))].sort((a, b) => a.localeCompare(b, 'pt-BR')));

  function filtrar() {
    const busca = normalizar(valor('busca').trim());
    const secao = valor('secao');
    const tipo = valor('tipo');
    const orgao = valor('orgao');
    const de = valor('de');
    const ate = valor('ate');

    filtrados = base.filter(a => {
      const dia = isoLocal(a.data);
      return (!secao || nomeSecao(a) === secao)
        && (!tipo || a.tipo === tipo)
        && (!orgao || a.orgao === orgao)
        && (!de || dia >= de)
        && (!ate || dia <= ate)
        && (!busca || normalizar(`${a.titulo} ${a.conteudo ?? a.ementa} ${a.orgao ?? ''}`).includes(busca));
    });
    pagina = 1;
    render();
  }

  function render() {
    const edicoes = new Set(filtrados.map(a => a.edicao)).size;
    const ultima = filtrados[0];
    renderKpis(el('kpis'), [
      { rotulo: 'Publicações', valor: fmtNum(filtrados.length), icone: 'bi-file-earmark-text' },
      { rotulo: prefixo === 'extra' ? 'Edições extras' : 'Edições', valor: fmtNum(edicoes), icone: 'bi-journals' },
      { rotulo: 'Média por edição', valor: edicoes ? fmtDec(filtrados.length / edicoes) : '0', icone: 'bi-graph-up' },
      { rotulo: 'Última publicação', valor: ultima ? fmtData(ultima.data) : '—', icone: 'bi-calendar-event' }
    ]);

    el('contagem').textContent = fmtNum(filtrados.length);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    pagina = Math.min(pagina, totalPaginas);
    const inicio = (pagina - 1) * POR_PAGINA;
    const itens = filtrados.slice(inicio, inicio + POR_PAGINA);

    el('tabela').innerHTML = itens.length
      ? itens.map(a => `
        <tr data-id="${a.id}" tabindex="0">
          <td class="text-nowrap">${fmtData(a.data)}</td>
          <td class="text-nowrap">${escapar(a.edicao)}</td>
          <td class="text-nowrap"><span class="badge ${a.extra ? 'badge-extra' : 'badge-secao'}">${escapar(nomeSecao(a))}</span></td>
          <td>
            <div class="titulo-ato">${escapar(a.titulo)}</div>
            <div class="ementa-ato">${escapar(a.ementa)}</div>
          </td>${colunas.celulas(a)}
        </tr>`).join('')
      : `<tr><td colspan="6" class="text-center text-muted py-5"><i class="bi bi-inbox d-block fs-2 mb-2"></i>Nenhuma publicação encontrada com os filtros selecionados.</td></tr>`;

    el('info').textContent = filtrados.length
      ? `Exibindo ${fmtNum(inicio + 1)}–${fmtNum(inicio + itens.length)} de ${fmtNum(filtrados.length)}`
      : '';

    renderPaginacao(totalPaginas);
  }

  function renderPaginacao(total) {
    const botao = (rotulo, alvo, { ativo = false, desabilitado = false, aria = '' } = {}) => `
      <li class="page-item ${ativo ? 'active' : ''} ${desabilitado ? 'disabled' : ''}">
        <button class="page-link" data-pagina="${alvo}" ${aria ? `aria-label="${aria}"` : ''}>${rotulo}</button>
      </li>`;

    const paginas = new Set([1, total, pagina - 1, pagina, pagina + 1].filter(p => p >= 1 && p <= total));
    const ordenadas = [...paginas].sort((a, b) => a - b);

    let html = botao('&laquo;', pagina - 1, { desabilitado: pagina === 1, aria: 'Anterior' });
    ordenadas.forEach((p, i) => {
      if (i > 0 && p - ordenadas[i - 1] > 1) html += '<li class="page-item disabled"><span class="page-link">…</span></li>';
      html += botao(p, p, { ativo: p === pagina });
    });
    html += botao('&raquo;', pagina + 1, { desabilitado: pagina === total, aria: 'Próxima' });
    el('paginacao').innerHTML = html;
  }

  function exportarCsv() {
    const csv = [colunas.csvCabecalho, ...filtrados.map(colunas.csvLinha)]
      .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${prefixo === 'extra' ? 'dou-extra' : 'dou'}-${isoLocal(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Eventos
  let atraso;
  el('busca').addEventListener('input', () => { clearTimeout(atraso); atraso = setTimeout(filtrar, 250); });
  FILTROS.filter(id => id !== 'busca').forEach(id => el(id).addEventListener('change', filtrar));

  el('limpar').addEventListener('click', () => {
    FILTROS.forEach(id => { el(id).value = ''; });
    filtrar();
  });
  el('exportar').addEventListener('click', exportarCsv);

  el('paginacao').addEventListener('click', e => {
    const alvo = e.target.closest('[data-pagina]');
    if (!alvo || alvo.parentElement.classList.contains('disabled')) return;
    pagina = Number(alvo.dataset.pagina);
    render();
  });

  const abrirLinha = e => {
    if (e.target.closest('a')) return; // links externos da linha não abrem o modal
    const linha = e.target.closest('tr[data-id]');
    if (linha) abrirAto(base.find(a => a.id === Number(linha.dataset.id)));
  };
  el('tabela').addEventListener('click', abrirLinha);
  el('tabela').addEventListener('keydown', e => { if (e.key === 'Enter') abrirLinha(e); });

  render();
}

/* ===================== DOU (API) ===================== */
const API_BASE_URL = 'https://matheusdevrumobr.pythonanywhere.com';
const API_DOU_NORMAIS = `${API_BASE_URL}/dous/normais`;
const API_DOU_EXTRAS = `${API_BASE_URL}/dous/extras`;

// Tipos de ato reconhecidos no início do título; os mais longos são testados primeiro
// para que "Despacho Decisório" não seja classificado como "Despacho".
const TIPOS_ATO = [
  'Ato Declaratório Executivo', 'Despacho Decisório', 'Pauta de Julgamento', 'Instrução Normativa',
  'Medida Provisória', 'Aviso de Licitação', 'Extrato de Contrato', 'Portaria', 'Despacho', 'Decisão',
  'Resolução', 'Retificação', 'Alvará', 'Atos', 'Ato', 'Decreto', 'Lei', 'Edital', 'Extrato', 'Aviso',
  'Acórdão', 'Deliberação', 'Comunicado', 'Parecer', 'Súmula'
].sort((a, b) => b.length - a.length);

function tipoDoAto(titulo) {
  const t = normalizar(titulo.trim());
  const tipo = TIPOS_ATO.find(tp => new RegExp(`^${normalizar(tp)}(?![a-z])`).test(t));
  if (tipo) return tipo;
  const palavra = titulo.trim().split(/[\s\-–,]/)[0];
  return palavra ? palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase() : 'Outros';
}

// Converte uma publicação da API para o formato usado pela listagem e pelo modal.
// `extra` vem do endpoint consultado, sem depender do valor de `tipo` retornado.
function converterPublicacao(p, extra) {
  const [ano, mes, dia] = p.pub_date.split('-').map(Number);
  const conteudo = (p.conteudo ?? '').trim();
  const linhas = conteudo.split('\n').map(l => l.trim()).filter(Boolean);
  if (linhas[0] === p.titulo.trim()) linhas.shift(); // o conteúdo costuma repetir o título na 1ª linha
  return {
    id: p.id,
    data: new Date(ano, mes - 1, dia),
    edicao: p.edicao,
    secao: String(p.secao).replace(/\D/g, '') || p.secao, // "dou1" → "1"
    extra,
    tipo: tipoDoAto(p.titulo),
    titulo: p.titulo,
    ementa: linhas.join(' '),
    conteudo,
    url: p.url
  };
}

const COLUNAS_DOU = {
  celulas: a => `
    <td class="d-none d-md-table-cell text-nowrap">${escapar(a.tipo)}</td>
    <td class="text-center">${a.url
      ? `<a href="${escapar(a.url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary" title="Abrir no DOU" aria-label="Abrir no DOU"><i class="bi bi-box-arrow-up-right"></i></a>`
      : '—'}</td>`,
  csvCabecalho: ['Data', 'Edição', 'Seção', 'Tipo', 'Título', 'Conteúdo', 'Link'],
  csvLinha: a => [fmtData(a.data), a.edicao, nomeSecao(a), a.tipo, a.titulo, a.conteudo, a.url ?? '']
};

// Busca as publicações de um endpoint e monta a listagem da aba indicada por `prefixo`.
async function carregarListagem(prefixo, url, { extra = false, nome = 'DOU' } = {}) {
  const tabela = document.getElementById(`${prefixo}-tabela`);
  const mensagem = html => { tabela.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-5">${html}</td></tr>`; };
  mensagem('<div class="spinner-border spinner-border-sm me-2" role="status"></div>Carregando publicações…');

  try {
    const resposta = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json();
    const base = (json.publicacoes ?? [])
      .map(p => converterPublicacao(p, extra))
      .sort((a, b) => b.data - a.data); // mais recentes primeiro (ordem estável para o mesmo dia)
    criarListagem(prefixo, base, COLUNAS_DOU);
  } catch (erro) {
    console.error(`Falha ao carregar o ${nome}:`, erro);
    mensagem(`<i class="bi bi-exclamation-triangle d-block fs-2 mb-2"></i>Não foi possível carregar as publicações do ${nome}.
      <div class="mt-3"><button class="btn btn-sm btn-laranja" id="${prefixo}-recarregar"><i class="bi bi-arrow-clockwise me-1"></i>Tentar novamente</button></div>`);
    document.getElementById(`${prefixo}-recarregar`).addEventListener('click', () => carregarListagem(prefixo, url, { extra, nome }));
  }
}

/* ===================== Análise ===================== */
const API_ANALISES = `${API_BASE_URL}/analises`;
const SEM_RELEVANCIA = 'NADA RELEVANTE';

// "2026-10-06" → Date local (evita o deslocamento de fuso de `new Date('2026-10-06')`).
const dataIso = iso => {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(ano, mes - 1, dia);
};

// Só interessam as análises com resposta preenchida e diferente de "NADA RELEVANTE".
const analiseRelevante = a => {
  const resposta = (a.resposta ?? '').trim();
  return resposta !== '' && resposta.toUpperCase() !== SEM_RELEVANCIA;
};

const ROTULO_EXPANDIR = 'Ver texto completo<i class="bi bi-chevron-down ms-1"></i>';
const ROTULO_RECOLHER = 'Recolher<i class="bi bi-chevron-up ms-1"></i>';

function renderAnalise(lista) {
  document.getElementById('analise-contagem').textContent = fmtNum(lista.length);

  // Todos os cards começam recolhidos (texto limitado a algumas linhas).
  document.getElementById('analise-pareceres').innerHTML = lista.length
    ? lista.map(a => `
      <div class="col-12 col-md-6 col-xl-4">
        <article class="card cartao cartao-parecer parecer-aplicavel">
          <div class="card-body d-flex flex-column">
            <div class="d-flex justify-content-end mb-2">
              <small class="text-muted text-nowrap"><i class="bi bi-calendar-event me-1"></i>${fmtData(dataIso(a.data_referencia))}</small>
            </div>
            <h3 class="titulo-norma mb-3">${escapar(a.titulo)}</h3>
            <div class="detalhe-rotulo">Conteúdo</div>
            <p class="texto-parecer colapsado mb-1">${escapar(a.resposta.trim())}</p>
            <button type="button" class="btn btn-link btn-sm p-0 mb-3 align-self-start alternar-texto" aria-expanded="false">${ROTULO_EXPANDIR}</button>
            ${a.url ? `
            <a href="${escapar(a.url)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary mt-auto align-self-start">
              <i class="bi bi-box-arrow-up-right me-1"></i>Ver referência
            </a>` : ''}
          </div>
        </article>
      </div>`).join('')
    : '<div class="col-12"><p class="text-muted text-center py-5 mb-0"><i class="bi bi-inbox d-block fs-2 mb-2"></i>Nenhuma norma relevante encontrada.</p></div>';

  ajustarBotoesExpandir();
}

// Esconde o botão de expandir nos cards cujo texto já cabe inteiro recolhido.
// Só é possível medir com a aba visível, por isso também roda ao abrir a aba e ao redimensionar.
function ajustarBotoesExpandir() {
  document.querySelectorAll('#analise-pareceres .texto-parecer.colapsado').forEach(texto => {
    if (!texto.offsetParent) return; // aba oculta: não há como medir agora
    texto.nextElementSibling.classList.toggle('d-none', texto.scrollHeight <= texto.clientHeight + 1);
  });
}

document.getElementById('analise-pareceres').addEventListener('click', e => {
  const botao = e.target.closest('.alternar-texto');
  if (!botao) return;
  const expandido = botao.previousElementSibling.classList.toggle('colapsado') === false;
  botao.setAttribute('aria-expanded', expandido);
  botao.innerHTML = expandido ? ROTULO_RECOLHER : ROTULO_EXPANDIR;
});

document.getElementById('tab-analise').addEventListener('shown.bs.tab', ajustarBotoesExpandir);
let atrasoRedimensionar;
window.addEventListener('resize', () => { clearTimeout(atrasoRedimensionar); atrasoRedimensionar = setTimeout(ajustarBotoesExpandir, 150); });

async function carregarAnalises() {
  const container = document.getElementById('analise-pareceres');
  const mensagem = html => { container.innerHTML = `<div class="col-12"><p class="text-muted text-center py-5 mb-0">${html}</p></div>`; };
  mensagem('<span class="spinner-border spinner-border-sm me-2" role="status"></span>Carregando análises…');

  try {
    const resposta = await fetch(API_ANALISES, { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const json = await resposta.json();
    // Aceita tanto uma lista direta quanto um objeto que envolva a lista (ex.: { analises: [...] }).
    const itens = Array.isArray(json) ? json : (Object.values(json).find(Array.isArray) ?? []);
    renderAnalise(itens
      .filter(analiseRelevante)
      .sort((a, b) => String(b.data_referencia).localeCompare(String(a.data_referencia))));
  } catch (erro) {
    console.error('Falha ao carregar as análises:', erro);
    mensagem(`<i class="bi bi-exclamation-triangle d-block fs-2 mb-2"></i>Não foi possível carregar as análises.
      <span class="d-block mt-3"><button class="btn btn-sm btn-laranja" id="analise-recarregar"><i class="bi bi-arrow-clockwise me-1"></i>Tentar novamente</button></span>`);
    document.getElementById('analise-recarregar').addEventListener('click', carregarAnalises);
  }
}

/* ===================== Inicialização ===================== */
document.getElementById('data-atualizacao').textContent = fmtData(DouData.hoje);
carregarListagem('dou', API_DOU_NORMAIS);
carregarListagem('extra', API_DOU_EXTRAS, { extra: true, nome: 'DOU Extra' });
carregarAnalises();
