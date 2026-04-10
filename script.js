    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    // Dados Injetados do Ambiente
    const firebaseConfig = JSON.parse(__firebase_config);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'calculadora-3d-v3';
    
    let app, auth, db, user = null;
    let materials = [{ nome: "PLA", valor: 120 }, { nome: "PETG", valor: 140 }, { nome: "ABS", valor: 110 }];
    let currentMaterial = materials[0];

    // Inicialização do Firebase seguindo as Regras de Segurança
    const initFirebase = async () => {
        try {
            app = initializeApp(firebaseConfig);
            auth = getAuth(app);
            db = getFirestore(app);

            // Tenta autenticar com Token Customizado ou Anônimo
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }

            onAuthStateChanged(auth, async (u) => {
                if (u) {
                    user = u;
                    updateUIStatus(true);
                    await loadCloudSettings();
                    setupRealtimeHistory();
                } else {
                    updateUIStatus(false);
                }
                document.getElementById('loader').style.display = 'none';
                calculate();
            });
        } catch (e) {
            console.error("Erro Crítico Firebase:", e);
            updateUIStatus(false);
            document.getElementById('loader').style.display = 'none';
        }
    };

    const updateUIStatus = (online) => {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (dot) dot.className = online ? "h-2 w-2 bg-green-500 rounded-full" : "h-2 w-2 bg-red-500 rounded-full";
        if (text) text.textContent = online ? "Sincronizado com Nuvem" : "Erro de Conexão (Local)";
    };

    // --- LÓGICA DE NEGÓCIO ---

    window.calculate = () => {
        const qtd = parseFloat(document.getElementById('proj-qtd').value) || 1;
        const peso = parseFloat(document.getElementById('input-peso').value) || 0;
        const tempo = parseFloat(document.getElementById('input-tempo').value) || 0;
        const maoObraH = parseFloat(document.getElementById('conf-mao-obra').value) || 25;
        const lucroPct = parseFloat(document.getElementById('conf-lucro').value) || 50;
        
        const custoMat = (peso / 1000) * currentMaterial.valor * qtd;
        const custoMao = tempo * maoObraH * qtd;
        const base = custoMat + custoMao;
        
        const total = base / (1 - (lucroPct / 100));
        
        document.getElementById('res-custo-mat').textContent = custoMat.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('res-mao-obra').textContent = custoMao.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        document.getElementById('res-total').textContent = total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
        
        return { total, qtd, custoMat, custoMao };
    };

    window.saveToCloud = async () => {
        if (!user) { alert("Aguarde a conexão..."); return; }
        const res = calculate();
        const entry = {
            nome: document.getElementById('proj-nome').value || "Sem Nome",
            total: res.total,
            qtd: res.qtd,
            data: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'vendas'), entry);
            alert("Venda registrada na nuvem!");
        } catch (e) { console.error(e); }
    };

    const setupRealtimeHistory = () => {
        const q = collection(db, 'artifacts', appId, 'users', user.uid, 'vendas');
        onSnapshot(q, (snap) => {
            const list = document.getElementById('history-list');
            list.innerHTML = '';
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const tr = document.createElement('tr');
                tr.className = "border-b text-xs";
                tr.innerHTML = `
                    <td class="py-4 text-slate-400">${new Date(data.data).toLocaleDateString()}</td>
                    <td class="py-4 font-bold">${data.nome}</td>
                    <td class="py-4 text-right font-black text-blue-600">${data.total.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                    <td class="py-4 text-center">
                        <button onclick="deleteSale('${docSnap.id}')" class="text-red-400 hover:text-red-600"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </td>`;
                list.appendChild(tr);
            });
            lucide.createIcons();
        }, (err) => console.error("Erro no Listener:", err));
    };

    window.deleteSale = async (id) => {
        if (!confirm("Excluir registro?")) return;
        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'vendas', id));
    };

    const loadCloudSettings = async () => {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'prefs'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('conf-empresa').value = d.empresa || "";
            document.getElementById('conf-whatsapp').value = d.whatsapp || "";
            document.getElementById('conf-mao-obra').value = d.maoObra || 25;
            document.getElementById('conf-lucro').value = d.lucro || 50;
            if (d.materials) materials = d.materials;
            updateBrand();
        }
    };

    window.saveAndGoBack = async () => {
        const data = {
            empresa: document.getElementById('conf-empresa').value,
            whatsapp: document.getElementById('conf-whatsapp').value,
            maoObra: document.getElementById('conf-mao-obra').value,
            lucro: document.getElementById('conf-lucro').value,
            materials: materials
        };
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'prefs'), data);
        changeTab('calculadora');
    };

    // --- UI HELPERS ---

    window.changeTab = (tab) => {
        ['calculadora', 'historico', 'config'].forEach(t => document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab));
        renderMaterialSelectors();
        if (tab === 'config') renderConfigMaterials();
    };

    window.renderMaterialSelectors = () => {
        const container = document.getElementById('preset-container');
        container.innerHTML = '';
        materials.forEach(m => {
            const btn = document.createElement('button');
            btn.className = `px-6 py-3 rounded-xl border-2 font-bold text-[11px] ${currentMaterial.nome === m.nome ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white text-slate-500'}`;
            btn.textContent = `${m.nome} (R$${m.valor}/kg)`;
            btn.onclick = () => { currentMaterial = m; renderMaterialSelectors(); calculate(); };
            container.appendChild(btn);
        });
    };

    window.renderConfigMaterials = () => {
        const container = document.getElementById('config-preset-list');
        container.innerHTML = '';
        materials.forEach((m, i) => {
            const div = document.createElement('div');
            div.className = "flex gap-2 p-2 bg-slate-50 rounded-lg";
            div.innerHTML = `
                <input type="text" value="${m.nome}" class="input-field py-1 text-xs" oninput="materials[${i}].nome=this.value">
                <input type="number" value="${m.valor}" class="input-field py-1 text-xs w-24" oninput="materials[${i}].valor=this.value">
            `;
            container.appendChild(div);
        });
    };

    window.updateBrand = () => {
        document.getElementById('display-empresa').textContent = document.getElementById('conf-empresa').value || "Minha Empresa 3D";
    };

    window.exportPDF = () => {
        const { jsPDF } = window.jspdf;
        const docPDF = new jsPDF();
        docPDF.text("Orçamento de Impressão 3D", 20, 20);
        docPDF.text(`Produto: ${document.getElementById('proj-nome').value || 'N/A'}`, 20, 40);
        docPDF.text(`Total: ${document.getElementById('res-total').textContent}`, 20, 50);
        docPDF.save("orcamento.pdf");
    };

    window.shareWhatsApp = () => {
        const num = document.getElementById('conf-whatsapp').value.replace(/\D/g, '');
        const msg = `Orçamento: ${document.getElementById('res-total').textContent}`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`);
    };