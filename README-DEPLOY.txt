PDF Ad Cleaner – gulag-cleaner.online  (static site, no build step)

UPLOAD
 Upload the CONTENTS of this folder (not the zip itself) to your web root so that
 index.html sits at https://gulag-cleaner.online/ . Keep the folder structure.

BEFORE YOU GO LIVE
 1. Email: create contact@gulag-cleaner.online (it appears on Contact and Privacy pages).
 2. Google Search Console: easiest is a DOMAIN property verified with a DNS TXT record.
    If you prefer the HTML meta tag, paste it where the comment
    "GOOGLE SEARCH CONSOLE: paste your verification meta tag" appears in the <head>
    of index.html (and other pages if you want it everywhere).
 3. HTTPS must be on (the PDF tool and canonical URLs assume https://gulag-cleaner.online).

SERVER NOTES
 - Apache: .htaccess is included (HTTPS + non-www redirects, caching, MIME types).
 - Nginx / other: make sure .mjs and .js are served as application/javascript and
   .wasm as application/wasm, and set 404 to /404.html. Add redirects http->https
   and www->non-www in your host settings.

AFTER LIVE
 - Submit https://gulag-cleaner.online/sitemap.xml in Search Console, request indexing
   for the homepage and /blog/.
 - Test the tool with a real PDF on desktop and phone, and press play on the video.

THIRD-PARTY CODE (self-hosted in assets/vendor, licences included)
 pdf-lib 1.17.1 (MIT) and PDF.js 5.6.205 (Apache-2.0).
