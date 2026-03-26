/* ============================================
   GERADOR DE CALENDÁRIO
   ============================================ */

class CalendarGenerator {
    constructor() {
        this.currentDate = new Date();
        this.transacoes = [];
        this.dividas = [];
        this.salarios = { luan: { bruto: 0, descontos: 0 }, bianca: { bruto: 0, descontos: 0 } };
    }

    setData(transacoes, dividas, salarios) {
        this.transacoes = Array.isArray(transacoes) ? transacoes : [];
        this.dividas = Array.isArray(dividas) ? dividas : [];
        this.salarios = salarios || { luan: { bruto: 0, descontos: 0 }, bianca: { bruto: 0, descontos: 0 } };
        this.generateCalendar();
        this.updateTimeline();
        this.updateSummary();
    }

    generateCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Atualizar nome do mês
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        document.getElementById('current-month').textContent = 
            `${monthNames[month]} ${year}`;

        // Obter primeiro dia e número de dias do mês
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const calendarDays = document.getElementById('calendar-days');
        calendarDays.innerHTML = '';

        // Dias do mês anterior (inativos)
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'day inactive';
            day.textContent = daysInPrevMonth - i;
            calendarDays.appendChild(day);
        }

        // Dias do mês atual
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.className = 'day';
            day.textContent = i;
            
            // Verificar se é hoje
            const today = new Date();
            if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
                day.classList.add('today');
            }

            // Verificar se tem transações
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const hasTransactions = this.transacoes.filter(t => t.data === dateStr);
            
            if (hasTransactions.length > 0) {
                const hasIncome = hasTransactions.some(t => t.tipo === 'receita');
                const hasExpense = hasTransactions.some(t => t.tipo === 'despesa');
                
                if (hasIncome) {
                    day.classList.add('has-income');
                } else if (hasExpense) {
                    day.classList.add('has-expense');
                }
            }

            day.addEventListener('click', () => this.selectDay(i, dateStr));
            calendarDays.appendChild(day);
        }

        // Dias do próximo mês (inativos)
        const totalCells = calendarDays.children.length;
        const remainingCells = 42 - totalCells;
        for (let i = 1; i <= remainingCells; i++) {
            const day = document.createElement('div');
            day.className = 'day inactive';
            day.textContent = i;
            calendarDays.appendChild(day);
        }
    }

    selectDay(day, dateStr) {
        // Filtrar transações do dia selecionado
        const dayTransactions = this.transacoes.filter(t => t.data === dateStr);
        this.renderTimelineForDay(dayTransactions, day);
    }

    renderTimelineForDay(transactions, day) {
        const timeline = document.getElementById('timeline-transacoes');
        
        if (transactions.length === 0) {
            timeline.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma transação neste dia</p>';
            return;
        }

        timeline.innerHTML = transactions.map(t => `
            <div class="timeline-item ${t.tipo}">
                <div class="timeline-icon">
                    <i class="fas ${t.tipo === 'receita' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${t.descricao}</div>
                    <div class="timeline-date">${new Date(t.data).toLocaleDateString('pt-BR')}</div>
                </div>
                <div class="timeline-amount">${t.tipo === 'receita' ? '+' : '-'} R$ ${t.valor.toFixed(2)}</div>
            </div>
        `).join('');
    }

    updateSummary() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthTransactions = this.transacoes.filter(t => {
            const [tYear, tMonth] = t.data.split('-');
            return parseInt(tYear) === year && parseInt(tMonth) === month + 1;
        });

        const receitas = monthTransactions
            .filter(t => t.tipo === 'receita')
            .reduce((sum, t) => sum + t.valor, 0);
        
        const despesas = monthTransactions
            .filter(t => t.tipo === 'despesa')
            .reduce((sum, t) => sum + t.valor, 0);
        
        const saldo = receitas - despesas;

        // Atualizar cards de resumo
        const totalReceitasSpan = document.getElementById('total-receitas');
        const totalDespesasSpan = document.getElementById('total-despesas');
        const saldoSpan = document.getElementById('saldo-atual');

        if (totalReceitasSpan) totalReceitasSpan.textContent = `R$ ${receitas.toFixed(2)}`;
        if (totalDespesasSpan) totalDespesasSpan.textContent = `R$ ${despesas.toFixed(2)}`;
        if (saldoSpan) saldoSpan.textContent = `R$ ${saldo.toFixed(2)}`;

        // Atualizar dívidas
        const dividasLuan = this.dividas.filter(d => d.responsavel === 'luan').reduce((sum, d) => sum + d.valor, 0);
        const dividasBianca = this.dividas.filter(d => d.responsavel === 'bianca').reduce((sum, d) => sum + d.valor, 0);
        const dividasConjunto = this.dividas.filter(d => d.responsavel === 'conjunto').reduce((sum, d) => sum + d.valor, 0);

        const totalDividasLuanSpan = document.getElementById('total-dividas-luan');
        const totalDividasBiancaSpan = document.getElementById('total-dividas-bianca');
        const totalDividasConjuntoSpan = document.getElementById('total-dividas-conjunto');

        if (totalDividasLuanSpan) totalDividasLuanSpan.textContent = `R$ ${dividasLuan.toFixed(2)}`;
        if (totalDividasBiancaSpan) totalDividasBiancaSpan.textContent = `R$ ${dividasBianca.toFixed(2)}`;
        if (totalDividasConjuntoSpan) totalDividasConjuntoSpan.textContent = `R$ ${dividasConjunto.toFixed(2)}`;

        // Atualizar salário líquido
        const salarioLuanLiquido = this.salarios.luan.bruto - this.salarios.luan.descontos;
        const salarioBiancaLiquido = this.salarios.bianca.bruto - this.salarios.bianca.descontos;
        const salarioConjuntoLiquido = salarioLuanLiquido + salarioBiancaLiquido;

        const salarioLiquidoSpan = document.getElementById('salario-liquido');
        if (salarioLiquidoSpan) salarioLiquidoSpan.textContent = `R$ ${salarioConjuntoLiquido.toFixed(2)}`;
    }

    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.generateCalendar();
        this.updateTimeline();
        this.updateSummary();
        this.triggerChartUpdate();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.generateCalendar();
        this.updateTimeline();
        this.updateSummary();
        this.triggerChartUpdate();
    }

    triggerChartUpdate() {
        // Dispara um evento customizado para atualizar os gráficos
        window.dispatchEvent(new Event('monthChanged'));
    }

    updateTimeline() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        const monthTransactions = this.transacoes.filter(t => {
            const [tYear, tMonth] = t.data.split('-');
            return parseInt(tYear) === year && parseInt(tMonth) === month + 1;
        });

        const timeline = document.getElementById('lista-transacoes');
        
        if (monthTransactions.length === 0) {
            timeline.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma transação este mês</p>';
            return;
        }

        timeline.innerHTML = monthTransactions.sort((a, b) => new Date(b.data) - new Date(a.data)).map(t => `
            <div class="timeline-item ${t.tipo}">
                <div class="timeline-icon">
                    <i class="fas ${t.tipo === 'receita' ? 'fa-arrow-down-left' : 'fa-arrow-up-right'}"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-title">${t.descricao}</div>
                    <div class="timeline-date">${new Date(t.data).toLocaleDateString('pt-BR')}</div>
                </div>
                <div class="timeline-amount">${t.tipo === 'receita' ? '+' : '-'} R$ ${t.valor.toFixed(2)}</div>
            </div>
        `).join('');
    }

    init() {
        document.getElementById('prev-month').addEventListener('click', () => this.previousMonth());
        document.getElementById('next-month').addEventListener('click', () => this.nextMonth());
        this.generateCalendar();
        this.updateTimeline();
        this.updateSummary();
    }
}

// Inicializar ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    const calendar = new CalendarGenerator();
    window.calendar = calendar;
    calendar.init();
});
