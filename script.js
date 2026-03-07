// =====================
// SUPABASE CONFIG
// =====================
const supabaseUrl = 'https://sspfhwosqpjykouoiahb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzcGZod29zcXBqeWtvdW9pYWhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMDQ5MDMsImV4cCI6MjA4Nzc4MDkwM30.ZhSDMtxk_rBzVFe-Q9cBXlAk2FOBHbOjihb85zgsi10'; // Use your actual Anon Key
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// =====================
// GLOBAL VARIABLES
// =====================
let buyerMap, buyerMarker;
let dispatchMap, dispatchMarker;

// =====================
// DASHBOARD NAVIGATION
// =====================
function openDashboard(id) {
  // Show/hide landing
  const landing = document.querySelector('.landing-container');
  if (landing) landing.style.display = id === 'landing' ? 'block' : 'none';

  // Hide all dashboards
  document.querySelectorAll('.dashboard').forEach(d => d.classList.add('hidden'));

  // Show selected dashboard
  const section = document.getElementById(id);
  if (section) section.classList.remove('hidden');

  // Initialize maps if needed
  if (id === 'buyer-dashboard') setTimeout(initBuyerMap, 100);
  if (id === 'request-dispatch-dashboard') setTimeout(initDispatchMap, 100);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================
// DOM CONTENT LOADED
// =====================
document.addEventListener('DOMContentLoaded', () => {

  // ---------- LANDING CARDS ----------
  document.querySelectorAll('.landing-container .card')[0]?.addEventListener('click', () => openDashboard('buyer-dashboard'));
  document.querySelectorAll('.landing-container .card')[1]?.addEventListener('click', () => openDashboard('seller-inner-dashboard'));

  // ---------- SELLER DASHBOARD CARDS ----------
  document.querySelectorAll('#seller-inner-dashboard .card-grid .card')[0]?.addEventListener('click', () => openDashboard('product-form-dashboard'));
  document.querySelectorAll('#seller-inner-dashboard .card-grid .card')[1]?.addEventListener('click', () => openDashboard('request-dispatch-dashboard'));

  // ---------- BACK BUTTONS ----------
  document.querySelectorAll('.dashboard button').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.dashboard');
      if (!parent) return;

      switch(parent.id){
        case 'buyer-dashboard':
        case 'seller-inner-dashboard':
          openDashboard('landing'); break;
        case 'product-form-dashboard':
        case 'request-dispatch-dashboard':
        case 'seller-payment-section':
          openDashboard('seller-inner-dashboard'); break;
        case 'payment-section':
          openDashboard('buyer-dashboard'); break;
        default: openDashboard('landing');
      }
    });
  });

  // ---------- PROCEED BUTTONS ----------
  document.querySelector('#buyerProceedBtn')?.addEventListener('click', () => openDashboard('payment-section'));
  document.querySelector('#dispatch-proceed')?.addEventListener('click', () => openDashboard('seller-payment-section'));
  
const productForm = document.getElementById('product-form');
productForm?.addEventListener('submit', (e) => {
  e.preventDefault(); // stops form submission
  openDashboard('request-dispatch-dashboard'); // opens request dispatch section
});
  

  // ---------- DISPATCH INPUTS ----------
  document.getElementById('dispatch-pickup')?.addEventListener('change', locatePickup);
  document.getElementById('dispatch-dropoff')?.addEventListener('input', calculateDispatchPrice);
  document.getElementById('dispatchCurrency')?.addEventListener('change', calculateDispatchPrice);
});

// =====================
// BUYER DASHBOARD MAP
// =====================
function initBuyerMap() {
  const mapDiv = document.getElementById('buyer-map');
  if (!mapDiv) return;

  if (!buyerMap) {
    buyerMap = L.map('buyer-map').setView([9.0820, 8.6753], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(buyerMap);

    buyerMarker = L.marker([9.0820, 8.6753], { draggable: true }).addTo(buyerMap);
  } else {
    buyerMap.invalidateSize();
  }
}

// =====================
// DISPATCH DASHBOARD MAP
// =====================
function initDispatchMap() {
  const mapDiv = document.getElementById('dispatch-map');
  if (!mapDiv) return;

  if (!dispatchMap) {
    dispatchMap = L.map('dispatch-map').setView([9.0820, 8.6753], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(dispatchMap);

    dispatchMarker = L.marker([9.0820, 8.6753], { draggable: true }).addTo(dispatchMap);
  } else {
    dispatchMap.invalidateSize();
  }
}

// =====================
// DISPATCH PICKUP LOCATION
// =====================
function locatePickup() {
  const pickupInput = document.getElementById('dispatch-pickup');
  if (!pickupInput || !dispatchMarker) return;

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickupInput.value)}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) return;
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      dispatchMarker.setLatLng([lat, lon]);
      dispatchMap.setView([lat, lon], 12);
      calculateDispatchPrice();
    })
    .catch(err => console.error(err));
}

// =====================
// DISTANCE HELPER
// =====================
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =====================
// CURRENCY & DISPATCH PRICE
// =====================
const currencyRates = { USD: 1, NGN: 1500, GBP: 0.79, EUR: 0.92, GHS: 12.5, CNY: 7.2 };
function getCurrencySymbol(code) { return { USD: '$', NGN: '₦', GBP: '£', EUR: '€', GHS: '₵', CNY: '¥' }[code] || '$'; }

function calculateDispatchPrice() {
  const dropoffInput = document.getElementById('dispatch-dropoff');
  const priceInput = document.getElementById('dispatch-price');
  const currencySelect = document.getElementById('dispatchCurrency');
  if (!dropoffInput || !dropoffInput.value.trim() || !priceInput) return;
  if (!dispatchMarker) return;

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dropoffInput.value)}`)
    .then(res => res.json())
    .then(data => {
      if (!data.length) return;
      const pickup = dispatchMarker.getLatLng();
      const dropLat = parseFloat(data[0].lat);
      const dropLon = parseFloat(data[0].lon);
      const distance = getDistanceKm(pickup.lat, pickup.lng, dropLat, dropLon);

      const baseUSD = distance * 0.2;
      const currency = currencySelect ? currencySelect.value : 'NGN';
      const converted = Math.round(baseUSD * currencyRates[currency]);
      const symbol = getCurrencySymbol(currency);

      priceInput.value = `${symbol}${converted.toLocaleString()}`;
    })
    .catch(err => console.error(err));
}

// ------------------
// Profile & Notifications
// ------------------
document.addEventListener('DOMContentLoaded', () => {
  const bellBtn = document.querySelector('.fa-bell').parentElement;
  const userBtn = document.querySelector('.fa-user').parentElement;
  const notificationsPanel = document.getElementById('notifications-panel');
  const profilePanel = document.getElementById('profile-panel');

  // Toggle Notifications Panel
  bellBtn.addEventListener('click', () => {
    notificationsPanel.classList.toggle('visible');
    profilePanel.classList.remove('visible'); // hide profile if open
  });

  // Toggle Profile Panel
  userBtn.addEventListener('click', () => {
    profilePanel.classList.toggle('visible');
    notificationsPanel.classList.remove('visible'); // hide notifications if open
  });

  // Close panels when clicking outside
  document.addEventListener('click', e => {
    if (!notificationsPanel.contains(e.target) && !bellBtn.contains(e.target)) {
      notificationsPanel.classList.remove('visible');
    }
    if (!profilePanel.contains(e.target) && !userBtn.contains(e.target)) {
      profilePanel.classList.remove('visible');
    }
  });

  // ------------------
  // Profile Picture Change
  // ------------------
  const profilePicInput = document.getElementById('profile-picture-input');
  const profilePicDisplay = document.getElementById('profile-picture-display');
  const changePicBtn = document.getElementById('change-picture-btn');

  changePicBtn.addEventListener('click', () => profilePicInput.click());
  profilePicInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      profilePicDisplay.src = evt.target.result;
      // replace user icon with profile picture
      userBtn.querySelector('i').style.display = 'none';
      if (!userBtn.querySelector('img')) {
        const img = document.createElement('img');
        img.src = evt.target.result;
        img.style.width = '30px';
        img.style.height = '30px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        img.style.marginTop = '-3px';
        userBtn.appendChild(img);
      } else {
        userBtn.querySelector('img').src = evt.target.result;
      }
    }
    reader.readAsDataURL(file);
  });

  // ------------------
  // DOB Dropdowns
  // ------------------
  const daySelect = document.getElementById('dob-day');
const monthSelect = document.getElementById('dob-month');
const yearSelect = document.getElementById('dob-year');

// Days 1–31
for (let d = 1; d <= 31; d++) daySelect.add(new Option(d, d));

// Months January–December
const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
months.forEach((m, i) => monthSelect.add(new Option(m, i + 1)));

// Years 1900–2026
for (let y = 1900; y <= 2026; y++) yearSelect.add(new Option(y, y));

  // ------------------
  // Save Profile
  // ------------------
  document.getElementById('save-profile-btn').addEventListener('click', () => {
    const profileData = {
      fullName: document.getElementById('full-name').value,
      username: document.getElementById('user-name').value,
      brandName: document.getElementById('brand-name').value,
      brandDesc: document.getElementById('brand-desc').value,
      dob: `${daySelect.value}-${monthSelect.value}-${yearSelect.value}`,
      email: document.getElementById('profile-email').value,
      phone: document.getElementById('profile-phone').value,
      picture: profilePicDisplay.src
    };
    localStorage.setItem('truckinProfile', JSON.stringify(profileData));
    alert('Profile saved successfully!');
    profilePanel.classList.remove('visible');
  });

  // ------------------
  // Load saved profile
  // ------------------
  const savedProfile = JSON.parse(localStorage.getItem('truckinProfile'));
  if (savedProfile) {
    document.getElementById('full-name').value = savedProfile.fullName;
    document.getElementById('user-name').value = savedProfile.username;
    document.getElementById('brand-name').value = savedProfile.brandName;
    document.getElementById('brand-desc').value = savedProfile.brandDesc;
    document.getElementById('dob-day').value = savedProfile.dob?.split('-')[0];
    document.getElementById('dob-month').value = savedProfile.dob?.split('-')[1];
    document.getElementById('dob-year').value = savedProfile.dob?.split('-')[2];
    document.getElementById('profile-email').value = savedProfile.email;
    document.getElementById('profile-phone').value = savedProfile.phone;
    document.getElementById('profile-picture-display').src = savedProfile.picture;
    const userIconImg = userBtn.querySelector('img');
    if (userIconImg) userIconImg.src = savedProfile.picture;
  }
  
  // --------------------
// SIGNUP
// --------------------
document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  const { data, error } = await _supabase.auth.signUp({ email, password });

  if (error) alert('Signup failed: ' + error.message);
  else {
    alert('Signup successful! You can now log in.');
    document.getElementById('signup-form').reset();
  }
});

// --------------------
// LOGIN
// --------------------
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });

  if (error) alert('Login failed: ' + error.message);
  else {
    alert('Login successful!');
    openDashboard('landing'); // redirect to main dashboard
    console.log('User UID:', data.user.id); // for testing RLS
  }
});
  
});

// ------------------
// Complaint Chat Panel
// ------------------
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// Load saved chat from localStorage
let chatHistory = JSON.parse(localStorage.getItem('truckinChat')) || [];
chatHistory.forEach(msg => addMessage(msg.text, msg.type));

function addMessage(text, type) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('chat-message', type === 'user' ? 'user-message' : 'bot-message');
  msgDiv.textContent = text;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, 'user');
  chatHistory.push({ text, type: 'user' });

  // Clear input
  chatInput.value = '';

  // Bot automatic response
  setTimeout(() => {
    const botReply = "Thanks for your message! Our support team will review it and get back to you within 24 hours.";
    addMessage(botReply, 'bot');
    chatHistory.push({ text: botReply, type: 'bot' });

    // Save chat history
    localStorage.setItem('truckinChat', JSON.stringify(chatHistory));
  }, 500);

  // Save user message immediately
  localStorage.setItem('truckinChat', JSON.stringify(chatHistory));
}

// Bind send button & Enter key
chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

chatSendBtn.addEventListener('click', e => {
  e.preventDefault(); // Prevent any default form/button behavior
  sendMessage();
});

const clearChatBtn = document.getElementById('clear-chat-btn');

clearChatBtn.addEventListener('click', () => {
  // Clear chatMessages container
  chatMessages.innerHTML = '';
  // Clear chat history from memory & localStorage
  chatHistory = [];
  localStorage.removeItem('truckinChat');
});

chatInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    e.preventDefault(); // Prevent Enter from submitting a form
    sendMessage();
  }
});

// =====================
  // RECORD BUYER REQUESTS
  // =====================
  document.querySelector('#payment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const buyerData = {
      type: 'buyer',
      name: document.getElementById('buyer-name').value,
      product_name: document.getElementById('product').value,
      email: document.getElementById('buyer-email').value,
      price: document.getElementById('price').value,
      location: document.getElementById('dropoff-location').value,
      created_at: new Date().toISOString()
    };

    const { error } = await _supabase.from('requests').insert([buyerData]);
    
    if (error) alert("Error saving to Supabase: " + error.message);
    else alert("Payment Successful & Recorded!");
  });

  // =====================
  // UPDATE USER PROFILE
  // =====================
  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const profileData = {
      full_name: document.getElementById('full-name').value,
      username: document.getElementById('user-name').value,
      brand_name: document.getElementById('brand-name').value,
      phone_number: document.getElementById('profile-phone').value,
      updated_at: new Date().toISOString()
    };

    const { error } = await _supabase.from('profiles').upsert(profileData);
    
    if (error) console.error(error);
    else alert('Profile synced to Supabase!');
  });

  // =====================
  // REAL-TIME MONITORING (OPTIONAL)
  // =====================
  const monitorTable = async (tableName) => {
    const subscription = supabase
      .channel(`realtime-${tableName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, payload => {
        console.log(`[Realtime][${tableName}]`, payload);
      })
      .subscribe();
  };

  // Example: watch requests and profiles in real-time
  monitorTable('requests');
  monitorTable('profiles');