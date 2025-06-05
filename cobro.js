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

  // Estado colapsado de las tarjetas
  let cardCollapseState = {};

  // Variables globales de clientes
  let currentClients = {};
  let currentLibreClients = {};

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
    renderMetrics(currentClients);
    alert("Precios actualizados");
  });

  /* =====================
       CLIENTES
  ===================== */
  const clientsRef = database.ref("clients");
  const libreClientsRef = database.ref("libreClients");

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
    clientsRef.push({
      name,
      beerCounts: { Entrada: 0, Recompra: 0, Adicion: 0 },
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  function addLibreClient(name) {
    libreClientsRef.push({
      name,
      chips: 0,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });
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
  }

  function updateLibreChips(clientKey, increment) {
    const ref = database.ref(`libreClients/${clientKey}/chips`);
    ref.transaction(count => Math.max(0, (count || 0) + increment));
  }

  function toggleBeerCount(clientKey, beerType) {
    const ref = database.ref(`clients/${clientKey}/beerCounts/${beerType}`);
    ref.transaction(val => (val === 1 ? 0 : 1));
  }

  function deleteLibreClient(clientKey) {
    database.ref(`libreClients/${clientKey}`).remove();
  }

  function deleteClient(clientKey) {
    database.ref(`clients/${clientKey}`).remove();
  }

  function calculateTotalRevenue(clients) {
    return Object.values(clients).reduce((total, client) => {
      const counts = client.beerCounts || {};
      return total + (prices.Entrada  * (counts.Entrada  || 0)) +
                     (prices.Recompra * (counts.Recompra || 0)) +
                     (prices.Adicion  * (counts.Adicion  || 0));
    }, 0);
  }

  function calculateLibreRevenue(clients, chipValue) {
    return Object.values(clients).reduce((total, c) => {
      const chips = c.chips || 0;
      return total + chips * chipValue;
    }, 0);
  }

  /* ===== BÚSQUEDA ===== */
  document.getElementById("client-search")?.addEventListener("input", () => {
    renderClients(currentClients);
  });

  document.getElementById("libre-client-search")?.addEventListener("input", () => {
    renderLibreClients(currentLibreClients);
  });

  /* =====================
       RENDERIZACIÓN
  ===================== */
  function renderClients(clients) {
    const clientList     = document.getElementById("client-list");
    const totalRevenueEl = document.getElementById("total-revenue");
    if (!clientList || !totalRevenueEl) return;

    const term = (document.getElementById("client-search")?.value || "").trim().toLowerCase();
    const entries = Object.entries(clients).sort(([,a],[,b]) => {
      const t1 = (typeof a.createdAt === 'number') ? a.createdAt : Number.MAX_SAFE_INTEGER;
      const t2 = (typeof b.createdAt === 'number') ? b.createdAt : Number.MAX_SAFE_INTEGER;
      return t1 - t2;
    });

    const filtered = entries.filter(([, c]) => c.name.toLowerCase().includes(term));

    clientList.innerHTML = "";

    filtered.forEach(([key, client], index) => {
      const card = document.createElement("div");
      card.className = "client-card" + (cardCollapseState[key] ? " collapsed" : "");

      /* ---- HEADER ---- */
      const header = document.createElement("div");
      header.className = "client-card-header";
      header.innerHTML = `<h3>${index + 1}. ${client.name}</h3>`;
      header.style.cursor = "pointer";
      header.addEventListener("click", e => {
        if (!["BUTTON", "I"].includes(e.target.tagName)) {
          const collapsed = card.classList.toggle("collapsed");
          cardCollapseState[key] = collapsed;
        }
      });
      card.appendChild(header);

      /* ---- COUNTS ---- */
      const countsDiv = document.createElement("div");
      countsDiv.className = "client-card-counts";

      const beerTypes = ["Entrada", "Recompra", "Adicion"];
      let clientTotal = 0;

      beerTypes.forEach(type => {
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
        e.stopPropagation();                // evita colapsar la tarjeta
          updateBeerCount(key, type, -1);
        });
incBtn.addEventListener("click", e => {
  e.stopPropagation();
  updateBeerCount(key, type, 1);
});
          wrapper.appendChild(controls);
        }

        clientTotal += count * prices[type];
        countsDiv.appendChild(wrapper);
      });

      card.appendChild(countsDiv);

      /* ---- TOTAL ---- */
      const totalDiv = document.createElement("div");
      totalDiv.className = "client-card-total";
      totalDiv.textContent = `Total: $${clientTotal.toLocaleString()}`;
      card.appendChild(totalDiv);

      /* ---- ACTIONS ---- */
      const actions = document.createElement("div");
      actions.className = "client-card-actions";
      actions.innerHTML = `
        <button class="action-btn delete-btn"><i class="material-icons">delete</i></button>
        <input type="checkbox" class="client-checkbox">`;
      actions.querySelector(".delete-btn").addEventListener("click", e => {
  e.stopPropagation();                // evita colapso accidental
  deleteClient(key);
});
      card.appendChild(actions);

      clientList.appendChild(card);
    });

    totalRevenueEl.textContent = `Total Recaudado: $${calculateTotalRevenue(filtered.reduce((obj,[k,v])=>{obj[k]=v;return obj;},{})).toLocaleString()}`;
  }

  function renderLibreClients(clients) {
    const clientList     = document.getElementById("libre-client-list");
    const totalRevenueEl = document.getElementById("libre-total-revenue");
    if (!clientList || !totalRevenueEl) return;

    const chipValue = +document.getElementById("libre-chip-value").value || 0;
    const term = (document.getElementById("libre-client-search")?.value || "").trim().toLowerCase();
    const entries = Object.entries(clients).sort(([,a],[,b]) => {
      const t1 = typeof a.createdAt === 'number' ? a.createdAt : Number.MAX_SAFE_INTEGER;
      const t2 = typeof b.createdAt === 'number' ? b.createdAt : Number.MAX_SAFE_INTEGER;
      return t1 - t2;
    });
    const filtered = entries.filter(([, c]) => c.name.toLowerCase().includes(term));

    clientList.innerHTML = "";
    let total = 0;

    filtered.forEach(([key, client], index) => {
      const card = document.createElement("div");
      card.className = "client-card";

      const header = document.createElement("div");
      header.className = "client-card-header";
      header.innerHTML = `<h3>${index + 1}. ${client.name}</h3>`;
      card.appendChild(header);

      const countsDiv = document.createElement("div");
      countsDiv.className = "client-card-counts";

      const wrapper = document.createElement("div");
      wrapper.className = "client-card-count";
      wrapper.innerHTML = `<span>Fichas</span>`;

      const val = document.createElement("span");
      val.className = "count-value";
      const count = client.chips || 0;
      val.textContent = count;
      wrapper.appendChild(val);

      const controls = document.createElement("div");
      controls.className = "count-controls";
      controls.innerHTML = `
        <button class="action-btn arrow-btn">&lt;</button>
        <button class="action-btn arrow-btn">&gt;</button>`;
      const [decBtn, incBtn] = controls.querySelectorAll("button");
      decBtn.addEventListener("click", e => { e.stopPropagation(); updateLibreChips(key, -1); });
      incBtn.addEventListener("click", e => { e.stopPropagation(); updateLibreChips(key, 1); });
      wrapper.appendChild(controls);

      countsDiv.appendChild(wrapper);
      card.appendChild(countsDiv);

      const totalDiv = document.createElement("div");
      totalDiv.className = "client-card-total";
      const playerTotal = count * chipValue;
      total += playerTotal;
      totalDiv.textContent = `Total: $${playerTotal.toLocaleString()}`;
      card.appendChild(totalDiv);

      const actions = document.createElement("div");
      actions.className = "client-card-actions";
      actions.innerHTML = `<button class="action-btn delete-btn"><i class="material-icons">delete</i></button>`;
      actions.querySelector(".delete-btn").addEventListener("click", e => { e.stopPropagation(); deleteLibreClient(key); });
      card.appendChild(actions);

      clientList.appendChild(card);
    });

    totalRevenueEl.textContent = `Total Recaudado: $${total.toLocaleString()}`;
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


  // =====================
  //   PESTAÑAS
  // =====================
  const tabClients = document.getElementById("tab-clients");
  const tabLibre = document.getElementById("tab-libre");
  const tabMetrics = document.getElementById("tab-metrics");
  const tabPremios = document.getElementById("tab-premios");
  const tabTimer = document.getElementById("tab-timer");
  const clientSection = document.getElementById("client-section");
  const libreSection = document.getElementById("libre-section");
  const metricsSection = document.getElementById("metrics-section");
  const premiosSection = document.getElementById("premios-section");
  const timerSection = document.getElementById("timer-section");

  tabClients.addEventListener("click", () => {
    tabClients.classList.add("active");
    tabLibre.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabPremios.classList.remove("active");
    tabTimer.classList.remove("active");
    clientSection.classList.remove("hidden");
    libreSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
    timerSection.classList.add("hidden");
  });

  tabLibre.addEventListener("click", () => {
    tabLibre.classList.add("active");
    tabClients.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabPremios.classList.remove("active");
    tabTimer.classList.remove("active");
    libreSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
    timerSection.classList.add("hidden");
  });
  tabMetrics.addEventListener("click", () => {
    tabMetrics.classList.add("active");
    tabClients.classList.remove("active");
    tabLibre.classList.remove("active");
    tabPremios.classList.remove("active");
    tabTimer.classList.remove("active");
    metricsSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    libreSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
    timerSection.classList.add("hidden");
  });
  tabPremios.addEventListener("click", () => {
    tabPremios.classList.add("active");
    tabClients.classList.remove("active");
    tabLibre.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabTimer.classList.remove("active");
    premiosSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    libreSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    timerSection.classList.add("hidden");
  });
  tabTimer.addEventListener("click", () => {
    tabTimer.classList.add("active");
    tabClients.classList.remove("active");
    tabLibre.classList.remove("active");
    tabMetrics.classList.remove("active");
    tabPremios.classList.remove("active");
    timerSection.classList.remove("hidden");
    clientSection.classList.add("hidden");
    libreSection.classList.add("hidden");
    metricsSection.classList.add("hidden");
    premiosSection.classList.add("hidden");
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

  // =====================
  //   TEMPORIZADOR (SIN "DESCANSO")
  // =====================
  let timerInterval = null;
  let timerRunning = false;
  let timerRemaining = 0;
  let timerEndTime = 0;
  let currentLevelIndex = 0;
  let levelsConfig = [];
  let timerInitial = 0; // Duración total del nivel en segundos
  const circleFg = document.querySelector(".circle-fg");
  const circleLength = 283;
  function updateCircle() {
    if (!circleFg || timerInitial === 0) return;
    const fraction = (timerInitial - timerRemaining) / timerInitial;
    const offset = circleLength - (fraction * circleLength);
    circleFg.style.strokeDashoffset = offset;
  }
  function updateTimerDisplay() {
    timerRemaining = Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    document.getElementById("timer-countdown").textContent =
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    updateCircle();
  }
  function saveTimerStateToDB() {
    const state = {
      currentLevelIndex,
      timerEndTime,
      timerRunning,
      timerInitial
    };
    database.ref("timerState").set(state);
  }
  // Se reemplaza la función de carga única por una suscripción en tiempo real
  function subscribeTimerState() {
    database.ref("timerState").on("value", snapshot => {
      const state = snapshot.val();
      if (state) {
        currentLevelIndex = state.currentLevelIndex;
        timerEndTime = state.timerEndTime;
        timerRunning = state.timerRunning;
        timerInitial = state.timerInitial || 0;
        timerRemaining = Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
        if (levelsConfig.length > 0 && currentLevelIndex < levelsConfig.length) {
          const levelInfo = levelsConfig[currentLevelIndex];
          document.getElementById("current-level").textContent =
            `Nivel: ${currentLevelIndex + 1} – Ciegas: ${levelInfo.blinds || "N/A"}`;
        }
        updateTimerDisplay();
      }
    });
  }
  function startTimer() {
    if (!levelsConfig.length) {
      alert("Por favor, guarda la configuración del temporizador primero.");
      return;
    }
    if (!timerRunning) {
      timerEndTime = Date.now() + timerRemaining * 1000;
      timerRunning = true;
      saveTimerStateToDB();
      timerInterval = setInterval(() => {
        updateTimerDisplay();
        if (timerRemaining <= 0) {
          playAlarm();
          clearInterval(timerInterval);
          timerRunning = false;
          currentLevelIndex++;
          if (currentLevelIndex >= levelsConfig.length) {
            currentLevelIndex = levelsConfig.length - 1;
            timerRemaining = 0;
            updateTimerDisplay();
            saveTimerStateToDB();
            return;
          }
          timerRemaining = levelsConfig[currentLevelIndex].roundDuration;
          timerInitial = timerRemaining;
          timerEndTime = Date.now() + timerRemaining * 1000;
          const levelInfo = levelsConfig[currentLevelIndex];
          document.getElementById("current-level").textContent =
            `Nivel: ${currentLevelIndex + 1} – Ciegas: ${levelInfo.blinds || "N/A"}`;
          saveTimerStateToDB();
          startTimer();
        }
      }, 1000);
    }
  }
  function pauseTimer() {
    clearInterval(timerInterval);
    timerRunning = false;
    saveTimerStateToDB();
  }
  function resetTimer() {
    pauseTimer();
    currentLevelIndex = 0;
    if (levelsConfig.length) {
      timerRemaining = levelsConfig[0].roundDuration;
      timerInitial = timerRemaining;
      document.getElementById("current-level").textContent =
        `Nivel: 1 – Ciegas: ${levelsConfig[0].blinds || "N/A"}`;
    } else {
      timerRemaining = 0;
      timerInitial = 0;
      document.getElementById("current-level").textContent =
        `Nivel: 1 – Ciegas: N/A`;
    }
    timerEndTime = Date.now() + timerRemaining * 1000;
    updateTimerDisplay();
    saveTimerStateToDB();
  }
  const restartLevelBtn = document.getElementById("restart-level-btn");
  if (restartLevelBtn) {
    restartLevelBtn.addEventListener("click", () => {
      if (levelsConfig.length > 0 && currentLevelIndex < levelsConfig.length) {
        timerRemaining = levelsConfig[currentLevelIndex].roundDuration;
        timerInitial = timerRemaining;
        timerEndTime = Date.now() + timerRemaining * 1000;
        updateTimerDisplay();
        saveTimerStateToDB();
        if (timerRunning) {
          clearInterval(timerInterval);
          startTimer();
        }
      }
    });
  }
  function loadTimerConfigFromDB() {
    database.ref("timerConfig").once("value").then(snapshot => {
      const config = snapshot.val();
      if (config) {
        levelsConfig = config;
        const levelsContainer = document.getElementById("levels-container");
        levelsContainer.innerHTML = "";
        levelsConfig.forEach((level, index) => {
          const row = document.createElement("tr");
          row.className = "level";
          row.innerHTML = `
            <td>${index + 1}</td>
            <td><input type="number" class="round-duration" value="${level.roundDuration / 60}"></td>
            <td><input type="text" class="blinds" placeholder="Ej. 50/100" value="${level.blinds}"></td>
            <td><button class="delete-level-btn btn">X</button></td>
          `;
          row.querySelector(".delete-level-btn").addEventListener("click", () => {
            row.remove();
          });
          levelsContainer.appendChild(row);
        });
        if (levelsConfig.length > 0) {
          timerRemaining = levelsConfig[0].roundDuration;
          timerInitial = timerRemaining;
          document.getElementById("current-level").textContent =
            `Nivel: 1 – Ciegas: ${levelsConfig[0].blinds || "N/A"}`;
        }
        updateTimerDisplay();
        // La suscripción en tiempo real se encargará de actualizar el estado del temporizador
      }
    });
  }
  loadTimerConfigFromDB();
  subscribeTimerState();

  // Intervalo global para actualizar la cuenta regresiva cada segundo (útil para usuarios que solo consultan)
  setInterval(() => {
    updateTimerDisplay();
  }, 1000);

  const startTimerBtn = document.getElementById("start-timer-btn");
  const pauseTimerBtn = document.getElementById("pause-timer-btn");
  const resetTimerBtn = document.getElementById("reset-timer-btn");
  if (startTimerBtn) startTimerBtn.addEventListener("click", startTimer);
  if (pauseTimerBtn) pauseTimerBtn.addEventListener("click", pauseTimer);
  if (resetTimerBtn) resetTimerBtn.addEventListener("click", resetTimer);
  // =====================
  //   CONFIGURACIÓN DE NIVELES
  // =====================
  const addLevelBtn = document.getElementById("add-level-btn");
  if (addLevelBtn) {
    addLevelBtn.addEventListener("click", () => {
      const levelsContainer = document.getElementById("levels-container");
      const rowCount = levelsContainer.querySelectorAll(".level").length + 1;
      const row = document.createElement("tr");
      row.className = "level";
      row.innerHTML = `
        <td>${rowCount}</td>
        <td><input type="number" class="round-duration" value="10"></td>
        <td><input type="text" class="blinds" placeholder="Ej. 50/100"></td>
        <td><button class="delete-level-btn btn">X</button></td>
      `;
      row.querySelector(".delete-level-btn").addEventListener("click", () => {
        row.remove();
      });
      levelsContainer.appendChild(row);
    });
  }
  const saveTimerConfigBtn = document.getElementById("save-timer-config-btn");
  if (saveTimerConfigBtn) {
    saveTimerConfigBtn.addEventListener("click", () => {
      const levelsContainer = document.getElementById("levels-container");
      const levelRows = levelsContainer.querySelectorAll(".level");
      levelsConfig = [];
      levelRows.forEach((row) => {
        const roundInput = row.querySelector(".round-duration");
        const blindsInput = row.querySelector(".blinds");
        const roundDuration = (parseInt(roundInput.value) || 0) * 60;
        const blinds = blindsInput.value || "";
        levelsConfig.push({ roundDuration, blinds });
      });
      currentLevelIndex = 0;
      if (levelsConfig.length > 0) {
        timerRemaining = levelsConfig[0].roundDuration;
        timerInitial = timerRemaining;
        document.getElementById("current-level").textContent =
          `Nivel: 1 – Ciegas: ${levelsConfig[0].blinds || "N/A"}`;
      } else {
        timerRemaining = 0;
        timerInitial = 0;
        document.getElementById("current-level").textContent =
          `Nivel: 1 – Ciegas: N/A`;
      }
      timerEndTime = Date.now() + timerRemaining * 1000;
      updateTimerDisplay();
      database.ref("timerConfig").set(levelsConfig)
        .then(() => {
          alert("Configuración del temporizador guardada.");
          saveTimerStateToDB();
          document.getElementById("timer-config").classList.add("hidden");
        })
        .catch(error => {
          console.error("Error al guardar la configuración:", error);
          alert("Error al guardar la configuración.");
        });
    });
  }
  const toggleTimerConfigBtn = document.getElementById("toggle-timer-config-btn");
  const timerConfig = document.getElementById("timer-config");
  if (toggleTimerConfigBtn) {
    toggleTimerConfigBtn.addEventListener("click", () => {
      timerConfig.classList.toggle("hidden");
    });
  }
  updatePricesUI();
});

const fullscreenToggleBtn = document.getElementById("toggle-fullscreen-btn");
const fullscreenIcon = document.getElementById("fullscreen-icon");
if (fullscreenToggleBtn) {
  fullscreenToggleBtn.addEventListener("click", () => {
    const timerSection = document.querySelector(".timer-section");
    timerSection.classList.toggle("fullscreen");
    if (timerSection.classList.contains("fullscreen")) {
      fullscreenIcon.textContent = "fullscreen_exit";
    } else {
      fullscreenIcon.textContent = "fullscreen";
    }
  });
}
