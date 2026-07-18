# Gunakan image resmi Node.js alpine yang ringan
FROM node:18-alpine

# Tentukan direktori kerja di dalam kontainer
WORKDIR /usr/src/app

# Salin package.json dan package-lock.json terlebih dahulu
COPY package*.json ./

# Install dependensi produksi saja
RUN npm ci --only=production

# Salin semua berkas proyek ke dalam kontainer
COPY . .

# Expose port yang digunakan oleh server Express (3000)
EXPOSE 3000

# Jalankan server Node.js
CMD [ "node", "server.js" ]
