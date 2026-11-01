# Benchmarks

These numbers come from `npm run bench`, which runs `benchmarks/harness.test.ts` and writes `benchmarks/results.json`. They are single-shot timings on one machine, not a statistical benchmark and not a user-facing latency claim. Re-run them before you quote them.

The harness also fails if any kernel takes a second or more. That ceiling is a regression net. The table below is the number worth reading.

## Method

| Kernel | Input | Why it exists |
| --- | --- | --- |
| `analyzeBundles` | 300 routes, shared React chunk, scattered date-fns copies | The CI gate has to stay cheap as route count grows |
| `estimateInp` | 10,000 interaction durations | Percentile selection should not become a tax on the collector |
| `cumulativeLayoutShift` | 10,000 shifts | Session windows run on the observer path |
| `contrastRatio` | 1,000 pairs of the platform text and background | Token checks stay trivial |
| `visibleRange` | 100,000 viewport calculations over 4,000 rows | Windowing math should disappear next to DOM cost |

No network, no browser paint, no React commit. DOM and paint belong in the browser, on the runtime screen, where the list mounts a window rather than 4,000 nodes. `npm run check:build` prints the gzip size of the built shell. Quote that output, not a number copied into this file.

## Results

Two single shots on Node v21.5.0, 30 October 2026. They move around. The claim worth making is that every kernel finished in under 10 ms, against a CI ceiling of 1 second. Re-run `npm run bench` before quoting a tighter number.

| Kernel | Latest sample |
| --- | --- |
| Analyze 300 route bundles | 1.6 ms |
| INP selection, 10,000 durations | 1.5 ms |
| CLS session windows, 10,000 shifts | 0.9 ms |
| Contrast, 1,000 token pairs | 5.0 ms |
| Window range, 100,000 calls | 6.7 ms |

The runtime screen is the DOM check: 4,000 spans, a window of about 18 rows mounted at rest. The harness does not measure paint. The shell does.
