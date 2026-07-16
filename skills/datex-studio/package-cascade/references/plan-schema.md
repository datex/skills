# Cascade Plan Schema

Output of `dxs -O json source cascade plan …` (unwrap the `cascade_plan` envelope key).

```jsonc
{
  "origin": { "uniqueIdentifier": "Module1", "publishedVersion": "20260714.1000" },
  "cycleDetected": false,                       // true => STOP, do not run
  "levels": [
    {
      "level": 1,                               // all level-1 nodes publish before any level-2
      "nodes": [
        {
          "uniqueIdentifier": "Module2",
          "name": "Module 2",
          "mainApplicationId": 3001,            // the Main branch to fork (do NOT guess it)
          "kind": "package",
          "updates": [                          // direct deps this node re-pins
            { "package": "Module1", "fromVersion": "1101", "toVersion": "20260714.1000" }
          ]
        }
      ]
    },
    {
      "level": 2,
      "nodes": [
        {
          "uniqueIdentifier": "Module0",
          "mainApplicationId": 3005,
          "kind": "package",
          "updates": [
            { "package": "Module2", "fromVersion": "…", "toVersion": null }
          ]
        }
      ]
    }
  ],
  "staleApplications": [                          // reported, NEVER auto-published
    { "uniqueIdentifier": "App1", "name": "App 1", "kind": "app",
      "mainApplicationId": 9001, "consumes": ["Module0"] }
  ]
}
```

Key points:
- `toVersion: null` means the version is only known after that dependency is published earlier in
  the run; `cascade run` resolves it automatically. Do not try to fill it in yourself.
- A node appears exactly once even if it re-pins several updated dependencies (multiple `updates`).
- `staleApplications` is the hand-off list for Phase 4 — one entry per application that consumes an
  updated package, with which package(s) it `consumes`.
