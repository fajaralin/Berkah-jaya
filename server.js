const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

io.on('connection', (socket) => {
  console.log(`⚡ Client terhubung ke Realtime WebSocket (Reverb Engine): ${socket.id}`);
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Disable caching for API responses
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Helper to read database
async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.users) parsed.users = [];
    return parsed;
  } catch (error) {
    console.error('Error reading database, using fallback data template', error);
    return { products: [], orders: [], chats: [], users: [] };
  }
}

const { exec } = require('child_process');

// Helper to write database with Automatic Background Git Sync
let syncDebounceTimer = null;

function performGitSync(customMsg) {
  return new Promise((resolve, reject) => {
    const nowStr = new Date().toLocaleString('id-ID');
    const msg = customMsg || `auto: Sync database updates [${nowStr}]`;
    console.log(`🔄 [GIT-SYNC] Mengunggah data terbaru ke GitHub: "${msg}"...`);

    exec('git add .', (err1) => {
      if (err1) console.warn('Git Add Warning:', err1.message);
      exec(`git commit -m "${msg}"`, (err2) => {
        // Tarik (pull) perubahan data terbaru dari online dulu agar tidak bentrok / tertinggal
        exec('git pull --rebase origin main', (errPull) => {
          if (errPull) console.warn('Git Pull Warning:', errPull.message);
          exec('git push origin main', (err3, stdout3, stderr3) => {
            if (err3) {
              console.error('❌ [GIT PUSH ERROR]:', err3.message || stderr3);
              return reject(new Error(err3.message || stderr3 || 'Gagal push ke GitHub remote'));
            }
            console.log('🚀 [GIT PUSH SUCCESS]: Data ter-sync ke GitHub & website online!');
            if (typeof io !== 'undefined') io.emit('sync:completed', { timestamp: Date.now() });
            resolve({ success: true, message: 'Data sudah versi terbaru & berhasil di-sync!' });
          });
        });
      });
    });
  });
}

function triggerAutoGitSync() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

  syncDebounceTimer = setTimeout(() => {
    performGitSync().catch(err => {
      console.error('❌ [AUTO-SYNC ERROR]:', err.message);
    });
  }, 2000);
}

async function writeDB(data) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    triggerAutoGitSync();
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// REST API Endpoints

// 1. GET /api/products - Get all or filtered/sorted products
app.get('/api/products', async (req, res) => {
  const db = await readDB();
  let result = [...db.products];
  const { category, q, sort } = req.query;

  // Filter by category
  if (category && category !== 'semua') {
    result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by search query
  if (q) {
    const query = q.toLowerCase().trim();
    result = result.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query)
    );
  }

  // Sort
  if (sort) {
    if (sort === 'terlaris') {
      result.sort((a, b) => b.sales - a.sales);
    } else if (sort === 'harga-rendah') {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === 'harga-tinggi') {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    }
  } else {
    // Default sorting: Alphabetical A-Z by product name
    result.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
  }

  res.json(result);
});

// 2. GET /api/products/:id - Get specific product details
app.get('/api/products/:id', async (req, res) => {
  const db = await readDB();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan' });
  }
  res.json(product);
});

// Helper to process variant data
function processVariantData(hasVariants, variants, defaultPrice, defaultCostPrice, defaultStock) {
  const isVariantActive = Boolean(hasVariants) && Array.isArray(variants) && variants.length > 0;
  if (!isVariantActive) {
    return {
      hasVariants: false,
      variants: [],
      price: Number(defaultPrice) || 0,
      costPrice: Number(defaultCostPrice) || 0,
      stock: Number(defaultStock) || 0
    };
  }

  const formattedVariants = variants.map((v, idx) => ({
    id: v.id ? String(v.id) : `v-${Date.now()}-${idx}`,
    name: String(v.name || `Varian ${idx + 1}`),
    price: Number(v.price) || 0,
    costPrice: Number(v.costPrice) || 0,
    stock: Number(v.stock) || 0
  }));

  const totalStock = formattedVariants.reduce((sum, v) => sum + v.stock, 0);
  const minPrice = Math.min(...formattedVariants.map(v => v.price));
  const minCostPrice = Math.min(...formattedVariants.map(v => v.costPrice));

  return {
    hasVariants: true,
    variants: formattedVariants,
    price: isFinite(minPrice) ? minPrice : (Number(defaultPrice) || 0),
    costPrice: isFinite(minCostPrice) ? minCostPrice : (Number(defaultCostPrice) || 0),
    stock: totalStock
  };
}

// 3. POST /api/products - Add a new product (Admin)
app.post('/api/products', async (req, res) => {
  const db = await readDB();
  const { name, category, price, costPrice, stock, description, brand, image, specifications, hasVariants, variants } = req.body;

  if (!name || !category || !description || !brand) {
    return res.status(400).json({ error: 'Mohon lengkapi semua field wajib produk.' });
  }

  const variantResult = processVariantData(hasVariants, variants, price, costPrice, stock);

  const newProduct = {
    id: String(Date.now()),
    name,
    category,
    price: variantResult.price,
    costPrice: variantResult.costPrice,
    stock: variantResult.stock,
    hasVariants: variantResult.hasVariants,
    variants: variantResult.variants,
    description,
    brand,
    rating: 5.0,
    sales: 0,
    image: image || 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    specifications: specifications || {},
    reviews: []
  };

  db.products.push(newProduct);
  await writeDB(db);
  io.emit('products:changed', { action: 'add', product: newProduct, timestamp: Date.now() });
  res.status(201).json(newProduct);
});

// 4. PUT /api/products/:id - Update product details (Admin)
app.put('/api/products/:id', async (req, res) => {
  const db = await readDB();
  const index = db.products.findIndex(p => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const existingProduct = db.products[index];
  const { name, category, price, costPrice, stock, description, brand, image, specifications, hasVariants, variants } = req.body;

  const targetHasVariants = hasVariants !== undefined ? hasVariants : existingProduct.hasVariants;
  const targetVariants = variants !== undefined ? variants : existingProduct.variants;
  const targetPrice = price !== undefined ? price : existingProduct.price;
  const targetCostPrice = costPrice !== undefined ? costPrice : existingProduct.costPrice;
  const targetStock = stock !== undefined ? stock : existingProduct.stock;

  const variantResult = processVariantData(targetHasVariants, targetVariants, targetPrice, targetCostPrice, targetStock);

  db.products[index] = {
    ...existingProduct,
    name: name !== undefined ? name : existingProduct.name,
    category: category !== undefined ? category : existingProduct.category,
    price: variantResult.price,
    costPrice: variantResult.costPrice,
    stock: variantResult.stock,
    hasVariants: variantResult.hasVariants,
    variants: variantResult.variants,
    description: description !== undefined ? description : existingProduct.description,
    brand: brand !== undefined ? brand : existingProduct.brand,
    image: image !== undefined ? image : existingProduct.image,
    specifications: specifications !== undefined ? specifications : existingProduct.specifications
  };

  await writeDB(db);
  io.emit('products:changed', { action: 'update', product: db.products[index], timestamp: Date.now() });
  res.json(db.products[index]);
});

// 5. DELETE /api/products/:id - Delete product (Admin)
app.delete('/api/products/:id', async (req, res) => {
  const db = await readDB();
  const initialLength = db.products.length;
  db.products = db.products.filter(p => p.id !== req.params.id);

  if (db.products.length === initialLength) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  await writeDB(db);
  io.emit('products:changed', { action: 'delete', id: req.params.id, timestamp: Date.now() });
  res.json({ message: 'Produk berhasil dihapus.' });
});

// 6. POST /api/orders - Submit Checkout Order
app.post('/api/orders', async (req, res) => {
  const db = await readDB();
  const { customerName, phone, address, items, shippingCost, paymentMethod } = req.body;

  if (!customerName || !phone || !address || !items || items.length === 0 || !paymentMethod) {
    return res.status(400).json({ error: 'Informasi pengiriman dan keranjang belanja tidak lengkap.' });
  }

  // Verify stock for all items
  for (const item of items) {
    const product = db.products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak ditemukan.` });
    }
    if (item.variantId && product.hasVariants && Array.isArray(product.variants)) {
      const v = product.variants.find(varItem => String(varItem.id) === String(item.variantId));
      if (v && v.stock < item.quantity) {
        return res.status(400).json({ error: `Stok varian "${product.name} - ${v.name}" tidak mencukupi (Tersisa: ${v.stock}).` });
      }
    } else if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Stok produk "${product.name}" tidak mencukupi (Tersisa: ${product.stock}).` });
    }
  }

  // Deduct stock and increment sales
  let subtotal = 0;
  for (const item of items) {
    const product = db.products.find(p => p.id === item.productId);
    const itemPrice = Number(item.price) || product.price;

    if (item.variantId && product.hasVariants && Array.isArray(product.variants)) {
      const v = product.variants.find(varItem => String(varItem.id) === String(item.variantId));
      if (v) {
        v.stock -= item.quantity;
        if (v.stock < 0) v.stock = 0;
        product.stock = product.variants.reduce((sum, varItem) => sum + Number(varItem.stock), 0);
      } else {
        product.stock -= item.quantity;
      }
    } else {
      product.stock -= item.quantity;
    }
    if (product.stock < 0) product.stock = 0;
    product.sales += item.quantity;
    subtotal += itemPrice * item.quantity;
  }

  const shipping = Number(shippingCost) || 0;
  const total = subtotal + shipping;

  const newOrder = {
    id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
    date: new Date().toISOString().split('T')[0],
    customerName,
    phone,
    address,
    items,
    total,
    shippingCost: shipping,
    status: 'Diproses',
    paymentMethod
  };

  db.orders.unshift(newOrder); // Add to beginning
  await writeDB(db);

  io.emit('orders:changed', { action: 'add', order: newOrder, timestamp: Date.now() });
  io.emit('products:changed', { action: 'update', timestamp: Date.now() });

  res.status(201).json(newOrder);
});

// 6b. POST /api/pos/checkout - Submit Offline POS Cashier Order
app.post('/api/pos/checkout', async (req, res) => {
  const db = await readDB();
  const { customerName, phone, items, paymentMethod, cashReceived, discount } = req.body;

  if (!items || items.length === 0 || !paymentMethod) {
    return res.status(400).json({ error: 'Keranjang kasir kosong atau metode pembayaran tidak dipilih.' });
  }

  // Verify stock for all items
  for (const item of items) {
    const product = db.products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(404).json({ error: `Produk dengan ID ${item.productId} tidak ditemukan.` });
    }
    if (item.variantId && product.hasVariants && Array.isArray(product.variants)) {
      const v = product.variants.find(varItem => String(varItem.id) === String(item.variantId));
      if (v && v.stock < item.quantity) {
        return res.status(400).json({ error: `Stok varian "${product.name} - ${v.name}" tidak mencukupi (Tersisa: ${v.stock}).` });
      }
    } else if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Stok produk "${product.name}" tidak mencukupi (Tersisa: ${product.stock}).` });
    }
  }

  // Deduct stock and increment sales
  let subtotal = 0;
  for (const item of items) {
    const product = db.products.find(p => p.id === item.productId);
    const itemPrice = Number(item.price) || product.price;

    if (item.variantId && product.hasVariants && Array.isArray(product.variants)) {
      const v = product.variants.find(varItem => String(varItem.id) === String(item.variantId));
      if (v) {
        v.stock -= item.quantity;
        if (v.stock < 0) v.stock = 0;
        product.stock = product.variants.reduce((sum, varItem) => sum + Number(varItem.stock), 0);
      } else {
        product.stock -= item.quantity;
      }
    } else {
      product.stock -= item.quantity;
    }
    if (product.stock < 0) product.stock = 0;
    product.sales += item.quantity;
    subtotal += itemPrice * item.quantity;
  }

  const disc = Number(discount) || 0;
  const total = Math.max(0, subtotal - disc);
  const cash = Number(cashReceived) || total;
  const change = Math.max(0, cash - total);

  const newOrder = {
    id: `POS-${Math.floor(10000 + Math.random() * 90000)}`,
    type: 'offline',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    customerName: customerName || 'Pembeli Offline / Kasir',
    phone: phone || '-',
    address: 'Pembelian Langsung di Toko Fisik Berkah Jaya',
    items,
    subtotal,
    discount: disc,
    total,
    shippingCost: 0,
    cashReceived: cash,
    change,
    status: 'Selesai',
    paymentMethod: paymentMethod || 'Tunai (Cash)'
  };

  db.orders.unshift(newOrder);
  await writeDB(db);

  // Broadcast WebSocket event to all devices
  io.emit('orders:changed', { action: 'add', order: newOrder, timestamp: Date.now() });
  io.emit('products:changed', { action: 'update', timestamp: Date.now() });

  res.status(201).json({ message: 'Transaksi kasir berhasil diselesaikan.', order: newOrder });
});

// 6c. GET /api/reports/monthly - Get Monthly Sales Report & Stats
app.get('/api/reports/monthly', async (req, res) => {
  const db = await readDB();
  const { month } = req.query; // YYYY-MM or 'all'

  let filtered = [...db.orders];
  if (month && month !== 'all') {
    filtered = filtered.filter(o => o.date && o.date.startsWith(month));
  }

  const totalRevenue = filtered.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = filtered.length;
  
  let onlineRevenue = 0;
  let offlineRevenue = 0;
  let onlineCount = 0;
  let offlineCount = 0;
  let totalUnitsSold = 0;

  const productSalesMap = {};

  filtered.forEach(o => {
    if (o.type === 'offline' || o.id.startsWith('POS-')) {
      offlineRevenue += o.total;
      offlineCount++;
    } else {
      onlineRevenue += o.total;
      onlineCount++;
    }

    if (o.items) {
      o.items.forEach(item => {
        totalUnitsSold += item.quantity;
        if (!productSalesMap[item.name]) {
          productSalesMap[item.name] = { qty: 0, revenue: 0 };
        }
        productSalesMap[item.name].qty += item.quantity;
        productSalesMap[item.name].revenue += (item.price * item.quantity);
      });
    }
  });

  // Top products
  const topProducts = Object.keys(productSalesMap).map(name => ({
    name,
    qty: productSalesMap[name].qty,
    revenue: productSalesMap[name].revenue
  })).sort((a, b) => b.qty - a.qty).slice(0, 5);

  res.json({
    month: month || 'all',
    totalRevenue,
    totalOrders,
    onlineRevenue,
    offlineRevenue,
    onlineCount,
    offlineCount,
    totalUnitsSold,
    topProducts,
    orders: filtered
  });
});

// 7. GET /api/orders - Get all orders
app.get('/api/orders', async (req, res) => {
  const db = await readDB();
  res.json(db.orders);
});

// 8. GET /api/stats - Admin Dashboard Analytics
app.get('/api/stats', async (req, res) => {
  const db = await readDB();
  
  const totalRevenue = db.orders.reduce((sum, order) => sum + order.total, 0);
  const totalSalesCount = db.orders.reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
  }, 0);

  const categoryDistribution = {
    bangunan: 0,
    listrik: 0,
    pertanian: 0
  };

  db.orders.forEach(order => {
    order.items.forEach(item => {
      // Find category of item
      const product = db.products.find(p => p.id === item.productId);
      if (product && categoryDistribution[product.category] !== undefined) {
        categoryDistribution[product.category] += item.quantity * item.price;
      }
    });
  });

  res.json({
    totalRevenue,
    totalOrders: db.orders.length,
    totalSalesCount,
    totalProducts: db.products.length,
    categoryDistribution,
    recentOrders: db.orders.slice(0, 5)
  });
});

// 9. POST /api/chat - Send message and get automated support answer
app.post('/api/chat', async (req, res) => {
  const db = await readDB();
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Pesan kosong.' });
  }

  const userMsg = {
    id: `chat-${Date.now()}`,
    sender: 'customer',
    message,
    timestamp: new Date().toISOString()
  };

  db.chats.push(userMsg);

  // Generate simulated response
  const msgLower = message.toLowerCase();
  let replyText = 'Terima kasih telah menghubungi Berkah Jaya. Ada yang bisa kami bantu mengenai alat bangunan, alat listrik, atau obat pertanian?';

  if (msgLower.includes('semen') || msgLower.includes('padang')) {
    replyText = 'Untuk Semen Padang Portland 50kg ready stok banyak kak! Harga Rp 72.000 per sak. Siap kirim pakai pickup atau truk untuk pembelian jumlah besar.';
  } else if (msgLower.includes('pupuk') || msgLower.includes('npk') || msgLower.includes('mutiara')) {
    replyText = 'Pupuk NPK Mutiara 16-16-16 ready kak, kemasan repack 1kg harga Rp 18.000. Sangat bagus untuk tanaman hias maupun buah.';
  } else if (msgLower.includes('kirim') || msgLower.includes('ongkir') || msgLower.includes('kurir')) {
    replyText = 'Kami mendukung pengiriman via kurir toko (langsung sampai hari ini untuk area lokal), JNE, J&T, serta POS Indonesia. Ongkos kirim disesuaikan dengan jarak dan bobot barang.';
  } else if (msgLower.includes('diskon') || msgLower.includes('murah') || msgLower.includes('promo')) {
    replyText = 'Dapatkan promo gratis ongkir dengan voucher belanja BERKAHJAYA50 untuk pembelian minimal Rp 200.000!';
  } else if (msgLower.includes('ready') || msgLower.includes('stok') || msgLower.includes('ada')) {
    replyText = 'Semua produk yang tampil di katalog berstatus READY STOK kak. Kakak bisa tambahkan ke keranjang dan lakukan checkout langsung ya.';
  } else if (msgLower.includes('alamat') || msgLower.includes('toko') || msgLower.includes('lokasi')) {
    replyText = 'Toko fisik Berkah Jaya berlokasi di 25HF+CHP, Jl. Garuda, Penyangkringan, Karangmulyo, Kec. Pegandon, Kabupaten Kendal, Jawa Tengah 51357. Buka setiap hari Senin-Sabtu jam 08:00 - 17:00 WIB. Peta Google Maps: https://maps.app.goo.gl/LX4Ssx2pg8R34i4JA';
  } else if (msgLower.includes('listrik') || msgLower.includes('kabel') || msgLower.includes('philips')) {
    replyText = 'Untuk alat listrik, kami menyediakan kabel Supreme SNI, bohlam LED Philips hemat energi, stop kontak Kaiser, dan saklar Panasonic. Semua dijamin original!';
  }

  const adminMsg = {
    id: `chat-${Date.now() + 1}`,
    sender: 'admin',
    message: replyText,
    timestamp: new Date().toISOString()
  };

  db.chats.push(adminMsg);
  await writeDB(db);

  res.json({
    userMessage: userMsg,
    adminMessage: adminMsg
  });
});

// GET /api/chat - Retrieve chat history
app.get('/api/chat', async (req, res) => {
  const db = await readDB();
  res.json(db.chats);
});

// POST /api/products/:id/review - Post product review
app.post('/api/products/:id/review', async (req, res) => {
  const db = await readDB();
  const { user, rating, comment } = req.body;
  const productId = req.params.id;

  if (!user || !rating || !comment) {
    return res.status(400).json({ error: 'Nama, rating, dan komentar wajib diisi.' });
  }

  const product = db.products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  }

  const newReview = {
    user,
    rating: Number(rating),
    comment,
    date: new Date().toISOString().split('T')[0]
  };

  product.reviews.unshift(newReview);

  // Recalculate average rating
  const totalRating = product.reviews.reduce((sum, rev) => sum + rev.rating, 0);
  product.rating = Number((totalRating / product.reviews.length).toFixed(1));

  await writeDB(db);
  res.status(201).json(product);
});

// 11. POST /api/register - Register customer
app.post('/api/register', async (req, res) => {
  const db = await readDB();
  const { username, password, name, phone } = req.body;

  if (!username || !password || !name || !phone) {
    return res.status(400).json({ error: 'Mohon lengkapi semua field registrasi.' });
  }

  const existingUser = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'Username sudah digunakan.' });
  }

  const newUser = {
    id: `usr-${Date.now()}`,
    username,
    password, // Stored as plain text for local mock server
    name,
    phone
  };

  db.users.push(newUser);
  await writeDB(db);

  // Return user without password
  const { password: _, ...userResponse } = newUser;
  res.status(201).json(userResponse);
});

// 12. POST /api/login - Login customer
app.post('/api/login', async (req, res) => {
  const db = await readDB();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Mohon isi username dan password.' });
  }

  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah.' });
  }

  // Return user without password
  const { password: _, ...userResponse } = user;
  res.json(userResponse);
});

// 13. POST /api/git-sync - Auto Commit & Push to GitHub to trigger Render Auto-Deploy
app.post('/api/git-sync', async (req, res) => {
  try {
    const result = await performGitSync(`manual: Sync dari Dashboard (${new Date().toLocaleTimeString('id-ID')})`);
    res.json({ message: 'Berhasil di-push ke GitHub! Server online sedang memperbarui data.', result });
  } catch (error) {
    res.status(500).json({ error: 'Gagal sync ke GitHub. Pastikan koneksi internet lancar & akun GitHub tersimpan.', details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`⚡ Server Berkah Jaya + Reverb Realtime Engine berjalan di http://localhost:${PORT}`);
  // Perform background sync 3 seconds after server is ready
  setTimeout(() => {
    performGitSync('auto: Startup sync data toko').catch(() => {});
  }, 3000);
});
