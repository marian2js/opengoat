# Quick Start Guide for OpenGoat

## Prerequisites
- Node.js >= 20.11
- npm

## Installation
```bash
npm i -g openclaw opengoat
openclaw onboard
opengoat start
```

Access the UI at `http://127.0.0.1:19123`.

## Creating Your First Agent Organization
1. In the UI, add a project.
2. Message the CEO: "Set up a team for project X."
3. Assign tasks via the board.

For CLI:
```bash
opengoat agent create "Engineer" --individual --reports-to ceo
opengoat task create --title "Build feature" --assign engineer
```
