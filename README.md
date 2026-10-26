<p align="center">
  <img src="docs/logo.svg" alt="Folichon logo" width="104" height="104">
</p>

<h1 align="center">Folichon</h1>

<p align="center">
  <b>Your CV and projects, on your own server.</b><br>
  A cheerful portfolio page you edit from your browser: one Docker container, no database.
</p>

<p align="center">
  <a href="https://github.com/MrDDream/Folichon/releases/latest"><img src="https://img.shields.io/github/v/release/MrDDream/Folichon?color=FF7A59&label=release" alt="Latest release"></a>
  <a href="https://github.com/MrDDream/Folichon/pkgs/container/folichon"><img src="https://img.shields.io/badge/docker-ghcr.io%2Fmrddream%2Ffolichon-FF7A59?logo=docker&logoColor=white" alt="Docker image"></a>
  <a href="https://github.com/MrDDream/Folichon/actions/workflows/tests.yml"><img src="https://github.com/MrDDream/Folichon/actions/workflows/tests.yml/badge.svg" alt="Tests"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-FF7A59" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#install-docker-compose">Install</a> ·
  <a href="#-what-it-does">Features</a> ·
  <a href="#-screenshots">Screenshots</a> ·
  <a href="README.fr.md">Version française</a>
</p>

<p align="center">
  <img src="docs/hero.webp" alt="The public page, the editor and the mobile view" width="820">
</p>

---

## 😄 Why Folichon?

A CV in a PDF is fine, but it doesn't show what you build. Website builders show it nicely, on someone else's servers, with their branding and their trackers.

Folichon is a single page that tells your story (who you are, what you build, where you've worked, what you know), hosted on **your** server. You change it from a built-in editor in your browser: no code, no rebuild, no database.

## ✨ What it does

|                                   |                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🧑‍💻 **A page that looks like you** | Introduction with photo, key figures, big project cards with their own colours and screenshots, small projects, experience timeline, skills and contact.          |
| ✏️ **Built-in editor**            | Every text, link, colour and image is editable from the browser, with lists you reorder, undo on delete and a guard against overwriting a newer version.          |
| 🔐 **Secured**                    | Admin at a secret address, password **and** two-factor authentication, limited attempts, revocable sessions, strict security headers.                             |
| 🌗 **Light and dark**             | Follows the system, with a switch on the page and in the editor.                                                                                                  |
| 🎨 **7 themes, your fonts**       | Folichon, Magazine, Terminal, Retro, Neon, Pop or Plain CV: each changes the layout, not just the colours. Pick a font for headings and body, or upload your own. |
| 📱 **Mobile first**               | Sticky menu, compact layout, the phone's own share sheet.                                                                                                         |
| 🌍 **French and English**         | The page and the editor speak both.                                                                                                                               |
| 🪶 **Light**                      | One container, no database, no external resource: fonts are served by the site, images are WebP.                                                                  |

## 📸 Screenshots

<table>
<tr>
<td align="center"><b>Public page</b><br><img src="docs/screens/page-light.webp" alt="Public page in light mode" width="400"></td>
<td align="center"><b>Dark mode</b><br><img src="docs/screens/page-dark.webp" alt="Public page in dark mode" width="400"></td>
</tr>
<tr>
<td align="center"><b>Editor</b><br><img src="docs/screens/admin.webp" alt="The built-in editor" width="400"></td>
<td align="center"><b>On mobile</b><br><img src="docs/screens/mobile.webp" alt="The page on a phone" width="400"></td>
</tr>
</table>

## Install (Docker Compose)

1. Create a folder with this `docker-compose.yml`:

   ```yaml
   services:
     folichon:
       image: ghcr.io/mrddream/folichon:latest
       container_name: folichon
       restart: unless-stopped
       init: true
       ports:
         - '3000:3000'
       env_file: .env
       volumes:
         - ./data:/data
   ```

2. Next to it, a `.env` file only you can read (`chmod 600 .env`):

   ```bash
   # Admin password: 12 characters or more recommended
   ADMIN_PASSWORD=
   # Secret admin address, for example /admin-7f3k9q2x
   ADMIN_PATH=
   # Behind a reverse proxy (Nginx Proxy Manager, Traefik, Caddy…):
   # TRUST_PROXY=loopback, uniquelocal
   # SITE_URL=https://example.com
   ```

3. Create the data folder (the container runs as user `1000`) and start:

   ```bash
   mkdir -p data && sudo chown 1000:1000 data
   docker compose up -d
   ```

The site is at `http://your-server:3000`, the admin at `http://your-server:3000/admin-7f3k9q2x`. Without `ADMIN_PATH`, a random address is generated and printed in `docker logs folichon`.

To build the image yourself: clone the repository, `cp .env.example .env`, then `docker compose up -d --build`.

## Environment variables

| Variable         | Purpose                                                                                                                                   | Default                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `ADMIN_PASSWORD` | Admin password. Without it (or if too short), the admin is disabled.                                                                      | —                                      |
| `ADMIN_PATH`     | Secret admin address.                                                                                                                     | random, kept in `data/admin-path.txt`  |
| `TRUST_PROXY`    | Behind a reverse proxy: proxies trusted for the visitor IP, for example `loopback, uniquelocal` or `1`. `true` is refused (IP spoofing).  | off                                    |
| `SITE_URL`       | Public address of the site, used for share previews (WhatsApp, LinkedIn…).                                                                | taken from the request                 |
| `UPDATE_CHECK`   | Checks GitHub (at most every 12 h) whether a newer Folichon version exists, shown next to the version in the admin. `false` turns it off. | on                                     |
| `SESSION_SECRET` | Session signing key.                                                                                                                      | random, kept in `data/.session-secret` |
| `PORT`           | Port inside the container.                                                                                                                | `3000`                                 |
| `DATA_DIR`       | Data folder.                                                                                                                              | `/data` in Docker                      |

## Two-factor authentication

- **First sign-in**: after the password, a QR code is shown. Scan it with your authenticator app and enter the code to turn it on. The key is kept in `data/totp.json`.
- **Next sign-ins**: password, then the current code.
- **Lost or new phone**: delete `data/totp.json` and restart the container. A new QR code is offered.

## Using the admin

- Every section can be edited: introduction, photo, CV, social links, key figures, projects, small projects, experience, skills, contact and footer.
- **Lists**: add, remove and reorder items with the ↑ ↓ arrows.
- **Images**: "Envoyer une image" button, or an `https://…` link.
- **Colours**: each project has its own colour set.
- **Theme and fonts** (Top of page › Site settings): 7 themes that change the layout and style of the public page; light/dark mode and the accent colour stay yours. One font for headings, one for body text: a bundled one (Bricolage Grotesque, Inter, JetBrains Mono), a family already installed on devices (serif, rounded, handwritten…), or your own file (WOFF2, WOFF, TTF or OTF), served by your server. Check that its licence allows use on a website.
- **Headline**: words between asterisks take the accent colour, for example `I build *Android apps*`.
- **Save** (or Ctrl/Cmd + S): the public page updates at once; the previous version is kept in `data/content.backup.json`. If the content changed elsewhere (another tab), saving is refused instead of overwriting it.
- **Export / Import**: back up or restore all content as one JSON file.
- An empty link, photo or e-mail hides the matching button. The e-mail address never appears in clear in the page.

## Security

- Password **and** 6-digit TOTP code (each code works only once).
- At most 5 failed attempts per IP, and 30 in total, every 15 minutes.
- Signed, `HttpOnly`, `SameSite=Strict` sessions valid for 12 h; changing the password or the 2FA key signs everyone out, and "Déconnexion" revokes the session on the server.
- Write requests coming from another site are refused.
- `Content-Security-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security` (over HTTPS) headers, `noindex` on the admin.
- Uploads limited to images (PNG, JPG, WebP, GIF, AVIF) and PDF, 15 MB at most, with a check of the real content. No SVG.
- The page loads no external resource.

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Development

```bash
npm install
ADMIN_PASSWORD=test-password ADMIN_PATH=/admin npm run dev
npm run check     # Prettier, ESLint and tests
```

## License

[MIT](LICENSE). The fonts (Inter, Bricolage Grotesque, JetBrains Mono) are under the SIL Open Font License: see `public/fonts/`.
