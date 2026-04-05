// --- ESTADO INICIAL ---
let history = JSON.parse(localStorage.getItem('i3d_history')) || [];
let configs = JSON.parse(localStorage.getItem('i3d_configs')) || {
    kwh: 0.85,
    watts: 100,
    valorMaq: 2500,
    vidaMaq: 5000,
    risco: 10
};

// --- FUNÇÕES DE INTERFACE (DEFINIDAS NO WINDOW PARA ACESSO GLOBAL) ---
window.changeTab = function(tab) {
    document.getElementById('tab-calculadora').classList.add('hidden');
    document.getElementById('tab-historico').classList.add('hidden');
    document.getElementById('tab-config').classList.add('hidden');
    
    document.getElementById('btn-tab-calc').classList.remove('tab-active');
    document.getElementById('btn-tab-hist').classList.remove('tab-active');
    document.getElementById('btn-tab-conf').classList.remove('tab-active');
    document.getElementById('btn-tab-calc').classList.add('text-gray-500');
    document.getElementById('btn-tab-hist').classList.add('text-gray-500');
    document.getElementById('btn-tab-conf').classList.add('text-gray-500');

    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    const btnId = tab === 'calculadora' ? 'btn-tab-calc' : tab === 'historico' ? 'btn-tab-hist' : 'btn-tab-conf';
    const activeBtn = document.getElementById(btnId);
    activeBtn.classList.add('tab-active');
    activeBtn.classList.remove('text-gray-500');
};

// --- SMART INPUTS ---
window.formatPeso = function(el) {
    let val = el.value.toLowerCase().replace(',', '.');
    let grams = 0;
    if (val.includes('kg')) {
        grams = parseFloat(val) * 1000;
    } else {
        grams = parseFloat(val) || 0;
    }
    el.dataset.grams = grams;
    el.value = grams + 'g';
};

window.formatTempo = function(el) {
    let val = el.value.toLowerCase().replace(',', '.');
    let totalHours = 0;
    if (val.includes(':') || val.includes('h')) {
        let parts = val.split(/[:h]/);
        let h = parseFloat(parts[0]) || 0;
        let m = parseFloat(parts[1]) || 0;
        totalHours = h + (m / 60);
        el.value = `${h}h ${m}m`;
    } else {
        totalHours = parseFloat(val) || 0;
        let h = Math.floor(totalHours);
        let m = Math.round((totalHours - h) * 60);
        el.value = `${h}h ${m}m`;
    }
    el.dataset.decimalHours = totalHours;
};

window.setMaterial = function(preco) {
    document.getElementById('custo-material-kg').value = preco;
    window.calculate();
};

// --- CÁLCULOS PRINCIPAIS ---
window.calculate = function() {
    const pesoG = parseFloat(document.getElementById('input-peso').dataset.grams) || 0;
    const horas = parseFloat(document.getElementById('input-tempo').dataset.decimalHours) || 0;
    const materialKg = parseFloat(document.getElementById('custo-material-kg').value) || 0;
    const custoExtra = parseFloat(document.getElementById('custo-extra').value) || 0;
    const qtd = parseInt(document.getElementById('proj-qtd').value) || 1;
    const mkpPerc = parseFloat(document.getElementById('taxa-mkp').value) || 0;
    const markup = parseFloat(document.getElementById('markup').value) || 0;

    const custoMat = (pesoG / 1000) * materialKg;
    const custoEnergia = (configs.watts / 1000) * horas * configs.kwh;
    const custoDepre = (configs.valorMaq / configs.vidaMaq) * horas;

    const baseProducao = custoMat + custoEnergia + custoDepre + custoExtra;
    const margemRisco = baseProducao * (configs.risco / 100);
    const custoFinalProducao = baseProducao + margemRisco;

    let precoSemTaxa = custoFinalProducao * (1 + (markup / 100));
    let precoFinalTotal = (precoSemTaxa / (1 - (mkpPerc / 100))) * qtd;

    if (isNaN(precoFinalTotal)) precoFinalTotal = 0;

    document.getElementById('res-custo-base').innerText = `R$ ${ (custoFinalProducao * qtd).toFixed(2) }`;
    document.getElementById('res-taxas').innerText = `R$ ${ (precoFinalTotal * (mkpPerc/100)).toFixed(2) }`;
    document.getElementById('res-preco-total').innerText = `R$ ${precoFinalTotal.toFixed(2)}`;
    document.getElementById('res-preco-unit').innerText = `R$ ${(precoFinalTotal / qtd).toFixed(2)}`;

    updateVisuals(custoMat * qtd, (custoEnergia + custoDepre) * qtd, precoFinalTotal * (mkpPerc/100), precoFinalTotal);
    
    const alerta = document.getElementById('alerta-lucro');
    if (markup < 20) {
        alerta.classList.remove('hidden');
    } else {
        alerta.classList.add('hidden');
    }
};

function updateVisuals(mat, ops, tax, total) {
    if (total <= 0) return;
    const pMat = (mat / total) * 100;
    const pOps = (ops / total) * 100;
    const pTax = (tax / total) * 100;
    const pLucro = Math.max(0, 100 - (pMat + pOps + pTax));

    document.getElementById('bar-mat').style.width = pMat + '%';
    document.getElementById('label-p-mat').innerText = Math.round(pMat) + '%';
    document.getElementById('bar-ops').style.width = pOps + '%';
    document.getElementById('label-p-ops').innerText = Math.round(pOps) + '%';
    document.getElementById('bar-tax').style.width = pTax + '%';
    document.getElementById('label-p-tax').innerText = Math.round(pTax) + '%';
    document.getElementById('bar-lucro').style.width = pLucro + '%';
    document.getElementById('label-p-lucro').innerText = Math.round(pLucro) + '%';
}

window.magicArredondar = function() {
    const precoAtual = parseFloat(document.getElementById('res-preco-total').innerText.replace('R$ ', ''));
    if (precoAtual === 0) return;
    let novoPreco = Math.ceil(precoAtual) - 0.10;
    if (novoPreco < precoAtual) novoPreco += 1.0;
    document.getElementById('res-preco-total').innerText = `R$ ${novoPreco.toFixed(2)}`;
    document.getElementById('res-preco-unit').innerText = `R$ ${(novoPreco / parseInt(document.getElementById('proj-qtd').value)).toFixed(2)}`;
};

// --- PERSISTÊNCIA ---
window.saveConfigs = function() {
    configs = {
        kwh: parseFloat(document.getElementById('conf-kwh').value),
        watts: parseFloat(document.getElementById('conf-watts').value),
        valorMaq: parseFloat(document.getElementById('conf-valor-maq').value),
        vidaMaq: parseFloat(document.getElementById('conf-vida-maq').value),
        risco: parseFloat(document.getElementById('conf-risco').value)
    };
    localStorage.setItem('i3d_configs', JSON.stringify(configs));
    alert("Configurações Salvas!");
    window.calculate();
};

function loadConfigsToFields() {
    document.getElementById('conf-kwh').value = configs.kwh;
    document.getElementById('conf-watts').value = configs.watts;
    document.getElementById('conf-valor-maq').value = configs.valorMaq;
    document.getElementById('conf-vida-maq').value = configs.vidaMaq;
    document.getElementById('conf-risco').value = configs.risco;
}

window.saveBudget = function() {
    const nome = document.getElementById('proj-nome').value || "Projeto Sem Nome";
    const cliente = document.getElementById('proj-cliente').value || "Cliente Final";
    const valor = document.getElementById('res-preco-total').innerText;
    const item = { id: Date.now(), nome, cliente, data: new Date().toLocaleDateString('pt-BR'), valor };
    history.unshift(item);
    localStorage.setItem('i3d_history', JSON.stringify(history));
    renderHistory();
    alert("Orçamento salvo!");
};

function renderHistory() {
    const container = document.getElementById('lista-historico');
    if(!container) return;
    container.innerHTML = history.map(item => `
        <tr class="border-b hover:bg-gray-50 text-sm">
            <td class="p-3">${item.nome}</td>
            <td class="p-3">${item.cliente}</td>
            <td class="p-3">${item.data}</td>
            <td class="p-3 font-bold text-blue-600">${item.valor}</td>
            <td class="p-3">
                <button onclick="deleteHist(${item.id})" class="text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

window.deleteHist = function(id) {
    history = history.filter(h => h.id !== id);
    localStorage.setItem('i3d_history', JSON.stringify(history));
    renderHistory();
};

window.clearAllHistory = function() {
    if(confirm("Deseja apagar todo o histórico?")) {
        history = [];
        localStorage.removeItem('i3d_history');
        renderHistory();
    }
};

window.shareWhatsApp = function() {
    const nome = document.getElementById('proj-nome').value;
    const total = document.getElementById('res-preco-total').innerText;
    const texto = `Olá! Orçamento da *IMPRESSÃO3DBRASIL*:\n*Projeto:* ${nome}\n*Valor Total:* ${total}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
};

window.exportCSV = function() {
    let csv = "Projeto;Cliente;Data;Valor\n" + history.map(h => `${h.nome};${h.cliente};${h.data};${h.valor}`).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + csv));
    link.setAttribute("download", "historico_orcamentos.csv");
    document.body.appendChild(link);
    link.click();
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadConfigsToFields();
    renderHistory();
    window.calculate();
});