import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import * as http from "node:http";
import * as https from "node:https";
import { basename } from "node:path";
import { URL } from "node:url";
import * as github from "./github";

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

type HttpResponse = {
  statusCode: number;
  statusMessage: string;
  body: string;
};

type UploadOptions = {
  apiKey: string;
  apkPath: string;
  apkSizeBytes: number;
  uploadUrl: string;
  note: string;
  timeoutSeconds: number;
};

type AppVersionResponse = {
  id?: unknown;
  appId?: unknown;
  applicationId?: unknown;
  versionName?: unknown;
  versionCode?: unknown;
  fileName?: unknown;
  fileSizeBytes?: unknown;
};

async function run(): Promise<void> {
  try {
    const apiKey = github.getInput("api-key", { required: true });
    const apkPath = github.getInput("apk-path", { required: true });
    const uploadUrl = github.getInput("upload-url") || "https://api.drebin451.com/v1/apps";
    const note = github.getInput("note");
    const timeoutSeconds = parsePositiveInteger(github.getInput("timeout-seconds") || "300", "timeout-seconds");

    github.setSecret(apiKey);

    const apkStats = await stat(apkPath).catch((error: unknown) => {
      throw new Error(`APK file not found: ${apkPath}`, { cause: error });
    });

    if (!apkStats.isFile()) {
      throw new Error(`APK path is not a file: ${apkPath}`);
    }

    github.info(`Uploading APK to Drebin451: ${apkPath}`);

    const response = await uploadApk({
      apiKey,
      apkPath,
      apkSizeBytes: apkStats.size,
      uploadUrl,
      note,
      timeoutSeconds,
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(
        [
          `Drebin451 upload failed with HTTP ${response.statusCode} ${response.statusMessage}`.trim(),
          response.body ? `Response body:\n${truncate(response.body)}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }

    github.info(`Drebin451 upload succeeded with HTTP ${response.statusCode}.`);
    await writeOutputs(response.body);
  } catch (error) {
    github.setFailed(error instanceof Error ? error.message : String(error));
  }
}

function parsePositiveInteger(value: string, inputName: string): number {
  const parsed = Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${inputName} must be a positive integer.`);
  }
  return parsed;
}

async function uploadApk(options: UploadOptions): Promise<HttpResponse> {
  const url = new URL(options.uploadUrl);
  const client = clientFor(url);
  const boundary = `drebin451-${randomBytes(16).toString("hex")}`;
  const multipart = multipartParts(boundary, options.apkPath, options.note);
  const contentLength = multipart.note.length + multipart.fileHeader.length + options.apkSizeBytes + multipart.fileFooter.length;

  return new Promise<HttpResponse>((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: "POST",
        timeout: options.timeoutSeconds * 1000,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": String(contentLength),
          "X-API-Key": options.apiKey,
          "User-Agent": "drebin451-release-action",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            statusMessage: response.statusMessage ?? "",
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    request.setTimeout(options.timeoutSeconds * 1000, () => {
      request.destroy(new Error(`Drebin451 upload timed out after ${options.timeoutSeconds} seconds.`));
    });

    request.on("error", reject);

    void writeMultipartBody(request, options.apkPath, multipart).catch((error: unknown) => {
      request.destroy(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

function clientFor(url: URL): typeof http | typeof https {
  if (url.protocol === "http:") return http;
  if (url.protocol === "https:") return https;
  throw new Error(`Unsupported upload-url protocol: ${url.protocol}`);
}

function multipartParts(boundary: string, apkPath: string, note: string): { note: Buffer; fileHeader: Buffer; fileFooter: Buffer } {
  const safeFileName = escapeContentDispositionValue(basename(apkPath) || "app.apk");
  const notePart = note
    ? Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\n${note}\r\n`, "utf8")
    : Buffer.alloc(0);
  const fileHeader = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="apk"; filename="${safeFileName}"`,
      `Content-Type: ${APK_CONTENT_TYPE}`,
      "",
      "",
    ].join("\r\n"),
    "utf8",
  );
  const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");

  return { note: notePart, fileHeader, fileFooter };
}

function escapeContentDispositionValue(value: string): string {
  return value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function writeMultipartBody(
  request: http.ClientRequest,
  apkPath: string,
  multipart: { note: Buffer; fileHeader: Buffer; fileFooter: Buffer },
): Promise<void> {
  await writeBuffer(request, multipart.note);
  await writeBuffer(request, multipart.fileHeader);
  await pipeFile(request, apkPath);
  await writeBuffer(request, multipart.fileFooter);
  request.end();
}

function writeBuffer(request: http.ClientRequest, buffer: Buffer): Promise<void> {
  if (buffer.length === 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    request.write(buffer, (error?: Error | null) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function pipeFile(request: http.ClientRequest, apkPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const stream = createReadStream(apkPath);

    const fail = (error: Error): void => {
      stream.destroy();
      reject(error);
    };

    request.once("error", fail);
    stream.once("error", fail);
    stream.once("end", () => {
      request.off("error", fail);
      resolve();
    });

    stream.pipe(request, { end: false });
  });
}

async function writeOutputs(responseBody: string): Promise<void> {
  github.setOutput("response-json", responseBody);

  let json: AppVersionResponse;
  try {
    json = JSON.parse(responseBody) as AppVersionResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    github.warning(`Upload succeeded, but the response was not valid JSON: ${message}`);
    return;
  }

  setOutputIfPresent("version-id", json.id);
  setOutputIfPresent("app-id", json.appId);
  setOutputIfPresent("application-id", json.applicationId);
  setOutputIfPresent("version-name", json.versionName);
  setOutputIfPresent("version-code", json.versionCode);
  setOutputIfPresent("file-name", json.fileName);
  setOutputIfPresent("file-size-bytes", json.fileSizeBytes);

  const applicationId = stringValue(json.applicationId) || "unknown application";
  const version = [stringValue(json.versionName), stringValue(json.versionCode) ? `(${stringValue(json.versionCode)})` : ""]
    .filter(Boolean)
    .join(" ");

  if (json.applicationId) {
    github.info(`Uploaded ${applicationId}${version ? ` ${version}` : ""}.`);
  }

  await github.appendStepSummary(`### Drebin451 upload\n\nUploaded \`${applicationId}\`${version ? ` \`${version}\`` : ""}.\n`);
}

function setOutputIfPresent(name: string, value: unknown): void {
  if (value === undefined || value === null) return;
  github.setOutput(name, String(value));
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function truncate(value: string, maxLength = 4096): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n...truncated...`;
}

void run();
