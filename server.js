const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// Helper to write database
async function writeDB(data) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

// 3. POST /api/products - Add a new product (Admin)
app.post('/api/products', async (req, res) => {
  const db = await readDB();
  const { name, category, price, stock, description, brand, image, specifications } = req.body;

  if (!name || !category || !price || stock === undefined || !description || !brand) {
    return res.status(400).json({ error: 'Mohon lengkapi semua field wajib produk.' });
  }

  const newProduct = {
    id: String(Date.now()),
    name,
    category,
    price: Number(price),
    stock: Number(stock),
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
  const { name, category, price, stock, description, brand, image, specifications } = req.body;

  db.products[index] = {
    ...existingProduct,
    name: name !== undefined ? name : existingProduct.name,
    category: category !== undefined ? category : existingProduct.category,
    price: price !== undefined ? Number(price) : existingProduct.price,
    stock: stock !== undefined ? Number(stock) : existingProduct.stock,
    description: description !== undefined ? description : existingProduct.description,
    brand: brand !== undefined ? brand : existingProduct.brand,
    image: image !== undefined ? image : existingProduct.image,
    specifications: specifications !== undefined ? specifications : existingProduct.specifications
  };

  await writeDB(db);
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
    if (product.stock < item.quantity) {
      return res.status(400).json({ error: `Stok produk "${product.name}" tidak mencukupi (Tersisa: ${product.stock}).` });
    }
  }

  // Deduct stock and increment sales
  let subtotal = 0;
  for (const item of items) {
    const product = db.products.find(p => p.id === item.productId);
    product.stock -= item.quantity;
    product.sales += item.quantity;
    subtotal += product.price * item.quantity;
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

  res.status(201).json(newOrder);
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

app.listen(PORT, () => {
  console.log(`Server Berkah Jaya berjalan di http://localhost:${PORT}`);
});
