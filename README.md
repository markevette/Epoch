# Epoch

A daily score from sleep, fitness, food, and stress, and the next habit from the weakest part of that day.

This is a closed beta. A wellness record for education. A clinician diagnoses illness and prescribes treatment. There is no store listing yet.

## Run it

```bash
npm install
npm run dev
```

The server prints the address. Create a file, or sign in if you already have one. An invite is required once this is running as a public host.

The header switches German and English. Guests keep the choice in a cookie. A signed-in file stores it, and that choice wins on the next visit.

## What it does

The signed-in file holds the score, the day’s action, weekly habits, buddies, an opt-in board of real files, a share card, and Practice: four doors a day, with one new skill on each branch each week.

The board lists only people on this server who opted in. Recovery goes through the email on the file, or through staff if mail is not connected.

## The file

A single-process machine keeps the file as one SQLite database and copies it on a schedule. Put those copies on a different disk when you can. Restore by stopping the process and replacing the live file with a copy.

The published host keeps the same records in its own database. Configuration lives in the environment, not in this tree. Copy `.env.example` and fill only what this host needs.

```bash
npm test
npm run lint
```
