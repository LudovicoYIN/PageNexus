# PageNexus

PageNexus is a local-first desktop knowledge-base app built with Tauri, React, and `pi-coding-agent`.

Users can:

- create knowledge bases
- upload and parse local documents
- ask questions against parsed materials
- watch the agent use native file tools such as `ls`, `find`, `grep`, `read`, and `bash`

The current parser is implemented with embedded Python and PyMuPDF. Runtime model settings are configured inside the app, not hardcoded in the repository.

## Stack

- Tauri 2
- React + Vite
- Tailwind CSS
- `@mariozechner/pi-coding-agent`
- embedded Python runtime
- PyMuPDF
- SQLite

## Project Layout

```text
.
├── frontend/        React desktop UI
├── node/            Node wrapper for pi-coding-agent RPC mode
├── python/          parser and utility scripts
├── src-tauri/       Rust backend and Tauri bundle config
├── tests/           Python parser tests
└── .github/         CI workflows
```

`python-runtime/` is generated locally by the bootstrap script and is intentionally ignored from Git.

## Local Development

Install dependencies:

```bash
npm install
npm --prefix frontend install
```

Run the desktop app:

```bash
npm run dev
```

On first launch, open `Settings` and fill in:

- `PackyAPI API Key`
- `API Base URL`
- `Model ID`

Run all tests:

```bash
npm test
```

Build a local production package:

```bash
npm run build
```

## Runtime Settings

After launching the app, open `Settings` and configure:

- `PackyAPI API Key`
- `API Base URL`
- `Model ID`

Those values are stored in the app data directory as local settings and are used by both health checks and the coding agent runtime.

## Packaging

macOS:

```bash
cargo tauri build --bundles dmg
```

Windows:

```bash
cargo tauri build --bundles nsis
```

## CI

GitHub Actions workflow:

- `.github/workflows/pagenexus-desktop-build.yml`

It builds:

- macOS `.dmg`
- Windows `nsis` installer

The workflow does not require a PackyAPI runtime key, because the packaged app reads that from the local settings UI.
