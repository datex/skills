# Platform B — the model API connection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Agent application runs its agent loop on the customer's own Anthropic key: a new API connection type `AnthropicApi` is created in the Manager, declared as one app setting in Studio, bound per environment, and read by the generated app's agent loop at runtime.

**Architecture:** The type follows the MsSql connection (type 12, PR 2823) through every layer: .NET domain entity with secret hooks, EF discriminator, MediatR handlers, controller, DbUp seed; Manager connection editor; Studio setting picker; codegen enum mirror. The key reaches the running app the way every connection already does — through the platform settings the generated backend loads at startup — and codegen bakes which setting holds it into `agent.manifest.ts`, so the agent's model client reads it from `SettingsValuesService` instead of from the process environment.

**Tech Stack:** ASP.NET Core 9 / EF Core / MediatR / xUnit (DB-backed `DatabaseFixture`), DbUp SQL scripts, Angular 20 (ClientApp `datexapplication` project), Node/TypeScript codegen with mocha backend specs, `@anthropic-ai/sdk`.

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` — D-A6, §4.1 "Model API connection", §4.2 "Manager", §4.5 "Vendor-abstracted model client", §5 item 5.

## Decisions this plan makes against the spec's wording

These are rulings, made with the code in front of us. Each is cheap to reverse.

1. **Delivery through settings, not `ANTHROPIC_API_KEY`.** The spec says "the container receives it as env (`ANTHROPIC_API_KEY`)". No connection reaches a container as an env var today: the generated backend loads every bound connection from the platform (`loadSettings` in `backendapp/src/backend.functions.ts`) and services read `connectionOptionsJson` from `SettingsValuesService` (MsSql: `handlebars/backend/mssql.service.hbs`). Settings are the established path, need no .NET deploy change, and keep the key **out of the process environment** — which matters for Platform C, whose `run_script` child processes inherit env and must never see the model key (spec §7 Proof 2). `ANTHROPIC_API_KEY` stays as a local-development fallback only. Connection settings are already stripped from what the backend serves to the browser (`backendapp/src/settings.router.ts`).
2. **A new `Script0101.sql`, not an addition to `Script0100.sql`.** Review-round item 1 chose to extend `Script0100`. That script has since run on development databases (Platform A), and DbUp records scripts by name, so lines appended to it never run there. `Script0101` is embedded like every script.
3. **No "exactly one model connection" publish error.** The platform's validation has errors only, no warnings, and an Agent application without a model key is still useful (lane 1: a human's Claude Code drives it with `fpx`). So validation refuses only **more than one** `AnthropicApi` setting (the loop could not choose); a missing one surfaces at the first turn as `503 ModelNotConfigured`.

## Global Constraints

- Repo: `D:\Git\248960_agent`, branch `feature/248960_agent_applications`. Commit locally; **never push**. Do not commit plans or specs in this repo. Never stage `agent-apps-spike-plan.md` or `docs/agent-apps/*` files that are untracked today.
- Every commit message ends with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- Type value: `AnthropicApi = 13` in .NET, Studio and codegen enums. Display name `AnthropicApi` (the enum key, as for every other type).
- Options shape (camelCase in JSON, PascalCase in C#): `apiKey` (secret, required), `baseUrl` (optional, non-secret; an Anthropic-compatible endpoint). The secret's `ChangedSecrets` name is `apikey` (lowercase, matched case-insensitively).
- The key is never returned by the API (`ClearSecrets`), never written to logs, never placed in `ConnectionString`.
- "Datex Studio", never "Wavelength", in any user-facing text (enum/class names already in the code base are exempt).
- Tests: .NET `cd src/Wavelength/DatexApplicationApi.Tests && dotnet test --filter <name>`; DB-backed tests need the local test database (they run on this machine — Platform A's `ApplicationsValidationAgentTests` did). Codegen: see Task 4. Studio/Manager: `npm run build` of the ClientApp (this repo's ClientApp component specs are not maintained; do not author `.spec.ts`).

## Review Focus

1. **A key edited in the Manager without being retyped** — expectation: saving a connection whose key field was left untouched keeps the stored key; only a changed key (listed in `ChangedSecrets`) replaces it. Pinned in Task 1 (`ApplyChangedSecrets` tests).
2. **An app with two `AnthropicApi` settings** — expectation: Studio refuses to add the second, and validation reports it, rather than codegen silently picking one. Pinned in Task 2 (validation test) and Task 3 (setting-edit rule).
3. **A deployed Agent app with no model connection bound** — expectation: `POST /api/$agent/turn` answers `503 {code: 'ModelNotConfigured'}` naming the setting to bind, not a generic 500. Pinned in Task 4 (router test).
4. **A key rotated while the app runs** — expectation: the next turn uses the new key without a restart once settings reload; a client is never cached across a key change. Pinned in Task 4 (client cache keyed by key + base URL).
5. **The key leaking into a script's environment or the browser** — expectation: the key is read from settings, never copied into `process.env`, and never served by `/api/settings`. Pinned in Task 4 (env assertion) and existing `settings.router.ts` behaviour (Task 4 adds a test that an AnthropicApi setting is filtered).

---

## File Structure

| Area | Path (under `src/Wavelength/`) | Task |
|---|---|---|
| Domain | `DatexApplicationApi.Domain/Entities/ApiConnections/ApiConnectionType.cs`, new `AnthropicApiConnection.cs` | 1 |
| EF | `DatexApplicationApi.Infrastructure/Data/EFConfigurations/ApiConnections/ApiConnectionEntityConfiguration.cs`, new `AnthropicApiConnectionEntityConfiguration.cs` | 1 |
| Handlers | `DatexApplicationApi.Core/ApiConnections/Commands/{Create,Update}ApiConnectionCommandHandler.cs`, `…/Queries/GetApiConnectionQueryHandler.cs` | 1 |
| Controller | new `DatexApplicationApi/Controllers/ApiConnections/AnthropicApiConnectionsController.cs` | 1 |
| DB | new `DatexApplicationApi.Database/Migration/Scripts/Script0101.sql`, `DatexApplicationApi.Database.csproj` | 1 |
| Tests | `DatexApplicationApi.Tests/DomainTests/ApiConnectionSecretsTests.cs`, `…/Controllers/ApiConnectionTypesControllerTests.cs`, new `…/Controllers/AnthropicApiConnectionsControllerTests.cs` | 1 |
| Validation | `DatexApplicationApi.Infrastructure/Services/ApplicationsValidationService.cs`, `DatexApplicationApi.Tests/Controllers/ApplicationsValidationAgentTests.cs` (+ test data) | 2 |
| Manager + Studio | ClientApp `projects/datexapplication/src/app/…` (see Task 3) | 3 |
| Codegen | `DatexApplicationApi/codegen/src/…` (see Task 4) | 4 |
| Docs/skills | spec D-A6 text (uncommitted), `D:\Git\skills` agent-creator, `D:\Git\datex-studio-cli\docs\agent-cli.md` (uncommitted) | 5 |

---

### Task 1: The `AnthropicApi` connection type on the server

**Files:** as in the table, Task 1 rows.

**Interfaces:**
- Produces: `ApiConnectionTypeEnum.AnthropicApi = 13`; `AnthropicApiConnection : ApiConnection<AnthropicApiConnectionOptionsConfig>`; `AnthropicApiConnectionOptionsConfig { string ApiKey; string BaseUrl }`; REST `api/anthropicapiconnections` (GET/POST/PUT, same base controller as MsSql); DB row `ApiConnectionTypes (13, 'AnthropicApi')`.

- [ ] **Step 1: Failing domain tests** — append to `DatexApplicationApi.Tests/DomainTests/ApiConnectionSecretsTests.cs`:

```csharp
        [Fact]
        public void AnthropicConfig_ClearSecrets_NullsTheKeyOnly()
        {
            var config = new AnthropicApiConnectionOptionsConfig { ApiKey = "sk-ant-secret", BaseUrl = "https://proxy.example" };

            config.ClearSecrets();

            Assert.Null(config.ApiKey);
            Assert.Equal("https://proxy.example", config.BaseUrl);
        }

        [Fact]
        public void AnthropicConnection_ConnectionString_NeverCarriesTheKey()
        {
            var withDefault = new AnthropicApiConnection(1, "model", new AnthropicApiConnectionOptionsConfig { ApiKey = "sk-ant-secret" });
            var withProxy = new AnthropicApiConnection(1, "model", new AnthropicApiConnectionOptionsConfig { ApiKey = "sk-ant-secret", BaseUrl = "https://proxy.example" });

            Assert.Equal("https://api.anthropic.com", withDefault.ConnectionString);
            Assert.Equal("https://proxy.example", withProxy.ConnectionString);
            Assert.DoesNotContain("sk-ant", withDefault.ConnectionString + withProxy.ConnectionString);
            Assert.Equal(ApiConnectionTypeEnum.AnthropicApi, withDefault.ApiConnectionTypeId);
        }

        [Theory]
        [InlineData("apikey")]
        [InlineData("APIKEY")]
        [InlineData("ApiKey")]
        public void AnthropicPrepareSecretsForUpdate_ListedKeyIsTaken_CaseInsensitively(string listed)
        {
            var dto = new ApiConnectionDto<AnthropicApiConnectionOptionsConfig>
            {
                ChangedSecrets = new List<string> { listed },
                ConnectionOptionsJson = new AnthropicApiConnectionOptionsConfig { ApiKey = "new-key", BaseUrl = "https://b" }
            };
            var stored = new AnthropicApiConnection(1, "model", new AnthropicApiConnectionOptionsConfig { ApiKey = "old-key", BaseUrl = "https://a" });

            dto.PrepareSecretsForUpdate(stored);

            Assert.Equal("new-key", dto.ConnectionOptionsJson.ApiKey);
            Assert.Equal("https://b", dto.ConnectionOptionsJson.BaseUrl); // not a secret: taken verbatim
        }

        [Fact]
        public void AnthropicPrepareSecretsForUpdate_UnlistedKeyKeepsTheStoredOne()
        {
            // Review Focus 1: the Manager sends the form without the key when nobody retyped it.
            var dto = new ApiConnectionDto<AnthropicApiConnectionOptionsConfig>
            {
                ChangedSecrets = new List<string>(),
                ConnectionOptionsJson = new AnthropicApiConnectionOptionsConfig { ApiKey = null, BaseUrl = null }
            };
            var stored = new AnthropicApiConnection(1, "model", new AnthropicApiConnectionOptionsConfig { ApiKey = "old-key" });

            dto.PrepareSecretsForUpdate(stored);

            Assert.Equal("old-key", dto.ConnectionOptionsJson.ApiKey);
        }

        [Theory]
        [InlineData("********", "stored", "stored")]
        [InlineData(null, "stored", "stored")]
        [InlineData("fresh", "stored", "fresh")]
        public void AnthropicMergeMaskedSecrets_ResolvesTheKeyAgainstStored(string incoming, string stored, string expected)
        {
            var config = new AnthropicApiConnectionOptionsConfig { ApiKey = incoming };

            config.MergeMaskedSecrets(new AnthropicApiConnectionOptionsConfig { ApiKey = stored });

            Assert.Equal(expected, config.ApiKey);
        }
```

Read the file's existing `PrepareSecretsForUpdate` tests first: if `PrepareSecretsForUpdate` with an **empty** `ChangedSecrets` does not call `ApplyChangedSecrets` (e.g. it treats empty as "legacy client, merge masks"), adjust the unlisted-key test to the mechanism the existing Sftp/MsSql tests prove, and say so in the report.

- [ ] **Step 2: Run, see them fail to compile**

Run: `cd src/Wavelength/DatexApplicationApi.Tests && dotnet test --filter "FullyQualifiedName~ApiConnectionSecretsTests"`
Expected: build error — `AnthropicApiConnectionOptionsConfig` not found.

- [ ] **Step 3: Enum value** — in `ApiConnectionType.cs` after `MsSql = 12`: `AnthropicApi = 13`.

- [ ] **Step 4: Entity** — create `DatexApplicationApi.Domain/Entities/ApiConnections/AnthropicApiConnection.cs` (match the file's BOM/line endings to `MsSqlApiConnection.cs`):

```csharp
namespace DatexApplicationApi.Domain.Entities.ApiConnections
{
    /// <summary>
    /// The customer's own Anthropic key for an Agent application's agent loop (248960, spec D-A6).
    /// The key is a secret: never returned by the API and never part of <see cref="ApiConnection.ConnectionString"/>.
    /// </summary>
    public class AnthropicApiConnection : ApiConnection<AnthropicApiConnectionOptionsConfig>
    {
        public const string DefaultBaseUrl = "https://api.anthropic.com";

        public AnthropicApiConnection() { }

        public AnthropicApiConnection(
            int organizationId,
            string name,
            AnthropicApiConnectionOptionsConfig connectionOptionsJson) : base(organizationId, name, connectionOptionsJson)
        {
            this.Update(name, connectionOptionsJson);
        }

        public override ApiConnectionTypeEnum ApiConnectionTypeId => ApiConnectionTypeEnum.AnthropicApi;

        public override void Update(string name, AnthropicApiConnectionOptionsConfig connectionOptionsJson)
        {
            base.Update(name, connectionOptionsJson);

            this.ConnectionString = string.IsNullOrWhiteSpace(connectionOptionsJson?.BaseUrl)
                ? DefaultBaseUrl
                : connectionOptionsJson.BaseUrl;
        }
    }

    public class AnthropicApiConnectionOptionsConfig : BaseConnectionOptionsConfig
    {
        public string ApiKey { get; set; }

        /// <summary>Optional Anthropic-compatible endpoint; empty means the public API.</summary>
        public string BaseUrl { get; set; }

        public override void ClearSecrets()
        {
            ApiKey = null;
        }

        public override void MergeMaskedSecrets(BaseConnectionOptionsConfig storedOptions)
        {
            if (storedOptions is not AnthropicApiConnectionOptionsConfig stored)
            {
                return;
            }

            ApiKey = ApiConnectionSecrets.Merge(ApiKey, stored.ApiKey);
        }

        public override void ApplyChangedSecrets(BaseConnectionOptionsConfig storedOptions, ISet<string> changedSecrets)
        {
            if (storedOptions is not AnthropicApiConnectionOptionsConfig stored)
            {
                return;
            }

            if (!changedSecrets.Contains("apikey")) ApiKey = stored.ApiKey;
        }
    }
}
```

Confirm `changedSecrets` is built case-insensitively (the MsSql `"PASSWORD"` test proves it); if not, lowercase before `Contains`.

- [ ] **Step 5: EF** — create `AnthropicApiConnectionEntityConfiguration.cs` (copy of the MsSql one with the type swapped) and add `.HasValue<AnthropicApiConnection>(ApiConnectionTypeEnum.AnthropicApi)` after the MsSql line in `ApiConnectionEntityConfiguration.cs`. Check whether the entity configurations are registered by assembly scan (`ApplyConfigurationsFromAssembly`); if they are listed by hand, add the new one beside MsSql's.

- [ ] **Step 6: Handlers** — add, beside each `…MsSql…` class, the same class for Anthropic:
  `CreateAnthropicApiConnectionCommandHandler` (constructs `new AnthropicApiConnection(command.ApiConnectionDto.OrganizationId ?? _userContext.OrganizationId, command.ApiConnectionDto.Name, command.ApiConnectionDto.ConnectionOptionsJson)`), `UpdateAnthropicApiConnectionCommandHandler` (`apiConnection.Update(Name, ConnectionOptionsJson)`), `GetAnthropicApiConnectionQueryHandler` (returns `new ApiConnectionDto<AnthropicApiConnectionOptionsConfig>(apiConnection, apiConnection.ConnectionOptionsJson)`). Same base classes and constructor parameters as the MsSql ones.

- [ ] **Step 7: Controller** — create `DatexApplicationApi/Controllers/ApiConnections/AnthropicApiConnectionsController.cs`: the MsSql controller with every `MsSql` replaced by `Anthropic` (`[Route("api/[controller]")]` → `api/anthropicapiconnections`).

- [ ] **Step 8: Domain tests pass**

Run: `dotnet test --filter "FullyQualifiedName~ApiConnectionSecretsTests"`
Expected: PASS, including every pre-existing case.

- [ ] **Step 9: Seed script** — create `DatexApplicationApi.Database/Migration/Scripts/Script0101.sql`:

```sql
-- 248960 Agent applications: the customer's own model key (spec D-A6).
-- A new script rather than an addition to Script0100: DbUp records scripts by name, and
-- Script0100 has already run on development databases, so lines added to it would never run.
PRINT 'Inserting AnthropicApi into ApiConnectionTypes'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[ApiConnectionTypes] WHERE [Id] = 13)
BEGIN
    INSERT INTO [dbo].[ApiConnectionTypes] ([Id], [Name])
    VALUES (13, N'AnthropicApi')
END
GO
```

Check `Script0059.sql` for the exact table/column names and copy its column list if it differs. In `DatexApplicationApi.Database.csproj` add, beside the `Script0100.sql` lines, `<None Remove="Migration\Scripts\Script0101.sql" />` and `<EmbeddedResource Include="Migration\Scripts\Script0101.sql" />`.

- [ ] **Step 10: Controller tests (DB-backed)**
  - In `ApiConnectionTypesControllerTests.cs`, change the expected count from 6 to 7 and, if the test lists names, add `AnthropicApi`.
  - Create `AnthropicApiConnectionsControllerTests.cs` by copying `MongoDbApiConnectionsControllerTests.cs` and adapting: create returns the connection with `ConnectionOptionsJson.ApiKey == null` (cleared on the way out) and `ConnectionString == "https://api.anthropic.com"`; get by id returns no key; update with `ChangedSecrets` empty keeps the stored key (assert by reading the entity from `DbContext` after `ChangeTracker.Clear()`); update with `ChangedSecrets = ["apikey"]` replaces it.

Run: `dotnet test --filter "FullyQualifiedName~ApiConnectionTypesControllerTests|FullyQualifiedName~AnthropicApiConnectionsControllerTests"`
Expected: PASS. If the test database is unreachable, record the exact error and run the rest; do not skip silently.

- [ ] **Step 11: Whole suite for regressions**

Run: `dotnet build` at `src/Wavelength` (solution) then `dotnet test` in the Tests project. Record pass/fail counts. For every failure, decide whether it touches API connections or migrations; a failure that does is this task's to fix, and any other one is listed in the report with its first error line as pre-existing (confirm by checking it fails the same way at the task's base commit, using `git worktree add` on a scratch path — never `git stash`).

- [ ] **Step 12: Commit**

```bash
git add src/Wavelength/DatexApplicationApi.Domain src/Wavelength/DatexApplicationApi.Infrastructure src/Wavelength/DatexApplicationApi.Core src/Wavelength/DatexApplicationApi/Controllers/ApiConnections src/Wavelength/DatexApplicationApi.Database src/Wavelength/DatexApplicationApi.Tests
git commit -m "feat(api-connections): AnthropicApi connection type (13) for an Agent application's model key

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Validation — at most one model connection per application

**Files:** `DatexApplicationApi.Infrastructure/Services/ApplicationsValidationService.cs` (beside the "exactly one storage connection" rule), `DatexApplicationApi.Tests/Controllers/ApplicationsValidationAgentTests.cs`, the test data class `TestAgentApplications` (find it with `grep -rn "class TestAgentApplications" src/Wavelength/DatexApplicationApi.Tests`).

**Interfaces:** Consumes `ApiConnectionTypeEnum.AnthropicApi` (Task 1). Produces the error text `"There can be at most one AnthropicApi connection setting: the agent loop uses exactly one model key."`

- [ ] **Step 1: Failing tests** — add to `ApplicationsValidationAgentTests`:

```csharp
        private const string TwoModelConnections = "There can be at most one AnthropicApi connection setting: the agent loop uses exactly one model key.";

        [Fact]
        public async Task App_WithTwoAnthropicSettings_ReportsTwoModelConnections()
        {
            var errors = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppTwoModelKeys);

            Assert.Contains(errors, e => e.message == TwoModelConnections);
        }

        [Fact]
        public async Task AgentApp_WithOneOrNoAnthropicSetting_DoesNotReportIt()
        {
            // Review decision 3: no model key is not an error — lane 1 (fpx from a human's Claude Code) needs none.
            var none = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppFeature);
            var one = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppOneModelKey);

            Assert.DoesNotContain(none, e => e.message == TwoModelConnections);
            Assert.DoesNotContain(one, e => e.message == TwoModelConnections);
        }
```

Add `AgentAppOneModelKey` and `AgentAppTwoModelKeys` to `TestAgentApplications`, following how that class inserts `AgentAppFeature` (same organization, an own flow so "nothing to command" does not fire) and how `currentApplication.Settings` is populated for an app in test data (find an existing app with a MongoDb setting for the storage rule's tests and copy its setting shape; the setting needs `settingType = ApiConnection`, `apiConnectionType = AnthropicApi`, distinct names `modelKey` / `modelKey2`).

- [ ] **Step 2: Run, see them fail**

Run: `dotnet test --filter "FullyQualifiedName~ApplicationsValidationAgentTests"`
Expected: the two-settings test FAILS (no such error); the others pass.

- [ ] **Step 3: The rule** — after the storage-connection block in `ApplicationsValidationService.cs`:

```csharp
                var modelConnectionsCount = (currentApplication.Settings ?? new List<AppConfigSetting>())
                    .Count(s => s.settingType == SettingTypeEnum.ApiConnection && s.apiConnectionType == ApiConnectionTypeEnum.AnthropicApi);

                if (modelConnectionsCount > 1)
                {
                    result.Add(new DesignerConfigError(
                        "There can be at most one AnthropicApi connection setting: the agent loop uses exactly one model key."));
                }
```

The rule is not limited to Agent applications: a second model key is ambiguous in any app, and only Agent apps consume it today.

- [ ] **Step 4: Pass** — rerun the filter: all `ApplicationsValidationAgentTests` PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(validation): at most one AnthropicApi connection setting per application"` + trailer.

---

### Task 3: Manager connection editor and the Studio setting picker

ClientApp root: `src/Wavelength/DatexApplicationApi/ClientApp/projects/datexapplication/src/app/` (below: `app/`).

**Interfaces:** Consumes REST `api/anthropicapiconnections` (Task 1). Produces the TS enum value `ApiConnectionTypeEnum.AnthropicApi = 13`, `IAnthropicApiConnectionOptionsConfig { apiKey: string; baseUrl?: string }`, `AnthropicApiConnectionsService`, `ApiConnectionTypeNom.anthropicApi()`.

- [ ] **Step 1: Enum and types**
  - `app/common/designer-config-service/appconfig/app-config-designer.ts`: `AnthropicApi = 13` after `MsSql = 12`.
  - `app/common/services/api-connection.do.ts`: add `export interface IAnthropicApiConnectionOptionsConfig { apiKey: string; baseUrl?: string; }` beside the MsSql interface; add `{ id: 13, name: 'AnthropicApi' }` at the end of `ApiConnectionTypeNom.values` and an accessor `anthropicApi() { return this.values[6]; }` (verify the index: it must be the position of the new entry).
  - `app/common/services/api-connections.service.ts`: `AnthropicApiConnectionsService` beside `MsSqlApiConnectionsService`, `super(http, apiUrl, 'anthropicapi')`. Confirm the base service builds `${apiUrl}/${segment}connections` (so `'mssql'` → `mssqlconnections` → `MsSqlApiConnectionsController`) and that `'anthropicapi'` yields `anthropicapiconnections`; register it wherever `MsSqlApiConnectionsService` is provided.
  - `app/common/api-connection-control/api-connection-control.component.ts`: in the `label` switch add `case ApiConnectionTypeEnum.AnthropicApi: return 'Anthropic API connection';` before the throwing `default`.

- [ ] **Step 2: Manager editor form**
  - Copy `app/management/api-connection/api-connection-mssql-form/` to `api-connection-anthropic-form/` (component `ApiConnectionAnthropicFormComponent`, selector `app-api-connection-anthropic-form`), keeping only two fields:
    - **API key** — the existing secret field component exactly as the MsSql form uses it for `password`, with `name="apiKey"` and the secret's change name `apikey` (read `markSecretChanged` in `api-connection.do.ts` to see whether the name is lowercased for you).
    - **Base URL** — an optional plain text input bound to `baseUrl`, placeholder `https://api.anthropic.com`, hint "Leave empty for the public Anthropic API".
  - `api-connection-edit.component.ts`: import and inject the service, add the type getter and the `getApiConnectionService` case, exactly as for MsSql. `api-connection-edit.component.html`: add the `<app-api-connection-anthropic-form *ngIf="…anthropicApi…">` block beside the MsSql one.
  - `app/management/management.module.ts`: import and declare the new component beside the MsSql form.
  - Copy (sentence case, no trailing period on labels): labels `API key`, `Base URL`.

- [ ] **Step 3: Studio setting rule**
  - `app/studio/app-config/app-config-setting-edit/app-config-setting-edit.component.ts`: beside the "one MongoDb per app" rule (lines ~35-36), add the same rule for `ApiConnectionTypeEnum.AnthropicApi` so the type is not offered when the app already has one (Review Focus 2).

- [ ] **Step 4: Build**

Run (from the ClientApp root): `npm run build` (use the repo's documented build command from `CLAUDE.md` if it differs).
Expected: build succeeds with no new errors or warnings in the touched files.

- [ ] **Step 5: Commit** — `git commit -m "feat(manager,studio): AnthropicApi connection editor and setting picker"` + trailer.

---

### Task 4: Codegen — the agent loop reads its key from the bound setting

Codegen root: `src/Wavelength/DatexApplicationApi/codegen/src/` (below: `src/`).

**Interfaces:**
- Consumes the enum value 13.
- Produces: `AppModulesInfo.getAnthropicConnectionName(): string | null` (+ the `BaseModuleGenerator` passthrough); a second export in `agent.manifest.ts`: `export const AGENT_MODEL_SETTING: { app: string; name: string } | null`; `createModelClient(credentials: ModelCredentials): ModelClient`; `resolveModelCredentials(settings: any, setting, env): ModelCredentials | null`; error class `ModelNotConfigured`; route behaviour `503 { error, code: 'ModelNotConfigured' }`.

- [ ] **Step 1: Failing mocha specs** (in `src/tests/backend/agent/`)

`credentials.test.ts`:

```ts
import { expect } from 'chai';
import { resolveModelCredentials } from '../../../src/agent/credentials';

describe('agent model credentials', () => {
  const setting = { app: 'app', name: 'modelKey' };
  const settings = { app: { modelKey: { connectionOptionsJson: { apiKey: 'sk-ant-setting', baseUrl: 'https://proxy.example' } } } };

  it('the bound setting wins over the environment', () => {
    expect(resolveModelCredentials(settings, setting, { ANTHROPIC_API_KEY: 'sk-ant-env' }))
      .to.deep.equal({ apiKey: 'sk-ant-setting', baseURL: 'https://proxy.example', source: 'setting' });
  });

  it('falls back to ANTHROPIC_API_KEY (local development) when no setting is baked or bound', () => {
    expect(resolveModelCredentials(settings, null, { ANTHROPIC_API_KEY: 'sk-ant-env' }))
      .to.deep.equal({ apiKey: 'sk-ant-env', baseURL: undefined, source: 'env' });
    expect(resolveModelCredentials({ app: {} }, setting, { ANTHROPIC_API_KEY: 'sk-ant-env', ANTHROPIC_BASE_URL: 'http://localhost:11434' }))
      .to.deep.equal({ apiKey: 'sk-ant-env', baseURL: 'http://localhost:11434', source: 'env' });
  });

  it('a setting with an empty key counts as unbound', () => {
    const empty = { app: { modelKey: { connectionOptionsJson: { apiKey: '' } } } };
    expect(resolveModelCredentials(empty, setting, {})).to.equal(null);
  });

  it('returns null when neither is present', () => {
    expect(resolveModelCredentials({}, setting, {})).to.equal(null);
  });

  it('Review Focus 5: never writes the key into the environment', () => {
    const env: Record<string, string> = {};
    resolveModelCredentials(settings, setting, env);
    expect(env).to.deep.equal({});
    expect(process.env.ANTHROPIC_API_KEY ?? '').to.not.equal('sk-ant-setting');
  });
});
```

`client.test.ts` (new, or extend an existing client test):

```ts
import { expect } from 'chai';
import { createModelClient, resetModelClient, setModelClientCtorForTests } from '../../../src/agent/client';

describe('agent model client', () => {
  const built: any[] = [];
  beforeEach(() => { built.length = 0; resetModelClient(); setModelClientCtorForTests(function (opts: any) { built.push(opts); return { opts }; } as any); });
  afterEach(() => setModelClientCtorForTests(null));

  it('passes the key and base URL to the SDK', () => {
    createModelClient({ apiKey: 'k1', baseURL: 'https://proxy.example', source: 'setting' });
    expect(built).to.deep.equal([{ apiKey: 'k1', baseURL: 'https://proxy.example' }]);
  });

  it('Review Focus 4: a rotated key builds a new client; the same key reuses it', () => {
    const a = createModelClient({ apiKey: 'k1', source: 'setting' });
    const b = createModelClient({ apiKey: 'k1', source: 'setting' });
    const c = createModelClient({ apiKey: 'k2', source: 'setting' });
    expect(a).to.equal(b);
    expect(c).to.not.equal(a);
    expect(built.length).to.equal(2);
  });
});
```

Extend `router.test.ts` with the turn route (follow how the file builds its app/injector; seed `SettingsValuesService` with no model setting and make sure `ANTHROPIC_API_KEY` is unset for the test, restoring it after):

```ts
  it('Review Focus 3: a turn with no model key bound answers 503 ModelNotConfigured', async () => {
    const res = await postTurn({ conversationId: 'c1', messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).to.equal(503);
    expect(res.body.code).to.equal('ModelNotConfigured');
    expect(res.body.error).to.match(/AnthropicApi/);
  });
```

Extend `artifacts.test.ts` (or the agent manifest generator spec): for a fixture with one `settingType: 1, apiConnectionType: 13` setting named `modelKey`, the emitted `agent.manifest.ts` contains `export const AGENT_MODEL_SETTING = {"app":"<main app reference name>","name":"modelKey"}`; for a fixture without one it contains `AGENT_MODEL_SETTING = null`. Add that setting to the test fixture `src/tests/configs/app/settingsInfo.json` using the **current** shape (`settingType`/`apiConnectionType`/`connectionOptionsJson`), as the Studio-side map noted the fixture still uses legacy keys.

Add a `settings.router` spec: an `AnthropicApi` connection entry in `SettingsValuesService` is not present in the `/` response (it is a connection setting; this pins Review Focus 5 for the browser).

- [ ] **Step 2: Build the harness and see them fail**

```bash
cd src/Wavelength/DatexApplicationApi/codegen
npm run build && npm run start:test
cd dist/testapp/backendapp && npm install && npm run test:build && npm run test:run
```

Expected: the new specs fail (`credentials` module missing, `setModelClientCtorForTests` missing, no 503, no `AGENT_MODEL_SETTING`).

- [ ] **Step 3: Enum mirror and connection lookup**
  - `src/designer-configs/app-config-designer.ts`: `AnthropicApi = 13`.
  - `src/generators/app.modules.info.ts`: `getAnthropicConnectionName(): string | null`, modelled on `getMongoDBConnectionName()` (warn on more than one, return the first or null). `src/generators/base.module.generator.ts`: the passthrough beside `getMsSqlConnectionNames`.

- [ ] **Step 4: Bake the setting**
  - `src/handlebars/backend/agent.manifest.hbs`: after `AGENT_MANIFEST`, add
    `export const AGENT_MODEL_SETTING: { app: string; name: string } | null = {{{modelSettingJson}}};`
    and a line in the header comment: which setting holds the model key, baked so the loop needs no type lookup at runtime.
  - `src/generators/backend/agent/agent.manifest.generator.ts`: `emitAgentArtifacts(destinationDirPath, manifest, modelSetting: { app: string; name: string } | null = null)` passes `modelSettingJson: JSON.stringify(manifest === null ? null : modelSetting)`; `src/generators/backend/backend.app.generator.ts` (the `emitAgentArtifacts` call, ~line 232) passes `{ app: this._mainApp.getReferenceName(), name }` when `getAnthropicConnectionName()` returns a name, else null. Non-agent apps keep `null` for both exports.

- [ ] **Step 5: Credentials and client** (`src/backendapp/src/agent/`)

`credentials.ts`:

```ts
/**
 * Where the agent's model key comes from, in order:
 *   1. the AnthropicApi connection setting baked into AGENT_MODEL_SETTING and bound per
 *      environment in the Manager — the production path;
 *   2. ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL in the environment — local development only.
 * The key is read, never written anywhere: it does not enter process.env, so scripts the
 * loop spawns later (Platform C run_script) cannot inherit it.
 */
import { ANTHROPIC_API_KEY_VAR } from './config';

export interface ModelCredentials { apiKey: string; baseURL?: string; source: 'setting' | 'env' }

export function resolveModelCredentials(
  settings: any,
  setting: { app: string; name: string } | null,
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): ModelCredentials | null {
  const options = setting ? settings?.[setting.app]?.[setting.name]?.connectionOptionsJson : undefined;
  if (typeof options?.apiKey === 'string' && options.apiKey.trim() !== '') {
    return { apiKey: options.apiKey, baseURL: options.baseUrl || undefined, source: 'setting' };
  }
  const envKey = env[ANTHROPIC_API_KEY_VAR];
  if (typeof envKey === 'string' && envKey.trim() !== '') {
    return { apiKey: envKey, baseURL: env.ANTHROPIC_BASE_URL || undefined, source: 'env' };
  }
  return null;
}

export class ModelNotConfigured extends Error {
  constructor(settingName: string | null) {
    super(settingName
      ? `No model key: bind an AnthropicApi connection to the '${settingName}' setting for this environment in the Manager`
      : 'No model key: add an AnthropicApi connection setting to this Agent application in Datex Studio and bind it in the Manager');
    this.name = 'ModelNotConfigured';
  }
}
```

Read `SettingsValuesService` first: if settings are stored flat (`settingValues[name]`, as `loadSettings` builds them) and only the generated services read `settingsService.<app>.<name>` through a getter, pass the object shape the getter exposes and adjust the lookup and the test fixture to match. The test asserts the shape you settle on.

`client.ts`: replace the env read with the credentials argument; cache by `apiKey + '\n' + (baseURL ?? '')`; keep the lazy `require('@anthropic-ai/sdk')`; add `setModelClientCtorForTests(ctor | null)` as the testing seam beside `resetModelClient`. Remove the old "SDK resolves its own credentials" path: a bound key or `ANTHROPIC_API_KEY` is now required, and `ModelNotConfigured` is thrown before the SDK is touched when `resolveModelCredentials` returns null.

`router.ts` turn handler: before `runTurn`, `const credentials = resolveModelCredentials(injector.get(SettingsValuesService).SettingsService /* or the shape settled above */, AGENT_MODEL_SETTING, process.env)`; when null, `res.status(503).send({ error: new ModelNotConfigured(AGENT_MODEL_SETTING?.name ?? null).message, code: 'ModelNotConfigured' })` and return; else `client: createModelClient(credentials)`. Log `source` (never the key) in the usage record if the record has a free-form field.

`config.ts`: rewrite the `ANTHROPIC_API_KEY_VAR` comment — it is now the local-development fallback; the deployed path is the bound AnthropicApi setting.

- [ ] **Step 6: All green**

Run the Step 2 block (use `npm run build:noclean && npm run start:test` to keep `node_modules`). Expected: every backend spec passes, the new ones included.

- [ ] **Step 7: The Web output is unchanged except for the one null export**

```bash
cd src/Wavelength/DatexApplicationApi/codegen
CODEGEN_TEST_BACKEND_APP_TYPE=1 npm run start:test
grep -n "AGENT_MODEL_SETTING\|AGENT_MANIFEST" dist/testapp/backendapp/src/agent.manifest.ts
```

Expected: both exports are `null` for the Web shape.

- [ ] **Step 8: Commit** — `git commit -m "feat(codegen): agent loop reads its model key from the bound AnthropicApi setting; 503 ModelNotConfigured"` + trailer.

---

### Task 5: Docs and skills

- [ ] **Step 1: Spec text (uncommitted — Parvan commits specs)** — in the spec, D-A6 row and §4.1 "Model API connection": replace "the container receives it as env (`ANTHROPIC_API_KEY`)" with the settings delivery and its reason (decision 1 above), note `Script0101` (decision 2), and change the validation sentence to decision 3. Do not commit in `D:\Git\248960_agent`.

- [ ] **Step 2: agent-creator skill** — in `D:\Git\skills\skills\datex-studio\agent-creator\SKILL.md`, after step 6's prerequisites link, add a short "Model key (only for the app's own agent loop)" paragraph: create an `AnthropicApi` connection in the Manager (API key, optional base URL), add one connection setting of that type to the Agent application in Studio, bind it for each environment, regenerate. Without it `fpx` works and `dxs agent chat` gets `503 ModelNotConfigured`. Run `npm test` in `D:\Git\skills` (all green), commit there with the trailer.

- [ ] **Step 3: dxs guide (uncommitted)** — the same paragraph in `D:\Git\datex-studio-cli\docs\agent-cli.md` beside the tenant prerequisites, and add `503 ModelNotConfigured` to the `DXS-AGENT-040` cases. Leave it uncommitted: that branch is one squashed commit.

---

### Task 6: Live check (user-assisted)

Needs a real Anthropic key, which only the user has. Steps for the user, recorded in the final report:

1. Manager → API connections → new **AnthropicApi** connection, paste the key.
2. Studio → branch 73444 → Settings → add a connection setting of type AnthropicApi (e.g. `modelKey`).
3. Manager → the environment → bind `modelKey` to the new connection; regenerate and restart the local app.
4. `uv run dxs agent chat --app-url http://localhost:3000 --app-scope api://2e069781-2a39-45cb-b04f-d35a5b12ac4e/.default -m "Which materials are class A in warehouse 1?"` — expect an answer, not `ModelNotConfigured`.
5. Unbind the setting, restart, repeat — expect `503 ModelNotConfigured` naming `modelKey`.
