/* ===================== Utilitários ===================== */
const fmtData = d => d.toLocaleDateString('pt-BR');
const fmtNum = n => n.toLocaleString('pt-BR');
const fmtDec = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const escapar = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const normalizar = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeSecao = ato => `Seção ${ato.secao}${ato.extra ? ' – Extra' : ''}`;

const CORES = {
  laranja: '#FF8200',
  laranjaClaro: '#FFB366',
  laranjaEscuro: '#CC6800',
  cinza: '#6F7072',
  cinzaClaro: '#A6A7A9',
  cinzaEscuro: '#3D3E40',
  grade: '#ECEDEC'
};

function contar(lista, chave) {
  const mapa = new Map();
  lista.forEach(item => {
    const k = typeof chave === 'function' ? chave(item) : item[chave];
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });
  return mapa;
}

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
  const campos = [
    ['Data de publicação', fmtData(ato.data)],
    ['Edição', ato.edicao],
    ['Seção', nomeSecao(ato)],
    ['Página', ato.pagina],
    ['Órgão', ato.orgao],
    ['Tipo de ato', ato.tipo]
  ];
  document.getElementById('modal-ato-titulo').textContent = ato.titulo;
  document.getElementById('modal-ato-corpo').innerHTML = `
    <div class="row g-3 mb-3">
      ${campos.map(([r, v]) => `
        <div class="col-6 col-md-4">
          <div class="detalhe-rotulo">${r}</div>
          <div class="detalhe-valor">${escapar(v)}</div>
        </div>`).join('')}
    </div>
    <div class="detalhe-rotulo">Ementa</div>
    <p class="mb-0">${escapar(ato.ementa)}</p>`;
  modalAto.show();
}

document.getElementById('modal-ato-copiar').addEventListener('click', async e => {
  if (!atoSelecionado) return;
  const a = atoSelecionado;
  const ref = `${a.titulo} – ${a.orgao}. Diário Oficial da União, edição ${a.edicao}, ${nomeSecao(a)}, p. ${a.pagina}, ${fmtData(a.data)}.`;
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
function criarListagem(prefixo, base) {
  const el = id => document.getElementById(`${prefixo}-${id}`);
  const POR_PAGINA = 15;
  let pagina = 1;
  let filtrados = base;

  // Preenche os selects a partir dos próprios dados.
  const preencher = (select, valores) => {
    select.insertAdjacentHTML('beforeend', valores.map(v => `<option value="${escapar(v)}">${escapar(v)}</option>`).join(''));
  };
  preencher(el('secao'), [...new Set(base.map(nomeSecao))].sort());
  preencher(el('tipo'), [...new Set(base.map(a => a.tipo))].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  preencher(el('orgao'), [...new Set(base.map(a => a.orgao))].sort((a, b) => a.localeCompare(b, 'pt-BR')));

  function filtrar() {
    const busca = normalizar(el('busca').value.trim());
    const secao = el('secao').value;
    const tipo = el('tipo').value;
    const orgao = el('orgao').value;
    const de = el('de').value;
    const ate = el('ate').value;

    filtrados = base.filter(a => {
      const dia = isoLocal(a.data);
      return (!secao || nomeSecao(a) === secao)
        && (!tipo || a.tipo === tipo)
        && (!orgao || a.orgao === orgao)
        && (!de || dia >= de)
        && (!ate || dia <= ate)
        && (!busca || normalizar(`${a.titulo} ${a.ementa} ${a.orgao}`).includes(busca));
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
          </td>
          <td class="d-none d-md-table-cell">${escapar(a.orgao)}</td>
          <td class="d-none d-lg-table-cell">${a.pagina}</td>
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
    const cab = ['Data', 'Edição', 'Seção', 'Página', 'Órgão', 'Tipo', 'Título', 'Ementa'];
    const linhas = filtrados.map(a => [fmtData(a.data), a.edicao, nomeSecao(a), a.pagina, a.orgao, a.tipo, a.titulo, a.ementa]);
    const csv = [cab, ...linhas]
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
  ['secao', 'tipo', 'orgao', 'de', 'ate'].forEach(id => el(id).addEventListener('change', filtrar));

  el('limpar').addEventListener('click', () => {
    ['busca', 'secao', 'tipo', 'orgao', 'de', 'ate'].forEach(id => { el(id).value = ''; });
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
    const linha = e.target.closest('tr[data-id]');
    if (linha) abrirAto(base.find(a => a.id === Number(linha.dataset.id)));
  };
  el('tabela').addEventListener('click', abrirLinha);
  el('tabela').addEventListener('keydown', e => { if (e.key === 'Enter') abrirLinha(e); });

  render();
}

/* ===================== Análise ===================== */
const Analise = (() => {
  const graficos = {};
  const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = CORES.cinza;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.callbacks.label = ctx =>
    ` ${ctx.dataset.label || ctx.label}: ${fmtNum(Math.round((ctx.parsed.y ?? ctx.parsed) * 10) / 10)}`;

  const eixos = (empilhado = false) => ({
    x: { stacked: empilhado, grid: { display: false } },
    y: { stacked: empilhado, beginAtZero: true, grid: { color: CORES.grade }, border: { display: false }, ticks: { precision: 0 } }
  });

  function criarGraficos() {
    graficos.evolucao = new Chart(document.getElementById('grafico-evolucao'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'DOU', data: [], backgroundColor: CORES.laranja, borderRadius: 2 },
        { label: 'DOU Extra', data: [], backgroundColor: CORES.cinza, borderRadius: 2 }
      ] },
      options: { maintainAspectRatio: false, scales: eixos(true), plugins: { legend: { position: 'top', align: 'end' } } }
    });

    graficos.tipos = new Chart(document.getElementById('grafico-tipos'), {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], borderColor: '#fff', borderWidth: 2,
        backgroundColor: [CORES.laranja, CORES.laranjaClaro, CORES.laranjaEscuro, CORES.cinzaEscuro, CORES.cinza, CORES.cinzaClaro, '#D6D7D6'] }] },
      options: { maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 8, font: { size: 11 } } } } }
    });

    graficos.secoes = new Chart(document.getElementById('grafico-secoes'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Publicações', data: [], backgroundColor: CORES.laranja, borderRadius: 4, maxBarThickness: 48 }] },
      options: { maintainAspectRatio: false, scales: eixos(), plugins: { legend: { display: false } } }
    });

    graficos.semana = new Chart(document.getElementById('grafico-semana'), {
      type: 'bar',
      data: { labels: DIAS_SEMANA, datasets: [{ label: 'Média de publicações', data: [], backgroundColor: CORES.cinza, borderRadius: 4, maxBarThickness: 36 }] },
      options: { maintainAspectRatio: false, scales: eixos(), plugins: { legend: { display: false } } }
    });
  }

  function render() {
    const dias = Number(document.getElementById('analise-periodo').value);
    const fonte = document.getElementById('analise-fonte').value;

    const inicio = new Date(DouData.hoje);
    inicio.setDate(inicio.getDate() - dias + 1);

    const doPeriodo = lista => lista.filter(a => a.data >= inicio);
    const dou = fonte === 'extra' ? [] : doPeriodo(DouData.dou);
    const extra = fonte === 'dou' ? [] : doPeriodo(DouData.extra);
    const todos = [...dou, ...extra];

    // KPIs
    const porOrgao = [...contar(todos, 'orgao')].sort((a, b) => b[1] - a[1]);
    renderKpis(document.getElementById('analise-kpis'), [
      { rotulo: 'Total de publicações', valor: fmtNum(todos.length), icone: 'bi-file-earmark-text' },
      { rotulo: 'Média diária', valor: fmtDec(todos.length / dias), icone: 'bi-calendar3' },
      { rotulo: 'Participação Extra', valor: todos.length ? `${fmtDec(extra.length / todos.length * 100)}%` : '0%', icone: 'bi-lightning-charge' },
      { rotulo: 'Órgão mais ativo', valor: porOrgao[0]?.[0] ?? '—', icone: 'bi-building', texto: true }
    ]);

    // Evolução diária
    const datas = [];
    for (let d = new Date(inicio); d <= DouData.hoje; d.setDate(d.getDate() + 1)) datas.push(isoLocal(d));
    const douDia = contar(dou, a => isoLocal(a.data));
    const extraDia = contar(extra, a => isoLocal(a.data));
    graficos.evolucao.data.labels = datas.map(d => d.slice(8, 10) + '/' + d.slice(5, 7));
    graficos.evolucao.data.datasets[0].data = datas.map(d => douDia.get(d) || 0);
    graficos.evolucao.data.datasets[1].data = datas.map(d => extraDia.get(d) || 0);
    graficos.evolucao.data.datasets[0].hidden = fonte === 'extra';
    graficos.evolucao.data.datasets[1].hidden = fonte === 'dou';
    graficos.evolucao.update();

    // Tipos de ato: 6 maiores + "Outros"
    const tipos = [...contar(todos, 'tipo')].sort((a, b) => b[1] - a[1]);
    const principais = tipos.slice(0, 6);
    const outros = tipos.slice(6).reduce((s, [, n]) => s + n, 0);
    if (outros) principais.push(['Outros', outros]);
    graficos.tipos.data.labels = principais.map(([t]) => t);
    graficos.tipos.data.datasets[0].data = principais.map(([, n]) => n);
    graficos.tipos.update();

    // Seções
    const secoes = [...contar(todos, nomeSecao)].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
    graficos.secoes.data.labels = secoes.map(([s]) => s);
    graficos.secoes.data.datasets[0].data = secoes.map(([, n]) => n);
    graficos.secoes.update();

    // Média por dia da semana (total ÷ ocorrências daquele dia no período)
    const ocorrencias = Array(7).fill(0);
    datas.forEach(d => { ocorrencias[new Date(d + 'T00:00:00').getDay()]++; });
    const porDiaSemana = contar(todos, a => a.data.getDay());
    graficos.semana.data.datasets[0].data = DIAS_SEMANA.map((_, i) =>
      ocorrencias[i] ? Math.round((porDiaSemana.get(i) || 0) / ocorrencias[i] * 10) / 10 : 0);
    graficos.semana.update();

    // Ranking de órgãos
    const top = porOrgao.slice(0, 8);
    const maximo = top[0]?.[1] || 1;
    document.getElementById('analise-ranking').innerHTML = top.length
      ? top.map(([orgao, n]) => `
        <div class="ranking-item">
          <div class="d-flex justify-content-between gap-2 mb-1">
            <span class="ranking-nome text-truncate" title="${escapar(orgao)}">${escapar(orgao)}</span>
            <span class="ranking-valor">${fmtNum(n)}</span>
          </div>
          <div class="progress" role="progressbar" aria-label="${escapar(orgao)}" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${maximo}">
            <div class="progress-bar" style="width: ${(n / maximo * 100).toFixed(1)}%"></div>
          </div>
        </div>`).join('')
      : '<p class="text-muted text-center my-4">Sem dados no período.</p>';
  }

  // Os gráficos são criados na primeira exibição da aba, para que o Chart.js meça o tamanho correto.
  let iniciado = false;
  function iniciar() {
    if (iniciado) return;
    iniciado = true;
    criarGraficos();
    render();
    document.getElementById('analise-periodo').addEventListener('change', render);
    document.getElementById('analise-fonte').addEventListener('change', render);
  }

  return { iniciar };
})();

/* ===================== Inicialização ===================== */
document.getElementById('data-atualizacao').textContent = fmtData(DouData.hoje);
criarListagem('dou', DouData.dou);
criarListagem('extra', DouData.extra);
document.getElementById('tab-analise').addEventListener('shown.bs.tab', Analise.iniciar);
