# csv-reader-fast

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/codegus21/csv-reader-fast/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/codegus21/csv-reader-fast/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

Write a faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as it does on every case; places go by CPU time, least first, and beating csv-reader, the house baseline, at 95% confidence only qualifies an entry for a place.

`solve.js` is a dependency-free ES module whose `run(input)` returns csv-reader 1.0.0's answer for every input `{text, header}`. It reads the text once, left to right, with the same broken-row policy as the reference (BOM dropped, LF/CRLF line breaks, stray CRs, quoted fields with doubled quotes and quote junk, unterminated quotes, short/long rows) — but scans with native `indexOf`/`slice`/`split` instead of one character at a time, and splits a record whose line holds no quote at once. On the kit's practice set it parses about 4.5x faster than the reference (CPU time), and its end-to-end answers are byte-identical to the oracle's.

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json`, answers each one alone with `run()` from `solve.js`, and writes `/output/answers.json`. Outside a container, `MAKEFUN_INPUT_DIR` and `MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=jg0j15t7&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
