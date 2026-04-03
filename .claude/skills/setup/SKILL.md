---
name: setup
description: "Guide a user through setting up their local Ghost development environment from scratch. Use this skill whenever the user mentions setting up Ghost, getting started with Ghost development, running Ghost locally, installing Ghost dependencies, or troubleshooting their dev environment setup. Also use when they say things like 'I just cloned the repo', 'how do I run this', 'yarn dev isn't working', or 'first time contributing'."
---

# Ghost Local Dev Setup

An interactive guide that walks the user through setting up a working Ghost development environment. The goal is to get `yarn dev` running successfully on the first try by detecting the system, checking dependencies, installing what's missing, and configuring the environment — all while keeping the user informed and in control.

## Philosophy

This is a guided setup, not an automated script. The user should understand what's happening at each step so they can troubleshoot later. Ask for permission before installing anything system-level. Run checks yourself rather than asking the user to run commands and paste output — you have a terminal, use it. But always explain what you found and what you're about to do next.

## Step 1: Detect the System

Run these commands to understand the environment:

```bash
uname -s          # OS (Linux, Darwin)
uname -m          # Architecture (x86_64, arm64, aarch64)
sw_vers 2>/dev/null || cat /etc/os-release 2>/dev/null  # OS version
echo $SHELL       # Shell
```

Store the results — you'll use them throughout the rest of this guide to choose the right install commands. Summarize what you found to the user in one or two lines, e.g.: "You're on macOS (Apple Silicon) running zsh."

From here on, "macOS" means `uname -s` returned `Darwin`, and "Linux" means it returned `Linux`. For Linux, also note the distro from `/etc/os-release` — the install commands below cover Debian/Ubuntu (`apt`) and Fedora/RHEL (`dnf`). If the user is on Arch, openSUSE, or another distro, adapt the package manager commands accordingly.

## Step 2: Check Required Dependencies

Check each of these in parallel (they're independent). For each one, record whether it's installed and what version.

```bash
git --version
node --version
yarn --version
docker --version
docker compose version
```

Also check for version managers that may already be installed:
```bash
command -v nvm && nvm --version
command -v fnm && fnm --version
command -v brew && brew --version
```

### What's needed

| Dependency | Required version | Purpose |
|---|---|---|
| Git | Any recent version | Clone the repo, manage submodules |
| Node.js | `^22.13.1` | Run Ghost and build tools |
| Yarn | v1 (1.x) | Package manager, workspace management |
| Docker Engine | Any recent version | Run MySQL, Redis, Mailpit containers |
| Docker Compose | v2+ (the `docker compose` plugin) | Orchestrate the dev containers |

### Summary

Present a clear summary table to the user:

```
Dependency    Status        Version/Note
──────────    ──────        ────────────
Git           OK            2.43.0
Node.js       MISSING       Need ^22.13.1
Yarn          OK            1.22.22
Docker        OK            27.5.1
Compose       OK            2.32.4
```

If everything is installed and at the right version, skip ahead to Step 4. Otherwise, continue to Step 3.

## Step 3: Install Missing Dependencies

For each missing dependency, explain what you're about to install and why, then **ask the user for permission** before running any install command. Install in this order since later ones depend on earlier ones:

1. Build tools (needed for native Node modules)
2. Git
3. Node.js (via nvm)
4. Yarn (via npm, which comes with Node)
5. Docker + Docker Compose

After installing each one, re-run the version check to confirm it worked before moving on.

---

### 3a. Build Tools

Native Node modules (like `sharp` for image processing) need a C/C++ compiler and Python.

**macOS:**
```bash
xcode-select --install
```
This installs the Xcode Command Line Tools (includes `clang`, `make`, `git`, and Python). If it says "already installed", you're good. This is an interactive install — the user will see a system dialog to confirm.

**Linux (Debian/Ubuntu):**
```bash
sudo apt-get update && sudo apt-get install -y build-essential python3 git curl
```

**Linux (Fedora/RHEL):**
```bash
sudo dnf groupinstall -y "Development Tools" && sudo dnf install -y python3 git curl
```

---

### 3b. Git

Usually already present after installing build tools. Verify with `git --version`.

**macOS:** Included with Xcode Command Line Tools (step 3a). If somehow missing, `brew install git` (if Homebrew is available) or re-run `xcode-select --install`.

**Linux:** Included in the `apt`/`dnf` commands above. If skipped: `sudo apt-get install -y git` or `sudo dnf install -y git`.

---

### 3c. Node.js via nvm

Ghost requires Node.js `^22.13.1`. Always install Node through a version manager — never via `apt`, `brew`, or system package managers directly. Version managers let you switch Node versions per-project without sudo.

**If nvm is already installed** (check: `command -v nvm`):
```bash
nvm install 22
nvm use 22
nvm alias default 22
```

**If fnm is already installed** (check: `command -v fnm`):
```bash
fnm install 22
fnm use 22
fnm default 22
```

**If neither is installed — install nvm:**

This works the same on both macOS and Linux:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

After the install script runs, nvm won't be available in the current shell yet. The user needs to either:
- Open a new terminal tab/window, OR
- Source their shell config:
  ```bash
  source ~/.bashrc   # if using bash
  source ~/.zshrc    # if using zsh
  ```

Then install Node:
```bash
nvm install 22
nvm alias default 22
```

Verify: `node --version` should show v22.x.x.

**Common issues:**
- `nvm: command not found` after install — the shell config wasn't reloaded. Ask the user to open a new terminal.
- Wrong Node version despite `nvm use 22` — check if there's a `.nvmrc` in a parent directory overriding it.

---

### 3d. Yarn v1 (Classic)

Ghost uses Yarn v1 workspaces. Install it globally via npm (which comes with Node):

```bash
npm install -g yarn
```

Verify: `yarn --version` should show 1.22.x.

**If Yarn v2+ (Berry) is installed instead:**
Yarn Berry uses a different workspace format that's incompatible with Ghost. Uninstall it and install Classic:
```bash
npm uninstall -g yarn
npm install -g yarn@1
```

If `corepack` is managing Yarn (common with newer Node versions), disable it first:
```bash
corepack disable
npm install -g yarn
```

---

### 3e. Docker & Docker Compose

Ghost's dev environment runs MySQL 8.4, Redis 7, Mailpit, and the Ghost backend itself in Docker containers. You need both the Docker Engine and the Compose v2 plugin (`docker compose`, not the old `docker-compose`).

**macOS — Docker Desktop:**

Docker Desktop is the standard way to run Docker on macOS. It includes Docker Engine, Docker Compose, and a GUI for managing containers.

1. Check if Homebrew is available (`command -v brew`). If so:
   ```bash
   brew install --cask docker
   ```
   If Homebrew isn't available, tell the user to download Docker Desktop from https://www.docker.com/products/docker-desktop/ and install it manually.

2. After installation, the user needs to **open Docker Desktop** from Applications to start the Docker daemon. It runs as a menu bar app.

3. Verify:
   ```bash
   docker --version
   docker compose version
   ```

**Linux (Debian/Ubuntu) — Docker Engine:**

Docker Desktop is also available for Linux, but Docker Engine (the headless daemon) is lighter and more common for development:

```bash
# Remove any old/conflicting packages
sudo apt-get remove -y docker.io docker-doc docker-compose podman-docker containerd runc 2>/dev/null

# Add Docker's official GPG key and repository
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

# Install Docker Engine + Compose plugin
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

For **Debian** (not Ubuntu), replace `ubuntu` with `debian` in the repository URL above.

After installing, add the current user to the `docker` group so you don't need `sudo` for every Docker command:
```bash
sudo usermod -aG docker $USER
```

**Important:** This group change won't take effect in the current shell. The user needs to either:
- Log out and log back in, OR
- Run `newgrp docker` to activate the group in the current session

Start Docker and enable it on boot:
```bash
sudo systemctl start docker
sudo systemctl enable docker
```

Verify:
```bash
docker --version
docker compose version
docker run hello-world   # Should pull and run successfully
```

**Linux (Fedora/RHEL) — Docker Engine:**

```bash
# Remove old packages
sudo dnf remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine podman buildah 2>/dev/null

# Add Docker repo
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo

# Install Docker Engine + Compose plugin
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Then do the same post-install steps as Debian/Ubuntu above (add user to docker group, start/enable the service, verify).

---

## Step 4: Clone and Initial Setup

If the user hasn't cloned the repo yet, help them:
```bash
git clone https://github.com/TryGhost/Ghost.git
cd Ghost
```

Then run the setup command which installs yarn dependencies and initializes git submodules (the Casper and Source themes):
```bash
yarn setup
```

This will take a few minutes. Let the user know what's happening — `yarn setup` runs `yarn` (installs all workspace dependencies across the monorepo) and `git submodule update --init --recursive` (pulls the Casper and Source theme repos).

If `yarn setup` fails:
- **Node version mismatch:** Check `node --version` again — must be ^22.13.1. If using nvm, run `nvm use 22`.
- **Native module build failures:** Missing build tools — go back to Step 3a.
- **Permission errors:** Never use `sudo` with yarn. If there are permission issues with the global npm directory, fix with `mkdir -p ~/.npm-global && npm config set prefix '~/.npm-global'` and add `~/.npm-global/bin` to PATH.
- **Network/timeout errors:** Try `yarn --network-timeout 600000`.
- **`sharp` install failures on Linux ARM:** May need `sudo apt-get install -y libvips-dev`.

## Step 5: Environment Configuration

The `.env` file is optional for basic development but good to set up:

```bash
cp .env.example .env
```

Explain to the user that the default settings work fine for local development. The `.env` file is mainly for optional features like Stripe webhooks or Mailgun SMTP. They can configure those later if needed.

## Step 6: Start the Dev Environment

Make sure Docker is running first:
```bash
docker info > /dev/null 2>&1 && echo "Docker is running" || echo "Docker is NOT running"
```

If Docker isn't running:
- **macOS:** Tell the user to open Docker Desktop from Applications. It needs to be running as a menu bar app.
- **Linux:** `sudo systemctl start docker`

Then check if ports 2368, 3306, 6379, and 8025 are free:
```bash
lsof -i :2368 -i :3306 -i :6379 -i :8025 2>/dev/null
```

If any are in use, let the user know which ports are occupied and by what process. Common conflicts:
- **3306:** A local MySQL server. Stop it with `sudo systemctl stop mysql` (Linux) or `brew services stop mysql` (macOS), or it'll conflict with Docker MySQL.
- **2368:** Another Ghost instance.
- **6379:** A local Redis server.

Then start the dev environment:
```bash
yarn dev
```

Explain what this does: it builds Docker images (first run takes a few minutes to download base images), starts MySQL, Redis, Mailpit, the Ghost backend, and a Caddy reverse proxy in Docker, then starts frontend dev servers on the host for hot-reloading.

## Step 7: Verify It's Working

Once `yarn dev` is running and the logs show Ghost is ready (look for "Ghost is running in development..."), confirm these URLs work:

- **Ghost site:** http://localhost:2368
- **Ghost Admin:** http://localhost:2368/ghost/
- **Mailpit (email testing):** http://localhost:8025

Tell the user: "Your Ghost development environment is running! Visit http://localhost:2368/ghost/ to set up your admin account. Any emails Ghost sends will appear in Mailpit at http://localhost:8025."

## Troubleshooting Common Issues

If `yarn dev` fails, check these in order:

1. **Docker build errors:** Try `yarn docker:clean` then `yarn dev` again.
2. **Port conflicts:** Check `docker ps` and `lsof -i :<port>` for conflicts.
3. **MySQL won't start:** Sometimes the volume is corrupted. `yarn docker:clean` resets everything.
4. **"Cannot find module" errors:** Run `yarn` again to reinstall dependencies.
5. **Permission denied on Docker socket (Linux):** Make sure you're in the docker group: `groups $USER` should include `docker`. If not, run `sudo usermod -aG docker $USER` and then `newgrp docker` or log out/in.
6. **Slow first start:** The first `yarn dev` builds Docker images and downloads base images. This can take 5-10 minutes on slower connections. Subsequent starts are much faster.
7. **Docker Desktop not enough resources (macOS):** If MySQL crashes or containers are OOM-killed, increase Docker Desktop's memory allocation in Settings > Resources. 4GB minimum recommended.

## Quick Reference (for after setup)

Once setup is complete, share this cheat sheet:

```
yarn dev                  # Start dev environment
yarn docker:down          # Stop containers (preserves data)
yarn docker:clean         # Stop and wipe everything (fresh start)
yarn reset:data           # Load sample data (1000 members, 100 posts)
yarn reset:data:empty     # Reset to empty database
yarn lint                 # Lint all packages
yarn test:unit            # Run unit tests
```
