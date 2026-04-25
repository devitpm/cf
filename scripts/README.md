# Script: Fetch WordPress Posts

Script untuk mengambil semua post dari WordPress REST API dan mengkonversinya menjadi artikel Astro blog.

## Fitur

✅ Fetch semua posts dari endpoint WordPress REST API  
✅ Download featured images otomatis ke `public/blogs/`  
✅ Convert post content ke Markdown dengan frontmatter Astro  
✅ Generate URL-safe slugs dari judul post  
✅ Handle HTML stripping dari content

## Instalasi

Script ini sudah tersedia di folder `scripts/fetch-wordpress-posts.mjs`.

## Cara Menggunakan

```bash
# Jalankan script
npm run fetch-posts
```

Script akan:
1. Fetch semua posts dari: `https://cahayafoodies.com/wp-json/wp/v2/posts?per_page=100`
2. Download featured images ke `public/blogs/`
3. Membuat file markdown di `src/content/blog/` dengan format:

```markdown
---
title: "Judul Post"
slug: "url-slug"
mainImage: "/blogs/image.jpg"
releaseDate: "YYYY-MM-DD"
---

Isi post di sini...
```

## Output

- 📝 **Artikel**: `src/content/blog/*.md`
- 🖼️ **Gambar**: `public/blogs/*`

## Catatan

- Jika featured image tidak tersedia, akan menggunakan placeholder default
- HTML tags otomatis dihapus dari content
- Judul post dibersihkan untuk membuat slug yang valid
- Setiap post diproses dengan error handling individual

## Troubleshooting

### Fetch gagal
- Pastikan URL WordPress API accessible
- Cek koneksi internet
- Verify endpoint returns valid JSON

### Gambar tidak terdownload
- Beberapa gambar mungkin tidak public
- Script akan melanjutkan dengan placeholder jika terjadi error

### Content tidak sesuai
- Gunakan file markdown hasil untuk editing manual jika diperlukan
- Script hanya membersihkan HTML, content tetap dari WordPress API
