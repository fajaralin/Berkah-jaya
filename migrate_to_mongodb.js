const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); } catch(e) {}
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch(e) {}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://fajaralinofficial_db_user:digimonr123@cluster0.vqgbr8b.mongodb.net/berkah_jaya?retryWrites=true&w=majority";
const DB_PATH = path.join(__dirname, 'data', 'db.json');

async function migrate() {
  console.log('🚀 Starting migration from local db.json to MongoDB Atlas Cloud...');
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully to MongoDB Atlas Cloud!');
    const db = client.db('berkah_jaya');

    // Read local db.json
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    const localDb = JSON.parse(rawData);

    // 1. Migrate Products
    if (Array.isArray(localDb.products) && localDb.products.length > 0) {
      const prodCol = db.collection('products');
      for (const prod of localDb.products) {
        await prodCol.updateOne({ id: String(prod.id) }, { $set: prod }, { upsert: true });
      }
      console.log(`📦 Successfully migrated ${localDb.products.length} products!`);
    }

    // 2. Migrate Orders
    if (Array.isArray(localDb.orders) && localDb.orders.length > 0) {
      const orderCol = db.collection('orders');
      for (const order of localDb.orders) {
        await orderCol.updateOne({ id: String(order.id) }, { $set: order }, { upsert: true });
      }
      console.log(`🧾 Successfully migrated ${localDb.orders.length} orders!`);
    }

    // 3. Migrate Chats
    if (Array.isArray(localDb.chats) && localDb.chats.length > 0) {
      const chatCol = db.collection('chats');
      for (const chat of localDb.chats) {
        await chatCol.updateOne({ id: String(chat.id || chat._id) }, { $set: chat }, { upsert: true });
      }
      console.log(`💬 Successfully migrated ${localDb.chats.length} chats!`);
    }

    // 4. Migrate Users
    if (Array.isArray(localDb.users) && localDb.users.length > 0) {
      const userCol = db.collection('users');
      for (const user of localDb.users) {
        await userCol.updateOne({ id: String(user.id) }, { $set: user }, { upsert: true });
      }
      console.log(`👤 Successfully migrated ${localDb.users.length} users!`);
    }

    console.log('🎉 ALL DATA MIGRATED TO MONGODB ATLAS CLOUD!');
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
  } finally {
    await client.close();
  }
}

migrate();
