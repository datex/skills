# Platform B — the AI API connection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Agent application runs its agent loop on the customer's own model key: a new API connection type `AiApi` with a provider choice (Anthropic, OpenAI) is created in the Manager, declared as one setting of an Agent application in Studio, bound per environment, and read by the generated app's agent loop at runtime.

**Architecture:** The type follows the SFTP connection's shape — one type whose options carry a type-id (`ProviderId`, like SFTP's `AuthenticationTypeId`) that the entity and the Manager form branch on — and the MsSql connection's plumbing (entity with secret hooks, EF discriminator, MediatR handlers, controller, DbUp seed). The key reaches the running app the way every connection does — through the platform settings the generated backend loads at startup — and codegen bakes which setting holds it into `agent.manifest.ts`. There is exactly one credential path, in development and production alike: no environment-variable fallback.

**Tech Stack:** ASP.NET Core 9 / EF Core / MediatR / xUnit (DB-backed `DatabaseFixture`), DbUp SQL scripts, Angular 20 (ClientApp `datexapplication` project), Node/TypeScript codegen with mocha backend specs, `@anthropic-ai/sdk`.

**Spec:** `D:\Git\248960_agent\docs\superpowers\specs\2026-09-25-agent-application-type-design.md` — D-A6, §4.1 "Model API connection", §4.2 "Manager", §4.5 "Vendor-abstracted model client", §5 item 5.

## Decisions (Parvan, 2026-10-01) — binding for every task

1. **One `AiApi` type with a provider discriminator**, modelled on SFTP's authentication type: `AiProviderEnum { Anthropic = 1, OpenAI = 2 }` carried as `ProviderId` in the options. The spec's vendor-specific `AnthropicApi` is replaced.
2. **The key travels through the platform settings** (`settings/WithApiConnection` → `loadSettings` → `SettingsValuesService`), like every other connection. **Accepted risk:** that endpoint returns connection secrets to any signed-in user of the organization, and the generated app debug-logs loaded settings; the AI key shares that exposure with Mongo, SFTP and MsSql secrets. Hardening is out of scope and not to be raised as a defect of this plan. What this plan *does* guarantee: the Manager API never returns the key, the key is never put in `ConnectionString`, never copied into `process.env`, never served to the browser (`settings.router.ts` strips connection entries), and never logged by code this plan adds.
3. **No environment fallback.** `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` are no longer read by the agent runtime. Development binds a connection exactly as production does (app-level settings resolve a connection by `apiConnectionName` in `ApplicationsRepository.GetSettingsWithApiConnections`). A turn without a bound key is `503 ModelNotConfigured`.
4. **The seed goes into `Script0100.sql`** (the branch's unreleased script, guarded `IF NOT EXISTS`). Parvan re-runs it on development databases; DbUp will not re-run it on its own.
5. **Only Agent applications may declare an `AiApi` setting**, and at most one. Validation refuses an `AiApi` setting in any other application type and a second one in an Agent application; Studio offers the type only in Agent applications and only once. No model key is not an error (lane 1 — `fpx` from a human's Claude Code — needs none).
6. **OpenAI is selectable now, executable later.** The connection can be created with provider OpenAI; the agent loop answers `503 ModelProviderNotSupported` for it until the OpenAI `ModelClient` lands (spec §4.5 follow-up).

## Global Constraints

- Repo: `D:\Git\248960_agent`, branch `feature/248960_agent_applications`. Commit locally; **never push**. Do not commit plans or specs in this repo. Never stage the untracked `agent-apps-spike-plan.md` or `docs/agent-apps/*` files.
- Every commit message ends with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
- Type value: `AiApi = 13` in .NET, Studio and codegen enums. Provider values `Anthropic = 1`, `OpenAI = 2` everywhere (C# enum, TS enum, JSON `providerId` number).
- Options shape (C# PascalCase, JSON camelCase): `ProviderId` (required), `ApiKey` (secret, required), `BaseUrl` (optional, non-secret, an endpoint compatible with the provider). The secret's `ChangedSecrets` name is `apikey`.
- Default endpoints: Anthropic `https://api.anthropic.com`, OpenAI `https://api.openai.com/v1`.
- "Datex Studio", never "Wavelength", in user-facing text. Copy: sentence case, no trailing period on labels.
- Tests: .NET `cd src/Wavelength/DatexApplicationApi.Tests && dotnet test --filter <name>` (DB-backed tests use the local test database; Platform A's `ApplicationsValidationAgentTests` run on this machine). Codegen: see Task 4. ClientApp: `npm run build`; do not author `.spec.ts` (component specs are not maintained in this ClientApp).

## Review Focus

1. **A key edited in the Manager without being retyped** — saving keeps the stored key; only a key listed in `ChangedSecrets` replaces it. Pinned in Task 1.
2. **A connection saved without a provider** — refused with a validation error naming `ProviderId`, never defaulted to a vendor. Pinned in Task 1.
3. **An `AiApi` setting in a Web/API app, or two in an Agent app** — validation reports each; Studio does not offer the type there. Pinned in Task 2 (tests) and Task 3 (picker rule).
4. **A deployed Agent app with no bound key, or with an OpenAI key** — `POST /api/$agent/turn` answers `503` with `ModelNotConfigured` / `ModelProviderNotSupported` naming the setting, not a generic 500 — and `ANTHROPIC_API_KEY` in the process environment changes nothing. Pinned in Task 4.
5. **A key rotated while the app runs** — the next turn after settings reload uses the new key; a model client is cached per (provider, key, base URL), never across a change. Pinned in Task 4.

---

## File Structure

| Area | Path (under `src/Wavelength/`) | Task |
|---|---|---|
| Domain | `DatexApplicationApi.Domain/Entities/ApiConnections/ApiConnectionType.cs`, new `AiApiConnection.cs` | 1 |
| EF | `DatexApplicationApi.Infrastructure/Data/EFConfigurations/ApiConnections/ApiConnectionEntityConfiguration.cs`, new `AiApiConnectionEntityConfiguration.cs` | 1 |
| Handlers | `DatexApplicationApi.Core/ApiConnections/Commands/{Create,Update}ApiConnectionCommandHandler.cs`, `…/Queries/GetApiConnectionQueryHandler.cs` | 1 |
| Controller | new `DatexApplicationApi/Controllers/ApiConnections/AiApiConnectionsController.cs` | 1 |
| DB | `DatexApplicationApi.Database/Migration/Scripts/Script0100.sql` | 1 |
| Tests | `DatexApplicationApi.Tests/DomainTests/ApiConnectionSecretsTests.cs`, `…/Controllers/ApiConnectionTypesControllerTests.cs`, new `…/Controllers/AiApiConnectionsControllerTests.cs` | 1 |
| Validation | `DatexApplicationApi.Infrastructure/Services/ApplicationsValidationService.cs`, `DatexApplicationApi.Tests/Controllers/ApplicationsValidationAgentTests.cs` (+ test data) | 2 |
| Manager + Studio | ClientApp `projects/datexapplication/src/app/…` | 3 |
| Codegen | `DatexApplicationApi/codegen/src/…` | 4 |
| Docs/skills | spec (uncommitted), `D:\Git\skills` agent-creator, `D:\Git\datex-studio-cli\docs\agent-cli.md` (uncommitted) | 5 |

---

### Task 1: The `AiApi` connection type on the server

**Interfaces — produces:** `ApiConnectionTypeEnum.AiApi = 13`; `AiProviderEnum { Anthropic = 1, OpenAI = 2 }`; `AiApiConnection : ApiConnection<AiApiConnectionOptionsConfig>` with `public static string DefaultBaseUrl(AiProviderEnum provider)`; `AiApiConnectionOptionsConfig { AiProviderEnum? ProviderId; string ApiKey; string BaseUrl }`; REST `api/aiapiconnections` (GET/POST/PUT, same base controller as MsSql); DB row `ApiConnectionTypes (13, 'AiApi')`.

- [ ] **Step 1: Failing domain tests** — append to `DatexApplicationApi.Tests/DomainTests/ApiConnectionSecretsTests.cs`:

```csharp
        private static AiApiConnectionOptionsConfig Ai(AiProviderEnum? provider, string key, string baseUrl = null) =>
            new AiApiConnectionOptionsConfig { ProviderId = provider, ApiKey = key, BaseUrl = baseUrl };

        [Fact]
        public void AiConfig_ClearSecrets_NullsTheKeyOnly()
        {
            var config = Ai(AiProviderEnum.Anthropic, "sk-ant-secret", "https://proxy.example");

            config.ClearSecrets();

            Assert.Null(config.ApiKey);
            Assert.Equal(AiProviderEnum.Anthropic, config.ProviderId);
            Assert.Equal("https://proxy.example", config.BaseUrl);
        }

        [Theory]
        [InlineData(AiProviderEnum.Anthropic, null, "https://api.anthropic.com")]
        [InlineData(AiProviderEnum.OpenAI, null, "https://api.openai.com/v1")]
        [InlineData(AiProviderEnum.Anthropic, "https://proxy.example", "https://proxy.example")]
        public void AiConnection_ConnectionString_IsTheEndpointNeverTheKey(AiProviderEnum provider, string baseUrl, string expected)
        {
            var connection = new AiApiConnection(1, "model", Ai(provider, "sk-secret-123", baseUrl));

            Assert.Equal(expected, connection.ConnectionString);
            Assert.DoesNotContain("sk-secret", connection.ConnectionString);
            Assert.Equal(ApiConnectionTypeEnum.AiApi, connection.ApiConnectionTypeId);
        }

        [Fact]
        public void AiConnection_WithoutAProvider_IsRefused()
        {
            // Review Focus 2: never default to a vendor.
            var ex = Assert.ThrowsAny<Exception>(() => new AiApiConnection(1, "model", Ai(null, "k")));
            Assert.Contains("ProviderId", ex.Message);
        }

        [Theory]
        [InlineData("apikey")]
        [InlineData("APIKEY")]
        [InlineData("ApiKey")]
        public void AiPrepareSecretsForUpdate_ListedKeyIsTaken(string listed)
        {
            var dto = new ApiConnectionDto<AiApiConnectionOptionsConfig>
            {
                ChangedSecrets = new List<string> { listed },
                ConnectionOptionsJson = Ai(AiProviderEnum.OpenAI, "new-key", "https://b")
            };
            var stored = new AiApiConnection(1, "model", Ai(AiProviderEnum.Anthropic, "old-key", "https://a"));

            dto.PrepareSecretsForUpdate(stored);

            Assert.Equal("new-key", dto.ConnectionOptionsJson.ApiKey);
            Assert.Equal(AiProviderEnum.OpenAI, dto.ConnectionOptionsJson.ProviderId); // not a secret: taken verbatim
            Assert.Equal("https://b", dto.ConnectionOptionsJson.BaseUrl);
        }

        [Fact]
        public void AiPrepareSecretsForUpdate_UnlistedKeyKeepsTheStoredOne()
        {
            // Review Focus 1.
            var dto = new ApiConnectionDto<AiApiConnectionOptionsConfig>
            {
                ChangedSecrets = new List<string>(),
                ConnectionOptionsJson = Ai(AiProviderEnum.Anthropic, null)
            };
            var stored = new AiApiConnection(1, "model", Ai(AiProviderEnum.Anthropic, "old-key"));

            dto.PrepareSecretsForUpdate(stored);

            Assert.Equal("old-key", dto.ConnectionOptionsJson.ApiKey);
        }

        [Theory]
        [InlineData("********", "stored", "stored")]
        [InlineData(null, "stored", "stored")]
        [InlineData("fresh", "stored", "fresh")]
        public void AiMergeMaskedSecrets_ResolvesTheKeyAgainstStored(string incoming, string stored, string expected)
        {
            var config = Ai(AiProviderEnum.Anthropic, incoming);

            config.MergeMaskedSecrets(Ai(AiProviderEnum.Anthropic, stored));

            Assert.Equal(expected, config.ApiKey);
        }
```

Read the file's existing `PrepareSecretsForUpdate` tests first: if an **empty** `ChangedSecrets` takes a different code path (e.g. legacy mask merge), adapt the unlisted-key test to the mechanism the SFTP/MsSql tests prove, and say so in the report. For the missing-provider test, use the same exception type the domain already throws for invalid connection input (search `throw new` in `DatexApplicationApi.Domain/Entities/ApiConnections/`); if there is none, throw `ArgumentException` with a message naming `ProviderId`, and tighten the test to that type.

- [ ] **Step 2: Run, see them fail to compile** — `dotnet test --filter "FullyQualifiedName~ApiConnectionSecretsTests"` → build error, `AiApiConnectionOptionsConfig` not found.

- [ ] **Step 3: Enum value** — `ApiConnectionType.cs`: `AiApi = 13` after `MsSql = 12`.

- [ ] **Step 4: Entity** — create `DatexApplicationApi.Domain/Entities/ApiConnections/AiApiConnection.cs` (match BOM/line endings to `SftpApiConnection.cs`):

```csharp
namespace DatexApplicationApi.Domain.Entities.ApiConnections
{
    /// <summary>
    /// The customer's own model key for an Agent application's agent loop (248960, spec D-A6).
    /// One type for every vendor, branched on <see cref="AiApiConnectionOptionsConfig.ProviderId"/>
    /// the way SFTP branches on its authentication type. The key is a secret: never returned by
    /// the API and never part of <see cref="ApiConnection.ConnectionString"/>.
    /// </summary>
    public class AiApiConnection : ApiConnection<AiApiConnectionOptionsConfig>
    {
        public AiApiConnection() { }

        public AiApiConnection(
            int organizationId,
            string name,
            AiApiConnectionOptionsConfig connectionOptionsJson) : base(organizationId, name, connectionOptionsJson)
        {
            this.Update(name, connectionOptionsJson);
        }

        public override ApiConnectionTypeEnum ApiConnectionTypeId => ApiConnectionTypeEnum.AiApi;

        public static string DefaultBaseUrl(AiProviderEnum provider) => provider switch
        {
            AiProviderEnum.Anthropic => "https://api.anthropic.com",
            AiProviderEnum.OpenAI => "https://api.openai.com/v1",
            _ => throw new ArgumentOutOfRangeException(nameof(provider), provider, "Unknown AI provider")
        };

        public override void Update(string name, AiApiConnectionOptionsConfig connectionOptionsJson)
        {
            if (connectionOptionsJson?.ProviderId is not AiProviderEnum provider)
            {
                throw new ArgumentException("An AI API connection needs a ProviderId (Anthropic or OpenAI)", nameof(connectionOptionsJson));
            }

            base.Update(name, connectionOptionsJson);

            this.ConnectionString = string.IsNullOrWhiteSpace(connectionOptionsJson.BaseUrl)
                ? DefaultBaseUrl(provider)
                : connectionOptionsJson.BaseUrl;
        }
    }

    public enum AiProviderEnum
    {
        Anthropic = 1,
        OpenAI = 2
    }

    public class AiApiConnectionOptionsConfig : BaseConnectionOptionsConfig
    {
        public AiProviderEnum? ProviderId { get; set; }

        public string ApiKey { get; set; }

        /// <summary>Optional endpoint compatible with the provider; empty means the provider's public API.</summary>
        public string BaseUrl { get; set; }

        public override void ClearSecrets()
        {
            ApiKey = null;
        }

        public override void MergeMaskedSecrets(BaseConnectionOptionsConfig storedOptions)
        {
            if (storedOptions is not AiApiConnectionOptionsConfig stored)
            {
                return;
            }

            ApiKey = ApiConnectionSecrets.Merge(ApiKey, stored.ApiKey);
        }

        public override void ApplyChangedSecrets(BaseConnectionOptionsConfig storedOptions, ISet<string> changedSecrets)
        {
            if (storedOptions is not AiApiConnectionOptionsConfig stored)
            {
                return;
            }

            if (!changedSecrets.Contains("apikey")) ApiKey = stored.ApiKey;
        }
    }
}
```

Replace `ArgumentException` with the domain's own validation exception if Step 1 found one. Confirm `changedSecrets` is case-insensitive (the MsSql `"PASSWORD"` test proves it). Check how `SftpAuthenticationTypeEnum` is serialized into `ConnectionOptionsJson` (number vs string) — `AiProviderEnum` must serialize the same way, and Task 4 reads it as a number.

- [ ] **Step 5: EF** — `AiApiConnectionEntityConfiguration.cs` (copy of the MsSql one, type swapped) and `.HasValue<AiApiConnection>(ApiConnectionTypeEnum.AiApi)` after the MsSql line in `ApiConnectionEntityConfiguration.cs`. If entity configurations are registered by hand rather than `ApplyConfigurationsFromAssembly`, register the new one beside MsSql's.

- [ ] **Step 6: Handlers** — beside each `…MsSql…` class add `CreateAiApiConnectionCommandHandler` (`new AiApiConnection(command.ApiConnectionDto.OrganizationId ?? _userContext.OrganizationId, command.ApiConnectionDto.Name, command.ApiConnectionDto.ConnectionOptionsJson)`), `UpdateAiApiConnectionCommandHandler` (`apiConnection.Update(Name, ConnectionOptionsJson)`), `GetAiApiConnectionQueryHandler` (`new ApiConnectionDto<AiApiConnectionOptionsConfig>(apiConnection, apiConnection.ConnectionOptionsJson)`). Same base classes and constructors as MsSql. Check how the create path reports an `ArgumentException` (or the domain validation exception) to the caller — it must surface as a 400, not a 500; if the MsSql path has no such case, map it the way other domain validation errors are mapped (find the exception filter/middleware) and cover it in Step 10.

- [ ] **Step 7: Controller** — `DatexApplicationApi/Controllers/ApiConnections/AiApiConnectionsController.cs`: the MsSql controller with `MsSql` → `AiApi` (route `api/aiapiconnections`).

- [ ] **Step 8: Domain tests pass** — `dotnet test --filter "FullyQualifiedName~ApiConnectionSecretsTests"` → PASS, all pre-existing cases included.

- [ ] **Step 9: Seed** — append to `DatexApplicationApi.Database/Migration/Scripts/Script0100.sql` (copy the table/column names from `Script0059.sql`):

```sql

PRINT 'Inserting AiApi into ApiConnectionTypes'
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[ApiConnectionTypes] WHERE [Id] = 13)
BEGIN
    INSERT INTO [dbo].[ApiConnectionTypes] ([Id], [Name])
    VALUES (13, N'AiApi')
END
GO
```

Update the script's header comment to list the new row. The test database is seeded from the migration scripts; if it was already migrated past `Script0100`, the DB-backed tests in Step 10 will not see row 13 — say so in the report with the exact failure, and Parvan re-runs the script.

- [ ] **Step 10: Controller tests (DB-backed)**
  - `ApiConnectionTypesControllerTests.cs`: expected count 6 → 7 (add `AiApi` if names are listed).
  - New `AiApiConnectionsControllerTests.cs`, modelled on `MongoDbApiConnectionsControllerTests.cs`: create (Anthropic) returns no key and `ConnectionString == "https://api.anthropic.com"`; get by id returns no key; update with empty `ChangedSecrets` keeps the stored key (read the entity back after `ChangeTracker.Clear()`); update with `["apikey"]` replaces it; create without `providerId` is rejected (400 or the domain exception the test infrastructure surfaces — assert the type, not just "throws").

Run: `dotnet test --filter "FullyQualifiedName~ApiConnectionTypesControllerTests|FullyQualifiedName~AiApiConnectionsControllerTests"` → PASS.

- [ ] **Step 11: Whole suite** — `dotnet build` (solution at `src/Wavelength`), then `dotnet test` in the Tests project. Record counts. A failure that touches API connections or migrations is this task's to fix; any other is listed with its first error line as pre-existing, confirmed by running it at the task's base commit in a scratch `git worktree add` (never `git stash`).

- [ ] **Step 12: Commit** — stage the Domain, Infrastructure, Core, Controllers/ApiConnections, Database and Tests changes; `git commit -m "feat(api-connections): AiApi connection type (13) with an Anthropic/OpenAI provider"` + trailer.

---

### Task 2: Validation — AI connections only in Agent applications, at most one

**Files:** `ApplicationsValidationService.cs` (beside the storage-connection rule), `ApplicationsValidationAgentTests.cs`, test data class `TestAgentApplications` (`grep -rn "class TestAgentApplications" src/Wavelength/DatexApplicationApi.Tests`).

**Interfaces:** Produces two error texts, used verbatim by tests:
- `"Only Agent applications can declare an AiApi connection setting."`
- `"There can be at most one AiApi connection setting: the agent loop uses exactly one model key."`

- [ ] **Step 1: Failing tests** — add to `ApplicationsValidationAgentTests`:

```csharp
        private const string AiOnlyInAgentApps = "Only Agent applications can declare an AiApi connection setting.";
        private const string AtMostOneAi = "There can be at most one AiApi connection setting: the agent loop uses exactly one model key.";

        [Fact]
        public async Task AgentApp_WithTwoAiSettings_ReportsAtMostOne()
        {
            var errors = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppTwoModelKeys);

            Assert.Contains(errors, e => e.message == AtMostOneAi);
            Assert.DoesNotContain(errors, e => e.message == AiOnlyInAgentApps);
        }

        [Fact]
        public async Task AgentApp_WithOneOrNoAiSetting_ReportsNeither()
        {
            var none = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppFeature);
            var one = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.AgentAppOneModelKey);

            Assert.DoesNotContain(none, e => e.message == AtMostOneAi || e.message == AiOnlyInAgentApps);
            Assert.DoesNotContain(one, e => e.message == AtMostOneAi || e.message == AiOnlyInAgentApps);
        }

        [Fact]
        public async Task WebApp_WithAnAiSetting_ReportsOnlyInAgentApps()
        {
            var errors = await TestScope.ApplicationsController.ValidateApplication(TestAgentApplications.WebAppWithModelKey);

            Assert.Contains(errors, e => e.message == AiOnlyInAgentApps);
        }
```

Add `AgentAppOneModelKey`, `AgentAppTwoModelKeys` (Agent apps with an own flow, so "nothing to command" does not fire) and `WebAppWithModelKey` (a Web app, type 1) to `TestAgentApplications`, following how it inserts `AgentAppFeature` and how existing test data gives an app a MongoDb connection setting (copy that setting shape with `settingType = ApiConnection`, `apiConnectionType = AiApi`, names `modelKey` / `modelKey2`). Use ids in the class's existing range and check they are free.

- [ ] **Step 2: See them fail** — `dotnet test --filter "FullyQualifiedName~ApplicationsValidationAgentTests"` → the two-settings and Web-app tests FAIL.

- [ ] **Step 3: The rules** — after the storage-connection block:

```csharp
                var aiConnectionsCount = (currentApplication.Settings ?? new List<AppConfigSetting>())
                    .Count(s => s.settingType == SettingTypeEnum.ApiConnection && s.apiConnectionType == ApiConnectionTypeEnum.AiApi);

                if (aiConnectionsCount > 0 && !ApplicationDefinitionType.IsAgent(applicationDefinitionTypeId))
                {
                    result.Add(new DesignerConfigError("Only Agent applications can declare an AiApi connection setting."));
                }
                else if (aiConnectionsCount > 1)
                {
                    result.Add(new DesignerConfigError(
                        "There can be at most one AiApi connection setting: the agent loop uses exactly one model key."));
                }
```

- [ ] **Step 4: Pass** — rerun the filter; every `ApplicationsValidationAgentTests` test passes.

- [ ] **Step 5: Commit** — `git commit -m "feat(validation): AiApi connection settings only in Agent applications, at most one"` + trailer.

---

### Task 3: Manager connection editor and the Studio setting picker

ClientApp app root: `src/Wavelength/DatexApplicationApi/ClientApp/projects/datexapplication/src/app/` (`app/` below).

**Interfaces:** Consumes REST `api/aiapiconnections`. Produces TS `ApiConnectionTypeEnum.AiApi = 13`, `AiProviderEnum { Anthropic = 1, OpenAI = 2 }`, `IAiApiConnectionOptionsConfig { providerId: AiProviderEnum; apiKey: string; baseUrl?: string }`, `AiApiConnectionsService`, `ApiConnectionTypeNom.aiApi()`.

- [ ] **Step 1: Enum and types**
  - `app/common/designer-config-service/appconfig/app-config-designer.ts`: `AiApi = 13`.
  - `app/common/services/api-connection.do.ts`: `export enum AiProviderEnum { Anthropic = 1, OpenAI = 2 }` and the `IAiApiConnectionOptionsConfig` interface beside the MsSql one; `{ id: 13, name: 'AiApi' }` at the end of `ApiConnectionTypeNom.values` and an `aiApi()` accessor returning that entry (verify its index). If the SFTP authentication types are exposed as a nom (`authenticationTypeByPassword` etc.), add an `AiProviderNom` the same way with `{ id: 1, name: 'Anthropic' }, { id: 2, name: 'OpenAI' }`.
  - `app/common/services/api-connections.service.ts`: `AiApiConnectionsService` beside `MsSqlApiConnectionsService`, `super(http, apiUrl, 'aiapi')`. Confirm the base service maps `'mssql'` to `mssqlconnections` and therefore `'aiapi'` to `aiapiconnections`; provide it wherever the MsSql service is provided.
  - `app/common/api-connection-control/api-connection-control.component.ts`: `case ApiConnectionTypeEnum.AiApi: return 'AI API connection';` before the throwing `default`.

- [ ] **Step 2: Manager editor form** — copy `app/management/api-connection/api-connection-sftp-form/` to `api-connection-ai-form/` (`ApiConnectionAiFormComponent`, selector `app-api-connection-ai-form`), and reduce it to:
  - **Provider** — a required `mat-select` bound to `connectionOptionsJson.providerId` with Anthropic and OpenAI (the SFTP form's authentication-type select is the pattern, including its change handler if it resets dependent fields).
  - **API key** — the existing secret field component as the SFTP/MsSql forms use it, `name="apiKey"`, change name `apikey` (read `markSecretChanged` to see whether it lowercases).
  - **Base URL** — optional text input bound to `baseUrl`; its placeholder follows the provider (`https://api.anthropic.com` / `https://api.openai.com/v1`); hint "Leave empty for the provider's public API".
  - Labels: `Provider`, `API key`, `Base URL`.
  - `api-connection-edit.component.ts` / `.html`: inject the service, type getter, `getApiConnectionService` case, and the `<app-api-connection-ai-form *ngIf=…>` block, as for MsSql. `app/management/management.module.ts`: import and declare the component.

- [ ] **Step 3: Studio setting picker** — `app/studio/app-config/app-config-setting-edit/app-config-setting-edit.component.ts`: the type list is built from `Object.keys(ApiConnectionTypeEnum)`. Remove `AiApi` from it unless the application being edited is an Agent application (find how the component or its parent knows the application's `applicationDefinitionTypeId`; the designer exposes `isAgent`), and apply the "one MongoDb per app" rule to `AiApi` too (Review Focus 3).

- [ ] **Step 4: Build** — `npm run build` from the ClientApp root (or the build command `CLAUDE.md` names). Expected: success, no new errors or warnings in touched files.

- [ ] **Step 5: Commit** — `git commit -m "feat(manager,studio): AI API connection editor (Anthropic/OpenAI) and Agent-only setting picker"` + trailer.

---

### Task 4: Codegen — the agent loop reads its key from the bound setting, and only from there

Codegen root `src/Wavelength/DatexApplicationApi/codegen/src/` (`src/` below).

**Interfaces — produces:** `AppModulesInfo.getAiConnectionName(): string | null` (+ `BaseModuleGenerator` passthrough); in `agent.manifest.ts` a second export `AGENT_MODEL_SETTING: { app: string; name: string } | null`; `resolveModelCredentials(settings, setting): ModelCredentials | null` with `ModelCredentials { provider: 'anthropic' | 'openai'; apiKey: string; baseURL?: string }`; `createModelClient(credentials): ModelClient`; errors `ModelNotConfigured`, `ModelProviderNotSupported` (both carry `code`); route answer `503 { error, code }`.

- [ ] **Step 1: Failing mocha specs** (`src/tests/backend/agent/`)

`credentials.test.ts`:

```ts
import { expect } from 'chai';
import { resolveModelCredentials } from '../../../src/agent/credentials';

describe('agent model credentials', () => {
  const setting = { app: 'app', name: 'modelKey' };
  const bound = (options: any) => ({ app: { modelKey: { connectionOptionsJson: options } } });

  it('reads provider, key and base URL from the bound setting', () => {
    expect(resolveModelCredentials(bound({ providerId: 1, apiKey: 'sk-ant', baseUrl: 'https://proxy.example' }), setting))
      .to.deep.equal({ provider: 'anthropic', apiKey: 'sk-ant', baseURL: 'https://proxy.example' });
    expect(resolveModelCredentials(bound({ providerId: 2, apiKey: 'sk-oai' }), setting))
      .to.deep.equal({ provider: 'openai', apiKey: 'sk-oai', baseURL: undefined });
  });

  it('is null when no setting is baked, none is bound, or the key is empty', () => {
    expect(resolveModelCredentials(bound({ providerId: 1, apiKey: 'k' }), null)).to.equal(null);
    expect(resolveModelCredentials({ app: {} }, setting)).to.equal(null);
    expect(resolveModelCredentials(bound({ providerId: 1, apiKey: '  ' }), setting)).to.equal(null);
  });

  it('an unknown provider id is not guessed', () => {
    expect(() => resolveModelCredentials(bound({ providerId: 9, apiKey: 'k' }), setting)).to.throw(/provider/i);
  });

  it('Review Focus 4: ANTHROPIC_API_KEY in the environment is never read', () => {
    const before = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'sk-from-env';
    try {
      expect(resolveModelCredentials({ app: {} }, setting)).to.equal(null);
    } finally {
      if (before === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = before;
    }
  });
});
```

`client.test.ts`:

```ts
import { expect } from 'chai';
import { createModelClient, resetModelClient, setModelClientCtorForTests } from '../../../src/agent/client';
import { ModelProviderNotSupported } from '../../../src/agent/credentials';

describe('agent model client', () => {
  const built: any[] = [];
  beforeEach(() => { built.length = 0; resetModelClient(); setModelClientCtorForTests(function (opts: any) { built.push(opts); return { opts }; } as any); });
  afterEach(() => setModelClientCtorForTests(null));

  it('passes only the key and base URL to the SDK', () => {
    createModelClient({ provider: 'anthropic', apiKey: 'k1', baseURL: 'https://proxy.example' });
    expect(built).to.deep.equal([{ apiKey: 'k1', baseURL: 'https://proxy.example' }]);
  });

  it('Review Focus 5: a rotated key builds a new client; the same key reuses it', () => {
    const a = createModelClient({ provider: 'anthropic', apiKey: 'k1' });
    const b = createModelClient({ provider: 'anthropic', apiKey: 'k1' });
    const c = createModelClient({ provider: 'anthropic', apiKey: 'k2' });
    expect(a).to.equal(b);
    expect(c).to.not.equal(a);
    expect(built.length).to.equal(2);
  });

  it('OpenAI is refused until its ModelClient ships', () => {
    expect(() => createModelClient({ provider: 'openai', apiKey: 'k' })).to.throw(ModelProviderNotSupported);
  });
});
```

Extend `router.test.ts` (build the app/injector the way the file already does; seed `SettingsValuesService` per case):

```ts
  it('Review Focus 4: no bound key answers 503 ModelNotConfigured naming the setting', async () => {
    const res = await postTurn({ settings: {}, body: { conversationId: 'c1', messages: [{ role: 'user', content: 'hi' }] } });
    expect(res.status).to.equal(503);
    expect(res.body.code).to.equal('ModelNotConfigured');
    expect(res.body.error).to.match(/AiApi/);
  });

  it('an OpenAI key answers 503 ModelProviderNotSupported', async () => {
    const res = await postTurn({ settings: { app: { modelKey: { connectionOptionsJson: { providerId: 2, apiKey: 'k' } } } }, body: { conversationId: 'c1', messages: [{ role: 'user', content: 'hi' }] } });
    expect(res.status).to.equal(503);
    expect(res.body.code).to.equal('ModelProviderNotSupported');
  });
```

(`postTurn` is a small helper you add in the spec; it must run against a baked `AGENT_MODEL_SETTING = { app: 'app', name: 'modelKey' }` — the fixture app gets that setting below.)

Extend `artifacts.test.ts` (or the manifest generator spec): with one `settingType: 1, apiConnectionType: 13` setting named `modelKey`, `agent.manifest.ts` contains `AGENT_MODEL_SETTING` equal to `{"app":"<main app reference name>","name":"modelKey"}`; without one, `AGENT_MODEL_SETTING = null`. Add that setting to `src/tests/configs/app/settingsInfo.json` in the **current** shape (`settingType`/`apiConnectionType`/`connectionOptionsJson`, no real key — use `"apiKey": "test-not-a-key"`).

Add a `settings.router` spec: an AiApi connection entry in `SettingsValuesService` is absent from the `/` response.

- [ ] **Step 2: See them fail**

```bash
cd src/Wavelength/DatexApplicationApi/codegen
npm run build && npm run start:test
cd dist/testapp/backendapp && npm install && npm run test:build && npm run test:run
```

Expected: the new specs fail (missing module/exports, no 503s, no `AGENT_MODEL_SETTING`).

- [ ] **Step 3: Enum mirror and lookup** — `src/designer-configs/app-config-designer.ts`: `AiApi = 13`. `src/generators/app.modules.info.ts`: `getAiConnectionName(): string | null` modelled on `getMongoDBConnectionName()` (warn on more than one; validation already refuses it). `src/generators/base.module.generator.ts`: the passthrough.

- [ ] **Step 4: Bake the setting** — `src/handlebars/backend/agent.manifest.hbs`: after `AGENT_MANIFEST` add `export const AGENT_MODEL_SETTING: { app: string; name: string } | null = {{{modelSettingJson}}};` and one header-comment line (which setting holds the model key; baked so the loop needs no type lookup at runtime). `src/generators/backend/agent/agent.manifest.generator.ts`: `emitAgentArtifacts(destinationDirPath, manifest, modelSetting: { app: string; name: string } | null = null)` passes `modelSettingJson: JSON.stringify(manifest === null ? null : modelSetting)`. `src/generators/backend/backend.app.generator.ts` (the `emitAgentArtifacts` call): pass `{ app: this._mainApp.getReferenceName(), name }` when `getAiConnectionName()` returns a name, else `null`.

- [ ] **Step 5: Credentials, client, route** (`src/backendapp/src/agent/`)

`credentials.ts`:

```ts
/**
 * The agent's model key comes from one place only: the AiApi connection setting baked into
 * AGENT_MODEL_SETTING and bound per environment in the Manager — in development and in
 * production alike (decision 3: no environment fallback). The key is read, never copied
 * into process.env and never logged.
 */

export type ModelProvider = 'anthropic' | 'openai';
export interface ModelCredentials { provider: ModelProvider; apiKey: string; baseURL?: string }

const PROVIDERS: Record<number, ModelProvider> = { 1: 'anthropic', 2: 'openai' };

export class ModelNotConfigured extends Error {
  readonly code = 'ModelNotConfigured';
  constructor(settingName: string | null) {
    super(settingName
      ? `No model key: bind an AiApi connection to the '${settingName}' setting for this environment in the Manager`
      : 'No model key: add an AiApi connection setting to this Agent application in Datex Studio and bind it in the Manager');
    this.name = 'ModelNotConfigured';
  }
}

export class ModelProviderNotSupported extends Error {
  readonly code = 'ModelProviderNotSupported';
  constructor(provider: string) {
    super(`The bound AiApi connection's provider '${provider}' is not supported by this agent runtime yet`);
    this.name = 'ModelProviderNotSupported';
  }
}

export function resolveModelCredentials(settings: any, setting: { app: string; name: string } | null): ModelCredentials | null {
  if (!setting) return null;
  const options = settings?.[setting.app]?.[setting.name]?.connectionOptionsJson;
  if (typeof options?.apiKey !== 'string' || options.apiKey.trim() === '') return null;
  const provider = PROVIDERS[options.providerId];
  if (!provider) throw new Error(`AiApi connection '${setting.name}' has an unknown provider id ${options.providerId}`);
  return { provider, apiKey: options.apiKey, baseURL: options.baseUrl || undefined };
}
```

Read `SettingsValuesService` first: `loadSettings` stores settings keyed by setting name, while generated services read `settingsService.<app>.<name>`. Use the object shape that `settingsService.<app>.<name>` actually resolves through, adjust the lookup and the specs' fixtures to it, and say which in the report.

`client.ts`: drop the environment read and the "SDK resolves its own credentials" path entirely. `createModelClient(credentials)`: `openai` → throw `new ModelProviderNotSupported('openai')`; `anthropic` → lazily `require('@anthropic-ai/sdk')`, build with `{ apiKey, baseURL }` (omit `baseURL` when undefined), cache by `provider + '\n' + apiKey + '\n' + (baseURL ?? '')`. Add `setModelClientCtorForTests(ctor | null)` beside `resetModelClient`.

`config.ts`: delete `ANTHROPIC_API_KEY_VAR` and its comment; grep the agent runtime for `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` and remove every read (leave `AGENT_MODEL` — it chooses the model, not a credential). Update `docs/agent-apps/step3-http-runbook.md` only if it is tracked; it is untracked on this branch, so leave it.

`router.ts` turn handler, before `runTurn`:

```ts
    let client;
    try {
      const credentials = resolveModelCredentials(injector.get(SettingsValuesService).SettingsService, AGENT_MODEL_SETTING);
      if (credentials === null) throw new ModelNotConfigured(AGENT_MODEL_SETTING?.name ?? null);
      client = createModelClient(credentials);
    } catch (err: any) {
      if (err instanceof ModelNotConfigured || err instanceof ModelProviderNotSupported) {
        res.status(503).send({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
```

(adapt `.SettingsService` to the shape settled above), then pass `client` to `runTurn`.

- [ ] **Step 6: All green** — rerun the Step 2 block with `npm run build:noclean && npm run start:test`. Expected: every backend spec passes.

- [ ] **Step 7: Web output** — `CODEGEN_TEST_BACKEND_APP_TYPE=1 npm run start:test`, then `grep -n "AGENT_MODEL_SETTING\|AGENT_MANIFEST" dist/testapp/backendapp/src/agent.manifest.ts`: both `null`.

- [ ] **Step 8: Commit** — `git commit -m "feat(codegen): agent loop reads its model key only from the bound AiApi setting; 503 ModelNotConfigured / ModelProviderNotSupported"` + trailer.

---

### Task 5: Docs and skills

- [ ] **Step 1: Spec (uncommitted — Parvan commits specs)** — D-A6 row and §4.1: one `AiApi` type with a provider (Anthropic, OpenAI) like SFTP's authentication type; delivery through settings with the accepted exposure (decision 2); no environment fallback; seed in `Script0100`; Agent-only, at most one. §4.5: OpenAI answers `503 ModelProviderNotSupported` until its `ModelClient`.
- [ ] **Step 2: agent-creator skill** — `D:\Git\skills\skills\datex-studio\agent-creator\SKILL.md`, after step 6's prerequisites link: "Model key (only for the app's own agent loop)": create an **AI API** connection in the Manager (provider, API key, optional base URL), add one connection setting of that type to the Agent application in Studio, bind it per environment, regenerate. Without it `fpx` works, and a turn answers `503 ModelNotConfigured`; an OpenAI key answers `503 ModelProviderNotSupported` for now. `npm test` in `D:\Git\skills` stays green; commit there with the trailer.
- [ ] **Step 3: dxs guide (uncommitted)** — the same paragraph in `D:\Git\datex-studio-cli\docs\agent-cli.md` beside the tenant prerequisites; add both 503 codes to the `DXS-AGENT-040` cases. Leave it uncommitted (that branch is one squashed commit).

---

### Task 6: Live check (user-assisted)

Needs a real Anthropic key. Steps for Parvan, recorded in the final report:

1. Re-run `Script0100.sql` on the development database (adds `ApiConnectionTypes` 13).
2. Manager → API connections → new **AI API** connection, provider Anthropic, paste the key.
3. Studio → branch 73444 → Settings → add a connection setting of type AiApi (e.g. `modelKey`) pointing at it.
4. Regenerate and restart the local app (the development settings path binds by connection name, so no environment binding is needed locally; for a deployed environment bind `modelKey` in the Manager).
5. `uv run dxs agent chat --app-url http://localhost:3000 --app-scope api://2e069781-2a39-45cb-b04f-d35a5b12ac4e/.default -m "Which materials are class A in warehouse 1?"` — an answer, not a 503.
6. Point the setting at a connection with provider OpenAI, regenerate — `503 ModelProviderNotSupported`; remove the setting, regenerate — `503 ModelNotConfigured`.
