# Core Engine Lock

The core trading programming engine has been strictly locked by the user. 

**DO NOT** modify, refactor, optimize, or change the logic in the following core files unless the user *explicitly* requests a change to the core trading algorithm:

1. `server/indicators.ts` (Core breakout logic, Bollinger Band Squeeze, KNN crossovers, Signal generation)
2. `server/dhan.ts` (API fetching, NSE market hours context, timezone alignment, historical data handling)
3. Scanner & Sheets Sync Engine in `server.ts` (Parallel chunking logic, sync loops)

The algorithm mirrors a highly specific Python script. Any unsolicited changes to these files risk breaking the signal accuracy and API constraints. For any general UI/UX changes, frontend fixes, or new non-core features, leave the core engine files 100% untouched.
