// Admin Dashboard State Management
let adminState = {
  currentAdminTab: 'products', // products, orders
  products: []
};

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
          ${o.status !== 'Selesai' ? `<button class="admin-complete-order-btn" data-id="${o.id}" title="Tandai Selesai"><i class="fa-solid fa-circle-check"></i></button>` : `<span class="text-green"><i class="fa-solid fa-circle-check"></i></span>`}
        </div>
      </td>
    `;
    
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
  document.getElementById('admin-product-search').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    const rows = document.querySelectorAll('#admin-product-table-body tr');
    rows.forEach(row => {
      const name = row.querySelector('.product-row-info').innerText.toLowerCase();
      const brand = row.getAttribute('data-brand').toLowerCase();
      if (name.includes(val) || brand.includes(val)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
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

  // Admin Quick Add Product by Category click
  const quickAddBtns = document.querySelectorAll('.admin-quick-add-btn');
  quickAddBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cat = e.currentTarget.getAttribute('data-category');
      openProductCrudModal(null);
      // Explicitly set category and apply specs template
      document.getElementById('form-product-category').value = cat;
      applyCategorySpecsTemplate(cat);
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

  // Close modals on clicking outside modal-content
  window.addEventListener('click', (e) => {
    const modal = document.getElementById('product-form-modal');
    if (e.target === modal) closeProductCrudModal();
  });
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
