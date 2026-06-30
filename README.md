# Drebin451 Release

GitHub Action for uploading an Android APK release to Drebin451.

Drebin451 reads the Android application id, version name, version code, label, and icon from the APK. This action sends the APK file plus an optional release note to the Drebin451 upload API using the `X-API-Key` header.

## Setup

1. In Drebin451, create an API key for the account that should own uploaded APKs.
2. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
3. Add a repository secret named `DREBIN_API_KEY` with the Drebin451 API key value.
4. Build your release APK before running this action.

## Basic Usage

```yaml
- name: Publish APK to Drebin451
  uses: Commit451/drebin451-release@v1
  with:
    api-key: ${{ secrets.DREBIN_API_KEY }}
    apk-path: app/androidApp/build/outputs/apk/release/androidApp-release.apk
    note: ${{ github.event.head_commit.message }}
```

For a self-hosted Drebin451 API, override `upload-url`:

```yaml
- name: Publish APK to Drebin451
  uses: Commit451/drebin451-release@v1
  with:
    api-key: ${{ secrets.DREBIN_API_KEY }}
    apk-path: app/build/outputs/apk/release/app-release.apk
    upload-url: https://api.example.com/v1/apps
```

## Full Example

```yaml
name: Release APK

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Java
        uses: actions/setup-java@v5
        with:
          distribution: zulu
          java-version: "21"

      - name: Build release APK
        run: ./gradlew :app:androidApp:assembleRelease

      - name: Publish APK to Drebin451
        uses: Commit451/drebin451-release@v1
        with:
          api-key: ${{ secrets.DREBIN_API_KEY }}
          apk-path: app/androidApp/build/outputs/apk/release/androidApp-release.apk
          note: ${{ github.event.head_commit.message }}
```

## Using Outputs

```yaml
- name: Publish APK to Drebin451
  id: drebin451
  uses: Commit451/drebin451-release@v1
  with:
    api-key: ${{ secrets.DREBIN_API_KEY }}
    apk-path: app/androidApp/build/outputs/apk/release/androidApp-release.apk

- name: Print uploaded version
  run: echo "Uploaded ${{ steps.drebin451.outputs['application-id'] }} ${{ steps.drebin451.outputs['version-name'] }}"
```

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `api-key` | Yes | | Drebin451 API key. Store it as a GitHub Actions secret. |
| `apk-path` | Yes | | Path to the APK file to upload. |
| `upload-url` | No | `https://api.drebin451.com/v1/apps` | Drebin451 upload endpoint URL. |
| `note` | No | | Release note attached to the uploaded version. |
| `timeout-seconds` | No | `300` | Maximum time to allow for the upload request. |

## Outputs

| Output | Description |
| --- | --- |
| `response-json` | Raw JSON response returned by Drebin451. |
| `version-id` | Drebin451 version id for the uploaded APK. |
| `app-id` | Drebin451 app id for the uploaded APK. |
| `application-id` | Android application id parsed from the APK. |
| `version-name` | Android versionName parsed from the APK. |
| `version-code` | Android versionCode parsed from the APK. |
| `file-name` | File name stored for the uploaded APK. |
| `file-size-bytes` | Size in bytes of the uploaded APK. |

## API Contract

The action sends:

```text
POST /v1/apps
X-API-Key: <api-key>
Content-Type: multipart/form-data

apk=<APK file>
note=<optional release note>
```

The Drebin451 API returns the created app version as JSON.

## Development

This action is implemented in TypeScript in `src/main.ts`. The compiled action entrypoint is committed at `dist/index.js`, so workflows that use this action do not need to run `npm install`.

Install dependencies:

```bash
npm install
```

Type-check the source:

```bash
npm run check
```

Build the distributable action:

```bash
npm run build
```

Commit changes to `src/`, `dist/`, `action.yml`, and `package-lock.json` together when releasing a new version.

## License

MIT
