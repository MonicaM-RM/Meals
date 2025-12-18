// ==================== CONFIGURACIÓN FIREBASE ====================
// Para usar sincronización en tiempo real, crea un proyecto en Firebase:
// 1. Ve a https://console.firebase.google.com/
// 2. Crea un nuevo proyecto
// 3. En la consola, ve a "Realtime Database" y crea una base de datos
// 4. En las reglas, pon temporalmente: { "rules": { ".read": true, ".write": true } }
// 5. Copia tu configuración aquí abajo

const firebaseConfig = {
  apiKey: "AIzaSyBjv_iGp7BcJrxvus1L1GdtJVkO8FUkwss",
  authDomain: "mealtracker-app.firebaseapp.com",
  databaseURL: "https://mealtracker-app-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mealtracker-app",
  storageBucket: "mealtracker-app.firebasestorage.app",
  messagingSenderId: "929523252564",
  appId: "1:929523252564:web:66e4a71e8838c2e0b89cc1"
};

// Modo: 'firebase' para sincronización en la nube, 'local' para solo localStorage
let MODE = 'firebase'; // ¡Sincronización activada!

// ==================== CONSTANTS ====================
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["Breakfast", "Lunch", "Dinner"];
const STATE_ORDER = ["no", "yes", "late"];
const STATE_DISPLAY = {
  "yes":  { char: "✓", class: "yes" },
  "no":   { char: "✕", class: "no" },
  "late": { char: "L", class: "late" }
};
const STORAGE_KEY = "meal_tracker_users_v2";

// ==================== ESTADO ====================
let users = [];
let sessionIndex = null;
let database = null;
let usersRef = null;

// ==================== ELEMENTOS DOM ====================
const syncStatus = document.getElementById('syncStatus');
const syncText = document.getElementById('syncText');
const welcome = document.getElementById('welcomeScreen');
const btnLogin = document.getElementById('btnLogin');
const btnViewData = document.getElementById('btnViewData');
const btnCreate = document.getElementById('btnCreate');
const btnEdit = document.getElementById('btnEdit');

const viewLogin = document.getElementById('viewLogin');
const viewData = document.getElementById('viewData');
const viewCreate = document.getElementById('viewCreate');
const viewEdit = document.getElementById('viewEdit');

const loginUserSelect = document.getElementById('loginUserSelect'); // Changed from inputs
const doLogin = document.getElementById('doLogin');
const backFromLogin = document.getElementById('backFromLogin');
const loginMsg = document.getElementById('loginMsg');
const sessionArea = document.getElementById('sessionArea');
const sessionTitle = document.getElementById('sessionTitle');
const sessionGrid = document.getElementById('sessionGrid');
const saveSession = document.getElementById('saveSession');
const logout = document.getElementById('logout');
const sessionMsg = document.getElementById('sessionMsg');

const totalsTable = document.getElementById('totalsTable');
const totalsStack = document.getElementById('totalsStack');
const backFromData = document.getElementById('backFromData');
const btnExportCSV = document.getElementById('btnExportCSV'); // New button

const createFirstName = document.getElementById('createFirstName');
const createLastName = document.getElementById('createLastName');
const createUserBtn = document.getElementById('createUserBtn');
const createMsg = document.getElementById('createMsg');
const backFromCreate = document.getElementById('backFromCreate');

const editUserList = document.getElementById('editUserList');
const backFromEdit = document.getElementById('backFromEdit');

const modalBackdrop = document.getElementById('modalBackdrop');
const modalFirstName = document.getElementById('modalFirstName');
const modalLastName = document.getElementById('modalLastName');
const modalSave = document.getElementById('modalSave');
const modalCancel = document.getElementById('modalCancel');
let modalEditingIndex = null;

// ==================== INICIALIZACIÓN ====================
init();

async function init() {
  if (MODE === 'firebase' && firebaseConfig.apiKey !== "TU_API_KEY") {
    try {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
      usersRef = database.ref('users');
      
      // Escuchar cambios en tiempo real
      usersRef.on('value', (snapshot) => {
        const data = snapshot.val();
        users = data ? Object.values(data) : [];
        updateSyncStatus(true);
        
        // Actualizar vistas si están abiertas
        if (viewData.classList.contains('active')) renderTotalsResponsive();
        if (viewEdit.classList.contains('active')) renderEditList();
        if (viewLogin.classList.contains('active')) populateLoginDropdown();
        if (sessionArea.style.display === 'block' && sessionIndex !== null) {
          // Check if user still exists (might have been deleted)
          if (users[sessionIndex]) {
             buildSessionGrid(users[sessionIndex], sessionGrid);
          } else {
             resetLogin();
          }
        }
      });

      // Detectar conexión
      database.ref('.info/connected').on('value', (snap) => {
        updateSyncStatus(snap.val() === true);
      });
    } catch (e) {
      console.error('Firebase error:', e);
      MODE = 'local';
      loadLocalData();
      updateSyncStatus(false, 'Firebase Error');
    }
  } else {
    loadLocalData();
    updateSyncStatus(false, 'Local mode');
  }
  
  showWelcome();
}

function updateSyncStatus(connected, customText) {
  syncStatus.className = 'sync-status ' + (connected ? 'connected' : 'disconnected');
  syncText.textContent = customText || (connected ? 'Synced' : 'Offline');
}

// ==================== PERSISTENCE ====================
function loadLocalData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    users = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(users)) users = [];
  } catch (e) {
    console.warn('Error loading data:', e);
    users = [];
  }
  
  // Sample data if empty
  if (users.length === 0) {
    users.push({ firstName: 'Mary', lastName: 'Smith', schedule: defaultSchedule() });
    users.push({ firstName: 'John', lastName: 'Doe', schedule: defaultSchedule() });
    saveData();
  }
}

function saveData() {
  if (MODE === 'firebase' && usersRef) {
    usersRef.set(users).catch(e => {
      console.error('Error saving to Firebase:', e);
      alert('Error saving. Saving locally.');
      saveLocalData();
    });
  } else {
    saveLocalData();
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    alert('Could not save: ' + e);
  }
}

// ==================== NAVEGACIÓN ====================
function hideAll() {
  welcome.style.display = 'none';
  [viewLogin, viewData, viewCreate, viewEdit].forEach(v => v.classList.remove('active'));
}

function showWelcome() {
  welcome.style.display = 'block';
  [viewLogin, viewData, viewCreate, viewEdit].forEach(v => v.classList.remove('active'));
  resetLogin();
  resetCreate();
  closeModal();
}

function openView(el) {
  hideAll();
  el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Eventos de navegación
btnLogin.addEventListener('click', () => { 
    openView(viewLogin); 
    resetLogin(); 
    populateLoginDropdown();
});
btnViewData.addEventListener('click', () => { openView(viewData); renderTotalsResponsive(); });
btnCreate.addEventListener('click', () => { openView(viewCreate); resetCreate(); });
btnEdit.addEventListener('click', () => { openView(viewEdit); renderEditList(); });

[backFromLogin, backFromData, backFromCreate, backFromEdit].forEach(btn => 
  btn.addEventListener('click', showWelcome)
);

// ==================== LOGIN ====================
function populateLoginDropdown() {
    loginUserSelect.innerHTML = '<option value="">Select a user...</option>';
    users.forEach((u, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${u.firstName} ${u.lastName}`;
        loginUserSelect.appendChild(option);
    });
}

doLogin.addEventListener('click', () => {
  const idx = loginUserSelect.value;
  
  if (idx === "") {
    showMessage(loginMsg, 'Please select a user.', 'error');
    return;
  }
  
  sessionIndex = parseInt(idx);
  loginMsg.innerHTML = '';
  openSession(sessionIndex);
});

logout.addEventListener('click', () => {
  sessionIndex = null;
  sessionArea.style.display = 'none';
  loginUserSelect.value = "";
  sessionMsg.innerHTML = '';
});

saveSession.addEventListener('click', () => {
  if (sessionIndex === null) return;
  saveData();
  showMessage(sessionMsg, 'Changes saved successfully!', 'success');
});

function resetLogin() {
  loginUserSelect.value = "";
  loginMsg.innerHTML = '';
  sessionArea.style.display = 'none';
  sessionMsg.innerHTML = '';
  sessionGrid.innerHTML = '';
  sessionIndex = null;
}

function openSession(idx) {
  const u = users[idx];
  sessionTitle.innerHTML = `<i class="fas fa-calendar-week" style="margin-right:8px"></i>${u.firstName} ${u.lastName} — Week`;
  sessionArea.style.display = 'block';
  buildSessionGrid(u, sessionGrid);
}

// ==================== TOTALES ====================
function renderTotalsResponsive() {
  if (window.matchMedia('(max-width:768px)').matches) {
    buildTotalsStack();
  } else {
    buildTotalsTable();
  }
}

function buildTotalsTable() {
  totalsStack.style.display = 'none';
  totalsTable.style.display = 'table';
  totalsTable.innerHTML = '';
  
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  tr.appendChild(el('th', 'Meal'));
  DAYS.forEach(d => tr.appendChild(el('th', d)));
  thead.appendChild(tr);
  totalsTable.appendChild(thead);

  const tbody = document.createElement('tbody');
  MEALS.forEach(meal => {
    const r = document.createElement('tr');
    r.appendChild(el('td', meal));
    DAYS.forEach(day => {
      let cnt = countAttendance(day, meal);
      const td = el('td', String(cnt));
      if (cnt > 0) td.style.color = 'var(--accent)';
      r.appendChild(td);
    });
    tbody.appendChild(r);
  });
  totalsTable.appendChild(tbody);
}

function buildTotalsStack() {
  totalsTable.style.display = 'none';
  totalsStack.style.display = 'flex';
  totalsStack.innerHTML = '';
  
  MEALS.forEach(meal => {
    const card = document.createElement('div');
    card.className = 'totals-card';
    
    const title = document.createElement('div');
    title.className = 'meal';
    title.innerHTML = `<i class="fas fa-utensils" style="margin-right:8px"></i>${meal}`;
    card.appendChild(title);
    
    const row = document.createElement('div');
    row.className = 'row';
    
    DAYS.forEach((day, i) => {
      let cnt = countAttendance(day, meal);
      const pill = document.createElement('div');
      pill.className = 'day-pill';
      pill.innerHTML = `${day}<span class="num">${cnt}</span>`;
      row.appendChild(pill);
    });
    
    card.appendChild(row);
    totalsStack.appendChild(card);
  });
}

function countAttendance(day, meal) {
  let cnt = 0;
  users.forEach(u => {
    const st = u.schedule?.[day]?.[meal] || 'no';
    if (st === 'yes' || st === 'late') cnt++;
  });
  return cnt;
}

// ==================== EXPORT CSV ====================
if (btnExportCSV) {
    btnExportCSV.addEventListener('click', exportToCSV);
}

function exportToCSV() {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "First Name,Last Name,Day,Meal,Status\n";

    users.forEach(u => {
        DAYS.forEach(day => {
            MEALS.forEach(meal => {
                const status = u.schedule?.[day]?.[meal] || 'no';
                csvContent += `${u.firstName},${u.lastName},${day},${meal},${status}\n`;
            });
        });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "meal_attendance.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// ==================== CREATE USER ====================
createUserBtn.addEventListener('click', () => {
  const fn = (createFirstName.value || '').trim();
  const ln = (createLastName.value || '').trim();
  
  if (!fn || !ln) {
    showMessage(createMsg, 'First and last name are required.', 'error');
    return;
  }
  
  if (userExists(fn, ln)) {
    showMessage(createMsg, 'User already exists.', 'error');
    return;
  }
  
  users.push({ firstName: fn, lastName: ln, schedule: defaultSchedule() });
  saveData();
  
  showMessage(createMsg, 'User created successfully!', 'success');
  createFirstName.value = '';
  createLastName.value = '';
});

function resetCreate() {
  createFirstName.value = '';
  createLastName.value = '';
  createMsg.innerHTML = '';
}

// ==================== EDIT USERS ====================
function renderEditList() {
  editUserList.innerHTML = '';
  
  if (users.length === 0) {
    editUserList.innerHTML = '<div class="small" style="text-align:center;padding:40px">No users registered</div>';
    return;
  }
  
  users.forEach((u, idx) => {
    const item = document.createElement('div');
    item.className = 'user-item';
    
    const left = document.createElement('div');
    left.className = 'user-left';
    
    const av = document.createElement('div');
    av.className = 'avatar';
    av.style.background = gradientForName(u.firstName + u.lastName);
    av.textContent = initials(u.firstName + ' ' + u.lastName);
    
    const info = document.createElement('div');
    info.className = 'user-name';
    info.textContent = `${u.firstName} ${u.lastName}`;
    
    left.appendChild(av);
    left.appendChild(info);
    
    const actions = document.createElement('div');
    actions.className = 'user-actions';
    
    const btnE = document.createElement('button');
    btnE.className = 'btn ghost';
    btnE.innerHTML = '<i class="fas fa-edit"></i> Edit';
    btnE.onclick = (e) => { e.stopPropagation(); openEditModal(idx); };
    
    const btnD = document.createElement('button');
    btnD.className = 'btn danger';
    btnD.innerHTML = '<i class="fas fa-trash"></i>';
    btnD.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${u.firstName} ${u.lastName}?`)) {
        users.splice(idx, 1);
        saveData();
        renderEditList();
      }
    };
    
    actions.appendChild(btnE);
    actions.appendChild(btnD);
    item.appendChild(left);
    item.appendChild(actions);
    editUserList.appendChild(item);
  });
}

function openEditModal(idx) {
  modalEditingIndex = idx;
  const u = users[idx];
  modalFirstName.value = u.firstName;
  modalLastName.value = u.lastName;
  modalBackdrop.style.display = 'flex';
}

modalCancel.addEventListener('click', closeModal);

modalSave.addEventListener('click', () => {
  const fn = (modalFirstName.value || '').trim();
  const ln = (modalLastName.value || '').trim();
  
  if (!fn || !ln) {
    alert('First and last name are required.');
    return;
  }
  
  const duplicate = users.some((u, i) => 
    i !== modalEditingIndex && 
    u.firstName.toLowerCase() === fn.toLowerCase() && 
    u.lastName.toLowerCase() === ln.toLowerCase()
  );
  
  if (duplicate) {
    alert('Another user with that name already exists.');
    return;
  }
  
  users[modalEditingIndex].firstName = fn;
  users[modalEditingIndex].lastName = ln;
  saveData();
  closeModal();
  renderEditList();
});

function closeModal() {
  modalBackdrop.style.display = 'none';
  modalEditingIndex = null;
}

// ==================== GRID DE SESIÓN ====================
function buildSessionGrid(user, container) {
  container.innerHTML = '';
  
  MEALS.forEach((meal, mealIdx) => {
    const block = document.createElement('div');
    block.className = 'meal-block';
    
    const title = document.createElement('div');
    const mealClass = ['breakfast', 'lunch', 'dinner'][mealIdx];
    title.className = `meal-title ${mealClass}`;
    const icons = ['fa-coffee', 'fa-sun', 'fa-moon'];
    title.innerHTML = `<i class="fas ${icons[mealIdx]}"></i> ${meal}`;
    block.appendChild(title);
    
    DAYS.forEach((day, dayIdx) => {
      const row = document.createElement('div');
      row.className = 'day-toggle';
      
      const left = document.createElement('div');
      left.className = 'day-name';
      left.textContent = DAYS_FULL[dayIdx];
      
      const st = user.schedule?.[day]?.[meal] || 'no';
      const btn = document.createElement('button');
      btn.className = `toggle-btn ${STATE_DISPLAY[st].class}`;
      btn.textContent = STATE_DISPLAY[st].char;
      
      btn.onclick = () => {
        const cur = user.schedule?.[day]?.[meal] || 'no';
        let i = STATE_ORDER.indexOf(cur);
        i = (i + 1) % STATE_ORDER.length;
        const next = STATE_ORDER[i];
        setState(user, day, meal, next);
        btn.className = `toggle-btn ${STATE_DISPLAY[next].class}`;
        btn.textContent = STATE_DISPLAY[next].char;
        sessionMsg.innerHTML = '';
      };
      
      row.appendChild(left);
      row.appendChild(btn);
      block.appendChild(row);
    });
    
    container.appendChild(block);
  });
}

// ==================== UTILIDADES ====================
function defaultSchedule() {
  const s = {};
  DAYS.forEach(d => {
    s[d] = {};
    MEALS.forEach(m => s[d][m] = 'no');
  });
  return s;
}

function setState(user, day, meal, val) {
  if (!user.schedule) user.schedule = defaultSchedule();
  if (!user.schedule[day]) user.schedule[day] = {};
  user.schedule[day][meal] = val;
}

function userExists(fn, ln) {
  return users.some(u => 
    u.firstName.toLowerCase() === fn.toLowerCase() && 
    u.lastName.toLowerCase() === ln.toLowerCase()
  );
}

function findUserIndex(fn, ln) {
  return users.findIndex(u => 
    u.firstName.toLowerCase() === fn.toLowerCase() && 
    u.lastName.toLowerCase() === ln.toLowerCase()
  );
}

function initials(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function gradientForName(name) {
  const gradients = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a8edea, #fed6e3)',
    'linear-gradient(135deg, #ff9a9e, #fecfef)',
    'linear-gradient(135deg, #ffecd2, #fcb69f)'
  ];
  let n = 0;
  for (let i = 0; i < name.length; i++) {
    n = (n * 31 + name.charCodeAt(i)) % gradients.length;
  }
  return gradients[n];
}

function el(tag, txt) {
  const e = document.createElement(tag);
  e.textContent = txt;
  return e;
}

function showMessage(container, text, type) {
  container.innerHTML = `<div class="message ${type}"><i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${text}</div>`;
  setTimeout(() => container.innerHTML = '', 4000);
}

// ==================== EVENTOS ====================
window.addEventListener('resize', () => {
  if (viewData.classList.contains('active')) renderTotalsResponsive();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalBackdrop.style.display === 'flex') {
      closeModal();
    } else if ([viewLogin, viewData, viewCreate, viewEdit].some(v => v.classList.contains('active'))) {
      showWelcome();
    }
  }
});

// Cerrar modal al hacer clic fuera
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});
