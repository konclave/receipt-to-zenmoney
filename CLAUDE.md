## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: vitest, oxlint, oxfmt

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`receipt-to-zenmoney` — a PWA application, that runs primary on a mobile device (phone) and can make a photo of the receipt, parse it to find the transaction summ, the store name and the possible category, and importing transactions into [Zenmoney](https://zenmoney.ru).

Transaction categories should be preloaded from the Zenmoney and stored locally in the app.

The app should have the ability to reload the transaction categories manually by the user action.

As a reference of the way of communication with the Zenmoney API we can use the [Zerro.app](https://github.com/ardov/zerro)

## New feature or bugfix

Create a separate git branch for each new feature or bugfix. Do not commit to the `main` branch.
