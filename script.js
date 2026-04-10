 import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    const firebaseConfig = {
        apiKey: "AIzaSyC7Yq9xkRQAEaArEj-BiAjSJw1-yRLdT0s",
        authDomain: "calculadoramaker3d.firebaseapp.com",
        projectId: "calculadoramaker3d",
        storageBucket: "calculadoramaker3d.firebasestorage.app",
        messagingSenderId: "573950888494",
        appId: "1:573950888494:web:892640f7b82b06c60eedbf",
        measurementId: "G-6TTNPLKLVC"
    };

    const appId = "calculadora-v3";
    let app, auth, db, user = null;
    let isOffline = true;

    // MATERIAIS PADRÃO (PRESETS)
    let materials = [
        { nome: "PLA", valor: 120 },
        { nome: "PETG", valor: 140 },
        { nome: "ABS", valor: 110 }
    ];
    let currentMaterial = materials[0];

    const updateUIStatus = (online) => {
        isOffline = !online;
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (dot) dot.className = online ? "h-2 w-2 bg-green-500 rounded-full" : "h-2 w-2 bg-orange-500 rounded-full";
        if (text) text.textContent = online ? "Firebase Conectado" : "Offline / Local Storage";
    };

    const init = async () => {
        loadLocalSettings();
        renderLocalHistory();
        
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            await signInAnonymously(auth);
            
            onAuthStateChanged(auth, async (u) => {
                if (u) {
                    user = u;
                    updateUIStatus(true);
                    await loadCloudSettings();
                    syncCloudHistory();
                }
            });
        } catch (e) {
            console.warn("Firebase offline:", e.message);
            updateUIStatus(false);
        } finally {
            document.getElementById('loader').style.display = 'none';
            lucide.createIcons();
            renderMaterialSelectors();
        }
    };

    window.changeTab = (tab) => {
        ['calculadora', 'historico', 'config'].forEach(t => {
            const el = document.getElementById(`tab-${t}`);
            if(el) el.classList.toggle('hidden', t !== tab);
            
            const btn = document.getElementById(`btn-tab-${t === 'calculadora' ? 'calc' : t === 'historico' ? 'hist' : 'conf'}`);
            if(btn) btn.className = t === tab ? 'px-8 py-3 font-bold tab-active transition-all' : 'px-8 py-3 font-bold text-slate-500 hover:text-blue-600 transition-all';
        });
        
        if (tab === 'calculadora') renderMaterialSelectors();
        if (tab === 'config') renderConfigMaterials();
        calculate();
    };

    // RENDERIZA OS BOTÕES DE MATERIAL NA ABA PRINCIPAL
    window.renderMaterialSelectors = () => {
        const container = document.getElementById('preset-container');
        if (!container) return;
        container.innerHTML = '';
        
        materials.forEach(m => {
            const isActive = currentMaterial.nome === m.nome;
            const btn = document.createElement('button');
            btn.className = `px-6 py-3 rounded-xl border-2 font-bold text-[11px] transition-all ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`;
            btn.textContent = `${m.nome} (R$${m.valor}/kg)`;
            btn.onclick = () => { 
                currentMaterial = m; 
                renderMaterialSelectors(); 
                calculate(); 
            };
            container.appendChild(btn);
        });
    };

    // RENDERIZA A LISTA DE EDIÇÃO NA ABA DE CONFIGURAÇÕES
    window.renderConfigMaterials = () => {
        const container = document.getElementById('config-preset-list');
        if (!container) return;
        container.innerHTML = '';
        
        materials.forEach((m, i) => {
            const div = document.createElement('div');
            div.className = "flex gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100";
            div.innerHTML = `
                <div class="flex-1">
                    <label class="text-[9px] font-bold text-slate-400 block mb-1">NOME</label>
                    <input type="text" value="${m.nome}" class="input-field text-xs py-2" oninput="materials[${i}].nome=this.value">
                </div>
                <div class="w-24">
                    <label class="text-[9px] font-bold text-slate-400 block mb-1">R$/KG</label>
                    <input type="number" value="${m.valor}" class="input-field text-xs py-2" oninput="materials[${i}].valor=parseFloat(this.value) || 0">
                </div>
            `;
            container.appendChild(div);
        });
    };

    window.calculate = () => {
        const qtd = parseFloat(document.getElementById('proj-qtd').value) || 1;
        const peso = parseFloat(document.getElementById('input-peso').value) || 0;
        const tempo = parseFloat(document.getElementById('input-tempo').value) || 0;
        const extras = parseFloat(document.getElementById('input-extra').value) || 0;

        const maoObraH = parseFloat(document.getElementById('conf-mao-obra').value) || 25;
        const lucroPct = parseFloat(document.getElementById('conf-lucro').value) || 50;
        const taxaMktPct = parseFloat(document.getElementById('conf-taxa-mkt').value) || 18;
        const taxaFixa = parseFloat(document.getElementById('conf-taxa-fixa').value) || 6;

        const custoFilamento = (peso / 1000) * currentMaterial.valor * qtd;
        const custoMaoObra = tempo * maoObraH * qtd;
        const custoTotal = custoFilamento + custoMaoObra + (extras * qtd);

        const divisor = 1 - (lucroPct/100) - (taxaMktPct/100);
        let precoVenda = divisor > 0 ? (custoTotal / divisor) : (custoTotal * 2);
        precoVenda += (taxaFixa * qtd);

        const lucroReal = (precoVenda - (taxaFixa * qtd)) * (lucroPct/100);
        const taxaMktReal = (precoVenda - (taxaFixa * qtd)) * (taxaMktPct/100);

        const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        const updateText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        updateText('res-custo-mat', fmt(custoFilamento));
        updateText('res-mao-obra', fmt(custoMaoObra));
        updateText('res-taxa-mkt', fmt(taxaMktReal));
        updateText('res-lucro-liquido', fmt(lucroReal));
        updateText('res-total', fmt(precoVenda));

        return { precoVenda, lucroReal, qtd };
    };

    // --- PERSISTÊNCIA ---

    const loadLocalSettings = () => {
        const local = localStorage.getItem('maker3d_v3_settings');
        if (local) applyData(JSON.parse(local));
    };

    const loadCloudSettings = async () => {
        if (!user) return;
        try {
            const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'prefs'));
            if (snap.exists()) applyData(snap.data());
        } catch (e) { console.warn("Erro ao ler nuvem:", e.message); }
    };

    const applyData = (d) => {
        document.getElementById('conf-empresa').value = d.empresa || "Minha Empresa 3D";
        document.getElementById('conf-whatsapp').value = d.whatsapp || "";
        document.getElementById('conf-mao-obra').value = d.maoObra || 25;
        document.getElementById('conf-lucro').value = d.lucro || 50;
        document.getElementById('conf-taxa-mkt').value = d.taxaMkt || 18;
        document.getElementById('conf-taxa-fixa').value = d.taxaFixa || 6;
        if (d.materials) {
            materials = d.materials;
            currentMaterial = materials[0];
        }
        updateBrand();
        renderMaterialSelectors();
        calculate();
    };

    window.saveAndGoBack = async () => {
        const data = {
            empresa: document.getElementById('conf-empresa').value,
            whatsapp: document.getElementById('conf-whatsapp').value,
            maoObra: document.getElementById('conf-mao-obra').value,
            lucro: document.getElementById('conf-lucro').value,
            taxaMkt: document.getElementById('conf-taxa-mkt').value,
            taxaFixa: document.getElementById('conf-taxa-fixa').value,
            materials: materials
        };
        
        localStorage.setItem('maker3d_v3_settings', JSON.stringify(data));
        
        if (user && !isOffline) {
            try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'prefs'), data); } catch(e){}
        }
        
        changeTab('calculadora');
    };

    window.saveToCloud = async () => {
        const res = calculate();
        const nome = document.getElementById('proj-nome').value || "Sem Nome";
        const entry = {
            nome,
            total: res.precoVenda,
            lucro: res.lucroReal,
            qtd: res.qtd,
            data: new Date().toISOString()
        };

        const hist = JSON.parse(localStorage.getItem('maker3d_v3_history') || '[]');
        hist.push(entry);
        localStorage.setItem('maker3d_v3_history', JSON.stringify(hist));

        if (user && !isOffline) {
            try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), entry); } catch(e){}
        }
        
        alert("Salvo com sucesso!");
        renderLocalHistory();
    };

    const syncCloudHistory = () => {
        if (!user) return;
        onSnapshot(collection(db, 'artifacts', appId, 'users', user.uid, 'history'), snap => {
            const docs = [];
            snap.forEach(d => docs.push({id: d.id, ...d.data()}));
            renderTable(docs, true);
        }, (err) => {
            updateUIStatus(false);
            renderLocalHistory();
        });
    };

    const renderLocalHistory = () => {
        const hist = JSON.parse(localStorage.getItem('maker3d_v3_history') || '[]');
        renderTable(hist, false);
    };

    const renderTable = (docs, fromCloud) => {
        const list = document.getElementById('history-list');
        if (!list) return;
        list.innerHTML = '';
        docs.sort((a,b) => new Date(b.data) - new Date(a.data)).forEach((it, idx) => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-slate-50 text-xs";
            tr.innerHTML = `
                <td class="py-4 text-slate-400">${new Date(it.data).toLocaleDateString()}</td>
                <td class="py-4 font-bold text-slate-800">${it.nome}</td>
                <td class="py-4 text-center">${it.qtd}</td>
                <td class="py-4 text-right font-black text-blue-600">${it.total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                <td class="py-4 text-center">
                    <button onclick="deleteRow('${fromCloud ? it.id : idx}', ${fromCloud})" class="text-slate-300 hover:text-red-500">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            `;
            list.appendChild(tr);
        });
        lucide.createIcons();
    };

    window.deleteRow = async (id, fromCloud) => {
        if (!confirm("Excluir venda?")) return;
        if (fromCloud && user && !isOffline) {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'history', id));
        } else {
            const hist = JSON.parse(localStorage.getItem('maker3d_v3_history') || '[]');
            hist.splice(id, 1);
            localStorage.setItem('maker3d_v3_history', JSON.stringify(hist));
            renderLocalHistory();
        }
    };

    window.forceSync = () => {
        if (user && !isOffline) syncCloudHistory();
        else alert("Firebase não conectado.");
    };

    window.updateBrand = () => {
        const el = document.getElementById('display-empresa');
        const input = document.getElementById('conf-empresa');
        if (el && input) el.textContent = input.value || "Minha Empresa 3D";
    };

    window.shareWhatsApp = () => {
        const zap = document.getElementById('conf-whatsapp').value.replace(/\D/g, '');
        const msg = `Orçamento 3D: *${document.getElementById('proj-nome').value}*\nValor: *${document.getElementById('res-total').textContent}*`;
        window.open(`https://wa.me/${zap}?text=${encodeURIComponent(msg)}`, '_blank');
    };
