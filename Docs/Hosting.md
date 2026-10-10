# Host the tracker

Hosting is optional. It puts the same tracker on the internet behind a password, so you can use it from your phone. These steps use [Render](https://render.com); any host that runs a Python process works the same way.

## How it works

- The host runs the same server as your computer does.
- A free host's disk is wiped on every restart, so the hosted copy saves to your GitHub repository instead. Each save becomes a commit on `main` named `tracker: save Data/...`.
- Your computer and the host therefore share one copy of the data, in git. Pull before working locally.

## 1. Create a GitHub token

Create a fine-grained personal access token limited to your LaunchPad repository, with **Contents: read and write** and nothing else. The server uses it to read and commit the data files.

## 2. Create the web service

In Render, create a **Web Service** from your repository, branch `main`, with these settings:

| Setting | Value |
|---|---|
| Build command | `uv sync --frozen && uv cache prune --ci` |
| Start command | `uv run tracker.py` |
| Health check path | `/health` |
| Build filter, ignored paths | `Data/**` and `Resume/Uploads/**`, so data commits do not redeploy the app |

## 3. Set the environment

| Variable | Value | Why |
|---|---|---|
| `HOST` | `0.0.0.0` | Listen beyond localhost. The server refuses to do this without a password |
| `TRACKER_PASSWORD` | A long password of your own | Turns on the sign-in page for everything except `/health` |
| `TRACKER_GITHUB_TOKEN` | The token from step 1 | Lets the server commit saves |
| `TRACKER_GITHUB_REPO` | `owner/name` of your repository | Where saves go |
| `TRACKER_GITHUB_BRANCH` | Optional, default `main` | Only if your data lives on another branch |

`PORT` is set by the host and read automatically. Set these in the host's dashboard only. Never commit them, and never paste them into a chat.

## 4. Check it

- In the host's log, the start-up lines name where saves go: `[sync] saving to GitHub: owner/name (branch main)`, then one line per data file. A file reported as "not in that repository yet" on a copy that already has data means `TRACKER_GITHUB_REPO` names the wrong repository.
- Open the service URL. You should get the LaunchPad sign-in page, then your board.
- Change something small and look for a `tracker: save Data/data.json` commit in the repository.
- On your computer, `git pull` brings that change down.

## Living with a hosted copy

- **Pull first.** Run `git pull --rebase --autostash` before changing data locally. The daily routine does this for you.
- **Never force-push `main`.** The host commits to it.
- **If two saves collide**, the later one is refused and the page reloads with the latest data; redo the change. Nothing is overwritten.
- **If GitHub is unreachable**, the save stays on the host and is retried on the next save.
- **Sign-in lasts 30 days.** `/logout` signs out. Changing `TRACKER_PASSWORD` signs everyone out.
- **A data save should not redeploy.** If the deploy list shows deploys for `tracker: save Data/...` commits, the build filter from step 2 is missing; each such deploy restarts the server.
- **Pushing code to `main` redeploys.** The server can only open links and reveal files on the computer it runs on, so on the hosted copy links open in a new tab and documents download instead.

## Previewing a change before it goes live

Render can build a preview for a pull request: add the label `render-preview`, or put `[render preview]` in the pull request's title. A preview copies the service's environment, including the GitHub token, so **anything saved in a preview is committed to your real data**. Clear `TRACKER_GITHUB_TOKEN` and `TRACKER_GITHUB_REPO` on the preview before clicking around in it.
