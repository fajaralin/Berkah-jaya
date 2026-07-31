// Admin Dashboard State Management
let adminState = {
  currentAdminTab: 'products', // products, orders
  products: []
};
let currentCategoryFilter = 'all';

// Function to filter products in table based on category tab & search input
function filterAdminProducts() {
  const searchQuery = document.getElementById('admin-product-search').value.toLowerCase().trim();
  const rows = document.querySelectorAll('#admin-product-table-body tr');
  
  rows.forEach(row => {
    const name = row.querySelector('.product-row-info').innerText.toLowerCase();
    const brand = row.getAttribute('data-brand').toLowerCase();
    const cat = row.getAttribute('data-category');
    
    const matchesSearch = name.includes(searchQuery) || brand.includes(searchQuery);
    const matchesCategory = (currentCategoryFilter === 'all' || cat === currentCategoryFilter);
    
    if (matchesSearch && matchesCategory) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Initialize Admin Application
document.addEventListener('DOMContentLoaded', () => {
  initAdmin();
});

async function initAdmin() {
  await loadAdminDashboard();
  setupAdminEventListeners();
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

// Load Admin Dashboard
async function loadAdminDashboard() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Gagal memuat statistik admin');
    const stats = await response.json();
    
    // Render Counters
    document.getElementById('stat-revenue').innerText = formatRupiah(stats.totalRevenue);
    document.getElementById('stat-products-count').innerText = stats.totalProducts;
    document.getElementById('stat-orders-count').innerText = stats.totalOrders;
    document.getElementById('stat-units-sold').innerText = stats.totalSalesCount;
    
    // Draw Sales Distribution progress bars
    const dist = stats.categoryDistribution || { bangunan: 0, listrik: 0, pertanian: 0 };
    const maxVal = Math.max(dist.bangunan, dist.listrik, dist.pertanian, 1);
    
    document.getElementById('dist-bangunan-val').innerText = formatRupiah(dist.bangunan);
    document.getElementById('dist-bangunan-bar').style.width = `${(dist.bangunan / maxVal) * 100}%`;
    
    document.getElementById('dist-listrik-val').innerText = formatRupiah(dist.listrik);
    document.getElementById('dist-listrik-bar').style.width = `${(dist.listrik / maxVal) * 100}%`;
    
    document.getElementById('dist-pertanian-val').innerText = formatRupiah(dist.pertanian);
    document.getElementById('dist-pertanian-bar').style.width = `${(dist.pertanian / maxVal) * 100}%`;
    
    // Render Product table CRUD
    renderAdminProductsTable();
    
    // Render Orders manager
    renderAdminOrdersTable(stats.recentOrders);
    
    // Render Recent Activities list
    renderRecentActivities(stats.recentOrders);
    
  } catch (err) {
    showToast('Terjadi kesalahan memuat dashboard.', 'error');
    console.error(err);
  }
}

async function renderAdminProductsTable() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();
    adminState.products = products; // Save to local state
    
    const tbody = document.getElementById('admin-product-table-body');
    tbody.innerHTML = '';
    
    products.forEach(p => {
      const row = document.createElement('tr');
      row.setAttribute('data-id', p.id);
      row.setAttribute('data-brand', p.brand);
      row.setAttribute('data-category', p.category);
      
      row.innerHTML = `
        <td>
          <div class="product-row-info">
            <img src="${p.image}" class="product-row-img" alt="${p.name}">
            <span>${p.name}</span>
          </div>
        </td>
        <td><span class="product-tag ${p.category}">${p.category}</span></td>
        <td><strong>${formatRupiah(p.price)}</strong></td>
        <td>${p.stock} pcs</td>
        <td>${p.sales} unit</td>
        <td>
          <div class="action-links">
            <button class="admin-edit-prod-btn" title="Edit Produk"><i class="fa-solid fa-pen"></i></button>
            <button class="admin-delete-prod-btn" title="Hapus Produk"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Re-apply filter and search based on current state
    filterAdminProducts();
  } catch (err) {
    console.error('Failed to load products table in admin:', err);
  }
}

function renderAdminOrdersTable(recentOrders) {
  const tbody = document.getElementById('admin-order-table-body');
  tbody.innerHTML = '';
  
  if (recentOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-light">Belum ada pesanan masuk.</td></tr>`;
    return;
  }
  
  recentOrders.forEach(o => {
    const row = document.createElement('tr');
    row.style.cursor = 'pointer';
    
    const itemsText = o.items.map(i => `${i.name} (x${i.quantity})`).join(', ');
    const statClass = o.status === 'Selesai' ? 'selesai' : o.status === 'Dalam Pengiriman' ? 'kirim' : 'proses';
    
    row.innerHTML = `
      <td><strong>#${o.id}</strong></td>
      <td>${o.date}</td>
      <td>
        <strong>${o.customerName}</strong><br>
        <span class="text-light" style="font-size: 11px;">${o.phone}</span>
      </td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsText}">${itemsText}</td>
      <td><strong>${formatRupiah(o.total)}</strong></td>
      <td><span class="status-badge ${statClass}">${o.status}</span></td>
      <td>
        <div class="action-links">
          <button class="admin-view-order-btn" title="Rincian Pesanan"><i class="fa-solid fa-eye"></i></button>
          ${o.status !== 'Selesai' ? `<button class="admin-complete-order-btn" data-id="${o.id}" title="Tandai Selesai"><i class="fa-solid fa-circle-check"></i></button>` : `<span class="text-green"><i class="fa-solid fa-circle-check"></i></span>`}
        </div>
      </td>
    `;
    
    // Attach click event to row / view order button
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.admin-complete-order-btn')) {
        openAdminOrderDetailModal(o);
      }
    });

    // Attach listener to update order status
    const compBtn = row.querySelector('.admin-complete-order-btn');
    if (compBtn) {
      compBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await updateOrderStatus(o.id, 'Selesai');
      });
    }
    
    tbody.appendChild(row);
  });
}

function openAdminOrderDetailModal(o) {
  const modal = document.getElementById('admin-order-detail-modal');
  const badge = document.getElementById('order-detail-status-badge');
  const bodyContent = document.getElementById('order-modal-body-content');
  const waBtn = document.getElementById('order-detail-wa-btn');
  const completeBtn = document.getElementById('order-detail-complete-btn');

  // Set status badge
  const statClass = o.status === 'Selesai' ? 'selesai' : o.status === 'Dalam Pengiriman' ? 'kirim' : 'proses';
  badge.className = `status-badge ${statClass}`;
  badge.innerText = o.status;

  // Clean WhatsApp phone number
  let cleanPhone = o.phone ? o.phone.replace(/[^0-9]/g, '') : '';
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  const waMsg = encodeURIComponent(`Halo ${o.customerName}, mengenai pesanan #${o.id} di Toko Berkah Jaya:`);
  waBtn.href = `https://api.whatsapp.com/send/?phone=${cleanPhone}&text=${waMsg}`;

  if (o.status === 'Selesai') {
    completeBtn.style.display = 'none';
  } else {
    completeBtn.style.display = 'inline-flex';
    completeBtn.onclick = async () => {
      closeAdminOrderDetailModal();
      await updateOrderStatus(o.id, 'Selesai');
    };
  }

  // Populate Body
  bodyContent.innerHTML = `
    <div class="order-detail-grid">
      <div class="order-detail-section">
        <h4><i class="fa-solid fa-user text-orange"></i> Informasi Pemesan</h4>
        <div class="order-info-group">
          <div class="info-row"><span>Kode Pesanan:</span> <strong>#${o.id}</strong></div>
          <div class="info-row"><span>Tanggal Transaksi:</span> <span>${o.date}</span></div>
          <div class="info-row"><span>Nama Pembeli:</span> <strong>${o.customerName}</strong></div>
          <div class="info-row"><span>No. Telepon / WA:</span> <span>${o.phone}</span></div>
          <div class="info-row">
            <span>Alamat Pengiriman:</span>
            <div class="address-box">${o.address || 'Alamat tidak dicantumkan'}</div>
          </div>
        </div>
      </div>

      <div class="order-detail-section">
        <h4><i class="fa-solid fa-credit-card text-orange"></i> Pembayaran & Pengiriman</h4>
        <div class="order-info-group">
          <div class="info-row"><span>Metode Pembayaran:</span> <span>${o.paymentMethod || 'Transfer Bank'}</span></div>
          <div class="info-row"><span>Ongkos Kirim:</span> <span>${formatRupiah(o.shippingCost || 0)}</span></div>
          <div class="info-row highlight-total"><span>Total Tagihan:</span> <strong class="text-orange">${formatRupiah(o.total)}</strong></div>
        </div>
      </div>

      <div class="order-detail-section full-width">
        <h4><i class="fa-solid fa-box-open text-orange"></i> Daftar Barang Dipesan (${o.items ? o.items.length : 0} Barang)</h4>
        <div class="order-items-table-wrapper">
          <table class="order-items-table">
            <thead>
              <tr>
                <th>Nama Barang</th>
                <th>Harga Satuan</th>
                <th>Jumlah</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(o.items || []).map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${formatRupiah(item.price)}</td>
                  <td>x${item.quantity}</td>
                  <td><strong>${formatRupiah(item.price * item.quantity)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');
}

function closeAdminOrderDetailModal() {
  document.getElementById('admin-order-detail-modal').classList.remove('active');
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    showToast(`Pesanan #${orderId} ditandai selesai!`, 'success');
    loadAdminDashboard();
  } catch (e) {
    console.error(e);
  }
}

function renderRecentActivities(orders) {
  const container = document.getElementById('admin-recent-activities');
  container.innerHTML = '';
  
  if (orders.length === 0) {
    container.innerHTML = `<li class="text-light">Belum ada aktivitas baru.</li>`;
    return;
  }
  
  orders.forEach(o => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="activity-desc">
        Pesanan Baru <strong>#${o.id}</strong> dari <strong>${o.customerName}</strong> senilai ${formatRupiah(o.total)}
      </div>
      <span class="activity-time">${o.date}</span>
    `;
    container.appendChild(li);
  });
}

// Delete product
async function deleteStoreProduct(id) {
  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Gagal menghapus produk');
    showToast('Produk berhasil dihapus.', 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast('Gagal menghapus produk.', 'error');
    console.error(err);
  }
}

// Default specifications templates for each category
const categorySpecTemplates = {
  bangunan: {
    "Berat": "",
    "Bahan": "",
    "Tipe": "",
    "Standar": "SNI"
  },
  listrik: {
    "Daya (Watt)": "",
    "Panjang Kabel": "",
    "Voltase": "220V",
    "Warna": ""
  },
  pertanian: {
    "Volume / Berat": "",
    "Bahan Aktif": "",
    "Sifat / Cara Pakai": "",
    "Dosis / Komposisi": ""
  }
};

// Function to populate specs based on category
function applyCategorySpecsTemplate(category) {
  const wrapper = document.getElementById('specs-fields-wrapper');
  wrapper.innerHTML = ''; // clear existing
  
  const specs = categorySpecTemplates[category] || {};
  Object.keys(specs).forEach(k => {
    const row = document.createElement('div');
    row.className = 'spec-field-pair';
    row.innerHTML = `
      <input type="text" class="spec-key" value="${k}" placeholder="Nama Spesifikasi">
      <input type="text" class="spec-value" value="${specs[k]}" placeholder="Nilai">
      <button type="button" class="btn-remove-spec"><i class="fa-solid fa-trash"></i></button>
    `;
    row.querySelector('.btn-remove-spec').addEventListener('click', () => row.remove());
    wrapper.appendChild(row);
  });
}

// Open Product Form Crud Modal (Add/Edit)
async function openProductCrudModal(productId = null) {
  const modal = document.getElementById('product-form-modal');
  const title = document.getElementById('product-form-title');
  const form = document.getElementById('product-crud-form');
  
  // reset form
  form.reset();
  document.getElementById('form-product-id').value = '';
  document.getElementById('specs-fields-wrapper').innerHTML = '';

  if (productId) {
    title.innerText = 'Edit Detail Produk';
    try {
      const response = await fetch(`/api/products/${productId}`);
      const p = await response.json();
      
      document.getElementById('form-product-id').value = p.id;
      document.getElementById('form-product-name').value = p.name;
      document.getElementById('form-product-brand').value = p.brand;
      document.getElementById('form-product-category').value = p.category;
      document.getElementById('form-product-image').value = p.image;
      document.getElementById('form-product-price').value = p.price;
      document.getElementById('form-product-stock').value = p.stock;
      document.getElementById('form-product-desc').value = p.description;
      
      // Load Specs fields
      const wrapper = document.getElementById('specs-fields-wrapper');
      const specs = p.specifications || {};
      Object.keys(specs).forEach(k => {
        const row = document.createElement('div');
        row.className = 'spec-field-pair';
        row.innerHTML = `
          <input type="text" class="spec-key" value="${k}" placeholder="Nama Spesifikasi">
          <input type="text" class="spec-value" value="${specs[k]}" placeholder="Nilai">
          <button type="button" class="btn-remove-spec"><i class="fa-solid fa-trash"></i></button>
        `;
        row.querySelector('.btn-remove-spec').addEventListener('click', () => row.remove());
        wrapper.appendChild(row);
      });
      
    } catch (e) {
      console.error(e);
      showToast('Gagal mengambil detail produk untuk diedit', 'error');
      return;
    }
  } else {
    title.innerText = 'Tambah Produk Baru';
    // Auto populate template for new product (default category 'bangunan')
    applyCategorySpecsTemplate('bangunan');
  }
  
  updateFormImagePreview();
  modal.classList.add('active');
}

function closeProductCrudModal() {
  document.getElementById('product-form-modal').classList.remove('active');
}

// Submit Product CRUD Form API Call
async function submitProductCrudForm() {
  const id = document.getElementById('form-product-id').value;
  const name = document.getElementById('form-product-name').value.trim();
  const brand = document.getElementById('form-product-brand').value.trim();
  const category = document.getElementById('form-product-category').value;
  const image = document.getElementById('form-product-image').value.trim();
  const price = Number(document.getElementById('form-product-price').value);
  const stock = Number(document.getElementById('form-product-stock').value);
  const description = document.getElementById('form-product-desc').value.trim();

  // Gather Specifications object
  const specsObj = {};
  const specPairs = document.querySelectorAll('#specs-fields-wrapper .spec-field-pair');
  specPairs.forEach(pair => {
    const key = pair.querySelector('.spec-key').value.trim();
    const val = pair.querySelector('.spec-value').value.trim();
    if (key && val) {
      specsObj[key] = val;
    }
  });

  const payload = { name, brand, category, image, price, stock, description, specifications: specsObj };

  try {
    let response;
    if (id) {
      // Edit PUT
      response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      // Add POST
      response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) throw new Error('Gagal menyimpan produk.');
    
    // Broadcast product update signal to index.html/store tabs
    try {
      localStorage.setItem('bj_products_updated', Date.now());
    } catch (e) {}

    showToast(id ? 'Detail produk berhasil diperbarui.' : 'Produk baru berhasil ditambahkan.', 'success');
    closeProductCrudModal();
    
    // Refresh admin data
    loadAdminDashboard();

  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
  }
}

// Setup Event Listeners
function setupAdminEventListeners() {
  // Admin dashboard tabs controls
  const adminTabs = document.querySelectorAll('.admin-tab-bar .admin-tab-btn');
  adminTabs.forEach(tb => {
    tb.addEventListener('click', (e) => {
      adminTabs.forEach(t => t.classList.remove('active'));
      const activeTabBtn = e.currentTarget;
      activeTabBtn.classList.add('active');
      
      const val = activeTabBtn.innerText === 'Manajemen Produk' ? 'products' : 'orders';
      adminState.currentAdminTab = val;
      
      if (val === 'products') {
        document.getElementById('admin-products-panel').classList.add('active');
        document.getElementById('admin-orders-panel').classList.remove('active');
      } else {
        document.getElementById('admin-products-panel').classList.remove('active');
        document.getElementById('admin-orders-panel').classList.add('active');
      }
    });
  });

  // Admin Search filter
  document.getElementById('admin-product-search').addEventListener('input', () => {
    filterAdminProducts();
  });

  // Admin Product Delete / Edit delegation
  document.getElementById('admin-product-table-body').addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const productId = row.getAttribute('data-id');
    
    // Delete action
    if (e.target.closest('.admin-delete-prod-btn')) {
      if (confirm('Apakah Anda yakin ingin menghapus produk ini dari toko?')) {
        deleteStoreProduct(productId);
      }
    }
    
    // Edit action
    if (e.target.closest('.admin-edit-prod-btn')) {
      openProductCrudModal(productId);
    }
  });

  // Admin Add Product click
  document.getElementById('admin-add-product-btn').addEventListener('click', () => {
    openProductCrudModal(null);
  });

  // Admin Category filter buttons click
  const filterBtns = document.querySelectorAll('.admin-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Toggle active status
      filterBtns.forEach(b => b.classList.remove('active'));
      const activeBtn = e.currentTarget;
      activeBtn.classList.add('active');
      
      currentCategoryFilter = activeBtn.getAttribute('data-category');
      filterAdminProducts();
    });
  });

  document.getElementById('close-form-modal-btn').addEventListener('click', closeProductCrudModal);
  document.getElementById('btn-cancel-crud').addEventListener('click', closeProductCrudModal);

  // Admin Product Category change template applicator
  document.getElementById('form-product-category').addEventListener('change', (e) => {
    const isNew = !document.getElementById('form-product-id').value;
    const hasSpecs = document.querySelectorAll('#specs-fields-wrapper .spec-field-pair').length > 0;
    if (isNew || !hasSpecs || confirm('Ganti template spesifikasi sesuai kategori baru? (Spesifikasi saat ini akan direset)')) {
      applyCategorySpecsTemplate(e.target.value);
    }
  });

  // Admin Product Form Submit
  document.getElementById('product-crud-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitProductCrudForm();
  });

  // Admin dynamic spec fields
  document.getElementById('btn-add-spec-field').addEventListener('click', () => {
    const container = document.getElementById('specs-fields-wrapper');
    const row = document.createElement('div');
    row.className = 'spec-field-pair';
    row.innerHTML = `
      <input type="text" class="spec-key" placeholder="Nama Spesifikasi">
      <input type="text" class="spec-value" placeholder="Nilai">
      <button type="button" class="btn-remove-spec"><i class="fa-solid fa-trash"></i></button>
    `;
    row.querySelector('.btn-remove-spec').addEventListener('click', () => row.remove());
    container.appendChild(row);
  });

  document.getElementById('close-order-modal-btn')?.addEventListener('click', closeAdminOrderDetailModal);
  document.getElementById('order-detail-close-btn')?.addEventListener('click', closeAdminOrderDetailModal);

  // Form Product Image input preview listener
  document.getElementById('form-product-image')?.addEventListener('input', updateFormImagePreview);
  document.getElementById('btn-open-image-editor')?.addEventListener('click', openImageEditorModal);

  // Close modals on clicking outside modal-content
  window.addEventListener('click', (e) => {
    const pModal = document.getElementById('product-form-modal');
    if (e.target === pModal) closeProductCrudModal();
    const oModal = document.getElementById('admin-order-detail-modal');
    if (e.target === oModal) closeAdminOrderDetailModal();
    const eModal = document.getElementById('image-editor-modal');
    if (e.target === eModal) closeImageEditorModal();
  });

  // Initialize Product Image Studio Controls
  initProductImageStudio();
  initRealtimeReverbEngine();
}

// Realtime Reverb Engine WebSocket Listener for Admin
function initRealtimeReverbEngine() {
  if (typeof io !== 'undefined') {
    const socket = io();
    socket.on('connect', () => {
      console.log('⚡ Connected to Admin Realtime Reverb Engine');
    });
    socket.on('products:changed', () => loadAdminDashboard());
    socket.on('orders:changed', () => loadAdminDashboard());
  }
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

// Update Image Preview in Product CRUD Form
function updateFormImagePreview() {
  const val = document.getElementById('form-product-image').value.trim();
  const container = document.getElementById('form-product-image-preview-container');
  const img = document.getElementById('form-product-image-preview');
  if (val) {
    img.src = val;
    container.style.display = 'flex';
  } else {
    container.style.display = 'none';
  }
}

/* ==========================================================================
   PRODUCT IMAGE STUDIO / CANVAS MULTI-LAYER ENGINE
   ========================================================================== */

let studioState = {
  canvas: null,
  ctx: null,
  layers: [],
  selectedLayerId: null,
  isDragging: false,
  isResizing: false,
  dragStartX: 0,
  dragStartY: 0,
  layerStartX: 0,
  layerStartY: 0,
  layerStartW: 0,
  layerStartH: 0,
  filters: {
    brightness: 100,
    contrast: 100,
    saturation: 100
  }
};

function openImageEditorModal() {
  const modal = document.getElementById('image-editor-modal');
  modal.classList.add('active');

  const currentVal = document.getElementById('form-product-image').value.trim();
  const defaultImg = currentVal || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80';
  
  loadBaseImageToStudio(defaultImg);
}

function closeImageEditorModal() {
  document.getElementById('image-editor-modal').classList.remove('active');
}

function loadBaseImageToStudio(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // Set base image layer
    studioState.layers = [{
      id: 'base-layer',
      type: 'base',
      name: 'Foto Utama Produk',
      img: img,
      x: 0,
      y: 0,
      width: studioState.canvas.width,
      height: studioState.canvas.height
    }];
    studioState.selectedLayerId = null;
    renderStudioCanvas();
    updateStudioLayersList();
  };
  img.onerror = () => {
    showToast('Gagal memuat gambar utama. Menggunakan kanvas kosong.', 'error');
    studioState.layers = [];
    renderStudioCanvas();
    updateStudioLayersList();
  };
  img.src = src;
}

function initProductImageStudio() {
  const canvas = document.getElementById('product-editor-canvas');
  if (!canvas) return;

  studioState.canvas = canvas;
  studioState.ctx = canvas.getContext('2d');

  // Close buttons
  document.getElementById('close-image-editor-btn')?.addEventListener('click', closeImageEditorModal);
  document.getElementById('btn-close-editor')?.addEventListener('click', closeImageEditorModal);

  // Tab switching
  const tabs = document.querySelectorAll('.editor-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.editor-tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.getAttribute('data-tab'));
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // Base Image Inputs
  document.getElementById('editor-base-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => loadBaseImageToStudio(evt.target.result);
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('btn-load-base-url')?.addEventListener('click', () => {
    const url = document.getElementById('editor-base-url-input').value.trim();
    if (url) loadBaseImageToStudio(url);
  });

  document.getElementById('editor-canvas-preset-size')?.addEventListener('change', (e) => {
    const [w, h] = e.target.value.split('x').map(Number);
    studioState.canvas.width = w;
    studioState.canvas.height = h;
    if (studioState.layers.length > 0 && studioState.layers[0].type === 'base') {
      studioState.layers[0].width = w;
      studioState.layers[0].height = h;
    }
    renderStudioCanvas();
  });

  // Overlay Image Inputs
  document.getElementById('editor-overlay-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => addOverlayImageToStudio(evt.target.result, file.name);
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('btn-add-overlay-url')?.addEventListener('click', () => {
    const url = document.getElementById('editor-overlay-url-input').value.trim();
    if (url) addOverlayImageToStudio(url, 'Overlay URL');
  });

  // Preset Stickers
  document.querySelectorAll('.sticker-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const badgeType = btn.getAttribute('data-badge');
      addBadgeStickerToStudio(badgeType);
    });
  });

  // Add Text Layer
  document.getElementById('btn-add-text-layer')?.addEventListener('click', () => {
    const text = document.getElementById('editor-text-input').value.trim() || 'PROMO SPECIAL';
    const color = document.getElementById('editor-text-color').value;
    const bg = document.getElementById('editor-text-bg').value;
    const fontSize = Number(document.getElementById('editor-text-size').value);

    addTextLayerToStudio(text, color, bg, fontSize);
  });

  // Filter Sliders
  const sliderB = document.getElementById('slider-brightness');
  const sliderC = document.getElementById('slider-contrast');
  const sliderS = document.getElementById('slider-saturation');

  const updateFilters = () => {
    studioState.filters.brightness = Number(sliderB.value);
    studioState.filters.contrast = Number(sliderC.value);
    studioState.filters.saturation = Number(sliderS.value);

    document.getElementById('val-brightness').innerText = `${sliderB.value}%`;
    document.getElementById('val-contrast').innerText = `${sliderC.value}%`;
    document.getElementById('val-saturation').innerText = `${sliderS.value}%`;

    renderStudioCanvas();
  };

  sliderB?.addEventListener('input', updateFilters);
  sliderC?.addEventListener('input', updateFilters);
  sliderS?.addEventListener('input', updateFilters);

  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    sliderB.value = 100;
    sliderC.value = 100;
    sliderS.value = 100;
    updateFilters();
  });

  // Quick Controls (Delete, Order Up, Order Down, Clear)
  document.getElementById('canvas-btn-delete')?.addEventListener('click', deleteSelectedStudioLayer);
  document.getElementById('canvas-btn-layer-up')?.addEventListener('click', () => moveSelectedStudioLayer(1));
  document.getElementById('canvas-btn-layer-down')?.addEventListener('click', () => moveSelectedStudioLayer(-1));
  document.getElementById('canvas-btn-clear')?.addEventListener('click', () => {
    studioState.layers = studioState.layers.filter(l => l.type === 'base');
    studioState.selectedLayerId = null;
    renderStudioCanvas();
    updateStudioLayersList();
  });

  // Export Buttons
  document.getElementById('btn-apply-editor-to-form')?.addEventListener('click', () => {
    try {
      // Render without selection handles
      renderStudioCanvas(false);
      let dataUrl;
      try {
        dataUrl = studioState.canvas.toDataURL('image/jpeg', 0.9);
      } catch (e) {
        dataUrl = studioState.canvas.toDataURL('image/png');
      }
      document.getElementById('form-product-image').value = dataUrl;
      updateFormImagePreview();
      closeImageEditorModal();
      showToast('Gambar editan berhasil diterapkan pada form produk!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengekspor gambar. Jika menggunakan URL luar, unggah gambar dari file perangkat.', 'error');
    }
  });

  document.getElementById('btn-download-editor-png')?.addEventListener('click', () => {
    try {
      renderStudioCanvas(false);
      const dataUrl = studioState.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'produk-berkah-jaya.png';
      link.href = dataUrl;
      link.click();
      showToast('Gambar berhasil diunduh', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mengunduh gambar. Silakan unggah gambar dasar dari file perangkat.', 'error');
    }
  });

  // Canvas Mouse Interactions (Drag & Resize)
  canvas.addEventListener('mousedown', handleStudioCanvasMouseDown);
  canvas.addEventListener('mousemove', handleStudioCanvasMouseMove);
  canvas.addEventListener('mouseup', handleStudioCanvasMouseUp);
  canvas.addEventListener('mouseleave', handleStudioCanvasMouseUp);
}

function addOverlayImageToStudio(src, name = 'Overlay') {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const id = 'layer-' + Date.now();
    const aspect = img.width / img.height;
    const w = 180;
    const h = w / aspect;
    const layer = {
      id,
      type: 'image',
      name: name,
      img: img,
      x: (studioState.canvas.width - w) / 2,
      y: (studioState.canvas.height - h) / 2,
      width: w,
      height: h,
      rotation: 0
    };
    studioState.layers.push(layer);
    studioState.selectedLayerId = id;
    renderStudioCanvas();
    updateStudioLayersList();
  };
  img.src = src;
}

function addBadgeStickerToStudio(badgeType) {
  const id = 'layer-' + Date.now();
  let text = '⭐ BEST SELLER';
  if (badgeType === 'original') text = '💯 ORIGINAL 100%';
  if (badgeType === 'garansi') text = '🛡️ GARANSI RESMI';
  if (badgeType === 'ongkir') text = '🚚 GRATIS ONGKIR';
  if (badgeType === 'diskon') text = '🔥 DISKON 50%';
  if (badgeType === 'berkah') text = '🏢 CV BERKAH JAYA';

  const layer = {
    id,
    type: 'badge',
    badgeType: badgeType,
    name: `Badge: ${text}`,
    text: text,
    x: 30,
    y: 30,
    width: 200,
    height: 48,
    rotation: 0
  };

  studioState.layers.push(layer);
  studioState.selectedLayerId = id;
  renderStudioCanvas();
  updateStudioLayersList();
}

function addTextLayerToStudio(text, color, bg, fontSize) {
  const id = 'layer-' + Date.now();
  // estimate text width
  studioState.ctx.font = `bold ${fontSize}px 'Outfit', 'Inter', sans-serif`;
  const textWidth = studioState.ctx.measureText(text).width + 30;

  const layer = {
    id,
    type: 'text',
    name: `Teks: "${text.slice(0, 12)}..."`,
    text: text,
    color: color,
    bg: bg,
    fontSize: fontSize,
    x: (studioState.canvas.width - textWidth) / 2,
    y: (studioState.canvas.height - 50) / 2,
    width: Math.max(textWidth, 120),
    height: fontSize + 20,
    rotation: 0
  };

  studioState.layers.push(layer);
  studioState.selectedLayerId = id;
  renderStudioCanvas();
  updateStudioLayersList();
}

function deleteSelectedStudioLayer() {
  if (!studioState.selectedLayerId) return;
  studioState.layers = studioState.layers.filter(l => l.id !== studioState.selectedLayerId || l.type === 'base');
  studioState.selectedLayerId = null;
  renderStudioCanvas();
  updateStudioLayersList();
}

function moveSelectedStudioLayer(dir) {
  if (!studioState.selectedLayerId) return;
  const idx = studioState.layers.findIndex(l => l.id === studioState.selectedLayerId);
  if (idx <= 0) return; // cannot move base layer or top

  const newIdx = idx + dir;
  if (newIdx < 1 || newIdx >= studioState.layers.length) return;

  const item = studioState.layers.splice(idx, 1)[0];
  studioState.layers.splice(newIdx, 0, item);

  renderStudioCanvas();
  updateStudioLayersList();
}

function renderStudioCanvas(drawSelection = true) {
  const { canvas, ctx, layers, filters, selectedLayerId } = studioState;
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply Filter string
  ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%)`;

  // Draw layers bottom to top
  layers.forEach(layer => {
    if (layer.type === 'base') {
      ctx.drawImage(layer.img, 0, 0, canvas.width, canvas.height);
    } else if (layer.type === 'image') {
      ctx.save();
      ctx.translate(layer.x + layer.width/2, layer.y + layer.height/2);
      ctx.rotate((layer.rotation || 0) * Math.PI / 180);
      ctx.drawImage(layer.img, -layer.width/2, -layer.height/2, layer.width, layer.height);
      ctx.restore();
    } else if (layer.type === 'badge') {
      drawStudioBadgeLayer(ctx, layer);
    } else if (layer.type === 'text') {
      drawStudioTextLayer(ctx, layer);
    }
  });

  // Reset filter for selection box
  ctx.filter = 'none';

  // Draw selection box & resize handle if active layer is selected
  if (drawSelection && selectedLayerId) {
    const sel = layers.find(l => l.id === selectedLayerId && l.type !== 'base');
    if (sel) {
      ctx.save();
      ctx.strokeStyle = '#ff6b00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);

      // Draw bottom-right resize handle
      ctx.fillStyle = '#0070f3';
      ctx.setLineDash([]);
      ctx.fillRect(sel.x + sel.width - 6, sel.y + sel.height - 6, 12, 12);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(sel.x + sel.width - 6, sel.y + sel.height - 6, 12, 12);

      ctx.restore();
    }
  }
}

function drawStudioBadgeLayer(ctx, layer) {
  ctx.save();
  ctx.translate(layer.x + layer.width/2, layer.y + layer.height/2);
  ctx.rotate((layer.rotation || 0) * Math.PI / 180);

  const w = layer.width;
  const h = layer.height;
  const rx = -w/2;
  const ry = -h/2;

  let grad;
  if (layer.badgeType === 'bestseller') {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#ff9900'); grad.addColorStop(1, '#ff5500');
  } else if (layer.badgeType === 'original') {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#00b09b'); grad.addColorStop(1, '#96c93d');
  } else if (layer.badgeType === 'garansi') {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#1e3c72'); grad.addColorStop(1, '#2a5298');
  } else if (layer.badgeType === 'ongkir') {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#11998e'); grad.addColorStop(1, '#38ef7d');
  } else if (layer.badgeType === 'diskon') {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#ee0979'); grad.addColorStop(1, '#ff6a00');
  } else {
    grad = ctx.createLinearGradient(rx, ry, rx + w, ry + h);
    grad.addColorStop(0, '#4776e6'); grad.addColorStop(1, '#8e54e9');
  }

  ctx.fillStyle = grad;
  ctx.beginPath();
  const radius = h / 2;
  if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, radius);
  else ctx.rect(rx, ry, w, h);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(h * 0.45)}px 'Outfit', 'Inter', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(layer.text, 0, 0);

  ctx.restore();
}

function drawStudioTextLayer(ctx, layer) {
  ctx.save();
  ctx.translate(layer.x + layer.width/2, layer.y + layer.height/2);
  ctx.rotate((layer.rotation || 0) * Math.PI / 180);

  const w = layer.width;
  const h = layer.height;
  const rx = -w/2;
  const ry = -h/2;

  if (layer.bg) {
    ctx.fillStyle = layer.bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, 6);
    else ctx.rect(rx, ry, w, h);
    ctx.fill();
  }

  ctx.fillStyle = layer.color || '#ffffff';
  ctx.font = `bold ${layer.fontSize || 24}px 'Outfit', 'Inter', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(layer.text, 0, 0);

  ctx.restore();
}

function updateStudioLayersList() {
  const container = document.getElementById('editor-layers-list');
  if (!container) return;
  container.innerHTML = '';

  studioState.layers.forEach(layer => {
    const row = document.createElement('div');
    row.className = `layer-item-row ${layer.id === studioState.selectedLayerId ? 'active' : ''}`;
    
    let icon = '<i class="fa-solid fa-image"></i>';
    if (layer.type === 'badge') icon = '<i class="fa-solid fa-certificate text-orange"></i>';
    if (layer.type === 'text') icon = '<i class="fa-solid fa-font text-blue"></i>';

    row.innerHTML = `
      <div class="layer-item-title">${icon} <span>${layer.name}</span></div>
      <div class="layer-item-actions">
        ${layer.type !== 'base' ? `<button type="button" class="btn-del-layer" title="Hapus"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    `;

    row.addEventListener('click', () => {
      studioState.selectedLayerId = layer.id;
      renderStudioCanvas();
      updateStudioLayersList();
    });

    const delBtn = row.querySelector('.btn-del-layer');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        studioState.selectedLayerId = layer.id;
        deleteSelectedStudioLayer();
      });
    }

    container.appendChild(row);
  });
}

function handleStudioCanvasMouseDown(e) {
  const rect = studioState.canvas.getBoundingClientRect();
  const scaleX = studioState.canvas.width / rect.width;
  const scaleY = studioState.canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  // Check resize handle click on active layer
  if (studioState.selectedLayerId) {
    const sel = studioState.layers.find(l => l.id === studioState.selectedLayerId && l.type !== 'base');
    if (sel) {
      const handleX = sel.x + sel.width - 6;
      const handleY = sel.y + sel.height - 6;
      if (mouseX >= handleX - 8 && mouseX <= handleX + 16 && mouseY >= handleY - 8 && mouseY <= handleY + 16) {
        studioState.isResizing = true;
        studioState.dragStartX = mouseX;
        studioState.dragStartY = mouseY;
        studioState.layerStartW = sel.width;
        studioState.layerStartH = sel.height;
        return;
      }
    }
  }

  // Hit test layers top to bottom (excluding base layer)
  let found = null;
  for (let i = studioState.layers.length - 1; i >= 0; i--) {
    const layer = studioState.layers[i];
    if (layer.type === 'base') continue;
    if (mouseX >= layer.x && mouseX <= layer.x + layer.width && mouseY >= layer.y && mouseY <= layer.y + layer.height) {
      found = layer;
      break;
    }
  }

  if (found) {
    studioState.selectedLayerId = found.id;
    studioState.isDragging = true;
    studioState.dragStartX = mouseX;
    studioState.dragStartY = mouseY;
    studioState.layerStartX = found.x;
    studioState.layerStartY = found.y;
  } else {
    studioState.selectedLayerId = null;
  }

  renderStudioCanvas();
  updateStudioLayersList();
}

function handleStudioCanvasMouseMove(e) {
  if (!studioState.isDragging && !studioState.isResizing) return;

  const rect = studioState.canvas.getBoundingClientRect();
  const scaleX = studioState.canvas.width / rect.width;
  const scaleY = studioState.canvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  const sel = studioState.layers.find(l => l.id === studioState.selectedLayerId);
  if (!sel) return;

  if (studioState.isDragging) {
    const dx = mouseX - studioState.dragStartX;
    const dy = mouseY - studioState.dragStartY;
    sel.x = studioState.layerStartX + dx;
    sel.y = studioState.layerStartY + dy;
  } else if (studioState.isResizing) {
    const dw = mouseX - studioState.dragStartX;
    const dh = mouseY - studioState.dragStartY;
    sel.width = Math.max(30, studioState.layerStartW + dw);
    sel.height = Math.max(20, studioState.layerStartH + dh);
  }

  renderStudioCanvas();
}

function handleStudioCanvasMouseUp() {
  studioState.isDragging = false;
  studioState.isResizing = false;
}

