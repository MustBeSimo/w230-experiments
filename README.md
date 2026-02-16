# W230 Experiments - CineFlow Prototype

> [!WARNING]
> **EXPERIMENTAL / PROPRIETARY**
> This repository contains experimental prototypes and core IP for the W230 project.
> **DO NOT COMMIT SECRETS** (API Keys, Credentials, etc.) to this repository.

## Overview

A cinematic video generation prototype leveraging Gemini 1.5/2.0 Flash and Fal.ai (Veo/Imagen).

## Quickstart

### Prerequisites

- Node.js (v18+)
- `npm` or `yarn`

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/MustBeSimo/w230-experiments.git
    cd w230-experiments
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment:
    - Copy `.env.example` to `.env.local`:
      ```bash
      cp .env.example .env.local
      ```
    - Open `.env.local` and add your API keys:
      ```bash
      GEMINI_API_KEY=your_gemini_key_here
      FAL_API_KEY=your_fal_key_here
      ```

4.  Run the Development Server:
    ```bash
    npm run dev
    ```

## Security

- **Secrets**: Never commit `.env` files. The `.gitignore` is configured to exclude them.
- **Auditing**: Periodically scan your git history for accidental leaks.

## License

All Rights Reserved. W230 Internal/Private Use Only.
