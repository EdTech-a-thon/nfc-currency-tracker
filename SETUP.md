# Production Setup

This guide assumes a fresh Linux VM and a domain name you control. The app, database, and HTTPS certificate all run on that VM.

## 1. Prepare DNS and the firewall

1. Find the VM's public IP in your hosting account.
2. In your DNS provider, create `A` records pointing to that IP: one for the app, such as `rewards.example.org`, and one for PocketBase, such as `data.example.org`. The browser calls PocketBase directly, so it needs its own public name and certificate. Remove an incorrect `AAAA` record unless the VM has working IPv6.
3. Allow inbound TCP ports `22`, `80`, and `443`, plus UDP `443`, in the provider firewall. Nothing else needs to be reachable from outside.

## 2. Install Docker

Check the distribution with `cat /etc/os-release`. Docker's official convenience script works across common distributions:

```sh
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
```

Sign out and back in, then check `docker --version` and `docker compose version`. If the script does not support the distribution, follow the matching manual installation page at <https://docs.docker.com/engine/install/> and install both Docker Engine and the Compose plugin. Docker group membership gives root-equivalent access; only add trusted deployment users.

## 3. Download and configure

```sh
git clone YOUR_GITHUB_REPOSITORY_URL nfc-currency-tracker
cd nfc-currency-tracker
cp .env.example .env
chmod 600 .env
```

Edit `.env` and set every value. `DOMAIN` and `POCKETBASE_DOMAIN` are the public hostnames without `https://`, and `NEXT_PUBLIC_POCKETBASE_URL` must be `https://` plus that PocketBase hostname. There is no separate session secret: PocketBase issues and checks the sign-in tokens itself.

**Finalize `NEXT_PUBLIC_CARD_BASE_URL` before writing any NFC chip.** Cards are written once and may be locked. Changing this origin later invalidates every physical card, even if the main app moves to another hostname. A stable example is `https://cards.example.org`; point it at this VM and include it in Caddy if it differs from `DOMAIN`.

If card and app hostnames differ, change the first line of `Caddyfile` to `{$DOMAIN}, cards.example.org {`.

## 4. Start the app

```sh
chmod +x deploy.sh
docker compose up -d --build
docker compose ps
```

Open `https://YOUR_DOMAIN`. Create the first teacher account with **Create a teacher account** on the login page. Check `https://YOUR_DOMAIN/api/health` and `https://YOUR_POCKETBASE_DOMAIN/api/health`; both should show a healthy response. Caddy requests and renews trusted Let's Encrypt certificates for both names automatically.

On first start, open `https://YOUR_POCKETBASE_DOMAIN/_/` and create the PocketBase superuser account. That is where you can review teacher accounts and stored data directly. Keep those credentials safe and separate from teacher logins.

## 5. Automatic GitHub deployment

In the GitHub repository, open **Settings > Secrets and variables > Actions** and create:

- `DEPLOY_HOST`: VM hostname or IP.
- `DEPLOY_USER`: Linux user that owns the checkout and can run Docker.
- `DEPLOY_SSH_KEY`: private key whose public key is in that user's `~/.ssh/authorized_keys`.
- `DEPLOY_HOST_KEY`: output of `ssh-keyscan YOUR_VM_HOST` reviewed against the VM's real host fingerprint.
- `DEPLOY_PATH`: absolute checkout path, such as `/home/deploy/nfc-currency-tracker`.

A push to `main` runs type checks, tests, and a production build before connecting to the VM and running `deploy.sh`. The script pulls only fast-forward changes and rebuilds. Any new files in `pb_migrations/` are applied by PocketBase itself when it restarts, so there is no separate migration step to remember. It is safe to run repeatedly.

## Backups

All records live in the `pocketbase_data` volume. Make one dated copy:

```sh
mkdir -p "$HOME/nfc-backups"
docker run --rm -v nfc-currency-tracker_pocketbase_data:/data -v "$HOME/nfc-backups":/backup alpine \
  tar czf "/backup/nfc-$(date +%F-%H%M).tar.gz" -C /data .
```

PocketBase can also make its own backups from the admin screens at `https://YOUR_POCKETBASE_DOMAIN/_/`, under **Settings > Backups**, which is the easier route day to day.

Sample daily cron entry at 2:15 AM. Replace `/absolute/project/path` with the real location:

```cron
15 2 * * * docker run --rm -v nfc-currency-tracker_pocketbase_data:/data -v /home/deploy/nfc-backups:/backup alpine tar czf /backup/nfc-$(date +\%F-\%H\%M).tar.gz -C /data .
```

Copy backups off the VM regularly. A backup on the same disk is not protection from disk loss. Test restores periodically. To restore:

```sh
docker compose stop app pocketbase
docker run --rm -v nfc-currency-tracker_pocketbase_data:/data -v "$HOME/nfc-backups":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/YOUR_BACKUP.tar.gz -C /data"
docker compose up -d pocketbase app
```

## Troubleshooting

**Certificate is not issued:** Confirm the A record resolves to this VM, ports 80 and 443 are open, no stale AAAA record points elsewhere, and `DOMAIN` exactly matches DNS. Run `docker compose logs caddy`.

**The app loads but nothing saves:** The browser calls PocketBase directly, so check that `NEXT_PUBLIC_POCKETBASE_URL` matches `POCKETBASE_DOMAIN` exactly, including `https://`. Because that value is baked in when the app is built, changing it needs a rebuild: `docker compose up -d --build app`. Run `docker compose logs pocketbase` to confirm the migrations applied.
