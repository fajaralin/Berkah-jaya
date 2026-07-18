// Configuration
const STORE_WA_NUMBER = '6281234567890';

// State Management
let appState = {
  products: [],
  cart: [],
  wishlist: [],
  activeCategory: 'semua',
  searchQuery: '',
  activeSort: 'default',
  appliedPriceMin: null,
  appliedPriceMax: null,
  appliedRatingMin: null,
  activeView: 'home', // home, wishlist, checkout, success
  voucherDiscount: 0,
  appliedVoucher: null,
  currentOrder: null,
  currentUser: null,
  redirectAfterLogin: null
};

// Vouchers definition
const MOCK_VOUCHERS = {
  'BERKAHJAYA50': { discount: 50000, minPurchase: 200000, desc: 'Diskon Rp 50.000 untuk minimal belanja Rp 200.000' }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Load initial data
  await fetchProducts();
  loadLocalStorage();
  
  // Render views
  renderProducts();
  updateCartBadge();
  setupEventListeners();
  startPromoSlider();
  initChatLogs();
}

// Local Storage helpers
function loadLocalStorage() {
  try {
    const savedCart = localStorage.getItem('bj_cart');
    const savedWish = localStorage.getItem('bj_wishlist');
    const savedUser = localStorage.getItem('bj_user');
    if (savedCart) appState.cart = JSON.parse(savedCart);
    if (savedWish) appState.wishlist = JSON.parse(savedWish);
    if (savedUser) {
      appState.currentUser = JSON.parse(savedUser);
    }
  } catch (e) {
    console.error('Failed to load localStorage state:', e);
  }
  updateHeaderAuthUI();
}

function saveCartToStorage() {
  localStorage.setItem('bj_cart', JSON.stringify(appState.cart));
}

function saveWishlistToStorage() {
  localStorage.setItem('bj_wishlist', JSON.stringify(appState.wishlist));
}

// Fetch lists from Backend API
async function fetchProducts() {
  try {
    let url = '/api/products';
    const params = [];
    if (appState.activeCategory !== 'semua') params.push(`category=${appState.activeCategory}`);
    if (appState.searchQuery) params.push(`q=${encodeURIComponent(appState.searchQuery)}`);
    if (appState.activeSort !== 'default') params.push(`sort=${appState.activeSort}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil data produk');
    appState.products = await response.json();
  } catch (error) {
    showToast('Koneksi server terganggu. Gagal memuat produk.', 'error');
    console.error(error);
  }
}

// Start promo slideshow
function startPromoSlider() {
  const slides = document.querySelectorAll('.promo-slide');
  const dots = document.querySelectorAll('.slider-dots .dot');
  let currentSlide = 0;
  
  if (slides.length === 0) return;
  
  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
  }
  
  let slideInterval = setInterval(nextSlide, 5000);
  
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      clearInterval(slideInterval);
      slides[currentSlide].classList.remove('active');
      dots[currentSlide].classList.remove('active');
      currentSlide = index;
      slides[currentSlide].classList.add('active');
      dots[currentSlide].classList.add('active');
      slideInterval = setInterval(nextSlide, 5000);
    });
  });
}

// Render dynamic products grid
function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  // Apply local client side filters (price range and rating)
  let filtered = [...appState.products];
  
  if (appState.appliedPriceMin !== null) {
    filtered = filtered.filter(p => p.price >= appState.appliedPriceMin);
  }
  if (appState.appliedPriceMax !== null) {
    filtered = filtered.filter(p => p.price <= appState.appliedPriceMax);
  }
  if (appState.appliedRatingMin !== null) {
    filtered = filtered.filter(p => p.rating >= appState.appliedRatingMin);
  }
  
  renderFilterTags();
  renderBrandFilters(filtered);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-box-open"></i>
        <h3>Produk Tidak Ditemukan</h3>
        <p>Maaf, produk yang Anda cari tidak tersedia atau tidak memenuhi kriteria filter.</p>
        <button class="btn-secondary" id="reset-catalog-filters-btn">Reset Pencarian</button>
      </div>
    `;
    
    document.getElementById('reset-catalog-filters-btn')?.addEventListener('click', () => {
      resetFilters();
    });
    return;
  }
  
  filtered.forEach(product => {
    const isLiked = appState.wishlist.includes(product.id);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);
    
    card.innerHTML = `
      <div class="product-card-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="product-tag ${product.category}">${product.category === 'bangunan' ? 'Bangunan' : product.category === 'listrik' ? 'Listrik' : 'Pertanian'}</span>
        <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${product.id}">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </div>
      <div class="product-card-info">
        <span class="product-brand">${product.brand}</span>
        <a href="#" class="product-name" data-id="${product.id}">${product.name}</a>
        <div class="product-rating-sales">
          <span class="text-gold"><i class="fa-solid fa-star"></i> ${product.rating}</span>
          <span class="text-light">|</span>
          <span class="text-muted">${product.sales >= 1000 ? (product.sales/1000).toFixed(1) + 'rb' : product.sales} Terjual</span>
        </div>
        <div class="product-price-row">
          <span class="product-price">${formatRupiah(product.price)}</span>
          <button class="add-cart-btn-small" data-id="${product.id}" title="Tambah ke keranjang">
            <i class="fa-solid fa-cart-plus"></i>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Render filter badges
function renderFilterTags() {
  const container = document.getElementById('active-filters-tags');
  if (!container) return;
  container.innerHTML = '';
  
  const tags = [];
  
  if (appState.searchQuery) {
    tags.push({ label: `Cari: "${appState.searchQuery}"`, action: 'query' });
  }
  if (appState.activeCategory !== 'semua') {
    tags.push({ label: `Kategori: ${appState.activeCategory}`, action: 'category' });
  }
  if (appState.appliedPriceMin !== null || appState.appliedPriceMax !== null) {
    const min = appState.appliedPriceMin ? formatRupiah(appState.appliedPriceMin) : '0';
    const max = appState.appliedPriceMax ? formatRupiah(appState.appliedPriceMax) : 'Maks';
    tags.push({ label: `Harga: ${min} - ${max}`, action: 'price' });
  }
  if (appState.appliedRatingMin !== null) {
    tags.push({ label: `Rating: ★ ${appState.appliedRatingMin}+`, action: 'rating' });
  }
  
  tags.forEach(t => {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.innerHTML = `
      ${t.label}
      <button data-action="${t.action}"><i class="fa-solid fa-xmark"></i></button>
    `;
    tag.querySelector('button').addEventListener('click', () => {
      clearSpecificFilter(t.action);
    });
    container.appendChild(tag);
  });
}

// Render dynamic brand options
function renderBrandFilters(filteredProducts) {
  const container = document.getElementById('brand-filters');
  if (!container) return;
  
  // Get unique brands
  const brands = [...new Set(appState.products.map(p => p.brand))];
  
  container.innerHTML = '';
  brands.slice(0, 6).forEach(brand => {
    const count = appState.products.filter(p => p.brand === brand).length;
    const label = document.createElement('label');
    label.className = 'filter-checkbox';
    label.innerHTML = `
      <input type="checkbox" name="brand" value="${brand}">
      <span>${brand} (${count})</span>
    `;
    label.querySelector('input').addEventListener('change', (e) => {
      applyBrandFilter();
    });
    container.appendChild(label);
  });
}

// Apply brands filtering
function applyBrandFilter() {
  const checked = Array.from(document.querySelectorAll('input[name="brand"]:checked')).map(el => el.value);
  const grid = document.getElementById('product-grid');
  
  if (checked.length === 0) {
    renderProducts();
    return;
  }
  
  // Filter products by selected brands
  let filtered = [...appState.products];
  
  if (appState.appliedPriceMin !== null) filtered = filtered.filter(p => p.price >= appState.appliedPriceMin);
  if (appState.appliedPriceMax !== null) filtered = filtered.filter(p => p.price <= appState.appliedPriceMax);
  if (appState.appliedRatingMin !== null) filtered = filtered.filter(p => p.rating >= appState.appliedRatingMin);
  
  filtered = filtered.filter(p => checked.includes(p.brand));
  
  grid.innerHTML = '';
  filtered.forEach(product => {
    const isLiked = appState.wishlist.includes(product.id);
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-card-image">
        <img src="${product.image}" alt="${product.name}">
        <span class="product-tag ${product.category}">${product.category}</span>
        <button class="like-btn ${isLiked ? 'liked' : ''}" data-id="${product.id}">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </div>
      <div class="product-card-info">
        <span class="product-brand">${product.brand}</span>
        <a href="#" class="product-name" data-id="${product.id}">${product.name}</a>
        <div class="product-rating-sales">
          <span class="text-gold"><i class="fa-solid fa-star"></i> ${product.rating}</span>
          <span class="text-light">|</span>
          <span class="text-muted">${product.sales} Terjual</span>
        </div>
        <div class="product-price-row">
          <span class="product-price">${formatRupiah(product.price)}</span>
          <button class="add-cart-btn-small" data-id="${product.id}">
            <i class="fa-solid fa-cart-plus"></i>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Reset filters state
function resetFilters() {
  appState.searchQuery = '';
  appState.appliedPriceMin = null;
  appState.appliedPriceMax = null;
  appState.appliedRatingMin = null;
  
  document.getElementById('search-input').value = '';
  document.getElementById('price-min').value = '';
  document.getElementById('price-max').value = '';
  
  const ratingRadios = document.getElementsByName('rating-filter');
  ratingRadios.forEach(radio => {
    if (radio.value === 'all') radio.checked = true;
  });
  
  fetchProducts().then(() => renderProducts());
}

// Clear specific filter
function clearSpecificFilter(type) {
  if (type === 'query') {
    appState.searchQuery = '';
    document.getElementById('search-input').value = '';
  } else if (type === 'category') {
    appState.activeCategory = 'semua';
    document.querySelectorAll('.category-tabs .tab-btn').forEach(btn => {
      if (btn.getAttribute('data-category') === 'semua') btn.classList.add('active');
      else btn.classList.remove('active');
    });
  } else if (type === 'price') {
    appState.appliedPriceMin = null;
    appState.appliedPriceMax = null;
    document.getElementById('price-min').value = '';
    document.getElementById('price-max').value = '';
  } else if (type === 'rating') {
    appState.appliedRatingMin = null;
    const radios = document.getElementsByName('rating-filter');
    radios.forEach(r => { if (r.value === 'all') r.checked = true; });
  }
  
  fetchProducts().then(() => renderProducts());
}

// Format number to Indonesian Rupiah
function formatRupiah(number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(number);
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation / View switches
  document.getElementById('logo-home').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('home');
  });
  

  document.getElementById('wishlist-btn').addEventListener('click', () => {
    switchView('wishlist');
  });
  
  document.getElementById('back-to-shop-wishlist').addEventListener('click', () => {
    switchView('home');
  });

  // Category Tabs click
  const tabs = document.querySelectorAll('.category-tabs .tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', async (e) => {
      tabs.forEach(t => t.classList.remove('active'));
      const activeTab = e.currentTarget;
      activeTab.classList.add('active');
      
      appState.activeCategory = activeTab.getAttribute('data-category');
      
      // If we are currently not on home view, switch to it
      if (appState.activeView !== 'home') {
        switchView('home');
      }
      
      await fetchProducts();
      renderProducts();
    });
  });

  // Footer category links click
  const footLinks = document.querySelectorAll('.footer-cat-link');
  footLinks.forEach(fl => {
    fl.addEventListener('click', async (e) => {
      e.preventDefault();
      const cat = fl.getAttribute('data-category');
      tabs.forEach(t => {
        if (t.getAttribute('data-category') === cat) t.classList.add('active');
        else t.classList.remove('active');
      });
      appState.activeCategory = cat;
      switchView('home');
      await fetchProducts();
      renderProducts();
    });
  });

  // Sorting Selection
  document.getElementById('sort-select').addEventListener('change', async (e) => {
    appState.activeSort = e.target.value;
    await fetchProducts();
    renderProducts();
  });

  // Search input typing suggestions
  const searchInput = document.getElementById('search-input');
  const suggestionsBox = document.getElementById('search-suggestions');
  
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    if (val.length < 2) {
      suggestionsBox.style.display = 'none';
      return;
    }
    
    // filter products locally for autocomplete suggestions
    const matches = appState.products.filter(p => p.name.toLowerCase().includes(val)).slice(0, 5);
    if (matches.length === 0) {
      suggestionsBox.style.display = 'none';
      return;
    }
    
    suggestionsBox.innerHTML = '';
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `<i class="fa-solid fa-magnifying-glass text-light"></i> <span>${m.name}</span>`;
      item.addEventListener('click', () => {
        searchInput.value = m.name;
        suggestionsBox.style.display = 'none';
        triggerSearch(m.name);
      });
      suggestionsBox.appendChild(item);
    });
    suggestionsBox.style.display = 'block';
  });

  // Close suggestion on document click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      suggestionsBox.style.display = 'none';
    }
  });

  // Search Form Submit
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    suggestionsBox.style.display = 'none';
    triggerSearch(searchInput.value);
  });

  // Price Filters Apply
  document.getElementById('apply-price-filter').addEventListener('click', () => {
    const minVal = document.getElementById('price-min').value;
    const maxVal = document.getElementById('price-max').value;
    appState.appliedPriceMin = minVal !== '' ? Number(minVal) : null;
    appState.appliedPriceMax = maxVal !== '' ? Number(maxVal) : null;
    renderProducts();
  });

  // Rating Filter Selection
  const ratingRadios = document.getElementsByName('rating-filter');
  ratingRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const val = radio.value;
      appState.appliedRatingMin = val !== 'all' ? Number(val) : null;
      renderProducts();
    });
  });

  // Clear Filters
  document.getElementById('clear-filters-btn').addEventListener('click', () => {
    resetFilters();
  });

  // Click handler delegation for product catalog
  const catalogGrid = document.getElementById('product-grid');
  catalogGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    const productId = card.getAttribute('data-id');
    
    // Add to cart click
    if (e.target.closest('.add-cart-btn-small')) {
      e.stopPropagation();
      e.preventDefault();
      const flySource = card.querySelector('img');
      addToCart(productId, 1, flySource);
      return;
    }
    
    // Like button click
    if (e.target.closest('.like-btn')) {
      e.stopPropagation();
      e.preventDefault();
      toggleWishlist(productId);
      const btn = e.target.closest('.like-btn');
      btn.classList.toggle('liked');
      const icon = btn.querySelector('i');
      icon.classList.toggle('fa-solid');
      icon.classList.toggle('fa-regular');
      return;
    }
    
    // Detail click
    if (e.target.closest('.product-name') || e.target.closest('.product-card-image')) {
      e.preventDefault();
      openProductDetails(productId);
    }
  });

  // Wishlist catalog click handler delegation
  const wishlistGrid = document.getElementById('wishlist-grid');
  wishlistGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    const productId = card.getAttribute('data-id');
    
    if (e.target.closest('.add-cart-btn-small')) {
      e.preventDefault();
      addToCart(productId, 1, card.querySelector('img'));
    } else if (e.target.closest('.like-btn')) {
      e.preventDefault();
      toggleWishlist(productId);
      renderWishlist(); // Refresh wishlist panel
    } else {
      e.preventDefault();
      openProductDetails(productId);
    }
  });

  // Product Details Modal controls
  document.getElementById('close-detail-modal-btn').addEventListener('click', closeProductDetails);
  
  // Modal background click to close
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('product-detail-modal');
    if (e.target === modal) closeProductDetails();
  });

  // Quantity controllers inside details
  const qtyInput = document.getElementById('qty-input');
  document.getElementById('qty-plus').addEventListener('click', () => {
    qtyInput.value = parseInt(qtyInput.value) + 1;
  });
  
  document.getElementById('qty-minus').addEventListener('click', () => {
    const current = parseInt(qtyInput.value);
    if (current > 1) qtyInput.value = current - 1;
  });

  // Review Form Submit
  document.getElementById('add-review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('review-user').value.trim();
    const comment = document.getElementById('review-comment').value.trim();
    const ratingVal = document.querySelector('input[name="review-rating"]:checked').value;
    
    const productId = document.getElementById('product-detail-modal').getAttribute('data-id');
    
    try {
      const response = await fetch(`/api/products/${productId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, rating: Number(ratingVal), comment })
      });
      
      if (!response.ok) throw new Error('Gagal mengirim ulasan');
      
      const updatedProduct = await response.json();
      
      // Show confirmation & reload review section
      showToast('Ulasan berhasil diposting!', 'success');
      document.getElementById('review-user').value = '';
      document.getElementById('review-comment').value = '';
      
      // Update locally cached product stats
      const localIdx = appState.products.findIndex(p => p.id === productId);
      if (localIdx !== -1) appState.products[localIdx] = updatedProduct;
      
      // Refresh modal
      openProductDetails(productId);
      
    } catch (err) {
      showToast('Terjadi kesalahan saat memposting ulasan.', 'error');
      console.error(err);
    }
  });

  // Cart Side bar toggles
  const cartSidebar = document.getElementById('cart-sidebar');
  const cartOverlay = document.getElementById('cart-overlay');
  
  document.getElementById('cart-icon-btn').addEventListener('click', () => {
    renderCart();
    cartSidebar.classList.add('active');
    cartOverlay.style.display = 'block';
  });
  
  document.getElementById('close-cart-sidebar-btn').addEventListener('click', closeCartSidebar);
  cartOverlay.addEventListener('click', closeCartSidebar);
  
  document.getElementById('cart-start-shopping').addEventListener('click', () => {
    closeCartSidebar();
    switchView('home');
  });

  function closeCartSidebar() {
    cartSidebar.classList.remove('active');
    cartOverlay.style.display = 'none';
  }

  // Cart quantity edits delegation
  document.getElementById('cart-items-wrapper').addEventListener('click', (e) => {
    const row = e.target.closest('.cart-item-row');
    if (!row) return;
    const productId = row.getAttribute('data-id');
    
    // Plus quantity
    if (e.target.closest('.qty-plus-cart')) {
      const idx = appState.cart.findIndex(item => item.productId === productId);
      if (idx !== -1) {
        appState.cart[idx].quantity += 1;
        saveCartToStorage();
        renderCart();
        updateCartBadge();
      }
    }
    
    // Minus quantity
    if (e.target.closest('.qty-minus-cart')) {
      const idx = appState.cart.findIndex(item => item.productId === productId);
      if (idx !== -1) {
        if (appState.cart[idx].quantity > 1) {
          appState.cart[idx].quantity -= 1;
        } else {
          appState.cart.splice(idx, 1);
        }
        saveCartToStorage();
        renderCart();
        updateCartBadge();
      }
    }

    // Remove button
    if (e.target.closest('.btn-remove-item')) {
      appState.cart = appState.cart.filter(item => item.productId !== productId);
      saveCartToStorage();
      renderCart();
      updateCartBadge();
    }
  });

  // Checkout redirect from sidebar cart
  document.getElementById('go-to-checkout-btn').addEventListener('click', () => {
    closeCartSidebar();
    if (!appState.currentUser) {
      appState.redirectAfterLogin = 'checkout';
      openAuthModal();
    } else {
      switchView('checkout');
    }
  });

  // Checkout Cancel click
  document.getElementById('cancel-checkout-btn').addEventListener('click', () => {
    switchView('home');
  });

  // Voucher apply click
  document.getElementById('apply-voucher-btn').addEventListener('click', () => {
    applyVoucherCode();
  });

  // Shipping cost options select change
  document.getElementById('checkout-shipping').addEventListener('change', () => {
    updateCheckoutBillingSummary();
  });

  // Submit checkout order
  document.getElementById('submit-order-btn').addEventListener('click', () => {
    submitCheckoutForm();
  });

  // Success view return links
  document.getElementById('success-back-to-shop').addEventListener('click', () => {
    switchView('home');
  });
  
  document.getElementById('success-chat-seller').addEventListener('click', () => {
    if (appState.currentOrder) {
      const formattedTotal = formatRupiah(appState.currentOrder.total);
      const confirmText = `Halo Berkah Jaya, saya ingin mengonfirmasi pembayaran untuk pesanan berikut:\n\n- ID Pesanan: ${appState.currentOrder.id}\n- Metode Pembayaran: ${appState.currentOrder.paymentMethod}\n- Total Transfer: ${formattedTotal}\n\nSaya akan segera mengirimkan bukti transfernya. Terima kasih!`;
      const waUrl = `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(confirmText)}`;
      window.open(waUrl, '_blank');
    } else {
      switchView('home');
    }
  });

  // Float Chat Assistant Bubble click
  document.getElementById('chat-toggle-bubble').addEventListener('click', () => {
    openChatDrawer();
  });

  document.getElementById('close-chat-drawer-btn').addEventListener('click', () => {
    document.getElementById('chat-drawer').classList.remove('active');
  });

  document.getElementById('chat-send-message-btn').addEventListener('click', () => {
    sendChatMessage();
  });

  document.getElementById('chat-user-message').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });





  // Auth Tabs Toggle
  const loginTab = document.getElementById('tab-login-btn');
  const registerTab = document.getElementById('tab-register-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.classList.add('active');
      registerForm.classList.remove('active');
    });
    
    registerTab.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerForm.classList.add('active');
      loginForm.classList.remove('active');
    });
  }

  // Close Auth Modal
  document.getElementById('close-auth-modal-btn')?.addEventListener('click', closeAuthModal);

  // Login Submit
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Username atau password salah.');
      }
      
      const user = await response.json();
      appState.currentUser = user;
      localStorage.setItem('bj_user', JSON.stringify(user));
      updateHeaderAuthUI();
      closeAuthModal();
      showToast(`Selamat datang kembali, ${user.name}!`, 'success');
      
      // Handle redirect if user was trying to checkout
      if (appState.redirectAfterLogin === 'checkout') {
        appState.redirectAfterLogin = null;
        switchView('checkout');
      }
      
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  // Register Submit
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, phone })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Pendaftaran gagal.');
      }
      
      const user = await response.json();
      appState.currentUser = user;
      localStorage.setItem('bj_user', JSON.stringify(user));
      updateHeaderAuthUI();
      closeAuthModal();
      showToast(`Pendaftaran sukses! Selamat datang, ${user.name}!`, 'success');
      
      // Handle redirect if user was trying to checkout
      if (appState.redirectAfterLogin === 'checkout') {
        appState.redirectAfterLogin = null;
        switchView('checkout');
      }
      
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

// View Switches controller
function switchView(viewName) {
  appState.activeView = viewName;
  
  // Hide all panels
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  
  // Show active panel
  const panel = document.getElementById(`${viewName}-view`);
  if (panel) panel.classList.add('active');
  
  // Scroll to top
  window.scrollTo(0, 0);
  
  if (viewName === 'home') {
    renderProducts();
  } else if (viewName === 'wishlist') {
    renderWishlist();
  } else if (viewName === 'checkout') {
    renderCheckoutSummary();
    if (appState.currentUser) {
      document.getElementById('checkout-name').value = appState.currentUser.name || '';
      document.getElementById('checkout-phone').value = appState.currentUser.phone || '';
    }
  }
}

// Trigger query search
async function triggerSearch(qVal) {
  appState.searchQuery = qVal;
  if (appState.activeView !== 'home') switchView('home');
  await fetchProducts();
  renderProducts();
}

// Add to Cart Logic & Fly Animation
function addToCart(productId, qty = 1, imgSourceElement = null) {
  const product = appState.products.find(p => p.id === productId);
  if (!product) return;
  
  if (product.stock === 0) {
    showToast('Maaf, stok produk saat ini habis!', 'error');
    return;
  }

  // Fly animation
  if (imgSourceElement) {
    const cartIcon = document.getElementById('cart-icon-btn');
    const cartRect = cartIcon.getBoundingClientRect();
    const imgRect = imgSourceElement.getBoundingClientRect();
    
    const clone = imgSourceElement.cloneNode();
    clone.style.position = 'fixed';
    clone.style.top = `${imgRect.top}px`;
    clone.style.left = `${imgRect.left}px`;
    clone.style.width = `${imgRect.width}px`;
    clone.style.height = `${imgRect.height}px`;
    clone.style.borderRadius = '50%';
    clone.style.zIndex = '300';
    clone.style.transition = 'all 0.8s cubic-bezier(0.25, 1, 0.5, 1)';
    clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    
    document.body.appendChild(clone);
    
    // Trigger animation frame
    setTimeout(() => {
      clone.style.top = `${cartRect.top + 10}px`;
      clone.style.left = `${cartRect.left + 10}px`;
      clone.style.width = '10px';
      clone.style.height = '10px';
      clone.style.opacity = '0.3';
    }, 10);
    
    setTimeout(() => {
      clone.remove();
      // Incremental state save
      executeAddToCart();
    }, 800);
  } else {
    executeAddToCart();
  }
  
  function executeAddToCart() {
    const existing = appState.cart.find(item => item.productId === productId);
    
    if (existing) {
      existing.quantity += qty;
    } else {
      appState.cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: qty,
        image: product.image
      });
    }
    
    saveCartToStorage();
    updateCartBadge();
    showToast(`Produk dimasukkan ke keranjang`, 'success');
  }
}

function updateCartBadge() {
  const totalQty = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cart-count').innerText = totalQty;
  
  const wishTotal = appState.wishlist.length;
  document.getElementById('wishlist-count').innerText = wishTotal;
}

// Toggle product in Wishlist
function toggleWishlist(productId) {
  const index = appState.wishlist.indexOf(productId);
  if (index === -1) {
    appState.wishlist.push(productId);
    showToast('Produk ditambahkan ke favorit', 'success');
  } else {
    appState.wishlist.splice(index, 1);
    showToast('Produk dihapus dari favorit', 'success');
  }
  saveWishlistToStorage();
  updateCartBadge();
}

// Render Favorite Wishlist panel
function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const wishItems = appState.products.filter(p => appState.wishlist.includes(p.id));
  
  if (wishItems.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-heart"></i>
        <h3>Wishlist Anda Kosong</h3>
        <p>Jelajahi produk kami dan klik ikon hati untuk menandai produk favorit Anda.</p>
        <button class="btn-primary btn-small" id="wishlist-start-shopping">Cari Produk</button>
      </div>
    `;
    document.getElementById('wishlist-start-shopping')?.addEventListener('click', () => switchView('home'));
    return;
  }
  
  wishItems.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.setAttribute('data-id', product.id);
    card.innerHTML = `
      <div class="product-card-image">
        <img src="${product.image}" alt="${product.name}">
        <span class="product-tag ${product.category}">${product.category}</span>
        <button class="like-btn liked" data-id="${product.id}">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="product-card-info">
        <span class="product-brand">${product.brand}</span>
        <a href="#" class="product-name" data-id="${product.id}">${product.name}</a>
        <div class="product-rating-sales">
          <span class="text-gold"><i class="fa-solid fa-star"></i> ${product.rating}</span>
          <span class="text-light">|</span>
          <span class="text-muted">${product.sales} Terjual</span>
        </div>
        <div class="product-price-row">
          <span class="product-price">${formatRupiah(product.price)}</span>
          <button class="add-cart-btn-small" data-id="${product.id}">
            <i class="fa-solid fa-cart-plus"></i>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// Open Product Details Modal
async function openProductDetails(productId) {
  try {
    const response = await fetch(`/api/products/${productId}`);
    if (!response.ok) throw new Error('Gagal memuat detail produk');
    const product = await response.json();
    
    const modal = document.getElementById('product-detail-modal');
    modal.setAttribute('data-id', product.id);
    
    document.getElementById('detail-image').src = product.image;
    document.getElementById('detail-category-badge').innerText = product.category;
    document.getElementById('detail-category-badge').className = `detail-category-badge ${product.category}`;
    document.getElementById('detail-name').innerText = product.name;
    document.getElementById('detail-brand-text').innerText = product.brand;
    document.getElementById('detail-rating-text').innerText = product.rating;
    document.getElementById('detail-sales-text').innerText = product.sales;
    document.getElementById('detail-price').innerText = formatRupiah(product.price);
    document.getElementById('detail-desc-text').innerText = product.description;
    document.getElementById('detail-stock-text').innerText = product.stock;
    
    // Set quantity picker back to 1
    const qtyInput = document.getElementById('qty-input');
    qtyInput.value = 1;
    qtyInput.max = product.stock;
    
    // Specs Table
    const specsTable = document.getElementById('detail-specs-table');
    specsTable.innerHTML = '';
    const specs = product.specifications || {};
    const keys = Object.keys(specs);
    
    if (keys.length === 0) {
      specsTable.innerHTML = `<tr><td colspan="2" class="text-light">Tidak ada spesifikasi tambahan.</td></tr>`;
    } else {
      keys.forEach(k => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${k}</td><td>${specs[k]}</td>`;
        specsTable.appendChild(row);
      });
    }

    // Modal action buttons
    const addBtn = document.getElementById('add-to-cart-detail-btn');
    const buyBtn = document.getElementById('buy-now-detail-btn');
    
    // Remove previous listeners using clone
    const newAddBtn = addBtn.cloneNode(true);
    const newBuyBtn = buyBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(newAddBtn, addBtn);
    buyBtn.parentNode.replaceChild(newBuyBtn, buyBtn);
    
    if (product.stock === 0) {
      newAddBtn.disabled = true;
      newAddBtn.innerText = 'Stok Habis';
      newBuyBtn.disabled = true;
      newBuyBtn.innerText = 'Stok Habis';
    } else {
      newAddBtn.disabled = false;
      newAddBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Masukkan Keranjang`;
      newAddBtn.addEventListener('click', () => {
        const amt = parseInt(qtyInput.value);
        addToCart(product.id, amt, document.getElementById('detail-image'));
        closeProductDetails();
      });
      
      newBuyBtn.disabled = false;
      newBuyBtn.innerText = 'Beli Sekarang';
      newBuyBtn.addEventListener('click', () => {
        const amt = parseInt(qtyInput.value);
        addToCart(product.id, amt, null);
        closeProductDetails();
        if (!appState.currentUser) {
          appState.redirectAfterLogin = 'checkout';
          openAuthModal();
        } else {
          switchView('checkout');
        }
      });

      // WhatsApp Inquiry Button
      const waAskBtn = document.getElementById('wa-ask-detail-btn');
      if (waAskBtn) {
        const newWaAskBtn = waAskBtn.cloneNode(true);
        waAskBtn.parentNode.replaceChild(newWaAskBtn, waAskBtn);
        newWaAskBtn.addEventListener('click', () => {
          const formattedPrice = formatRupiah(product.price);
          const queryText = `Halo Berkah Jaya, saya tertarik dan ingin bertanya tentang produk ini:\n\n*Detail Produk:*\n- Nama: ${product.name}\n- Merek: ${product.brand}\n- Kategori: ${product.category}\n- Harga: ${formattedPrice}\n\n`;
          const waUrl = `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(queryText)}`;
          window.open(waUrl, '_blank');
        });
      }
    }

    // Review Summary rendering
    document.getElementById('reviews-avg-rating').innerText = product.rating;
    document.getElementById('reviews-count-text').innerText = product.reviews.length;
    
    const starAvgContainer = document.getElementById('reviews-avg-stars');
    starAvgContainer.innerHTML = '';
    const fullStars = Math.floor(product.rating);
    const halfStar = product.rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('i');
      if (i <= fullStars) {
        star.className = 'fa-solid fa-star text-gold';
      } else if (i === fullStars + 1 && halfStar) {
        star.className = 'fa-solid fa-star-half-stroke text-gold';
      } else {
        star.className = 'fa-regular fa-star text-light';
      }
      starAvgContainer.appendChild(star);
    }
    
    // Review Items List
    const reviewList = document.getElementById('detail-reviews-list');
    reviewList.innerHTML = '';
    
    if (product.reviews.length === 0) {
      reviewList.innerHTML = `<div class="text-center text-light" style="padding: 20px 0;">Belum ada ulasan untuk produk ini.</div>`;
    } else {
      product.reviews.forEach(r => {
        const item = document.createElement('div');
        item.className = 'review-item';
        
        let rStars = '';
        for (let i = 1; i <= 5; i++) {
          rStars += `<i class="${i <= r.rating ? 'fa-solid fa-star text-gold' : 'fa-regular fa-star text-light'}"></i> `;
        }
        
        item.innerHTML = `
          <div class="review-item-header">
            <span class="review-user">${r.user}</span>
            <span class="review-date">${r.date}</span>
          </div>
          <div class="review-stars">${rStars}</div>
          <p class="review-comment">${r.comment}</p>
        `;
        reviewList.appendChild(item);
      });
    }

    modal.classList.add('active');
  } catch (err) {
    showToast('Detail produk gagal dimuat.', 'error');
    console.error(err);
  }
}

function closeProductDetails() {
  document.getElementById('product-detail-modal').classList.remove('active');
}

// Render Sidebar Cart Details
function renderCart() {
  const container = document.getElementById('cart-items-wrapper');
  const footerPanel = document.getElementById('cart-sidebar-footer-panel');
  const subtotalText = document.getElementById('cart-sidebar-subtotal');
  const badgeCount = document.getElementById('cart-sidebar-count');
  
  badgeCount.innerText = appState.cart.reduce((sum, i) => sum + i.quantity, 0);

  if (appState.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-cart-state">
        <i class="fa-solid fa-cart-arrow-down text-light" style="font-size: 40px; margin-bottom: 10px;"></i>
        <p>Keranjang belanja kosong</p>
        <button class="btn-primary btn-small" id="cart-start-shopping-empty" style="margin-top: 10px;">Belanja Sekarang</button>
      </div>
    `;
    footerPanel.style.display = 'none';
    
    document.getElementById('cart-start-shopping-empty')?.addEventListener('click', () => {
      document.getElementById('cart-sidebar').classList.remove('active');
      document.getElementById('cart-overlay').style.display = 'none';
      switchView('home');
    });
    return;
  }
  
  footerPanel.style.display = 'block';
  container.innerHTML = '';
  
  let subtotal = 0;
  
  appState.cart.forEach(item => {
    const totalItemVal = item.price * item.quantity;
    subtotal += totalItemVal;
    
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    row.setAttribute('data-id', item.productId);
    
    row.innerHTML = `
      <img src="${item.image}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <h4 class="cart-item-name">${item.name}</h4>
        <div class="cart-item-price">${formatRupiah(item.price)}</div>
        <div class="cart-item-qty-row">
          <div class="qty-buttons">
            <button class="qty-minus-cart"><i class="fa-solid fa-minus"></i></button>
            <input type="number" value="${item.quantity}" readonly>
            <button class="qty-plus-cart"><i class="fa-solid fa-plus"></i></button>
          </div>
          <button class="btn-remove-item" title="Hapus item"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
  
  subtotalText.innerText = formatRupiah(subtotal);
}

// Render Checkout Summary view
function renderCheckoutSummary() {
  const container = document.getElementById('checkout-items-list');
  if (appState.cart.length === 0) {
    showToast('Keranjang Anda kosong! Silakan berbelanja terlebih dahulu.', 'error');
    switchView('home');
    return;
  }
  
  container.innerHTML = '';
  appState.cart.forEach(item => {
    const row = document.createElement('div');
    row.className = 'checkout-item-mini';
    row.innerHTML = `
      <span class="checkout-item-title">${item.name} (x${item.quantity})</span>
      <span class="checkout-item-qty-price">${formatRupiah(item.price * item.quantity)}</span>
    `;
    container.appendChild(row);
  });
  
  // reset voucher discount status when loading checkout
  appState.voucherDiscount = 0;
  appState.appliedVoucher = null;
  document.getElementById('voucher-input').value = '';
  document.getElementById('discount-row').style.display = 'none';
  document.getElementById('voucher-message').innerHTML = '';
  
  updateCheckoutBillingSummary();
}

function updateCheckoutBillingSummary() {
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const shipSelect = document.getElementById('checkout-shipping');
  const shipCost = Number(shipSelect.options[shipSelect.selectedIndex].getAttribute('data-price')) || 0;
  
  document.getElementById('checkout-subtotal').innerText = formatRupiah(subtotal);
  document.getElementById('checkout-shipping-cost').innerText = formatRupiah(shipCost);
  
  // Check minimum requirement for vouchers if already applied
  if (appState.appliedVoucher) {
    const voucher = MOCK_VOUCHERS[appState.appliedVoucher];
    if (subtotal < voucher.minPurchase) {
      appState.voucherDiscount = 0;
      appState.appliedVoucher = null;
      document.getElementById('discount-row').style.display = 'none';
      document.getElementById('voucher-message').innerHTML = `<span class="text-orange">Voucher dibatalkan karena pembelian kurang dari minimum.</span>`;
    } else {
      appState.voucherDiscount = voucher.discount;
      document.getElementById('checkout-discount').innerText = `-${formatRupiah(voucher.discount)}`;
      document.getElementById('discount-row').style.display = 'flex';
    }
  }
  
  const total = subtotal + shipCost - appState.voucherDiscount;
  document.getElementById('checkout-total-bill').innerText = formatRupiah(total);
}

// Apply voucher validation
function applyVoucherCode() {
  const input = document.getElementById('voucher-input').value.trim().toUpperCase();
  const msgBox = document.getElementById('voucher-message');
  
  if (!input) {
    msgBox.innerHTML = '';
    return;
  }
  
  const voucher = MOCK_VOUCHERS[input];
  if (!voucher) {
    msgBox.innerHTML = `<span class="text-orange">Kode voucher tidak valid!</span>`;
    return;
  }
  
  const subtotal = appState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (subtotal < voucher.minPurchase) {
    msgBox.innerHTML = `<span class="text-orange">Voucher gagal digunakan. Minimal pembelian Rp ${voucher.minPurchase.toLocaleString('id-ID')}</span>`;
    return;
  }
  
  // Apply
  appState.appliedVoucher = input;
  appState.voucherDiscount = voucher.discount;
  msgBox.innerHTML = `<span class="text-green">Voucher "${input}" berhasil digunakan! Potongan ${formatRupiah(voucher.discount)}</span>`;
  
  updateCheckoutBillingSummary();
}

// Submit checkout form API Call
async function submitCheckoutForm() {
  const name = document.getElementById('checkout-name').value.trim();
  const phone = document.getElementById('checkout-phone').value.trim();
  const address = document.getElementById('checkout-address').value.trim();
  
  const shipSelect = document.getElementById('checkout-shipping');
  const shipOption = shipSelect.options[shipSelect.selectedIndex].text;
  const shipCost = Number(shipSelect.options[shipSelect.selectedIndex].getAttribute('data-price')) || 0;
  
  const paymentMethod = document.getElementById('checkout-payment').value;
  
  if (!name || !phone || !address) {
    showToast('Mohon isi alamat pengiriman dan nama penerima.', 'error');
    return;
  }

  const orderItems = appState.cart.map(item => ({
    productId: item.productId,
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  const orderPayload = {
    customerName: name,
    phone,
    address,
    items: orderItems,
    shippingCost: shipCost,
    paymentMethod: `${paymentMethod} (${shipOption})`
  };

  try {
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses Pesanan...`;

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Terjadi kesalahan sistem.');
    }

    const orderResult = await response.json();
    appState.currentOrder = orderResult;
    
    // Clear shopping cart
    appState.cart = [];
    saveCartToStorage();
    updateCartBadge();
    
    // Show success view
    showSuccessOrderView(orderResult);

    // Redirect to WhatsApp automatically
    const itemsText = orderResult.items.map((item, idx) => `- ${item.name} (x${item.quantity}) - ${formatRupiah(item.price * item.quantity)}`).join('\n');
    const waText = `Halo Berkah Jaya, saya ingin memesan barang dengan detail berikut:\n\n*Detail Penerima:*\n- Nama: ${orderResult.customerName}\n- No. HP: ${orderResult.phone}\n- Alamat: ${orderResult.address}\n- Jasa Pengiriman & Pembayaran: ${orderResult.paymentMethod}\n\n*Daftar Produk:*\n${itemsText}\n\n*Total Belanja:* ${formatRupiah(orderResult.total)}\n\nMohon segera diproses ya, terima kasih!`;
    const waUrl = `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(waText)}`;
    window.open(waUrl, '_blank');

  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
  } finally {
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = false;
    btn.innerText = `Buat Pesanan Sekarang`;
  }
}

function showSuccessOrderView(order) {
  document.getElementById('success-order-id').innerText = order.id;
  document.getElementById('success-payment').innerText = order.paymentMethod;
  document.getElementById('success-total').innerText = formatRupiah(order.total);
  
  const guideBox = document.getElementById('payment-instructions-box');
  const guideText = document.getElementById('payment-guide-text');
  
  if (order.paymentMethod.includes('COD')) {
    guideBox.style.backgroundColor = 'hsl(145, 80%, 96%)';
    guideBox.style.borderColor = 'var(--color-pertanian)';
    guideText.innerHTML = `Pesanan Anda menggunakan metode <strong>COD (Bayar di Tempat)</strong>. Siapkan uang tunai pas sebesar <strong>${formatRupiah(order.total)}</strong> saat kurir mengantarkan barang ke rumah Anda.`;
    guideBox.querySelector('.bank-account-card').style.display = 'none';
    guideBox.querySelector('.warning-text').style.display = 'none';
  } else {
    guideBox.style.backgroundColor = 'hsl(40, 100%, 97%)';
    guideBox.style.borderColor = 'var(--color-listrik)';
    guideText.innerText = 'Silakan lakukan pembayaran melalui transfer bank ke rekening toko berikut agar pesanan Anda dapat segera dikirim:';
    guideBox.querySelector('.bank-account-card').style.display = 'flex';
    guideBox.querySelector('.warning-text').style.display = 'block';
  }
  
  switchView('success');
}



// Live Support Chat drawer controls
function openChatDrawer() {
  document.getElementById('chat-drawer').classList.add('active');
  document.getElementById('chat-unread-dot').style.display = 'none';
  scrollChatToBottom();
}

async function initChatLogs() {
  try {
    const response = await fetch('/api/chat');
    const logs = await response.json();
    renderChats(logs);
  } catch (e) {
    console.error(e);
  }
}

function renderChats(chatLogs) {
  const container = document.getElementById('chat-messages-container');
  container.innerHTML = '';
  
  if (chatLogs.length === 0) {
    container.innerHTML = `<div class="text-center text-light" style="font-size: 12px; padding: 20px 0;">Mulai percakapan dengan menanyakan stok atau kiriman.</div>`;
    return;
  }
  
  chatLogs.forEach(c => {
    const bubble = document.createElement('div');
    bubble.className = `chat-msg ${c.sender}`;
    
    const d = new Date(c.timestamp);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    
    bubble.innerHTML = `
      ${c.message}
      <span class="chat-time">${timeStr}</span>
    `;
    container.appendChild(bubble);
  });
  
  scrollChatToBottom();
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages-container');
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}

// Send chat message to WhatsApp
async function sendChatMessage() {
  const input = document.getElementById('chat-user-message');
  const message = input.value.trim();
  
  if (!message) return;
  
  input.value = '';
  
  // Render user message immediately
  appendChatBubble(message, 'customer');
  scrollChatToBottom();
  
  // Redirect to WhatsApp
  const waText = `Halo Berkah Jaya, saya ingin bertanya:\n${message}`;
  const waUrl = `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(waText)}`;
  window.open(waUrl, '_blank');
}

function appendChatBubble(text, sender) {
  const container = document.getElementById('chat-messages-container');
  
  // Remove empty label if present
  if (container.innerText.includes('Mulai percakapan')) {
    container.innerHTML = '';
  }

  const bubble = document.createElement('div');
  bubble.className = `chat-msg ${sender}`;
  
  const d = new Date();
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  
  bubble.innerHTML = `
    ${text}
    <span class="chat-time">${timeStr}</span>
  `;
  container.appendChild(bubble);
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages-container');
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.id = 'chat-typing-indicator';
  indicator.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;
  container.appendChild(indicator);
  scrollChatToBottom();
}

function removeTypingIndicator() {
  const ind = document.getElementById('chat-typing-indicator');
  if (ind) ind.remove();
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') {
    icon = '<i class="fa-solid fa-circle-check" style="color: #2ecc71;"></i>';
  } else if (type === 'error') {
    icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--primary);"></i>';
  }
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  // Remove after animation completes
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Auth UI helpers
function updateHeaderAuthUI() {
  const container = document.getElementById('user-auth-wrapper');
  if (!container) return;
  
  if (appState.currentUser) {
    container.innerHTML = `
      <div class="user-profile-menu">
        <span class="user-welcome"><i class="fa-solid fa-circle-user"></i> <span class="welcome-text">Halo, <strong>${appState.currentUser.name}</strong></span></span>
        <button class="action-btn text-orange" id="nav-logout-btn" title="Keluar">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    `;
    
    // Attach logout event
    document.getElementById('nav-logout-btn').addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  } else {
    container.innerHTML = `
      <button class="btn-login-nav" id="nav-login-btn" title="Masuk / Daftar Akun">
        <i class="fa-regular fa-user"></i>
        <span class="btn-text">Masuk</span>
      </button>
    `;
    
    // Attach login event
    document.getElementById('nav-login-btn').addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  }
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

function handleLogout() {
  appState.currentUser = null;
  localStorage.removeItem('bj_user');
  updateHeaderAuthUI();
  showToast('Anda berhasil keluar.', 'success');
  // If we are currently on checkout or admin views, go back to home
  if (appState.activeView === 'checkout' || appState.activeView === 'admin') {
    switchView('home');
  }
}
