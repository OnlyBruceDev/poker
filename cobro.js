document.addEventListener("DOMContentLoaded", () => {
  // Configurar Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyDpCE-hcBRS_FfB-mMVtNveG_ZFwLPBC5Y",
    authDomain: "cerritopoker-34ad3.firebaseapp.com",
    databaseURL: "https://cerritopoker-34ad3-default-rtdb.firebaseio.com/",
    projectId: "cerritopoker-34ad3",
    storageBucket: "cerritopoker-34ad3.appspot.com",
    messagingSenderId: "452144009958",
    appId: "1:452144009958:web:5f34289399a6e7f7f76127"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const database = firebase.database();


  // Último cliente modificado
  let lastModifiedKey = null;

  // NUEVA variable global con todos los clientes para filtrar
  let currentClients = {};
  let currentLibreClients = {};

  // Tipos de fichas configurados
  let chipTypes = {};

  // Forzar cierre de sesión para desarrollo
  auth.signOut();

  // Función para reproducir la alarma al finalizar un nivel
  function playAlarm() {
    const alarmSound = new Audio('./alarm.mp3');
    alarmSound.play().catch(error => console.error("Error al reproducir la alarma:", error));
  }

  /* =====================
       AUTENTICACIÓN
  ===================== */
  auth.onAuthStateChanged(user => {
    if (user) {
      document.getElementById("login-container").classList.add("hidden");
      document.getElementById("app-container").classList.remove("hidden");
    } else {
      document.getElementById("login-container").classList.remove("hidden");
      document.getElementById("app-container").classList.add("hidden");
    }
  });

  /* =====================
       PRECIOS
  ===================== */
  let prices = { Entrada: 40, Recompra: 20, Adicion: 50 };

  function updatePricesUI() {
    document.getElementById("entrada-price").value = prices.Entrada;
    document.getElementById("recompra-price").value = prices.Recompra;
    document.getElementById("adicion-price").value = prices.Adicion;
  }

  // Login
  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      const email = document.getElementById("username").value;
      const password = document.getElementById("password").value;
      auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert("Error: " + error.message));
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => auth.signOut());
  }

  // Toggle precios
  document.getElementById("toggle-prices-btn")?.addEventListener("click", () => {
    const priceSettings = document.getElementById("price-settings");
    priceSettings.style.display = (priceSettings.style.display === "block") ? "none" : "block";
  });

  // Actualizar precios
  document.getElementById("update-prices-btn")?.addEventListener("click", () => {
    prices.Entrada   = parseFloat(document.getElementById("entrada-price").value)   || 0;
    prices.Recompra  = parseFloat(document.getElementById("recompra-price").value)  || 0;
    prices.Adicion   = parseFloat(document.getElementById("adicion-price").value)   || 0;
    renderClients(currentClients);
    renderLibreClients(currentClients);
    renderMetrics(currentClients);
    alert("Precios actualizados");
  });

  // Agregar tipo de ficha
  document.getElementById("add-chip-type-btn")?.addEventListener("click", () => {
    const color = document.getElementById("chip-color").value.trim();
    const quantity = parseInt(document.getElementById("chip-qty").value) || 0;
    const value = parseFloat(document.getElementById("chip-value").value) || 0;
    if (!color) return alert("Ingresa color de ficha");
    chipTypesRef.child(color).set({ quantity, available: quantity, value });
    document.getElementById("chip-color").value = "";
    document.getElementById("chip-qty").value = "";
    document.getElementById("chip-value").value = "";
  });

  /* =====================
       CLIENTES
  ===================== */
  const clientsRef = database.ref("clients");
  const libreClientsRef = database.ref("libreClients");
  const chipTypesRef = database.ref("chipTypes");

  chipTypesRef.on("value", snapshot => {
    chipTypes = snapshot.val() || {};
    renderChipTypes();
    renderClients(currentClients);
    renderLibreClients(currentLibreClients);
  });

  clientsRef.on("value", snapshot => {
    currentClients = snapshot.val() || {};
    renderClients(currentClients);
    renderMetrics(currentClients);
  });

  libreClientsRef.on("value", snapshot => {
    currentLibreClients = snapshot.val() || {};
    renderLibreClients(currentLibreClients);
  });

  function addClient(name) {
    const ref = clientsRef.push({
      name,
      beerCounts: { Entrada: 0, Recompra: 0, Adicion: 0 },
      chips: {},
      selected: false,
      note: "",
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    lastModifiedKey = ref.key;
  }

  function addLibreClient(name) {
    const ref = libreClientsRef.push({
      name,
      chips: {},
      selected: false,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
    lastModifiedKey = ref.key;
  }

  // Evitar duplicados
  document.getElementById("add-client-btn")?.addEventListener("click", () => {
    const input = document.getElementById("client-name");
    const name  = input.value.trim();
    if (!name) return alert("Por favor ingresa un nombre de cliente.");
    const exists = Object.values(currentClients).some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return alert("Ya existe un cliente con ese nombre.");
    addClient(name);
    input.value = "";
  });

  document.getElementById("add-libre-client-btn")?.addEventListener("click", () => {
    const input = document.getElementById("libre-client-name");
    const name  = input.value.trim();
    if (!name) return alert("Por favor ingresa un nombre de cliente.");
    const exists = Object.values(currentLibreClients).some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return alert("Ya existe un cliente con ese nombre.");
    addLibreClient(name);
    input.value = "";
  });

  function updateBeerCount(clientKey, beerType, increment) {
    const ref = database.ref(`clients/${clientKey}/beerCounts/${beerType}`);
    ref.transaction(count => Math.max(0, (count || 0) + increment));
    lastModifiedKey = clientKey;
  }

  function toggleBeerCount(clientKey, beerType) {
    const ref = database.ref(`clients/${clientKey}/beerCounts/${beerType}`);
    ref.transaction(val => (val === 1 ? 0 : 1));
    lastModifiedKey = clientKey;
  }

  function updateChipCount(clientKey, chipType, increment) {
    const clientRef = database.ref(`clients/${clientKey}/chips/${chipType}`);
    const availRef = database.ref(`chipTypes/${chipType}/available`);

    if (increment > 0) {
      availRef.transaction(avail => {
        if (avail === null) return 0;
        if (avail <= 0) return; // abort
        return avail - 1;
      }, (err, committed) => {
        if (committed) {
          clientRef.transaction(c => (c || 0) + 1);
          lastModifiedKey = clientKey;
        }
      });
    } else if (increment < 0) {
      clientRef.transaction(c => {
        const val = Math.max(0, (c || 0) - 1);
        if (val < (c || 0)) {
          availRef.transaction(a => (a || 0) + 1);
        }
        if (val < (c || 0)) lastModifiedKey = clientKey;
        return val;
      });
    }
  }

  function updateLibreChipCount(clientKey, chipType, increment) {
    const clientRef = database.ref(`libreClients/${clientKey}/chips/${chipType}`);
    const availRef = database.ref(`chipTypes/${chipType}/available`);

    if (increment > 0) {
      availRef.transaction(avail => {
        if (avail === null) return 0;
        if (avail <= 0) return; // abort
        return avail - 1;
      }, (err, committed) => {
        if (committed) {
          clientRef.transaction(c => (c || 0) + 1);
          lastModifiedKey = clientKey;
        }
      });
    } else if (increment < 0) {
      clientRef.transaction(c => {
        const val = Math.max(0, (c || 0) - 1);
        if (val < (c || 0)) {
          availRef.transaction(a => (a || 0) + 1);
        }
        if (val < (c || 0)) lastModifiedKey = clientKey;
        return val;
      });
    }
  }

  function deleteLibreClient(clientKey) {
    database.ref(`libreClients/${clientKey}`).remove();
  }

  function deleteClient(clientKey) {
    database.ref(`clients/${clientKey}`).remove();
  }

  function updateClientNote(clientKey, note) {
    database.ref(`clients/${clientKey}/note`).set(note);
    lastModifiedKey = clientKey;
  }

  function updateClientSelected(clientKey, selected) {
    database.ref(`clients/${clientKey}/selected`).set(!!selected);
    lastModifiedKey = clientKey;
  }

  function updateChipType(color, quantity, value) {
    const cfg = chipTypes[color] || {};
    const used = (cfg.quantity || 0) - (cfg.available || 0);
    let available = quantity - used;
    if (available < 0) available = 0;
    chipTypesRef.child(color).update({ quantity, value, available });
  }

  function deleteChipType(color) {
    chipTypesRef.child(color).remove();
    clientsRef.once("value").then(s => {
      s.forEach(c => database.ref(`clients/${c.key}/chips/${color}`).remove());
    });
    libreClientsRef.once("value").then(s => {
      s.forEach(c => database.ref(`libreClients/${c.key}/chips/${color}`).remove());
    });
  }

  function calculateTotalRevenue(clients) {
    return Object.values(clients).reduce((total, client) => {
      const counts = client.beerCounts || {};
      return total + (prices.Entrada  * (counts.Entrada  || 0)) +
                     (prices.Recompra * (counts.Recompra || 0)) +
                     (prices.Adicion  * (counts.Adicion  || 0));
    }, 0);
  }

  function buildClientCard(key, client, index, options) {
    let showChips = false;
    let showBeer = true;
    let showNotes = false;
    let showCheckbox = true;
    let chipUpdater = updateChipCount;
    let beerUpdater = updateBeerCount;
    let noteUpdater = updateClientNote;
    let deleteFn = deleteClient;

    if (typeof options === 'boolean') {
      showChips = options;
    } else if (typeof options === 'object' && options !== null) {
      showChips = !!options.showChips;
      showBeer = options.showBeer !== false;
      showNotes = !!options.showNotes;
      if (options.showCheckbox === false) showCheckbox = false;
      if (options.updateChip) chipUpdater = options.updateChip;
      if (options.updateBeer) beerUpdater = options.updateBeer;
      if (options.updateNote) noteUpdater = options.updateNote;
      if (options.deleteFn) deleteFn = options.deleteFn;
    }
    const card = document.createElement("div");
    card.className = "client-card collapsed";
    if (key === lastModifiedKey) card.classList.add("last-modified");

    const header = document.createElement("div");
    header.className = "client-card-header";
    header.innerHTML = `<h3>${index + 1}. ${client.name}</h3>`;
    header.style.cursor = "pointer";
    header.addEventListener("click", e => {
      if (!["BUTTON", "I"].includes(e.target.tagName)) {
        card.classList.toggle("collapsed");
      }
    });
    card.appendChild(header);

    const countsDiv = document.createElement("div");
    countsDiv.className = "client-card-counts";

    const beerTypes = ["Entrada", "Recompra", "Adicion"];
    let clientTotal = 0;

    if (showBeer) beerTypes.forEach(type => {
      const wrapper = document.createElement("div");
      wrapper.className = "client-card-count";
      wrapper.innerHTML = `<span>${type}</span>`;

      const count = (client.beerCounts && client.beerCounts[type]) || 0;

      if (type === "Entrada" || type === "Adicion") {
        const btn = document.createElement("button");
        btn.className = "toggle-btn";
        btn.innerHTML = `<i class="material-icons">${count === 1 ? "toggle_on" : "toggle_off"}</i>`;
        btn.firstChild.style.color = count === 1 ? "green" : "gray";
        btn.onclick = () => toggleBeerCount(key, type);
        wrapper.appendChild(btn);
      } else {
        const val = document.createElement("span");
        val.className = "count-value";
        val.textContent = count;
        wrapper.appendChild(val);

        const controls = document.createElement("div");
        controls.className = "count-controls";
        controls.innerHTML = `
          <button class="action-btn arrow-btn">&lt;</button>
          <button class="action-btn arrow-btn">&gt;</button>`;
        const [decBtn, incBtn] = controls.querySelectorAll("button");
        decBtn.addEventListener("click", e => {
          e.stopPropagation();
          beerUpdater(key, type, -1);
        });
        incBtn.addEventListener("click", e => {
          e.stopPropagation();
          beerUpdater(key, type, 1);
        });
        wrapper.appendChild(controls);
      }

      clientTotal += count * prices[type];
      countsDiv.appendChild(wrapper);
    });

    if (showChips) {
      Object.keys(chipTypes).forEach(type => {
        const wrapper = document.createElement("div");
        wrapper.className = "client-card-count";
        wrapper.innerHTML = `<span>${type}</span>`;

        const count = (client.chips && client.chips[type]) || 0;
        const val = document.createElement("span");
        val.className = "count-value";
        val.textContent = count;
        wrapper.appendChild(val);

        const controls = document.createElement("div");
        controls.className = "count-controls";
        controls.innerHTML = `
          <button class="action-btn arrow-btn">&lt;</button>
          <button class="action-btn arrow-btn">&gt;</button>`;
        const [decBtn, incBtn] = controls.querySelectorAll("button");
        decBtn.addEventListener("click", e => {
          e.stopPropagation();
          chipUpdater(key, type, -1);
        });
        incBtn.addEventListener("click", e => {
          e.stopPropagation();
          chipUpdater(key, type, 1);
        });
        clientTotal += count * ((chipTypes[type] && chipTypes[type].value) || 0);
        wrapper.appendChild(controls);
        countsDiv.appendChild(wrapper);
      });
    }

    card.appendChild(countsDiv);

    const totalDiv = document.createElement("div");
    totalDiv.className = "client-card-total";
    totalDiv.textContent = `Total: $${clientTotal.toLocaleString()}`;
    card.appendChild(totalDiv);

    const actions = document.createElement("div");
    actions.className = "client-card-actions";
    actions.innerHTML = `${showCheckbox ? '<input type="checkbox" class="client-checkbox">' : ''}`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "action-btn delete-btn";
    deleteBtn.innerHTML = '<i class="material-icons">close</i>';
    deleteBtn.addEventListener("click", e => {
      e.stopPropagation();
      deleteFn(key);
    });
    card.appendChild(deleteBtn);

    if (showCheckbox) {
      const cb = actions.querySelector(".client-checkbox");
      cb.checked = !!client.selected;
      cb.addEventListener("change", e => updateClientSelected(key, e.target.checked));
    }

    if (showNotes) {
      const noteBtn = document.createElement("button");
      noteBtn.className = "action-btn note-btn";
      noteBtn.textContent = "Notas";
      actions.prepend(noteBtn);

      if (client.note && client.note.trim() !== "") {
        noteBtn.classList.add("has-note");
      }

      const noteArea = document.createElement("textarea");
      noteArea.className = "client-note hidden";
      noteArea.value = client.note || "";
      noteArea.addEventListener("click", e => e.stopPropagation());
      noteArea.addEventListener("change", e => {
        noteUpdater(key, e.target.value);
        if (e.target.value.trim()) noteBtn.classList.add("has-note");
        else noteBtn.classList.remove("has-note");
      });
      noteBtn.addEventListener("click", e => {
        e.stopPropagation();
        noteArea.classList.toggle("hidden");
      });
      card.appendChild(noteArea);
    }
    card.appendChild(actions);
    return card;
  }

  /* ===== BÚSQUEDA ===== */
  document.getElementById("client-search")?.addEventListener("input", () => {
    renderClients(currentClients);
    renderLibreClients(currentLibreClients);
  });

  document.getElementById("libre-client-search")?.addEventListener("input", () => {
    renderLibreClients(currentLibreClients);
  });

  /* =====================
       RENDERIZACIÓN
  ===================== */
  function renderClients(clients) {
    const list = document.getElementById("client-list");
    const totalRevenueEl = document.getElementById("total-revenue");
    if (!list || !totalRevenueEl) return;

    const term = (document.getElementById("client-search")?.value || "").trim().toLowerCase();
    const entries = Object.entries(clients).sort(([,a],[,b]) => {
      const t1 = (typeof a.createdAt === 'number') ? a.createdAt : Number.MAX_SAFE_INTEGER;
      const t2 = (typeof b.createdAt === 'number') ? b.createdAt : Number.MAX_SAFE_INTEGER;
      return t1 - t2;
    });

    const filtered = entries.filter(([, c]) => c.name.toLowerCase().includes(term));

    list.innerHTML = "";


    filtered.forEach(([key, client], index) => {
      const card = buildClientCard(key, client, index, { showNotes: true });
      list.appendChild(card);
    });

    totalRevenueEl.textContent = `Total Recaudado: $${calculateTotalRevenue(filtered.reduce((obj,[k,v])=>{obj[k]=v;return obj;},{})).toLocaleString()}`;
  }

  function renderLibreClients(clients) {
    const list = document.getElementById("libre-client-list");
    if (!list) return;
    const term = (document.getElementById("libre-client-search")?.value || "").trim().toLowerCase();
    const entries = Object.entries(clients).sort(([,a],[,b]) => {
      const t1 = (typeof a.createdAt === 'number') ? a.createdAt : Number.MAX_SAFE_INTEGER;
      const t2 = (typeof b.createdAt === 'number') ? b.createdAt : Number.MAX_SAFE_INTEGER;
      return t1 - t2;
    });

    const filtered = entries.filter(([, c]) => c.name.toLowerCase().includes(term));
    list.innerHTML = "";

    filtered.forEach(([key, client], index) => {
      const card = buildClientCard(key, client, index, {
        showChips:true,
        showBeer:false,
        updateChip:updateLibreChipCount,
        deleteFn: deleteLibreClient
      });
      list.appendChild(card);
    });
  }

  function renderMetrics(clients) {
    const totalClients = Object.keys(clients).length;
    let entradas = 0, recompras = 0, adiciones = 0;

    Object.values(clients).forEach(c => {
      const counts = c.beerCounts || {};
      entradas  += counts.Entrada  || 0;
      recompras += counts.Recompra || 0;
      adiciones += counts.Adicion  || 0;
    });

    const chipEnt = +document.getElementById("chip-entrada").value || 0;
    const chipRec = +document.getElementById("chip-recompra").value || 0;
    const chipAdi = +document.getElementById("chip-adicion").value || 0;

    const totalFichas = entradas * chipEnt + recompras * chipRec + adiciones * chipAdi;
    const stackProm   = totalClients ? totalFichas / totalClients : 0;

    document.getElementById("total-clients").textContent   = `Total de Clientes: ${totalClients}`;
    document.getElementById("total-entradas").textContent  = `Total de Entradas: ${entradas}`;
    document.getElementById("total-recompras").textContent = `Total de Recompras: ${recompras}`;
    document.getElementById("total-adiciones").textContent = `Total de Adiciones: ${adiciones}`;
    document.getElementById("total-fichas").textContent    = `Total de Fichas: ${totalFichas.toLocaleString()}`;
    document.getElementById("stack-promedio").textContent  = `Stack Promedio: ${stackProm.toLocaleString()}`;
  }

  function renderChipTypes() {
    const list = document.getElementById("chip-types-list");
    if (!list) return;
    list.innerHTML = "";
    Object.entries(chipTypes).forEach(([color, cfg]) => {
      const div = document.createElement("div");
      div.className = "chip-type-item";
      div.innerHTML = `
        <span class="chip-color">${color}</span>
        <input type="number" class="chip-edit-qty" value="${cfg.quantity || 0}">
        <span class="chip-available">/${cfg.available ?? cfg.quantity ?? 0}</span>
        <input type="number" class="chip-edit-val" value="${cfg.value || 0}">
        <button class="chip-save-btn">Guardar</button>
        <button class="chip-del-btn">X</button>`;
      const qtyInput = div.querySelector(".chip-edit-qty");
      const valInput = div.querySelector(".chip-edit-val");
      div.querySelector(".chip-save-btn").addEventListener("click", () => {
        const q = parseInt(qtyInput.value) || 0;
        const v = parseFloat(valInput.value) || 0;
        updateChipType(color, q, v);
      });
      div.querySelector(".chip-del-btn").addEventListener("click", () => {
        if (confirm(`Eliminar tipo ${color}?`)) deleteChipType(color);
      });
      list.appendChild(div);
    });
  }


  // =====================
  //   PESTAÑAS
  // =====================
  const tabClients = document.getElementById("tab-clients");
  const tabMetrics = document.getElementById("tab-metrics");
  const tabLibre  = document.getElementById("tab-libre");
  const tabPremios = document.getElementById("tab-premios");
  const clientSection = document.getElementById("client-section");
  const metricsSection = document.getElementById("metrics-section");
  const libreSection  = document.getElementById("libre-section");
  const premiosSection = document.getElementById("premios-section");

  tabClients.addEventListener("click", () => {
    tabClients.classList.add("active");
    tabMetrics.classList.remove("active");
    tabLibre.classList.remove("active");
    tabPremios.classList.remove("active");
    clientSection.classList.remove("hidden");
    metricsSection.classList.add("hidden");
    libreSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
  });
  tabMetrics.addEventListener("click", () => {
    tabMetrics.classList.add("active");
    tabClients.classList.remove("active");
    tabLibre.classList.remove("active");
    tabPremios.classList.remove("active");
    metricsSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    libreSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
  });
  tabLibre.addEventListener("click", () => {
    tabLibre.classList.add("active");
    tabClients.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabPremios.classList.remove("active");
    libreSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
  });
  tabPremios.addEventListener("click", () => {
    tabPremios.classList.add("active");
    tabClients.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabLibre.classList.remove("active");
    premiosSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    libreSection.classList.add("hidden");
  });

  // =====================
  //   SECCIÓN DE PREMIOS (Firebase)
  // =====================
  const premiosRef = database.ref("premios");

  function formatCurrency(value) {
    return "$" + Number(value).toLocaleString();
  }

  function renderPremioCasillas(cantidad, premiosFromDB) {
    const premiosCajas = document.getElementById("premios-cajas");
    premiosCajas.innerHTML = "";
    for (let i = 0; i < cantidad; i++) {
      const wrapper = document.createElement("div");
      wrapper.className = "premio-wrapper";
      const label = document.createElement("label");
      label.textContent = "Premio " + (i + 1) + ": ";
      const input = document.createElement("input");
      input.type = "number";
      input.id = "premio-casilla-" + i;
      input.placeholder = "Ingrese premio";
      input.value = (premiosFromDB && premiosFromDB[i] !== undefined) ? premiosFromDB[i] : "";
      input.addEventListener("change", updatePremios);
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      premiosCajas.appendChild(wrapper);
    }
  }

  function updatePremios() {
    const cantidad = parseInt(document.getElementById("cantidad-premiados").value) || 0;
    let premiosArray = [];
    for (let i = 0; i < cantidad; i++) {
      const input = document.getElementById("premio-casilla-" + i);
      let value = parseFloat(input ? input.value : 0) || 0;
      premiosArray.push(value);
    }
    const valorTotal = parseFloat(document.getElementById("valor-total-premio").value) || 0;
    const sumPremios = premiosArray.reduce((sum, val) => sum + val, 0);
    const valorRestante = valorTotal - sumPremios;
    document.getElementById("valor-restante").textContent = "Valor Restante: " + formatCurrency(valorRestante);
    
    premiosRef.set({ cantidad, premios: premiosArray, valorTotal })
      .then(() => {
        console.log("Premios actualizados en la DB.");
      })
      .catch(error => {
        console.error("Error al actualizar premios:", error.message);
      });
  }

  premiosRef.on("value", snapshot => {
    const data = snapshot.val() || { cantidad: 0, premios: [], valorTotal: 0 };
    document.getElementById("cantidad-premiados").value = data.cantidad;
    document.getElementById("valor-total-premio").value = data.valorTotal;
    renderPremioCasillas(data.cantidad, data.premios);
    const sumPremios = (data.premios || []).reduce((sum, val) => sum + val, 0);
    const valorRestante = data.valorTotal - sumPremios;
    document.getElementById("valor-restante").textContent = "Valor Restante: " + formatCurrency(valorRestante);
  });

  document.getElementById("cantidad-premiados").addEventListener("change", updatePremios);
  document.getElementById("valor-total-premio").addEventListener("change", updatePremios);
  updatePricesUI();
  renderChipTypes();
});

