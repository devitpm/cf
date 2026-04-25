import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WP_API_URL = "https://cahayafoodies.com/wp-json/wp/v2/posts?per_page=100";
const BLOG_CONTENT_DIR = path.join(__dirname, "../src/content/blog");
const PUBLIC_BLOGS_DIR = path.join(__dirname, "../public/blogs");

// Utility function to download files with retry
function downloadFile(url, destPath, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (attemptsLeft) => {
      https
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400) {
            if (response.headers.location) {
              console.log(`    ↪️  Redirect to: ${response.headers.location}`);
              downloadFile(response.headers.location, destPath, attemptsLeft - 1)
                .then(resolve)
                .catch(reject);
              return;
            }
          }

          if (response.statusCode !== 200) {
            const err = new Error(`HTTP ${response.statusCode}`);
            if (attemptsLeft > 0) {
              console.log(`    🔄 Retry ${4 - attemptsLeft}/3...`);
              attempt(attemptsLeft - 1);
            } else {
              reject(err);
            }
            return;
          }

          let data = Buffer.alloc(0);
          response.on("data", (chunk) => {
            data = Buffer.concat([data, chunk]);
          });

          response.on("end", async () => {
            try {
              // Validate that we got actual image data
              if (data.length === 0) {
                throw new Error("Empty response body");
              }
              await fs.writeFile(destPath, data);
              resolve();
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", (err) => {
          if (attemptsLeft > 0) {
            console.log(`    🔄 Retry ${4 - attemptsLeft}/3 (${err.message})...`);
            attempt(attemptsLeft - 1);
          } else {
            reject(err);
          }
        });
    };

    attempt(retries);
  });
}

// Extract image URL from post content
function extractImageFromContent(content) {
  // Try to extract img src from content
  const imgRegex = /<img[^>]+src="([^">]+)"/;
  const match = content?.match(imgRegex);
  return match ? match[1] : null;
}

// Fetch image from media endpoint
async function fetchMediaImage(mediaId) {
  try {
    const mediaUrl = `https://cahayafoodies.com/wp-json/wp/v2/media/${mediaId}`;
    console.log(`    ℹ️  Fetching media ID: ${mediaId}`);
    
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      console.log(`    ⚠️  Media endpoint returned ${mediaResponse.status}`);
      return null;
    }

    const media = await mediaResponse.json();
    if (!media.source_url) {
      console.log(`    ⚠️  No source_url in media response`);
      return null;
    }

    console.log(`    ✓ Got media source_url: ${media.source_url}`);
    return media.source_url;
  } catch (err) {
    console.log(`    ⚠️  Media fetch error: ${err.message}`);
    return null;
  }
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"|?*]/g, "-") // Remove invalid chars
    .replace(/\s+/g, "-")
    .toLowerCase();
}

// Create URL-safe slug for post
function createSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Preserve WordPress HTML so Astro can render the content close to the original post.
function renderWordPressContent(html) {
  if (!html) return "";

  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, "")
    .replace(/<style[^>]*>.*?<\/style>/gi, "")
    .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<h[1-6][^>]*>\s*<\/h[1-6]>/gi, "")
    .replace(/<a\s+href=["']["'][^>]*>\s*<\/a>/gi, "")
    .replace(/<br\s*\/?>\s*(?=<\/li>|<\/p>|<\/h[1-6]>)/gi, "")
    .replace(/\s+data-\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+style="[^"]*"/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&hellip;/g, "...")
    .trim();
}

// Main fetch function
async function fetchAndProcessPosts() {
  try {
    console.log("📥 Fetching posts from WordPress API...");

    // Ensure directories exist
    await fs.mkdir(BLOG_CONTENT_DIR, { recursive: true });
    await fs.mkdir(PUBLIC_BLOGS_DIR, { recursive: true });

    // Fetch posts
    const response = await fetch(WP_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch posts: ${response.statusCode}`);
    }

    const posts = await response.json();
    console.log(`✅ Fetched ${posts.length} posts`);

    for (const post of posts) {
      try {
        const slug = createSlug(post.title.rendered);
        const releaseDate = new Date(post.date).toISOString().split("T")[0];

        console.log(`\n📝 Processing: ${post.title.rendered}`);

        // Initialize image path
        let imagePath = "/blog-placeholder-3.jpg";
        let imageDownloaded = false;

        // Strategy 1: Try featured media endpoint
        if (post.featured_media && post.featured_media > 0) {
          const sourceUrl = await fetchMediaImage(post.featured_media);
          if (sourceUrl) {
            try {
              // Extract filename and create local path
              const urlObj = new URL(sourceUrl);
              let filename = path.basename(urlObj.pathname);
              
              // Handle URLs without proper extensions
              if (!filename || !filename.includes(".")) {
                filename = `${slug}.jpg`;
              }
              
              filename = sanitizeFilename(filename);
              const localImagePath = path.join(PUBLIC_BLOGS_DIR, filename);
              const publicImagePath = `/blogs/${filename}`;

              console.log(`  📸 Downloading image: ${filename}`);
              await downloadFile(sourceUrl, localImagePath);
              imagePath = publicImagePath;
              imageDownloaded = true;
              console.log(`  ✅ Image saved: ${filename}`);
            } catch (err) {
              console.log(`  ⚠️  Failed to download image: ${err.message}`);
            }
          }
        } else {
          console.log(`  ℹ️  No featured_media ID`);
        }

        // Strategy 2: Try to extract from content HTML if featured media failed
        if (!imageDownloaded && post.content?.rendered) {
          const contentImageUrl = extractImageFromContent(post.content.rendered);
          if (contentImageUrl) {
            try {
              console.log(`  📸 Found image in content: ${contentImageUrl}`);
              const urlObj = new URL(contentImageUrl);
              let filename = path.basename(urlObj.pathname);
              
              if (!filename || !filename.includes(".")) {
                filename = `${slug}.jpg`;
              }

              filename = sanitizeFilename(filename);
              const localImagePath = path.join(PUBLIC_BLOGS_DIR, filename);
              const publicImagePath = `/blogs/${filename}`;

              console.log(`  📸 Downloading content image: ${filename}`);
              await downloadFile(contentImageUrl, localImagePath);
              imagePath = publicImagePath;
              imageDownloaded = true;
              console.log(`  ✅ Image saved: ${filename}`);
            } catch (err) {
              console.log(`  ⚠️  Failed to download content image: ${err.message}`);
            }
          }
        }

        if (!imageDownloaded) {
          console.log(`  ℹ️  Using placeholder image`);
        }

        // Preserve the rendered WordPress HTML instead of flattening it to markdown.
        const content = renderWordPressContent(post.content?.rendered || "");

        // Create frontmatter
        const frontmatter = `---
title: "${post.title.rendered
          .replace(/"/g, '\\"')
          .replace(/&#038;/g, "&")
          .replace(/&amp;/g, "&")
          .replace(/&hellip;/g, "...")}"
slug: "${slug}"
mainImage: "${imagePath}"
releaseDate: "${releaseDate}"
---

`;

        // Create markdown file
        const filePath = path.join(BLOG_CONTENT_DIR, `${slug}.md`);
        await fs.writeFile(filePath, frontmatter + content);

        console.log(`  ✅ Article saved: ${slug}.md`);
      } catch (err) {
        console.error(`  ❌ Error processing post "${post.title.rendered}": ${err.message}`);
      }
    }

    console.log("\n✨ Done! All posts have been processed.");
    console.log(`📁 Posts saved to: ${BLOG_CONTENT_DIR}`);
    console.log(`📁 Images saved to: ${PUBLIC_BLOGS_DIR}`);
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
}

// Run the script
fetchAndProcessPosts();
