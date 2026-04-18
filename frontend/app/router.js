// ============================================================
// PAGE-LOADER.JS — Carrega fragmentos HTML das páginas
// ============================================================

const PAGE_FRAGMENTS = [
    'frontend/modules/login/login.html',
    'frontend/modules/dashboard/dashboard.html',
    'frontend/modules/transactions/transactions.html',
    'frontend/modules/debts/debts.html',
    'frontend/modules/salaries/salaries.html',
    'frontend/modules/settings/settings.html',
    'frontend/modules/chores/chores.html',
    'frontend/modules/shopping/shopping.html',
    'frontend/modules/chat/chat.html'
];

/**
 * Carrega todos os fragmentos HTML e injeta no DOM.
 * Deve ser chamado antes de qualquer acesso ao DOM das páginas.
 */
export async function loadPages() {
    try {
        const results = await Promise.all(
            PAGE_FRAGMENTS.map(url =>
                fetch(url).then(r => {
                    if (!r.ok) throw new Error(`Falha ao carregar ${url}: ${r.status}`);
                    return r.text();
                })
            )
        );

        const [loginHtml, dashHtml, transHtml, debtsHtml, salHtml, settingsHtml, choresHtml, shopHtml, chatHtml] = results;

        const appContainer = document.getElementById('appContainer');
        const mainContent = document.getElementById('mainContent');

        // Login + Reset modal → antes do appContainer
        appContainer.insertAdjacentHTML('beforebegin', loginHtml);

        // Seções das abas → dentro de <main>
        mainContent.insertAdjacentHTML('beforeend', dashHtml);
        mainContent.insertAdjacentHTML('beforeend', transHtml);
        mainContent.insertAdjacentHTML('beforeend', debtsHtml);
        mainContent.insertAdjacentHTML('beforeend', salHtml);
        mainContent.insertAdjacentHTML('beforeend', settingsHtml);
        mainContent.insertAdjacentHTML('beforeend', choresHtml);
        mainContent.insertAdjacentHTML('beforeend', shopHtml);

        // Chat panel + overlays + modais → depois do appContainer
        appContainer.insertAdjacentHTML('afterend', chatHtml);
    } catch (error) {
        console.error('❌ Erro ao carregar páginas:', error);
        document.body.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;text-align:center;padding:2rem;background:#1a1a2e;color:#fff">
                <div>
                    <h2>Erro ao carregar a aplicação</h2>
                    <p style="color:#aaa;margin:1rem 0">${error.message}</p>
                    <button onclick="location.reload()" style="padding:.75rem 2rem;border:none;border-radius:8px;background:#3D6A8E;color:#fff;font-size:1rem;cursor:pointer">Tentar novamente</button>
                </div>
            </div>`;
        throw error;
    }
}
