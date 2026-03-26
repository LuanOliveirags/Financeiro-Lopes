document.addEventListener('DOMContentLoaded', function() {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registrado');
                // Pedir permissão para notificações
                if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            console.log('Notificações permitidas');
                        }
                    });
                }
            })
            .catch(error => console.log('Erro no SW:', error));
    }
    
    const form = document.getElementById('form-transacao');
    const saldoSpan = document.getElementById('saldo-atual');
    const totalReceitasSpan = document.getElementById('total-receitas');
    const totalDespesasSpan = document.getElementById('total-despesas');
    const formDivida = document.getElementById('form-divida');
    const listaDividasLuan = document.getElementById('lista-dividas-luan');
    const listaDividasBianca = document.getElementById('lista-dividas-bianca');
    const listaDividasConjunto = document.getElementById('lista-dividas-conjunto');
    const formSalario = document.getElementById('form-salario');
    const toggleTema = document.getElementById('toggle-tema');
    const btnFiltrar = document.getElementById('btn-filtrar');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const btnExportar = document.getElementById('btn-exportar');
    const btnImportar = document.getElementById('btn-importar');
    const inputImportar = document.getElementById('importar-excel');
    const btnTestarNotificacao = document.getElementById('btn-testar-notificacao');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroCategoria = document.getElementById('filtro-categoria');
    const fab = document.getElementById('fab-adicionar');
    const navItems = document.querySelectorAll('.nav-item');
    const lista = document.getElementById('lista-transacoes');

    let transacoes = [];
    let transacoesFiltradas = [];
    let dividas = [];
    let salarios = { luan: { bruto: 0, descontos: 0 }, bianca: { bruto: 0, descontos: 0 } };
    let temaEscuro = localStorage.getItem('tema') === 'dark';

    // Firebase (seus dados do projeto financeiro-lopes)
    const firebaseConfig = {
        apiKey: "AIzaSyAMx-ZoL4ccoZnNPzF1e5yYC1LWHp0c0vK",
        authDomain: "financeiro-lopes.firebaseapp.com",
        projectId: "financeiro-lopes",
        storageBucket: "financeiro-lopes.appspot.com",
        messagingSenderId: "621443570583",
        appId: "1:621443570583:web:1a5ad0106d260651482d2",
        measurementId: "G-7FHEPH5G5"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        // analytics opcional
        if (firebase.analytics) {
            firebase.analytics();
        }
    }

    const db = firebase.firestore();
    let currentUserId = null;

    firebase.auth().onAuthStateChanged(async user => {
        if (user) {
            currentUserId = user.uid;
            console.log('✅ Autenticado como:', currentUserId);
            try {
                await carregarFirebase();
                aplicarFiltros();
                exibirDividas();
                exibirSalarios();
            } catch (err) {
                console.error('❌ Erro ao carregar após autenticação:', err);
            }
        } else {
            console.log('⚠️ Nenhum usuário detectado, tentando login anônimo...');
            firebase.auth().signInAnonymously()
                .then(userCred => {
                    console.log('✅ Login anônimo bem-sucedido:', userCred.user.uid);
                })
                .catch(err => {
                    console.error('❌ Erro em signInAnonymously:', err.code, err.message);
                    showToast(`❌ Falha Firebase: ${err.code}`, 'error');
                });
        }
    });

    async function salvarFirebase() {
        if (!currentUserId) return;
        try {
            await db.collection('financas').doc(currentUserId).set({
                transacoes,
                dividas,
                salarios,
                dataAtualizacao: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('Dados salvos no Firebase');
        } catch (err) {
            console.error('Erro ao salvar no Firebase', err);
            showToast('Falha ao salvar no Firebase. Verifique a conexão.', 'warning');
        }
    }

    async function carregarFirebase() {
        if (!currentUserId) return;
        try {
            const doc = await db.collection('financas').doc(currentUserId).get();
            if (doc.exists) {
                const data = doc.data();
                if (Array.isArray(data.transacoes) && data.transacoes.length > 0) transacoes = data.transacoes;
                if (Array.isArray(data.dividas) && data.dividas.length > 0) dividas = data.dividas;
                if (data.salarios && data.salarios.luan && data.salarios.bianca) salarios = data.salarios;
                console.log('Dados carregados do Firebase');
            } else {
                console.log('Nenhum documento Firebase para este usuário. Mantendo vazio.');
            }

            transacoesFiltradas = [...transacoes];
            exibirTransacoes();
            exibirDividas();
            exibirSalarios();
            calcularTotais();
            atualizarGrafico();
        } catch (err) {
            console.error('Erro ao carregar dados do Firebase', err);
            showToast('Falha ao carregar do Firebase. Verifique a conexão.', 'warning');
        }
    }


    // Carregar dados só do Firebase. Se não houver dados no Firestore, mantém estrutura vazia.
    transacoesFiltradas = [...transacoes];

    // Tema - Aplicar imediatamente ao carregar (evita flash)
    if (localStorage.getItem('tema') === 'dark') {
        document.documentElement.classList.add('dark-mode-loading');
    }

    // Tema
    function aplicarTema() {
        document.body.classList.toggle('dark', temaEscuro);
        document.documentElement.classList.remove('dark-mode-loading');
        if (toggleTema) {
            const icon = temaEscuro ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            toggleTema.innerHTML = icon;
            toggleTema.setAttribute('aria-label', temaEscuro ? 'Ativar tema claro' : 'Ativar tema escuro');
            showToast(temaEscuro ? '🌙 Tema escuro ativado' : '☀️ Tema claro ativado', 'info');
        }
    }

    function refreshCalendarData() {
        if (window.calendar && typeof window.calendar.setData === 'function') {
            window.calendar.setData(transacoes, dividas, salarios);
        }
    }

    if (toggleTema) {
        toggleTema.addEventListener('click', function(e) {
            e.preventDefault();
            temaEscuro = !temaEscuro;
            localStorage.setItem('tema', temaEscuro ? 'dark' : 'light');
            aplicarTema();
        });
    }

    aplicarTema();

    // Sistema de Notificação Toast - Melhorado
    function showToast(message, type = 'success') {
        // Remove toast anterior se existir
        const oldToast = document.querySelector('.toast');
        if (oldToast) oldToast.remove();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
            </div>
        `;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(76, 175, 80, 0.3);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideInUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            z-index: 10000;
        `;
        
        if (type === 'error') {
            toast.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
        } else if (type === 'warning') {
            toast.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
        } else if (type === 'info') {
            toast.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
        }
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Adicionar estilos de animação ao toast
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInUp {
            from { opacity: 0; transform: translateY(100px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        .toast-content {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }
    `;
    document.head.appendChild(style);

    // Navegação por abas
    function showSection(sectionId) {
        const sections = document.querySelectorAll('section');
        sections.forEach(section => section.classList.remove('active'));
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        navItems.forEach(item => item.classList.remove('active'));
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

        window.scrollTo(0, 0);
    }

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            showSection(this.dataset.section);
        });
    });

    if (fab) {
        fab.addEventListener('click', function() {
            showSection('formulario');
        });
    }

    // Cálculos
    function calcularTotais() {
        const receitas = transacoesFiltradas.filter(t => t.tipo === 'receita' && t.categoria !== 'Salário').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoesFiltradas.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        const dividasTotais = dividas.reduce((sum, d) => sum + d.valor, 0);

        const salarioLuanLiquido = salarios.luan.bruto - salarios.luan.descontos;
        const salarioBiancaLiquido = salarios.bianca.bruto - salarios.bianca.descontos;
        const salarioConjuntoLiquido = salarioLuanLiquido + salarioBiancaLiquido;
        const saldo = salarioConjuntoLiquido + receitas - despesas - dividasTotais;

        const dividasLuan = dividas.filter(d => d.responsavel === 'luan').reduce((sum, d) => sum + d.valor, 0);
        const dividasBianca = dividas.filter(d => d.responsavel === 'bianca').reduce((sum, d) => sum + d.valor, 0);
        const dividasConjunto = dividas.filter(d => d.responsavel === 'conjunto').reduce((sum, d) => sum + d.valor, 0);

        if (totalReceitasSpan) totalReceitasSpan.textContent = `R$ ${receitas.toFixed(2)}`;
        if (totalDespesasSpan) totalDespesasSpan.textContent = `R$ ${despesas.toFixed(2)}`;
        if (saldoSpan) saldoSpan.textContent = `R$ ${saldo.toFixed(2)}`;
        
        const totalDividasLuanSpan = document.getElementById('total-dividas-luan');
        const totalDividasBiancaSpan = document.getElementById('total-dividas-bianca');
        const totalDividasConjuntoSpan = document.getElementById('total-dividas-conjunto');
        const salarioLiquidoSpan = document.getElementById('salario-liquido');

        if (totalDividasLuanSpan) totalDividasLuanSpan.textContent = `R$ ${dividasLuan.toFixed(2)}`;
        if (totalDividasBiancaSpan) totalDividasBiancaSpan.textContent = `R$ ${dividasBianca.toFixed(2)}`;
        if (totalDividasConjuntoSpan) totalDividasConjuntoSpan.textContent = `R$ ${dividasConjunto.toFixed(2)}`;
        if (salarioLiquidoSpan) salarioLiquidoSpan.textContent = `R$ ${salarioConjuntoLiquido.toFixed(2)}`;
    }

    // Gráfico
    let chart, chartDividas;
    function atualizarGrafico() {
        const receitasExtras = transacoesFiltradas.filter(t => t.tipo === 'receita' && t.categoria !== 'Salário').reduce((sum, t) => sum + t.valor, 0);
        const despesas = transacoesFiltradas.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
        const dividasTotais = dividas.reduce((sum, d) => sum + d.valor, 0);

        const salarioLuanLiquido = salarios.luan.bruto - salarios.luan.descontos;
        const salarioBiancaLiquido = salarios.bianca.bruto - salarios.bianca.descontos;
        const salarioConjuntoLiquido = salarioLuanLiquido + salarioBiancaLiquido;

        if (chart) chart.destroy();

        chart = new Chart(document.getElementById('grafico'), {
            type: 'doughnut',
            data: {
                labels: ['Salários', 'Receitas Extras', 'Despesas', 'Dívidas'],
                datasets: [{
                    data: [salarioConjuntoLiquido, receitasExtras, despesas, dividasTotais],
                    backgroundColor: ['#4CAF50', '#8BC34A', '#f44336', '#FF9800']
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });

        // Gráfico de dívidas
        const dividasLuan = dividas.filter(d => d.responsavel === 'luan').reduce((sum, d) => sum + d.valor, 0);
        const dividasBianca = dividas.filter(d => d.responsavel === 'bianca').reduce((sum, d) => sum + d.valor, 0);
        const dividasConjunto = dividas.filter(d => d.responsavel === 'conjunto').reduce((sum, d) => sum + d.valor, 0);

        if (chartDividas) chartDividas.destroy();

        chartDividas = new Chart(document.getElementById('grafico-dividas'), {
            type: 'bar',
            data: {
                labels: ['Luan', 'Bianca', 'Conjunto'],
                datasets: [{
                    label: 'Dívidas (R$)',
                    data: [dividasLuan, dividasBianca, dividasConjunto],
                    backgroundColor: ['#FF9800', '#E91E63', '#009688']
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        refreshCalendarData();
    }

    // Exibir transações
    function exibirTransacoes() {
        lista.innerHTML = '';
        transacoesFiltradas.forEach((transacao, index) => {
            const li = document.createElement('li');
            li.className = transacao.tipo;
            li.innerHTML = `
                <span>${transacao.descricao} - R$ ${transacao.valor.toFixed(2)} (${transacao.data}) - ${transacao.categoria}</span>
                <button onclick="removerTransacao(${transacao.id})">Remover</button>
            `;
            lista.appendChild(li);
        });
    }

    // Exibir dívidas
    function exibirDividas() {
        listaDividasLuan.innerHTML = '';
        listaDividasBianca.innerHTML = '';
        listaDividasConjunto.innerHTML = '';

        if (dividas.length === 0) {
            const vazio = document.createElement('p');
            vazio.textContent = 'Nenhuma dívida cadastrada ainda.';
            vazio.className = 'texto-vazio';
            listaDividasLuan.appendChild(vazio);
            listaDividasBianca.appendChild(vazio.cloneNode(true));
            listaDividasConjunto.appendChild(vazio.cloneNode(true));
            return;
        }

        dividas.forEach(divida => {
            const parcela = divida.parcela ? divida.parcela : 'não informada';
            const vencimento = divida.diaVencimento ? divida.diaVencimento : 'não informado';
            const valor = Number.isFinite(divida.valor) ? divida.valor.toFixed(2) : '0.00';

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="divida-dados">
                    <strong>${divida.nome}</strong>
                    <small>Parcela: ${parcela}</small>
                    <small>Vencimento: ${vencimento}</small>
                    <small>Valor: R$ ${valor}</small>
                </div>
                <button class="btn-remover" onclick="removerDivida(${divida.id})">Remover</button>
            `;

            if (divida.responsavel === 'luan') listaDividasLuan.appendChild(li);
            else if (divida.responsavel === 'bianca') listaDividasBianca.appendChild(li);
            else listaDividasConjunto.appendChild(li);
        });
    }

    // Exibir salários
    function exibirSalarios() {
        document.getElementById('salario-luan-bruto').textContent = salarios.luan.bruto.toFixed(2);
        document.getElementById('salario-luan-descontos').textContent = salarios.luan.descontos.toFixed(2);
        document.getElementById('salario-luan-liquido').textContent = (salarios.luan.bruto - salarios.luan.descontos).toFixed(2);

        document.getElementById('salario-bianca-bruto').textContent = salarios.bianca.bruto.toFixed(2);
        document.getElementById('salario-bianca-descontos').textContent = salarios.bianca.descontos.toFixed(2);
        document.getElementById('salario-bianca-liquido').textContent = (salarios.bianca.bruto - salarios.bianca.descontos).toFixed(2);

        document.getElementById('salario-conjunto-bruto').textContent = (salarios.luan.bruto + salarios.bianca.bruto).toFixed(2);
        document.getElementById('salario-conjunto-descontos').textContent = (salarios.luan.descontos + salarios.bianca.descontos).toFixed(2);
        document.getElementById('salario-conjunto-liquido').textContent = ((salarios.luan.bruto - salarios.luan.descontos) + (salarios.bianca.bruto - salarios.bianca.descontos)).toFixed(2);
    }

    // Salvar
    function salvarTransacoes() {
        salvarFirebase();
    }

    function salvarDividas() {
        salvarFirebase();
    }

    function salvarSalarios() {
        salvarFirebase();
    }

    // Remover
    window.removerTransacao = function(id) {
        transacoes = transacoes.filter(t => t.id !== id);
        aplicarFiltros();
        salvarTransacoes();
    };

    window.removerDivida = function(id) {
        dividas = dividas.filter(d => d.id !== id);
        exibirDividas();
        calcularTotais();
        atualizarGrafico();
        salvarDividas();
        showToast('✓ Dívida removida com sucesso!', 'success');
    };

    // Adicionar
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        form.classList.add('was-validated');

        if (!form.checkValidity()) {
            showToast('Preencha todos os campos obrigatórios corretamente.', 'warning');
            return;
        }

        const tipo = document.getElementById('tipo').value;
        const categoria = document.getElementById('categoria').value;
        const descricao = document.getElementById('descricao').value;
        const valor = parseFloat(document.getElementById('valor').value);
        const data = document.getElementById('data').value;

        const transacao = { id: Date.now(), tipo, categoria, descricao, valor, data };
        transacoes.push(transacao);
        aplicarFiltros();
        salvarTransacoes();
        
        // Feedback visual
        if (tipo === 'receita') {
            showToast(`✓ Receita de R$ ${valor.toFixed(2)} adicionada!`, 'success');
        } else {
            showToast(`✓ Despesa de R$ ${valor.toFixed(2)} registrada!`, 'success');
        }
        
        form.reset();
        form.classList.remove('was-validated');
    });

    // Adicionar dívida
    formDivida.addEventListener('submit', function(e) {
        e.preventDefault();
        formDivida.classList.add('was-validated');

        if (!formDivida.checkValidity()) {
            showToast('Preencha todos os campos obrigatórios corretamente.', 'warning');
            return;
        }

        const responsavel = document.getElementById('responsavel').value;
        const nome = document.getElementById('nome-divida').value;
        const parcela = document.getElementById('parcela').value;
        const diaVencimento = parseInt(document.getElementById('dia-vencimento').value);
        const valor = parseFloat(document.getElementById('valor-divida').value);

        const divida = { id: Date.now(), responsavel, nome, parcela, diaVencimento, valor };
        dividas.push(divida);
        exibirDividas();
        calcularTotais();
        salvarDividas();
        showToast(`✓ Dívida "${nome}" adicionada!`, 'success');
        formDivida.reset();
        formDivida.classList.remove('was-validated');
    });

    // Adicionar salário
    formSalario.addEventListener('submit', function(e) {
        e.preventDefault();
        formSalario.classList.add('was-validated');

        if (!formSalario.checkValidity()) {
            showToast('Preencha todos os campos obrigatórios corretamente.', 'warning');
            return;
        }

        const pessoa = document.getElementById('pessoa-salario').value;
        const bruto = parseFloat(document.getElementById('salario-bruto').value);
        const descontos = parseFloat(document.getElementById('descontos').value);

        salarios[pessoa] = { bruto, descontos };
        exibirSalarios();
        calcularTotais();
        salvarSalarios();
        showToast(`✓ Salário de ${pessoa} atualizado!`, 'success');
        formSalario.reset();
        formSalario.classList.remove('was-validated');
    });

    // Testar notificação
    btnTestarNotificacao.addEventListener('click', function() {
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.controller.postMessage({
                type: 'NOTIFY',
                message: 'Teste de notificação! Funcionando perfeitamente.'
            });
        } else {
            alert('Notificações não permitidas. Permita no navegador para receber lembretes.');
        }
    });

    // Filtros
    function aplicarFiltros() {
        let filtradas = [...transacoes];

        if (filtroMes.value) {
            filtradas = filtradas.filter(t => t.data.startsWith(filtroMes.value));
        }

        if (filtroCategoria.value) {
            filtradas = filtradas.filter(t => t.categoria === filtroCategoria.value);
        }

        transacoesFiltradas = filtradas;
        exibirTransacoes();
        calcularTotais();
        atualizarGrafico();
    }

    btnFiltrar.addEventListener('click', aplicarFiltros);
    btnLimparFiltros.addEventListener('click', function() {
        filtroMes.value = '';
        filtroCategoria.value = '';
        aplicarFiltros();
    });

    // Exportar CSV
    btnExportar.addEventListener('click', function() {
        const csv = transacoesFiltradas.map(t => `${t.data},${t.tipo},${t.categoria},${t.descricao},${t.valor}`).join('\n');
        const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
        const blob = new Blob([header + csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transacoes.csv';
        a.click();
        URL.revokeObjectURL(url);
        showToast(`✓ ${transacoesFiltradas.length} transações exportadas!`, 'success');
    });

    // Importar Excel
    btnImportar.addEventListener('click', function() {
        const file = inputImportar.files[0];
        if (!file) {
            alert('Selecione um arquivo Excel primeiro.');
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Assumir que a primeira linha é cabeçalho
            const headers = json[0];
            const rows = json.slice(1);

            // Mapear colunas (flexível)
            const colMap = {};
            headers.forEach((h, i) => {
                const lower = h.toLowerCase();
                if (lower.includes('data')) colMap.data = i;
                else if (lower.includes('tipo') || lower.includes('type')) colMap.tipo = i;
                else if (lower.includes('categoria') || lower.includes('category')) colMap.categoria = i;
                else if (lower.includes('descrição') || lower.includes('description') || lower.includes('desc')) colMap.descricao = i;
                else if (lower.includes('valor') || lower.includes('value') || lower.includes('amount')) colMap.valor = i;
            });

            rows.forEach(row => {
                const data = row[colMap.data];
                const tipo = row[colMap.tipo] ? row[colMap.tipo].toLowerCase().includes('receita') ? 'receita' : 'despesa' : 'despesa';
                const categoria = row[colMap.categoria] || 'outros';
                const descricao = row[colMap.descricao] || 'Importado';
                const valor = parseFloat(row[colMap.valor]) || 0;

                if (data && valor) {
                    const transacao = { id: Date.now() + Math.random(), tipo, categoria, descricao, valor, data: new Date(data).toISOString().split('T')[0] };
                    transacoes.push(transacao);
                }
            });

            salvarTransacoes();
            aplicarFiltros();
            showToast(`✓ ${rows.length} transações importadas com sucesso!`, 'success');
        };
        reader.readAsArrayBuffer(file);
    });

    // Notificações de vencimento
    function verificarVencimentos() {
        const hoje = new Date();
        const amanha = new Date(hoje);
        amanha.setDate(hoje.getDate() + 1);

        dividas.forEach(divida => {
            const vencimento = new Date(hoje.getFullYear(), hoje.getMonth(), divida.diaVencimento);
            if (vencimento < hoje) {
                vencimento.setMonth(vencimento.getMonth() + 1); // Próximo mês
            }

            if (vencimento.toDateString() === amanha.toDateString()) {
                if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
                    navigator.serviceWorker.controller.postMessage({
                        type: 'NOTIFY',
                        message: `Dívida ${divida.nome} vence amanhã! Valor: R$ ${divida.valor.toFixed(2)}`
                    });
                } else {
                    alert(`Lembrete: Dívida ${divida.nome} vence amanhã!`);
                }
            }
        });
    }

    // Verificar a cada hora (simulação)
    setInterval(verificarVencimentos, 3600000); // 1 hora
    verificarVencimentos(); // Ao carregar

    // Listener para atualizar gráficos quando mês mudar
    window.addEventListener('monthChanged', function() {
        calcularTotais();
        atualizarGrafico();
    });

    // Exibir localmente antes de Firebase (autenticação anon espera completar)
    aplicarFiltros();
    exibirDividas();
    exibirSalarios();

    // carregarFirebase será chamado automaticamente dentro do onAuthStateChanged
});