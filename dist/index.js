require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 248:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getInput = getInput;
exports.setSecret = setSecret;
exports.setOutput = setOutput;
exports.info = info;
exports.warning = warning;
exports.setFailed = setFailed;
exports.appendStepSummary = appendStepSummary;
const node_fs_1 = __nccwpck_require__(24);
const promises_1 = __nccwpck_require__(455);
const node_os_1 = __nccwpck_require__(161);
const node_crypto_1 = __nccwpck_require__(598);
function getInput(name, options = {}) {
    const key = name.replace(/ /g, "_").toUpperCase();
    const value = process.env[`INPUT_${key}`] ?? process.env[`INPUT_${key.replace(/-/g, "_")}`] ?? "";
    const trimmed = value.trim();
    if (options.required && !trimmed) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    return trimmed;
}
function setSecret(value) {
    issueCommand("add-mask", value);
}
function setOutput(name, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (outputPath) {
        const delimiter = delimiterFor(value);
        (0, node_fs_1.appendFileSync)(outputPath, `${name}<<${delimiter}${node_os_1.EOL}${value}${node_os_1.EOL}${delimiter}${node_os_1.EOL}`);
        return;
    }
    issueCommand("set-output", value, { name });
}
function info(message) {
    console.log(message);
}
function warning(message) {
    issueCommand("warning", message);
}
function setFailed(message) {
    process.exitCode = 1;
    issueCommand("error", message);
}
async function appendStepSummary(markdown) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath)
        return;
    await (0, promises_1.appendFile)(summaryPath, markdown.endsWith(node_os_1.EOL) ? markdown : `${markdown}${node_os_1.EOL}`, "utf8");
}
function delimiterFor(value) {
    let delimiter = "";
    do {
        delimiter = `drebin451_${(0, node_crypto_1.randomBytes)(16).toString("hex")}`;
    } while (value.includes(delimiter));
    return delimiter;
}
function issueCommand(command, message, properties = {}) {
    const serializedProperties = Object.entries(properties)
        .map(([key, value]) => `${key}=${escapeProperty(value)}`)
        .join(",");
    const propertySuffix = serializedProperties ? ` ${serializedProperties}` : "";
    console.log(`::${command}${propertySuffix}::${escapeData(message)}`);
}
function escapeData(value) {
    return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProperty(value) {
    return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}


/***/ }),

/***/ 730:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const node_crypto_1 = __nccwpck_require__(598);
const node_fs_1 = __nccwpck_require__(24);
const promises_1 = __nccwpck_require__(455);
const http = __importStar(__nccwpck_require__(67));
const https = __importStar(__nccwpck_require__(708));
const node_path_1 = __nccwpck_require__(760);
const node_url_1 = __nccwpck_require__(136);
const github = __importStar(__nccwpck_require__(248));
const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
async function run() {
    try {
        const apiKey = github.getInput("api-key", { required: true });
        const apkPath = github.getInput("apk-path", { required: true });
        const uploadUrl = github.getInput("upload-url") || "https://api.drebin451.com/v1/apps";
        const note = github.getInput("note");
        const timeoutSeconds = parsePositiveInteger(github.getInput("timeout-seconds") || "300", "timeout-seconds");
        github.setSecret(apiKey);
        const apkStats = await (0, promises_1.stat)(apkPath).catch((error) => {
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
            throw new Error([
                `Drebin451 upload failed with HTTP ${response.statusCode} ${response.statusMessage}`.trim(),
                response.body ? `Response body:\n${truncate(response.body)}` : "",
            ]
                .filter(Boolean)
                .join("\n"));
        }
        github.info(`Drebin451 upload succeeded with HTTP ${response.statusCode}.`);
        await writeOutputs(response.body);
    }
    catch (error) {
        github.setFailed(error instanceof Error ? error.message : String(error));
    }
}
function parsePositiveInteger(value, inputName) {
    const parsed = Number(value.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${inputName} must be a positive integer.`);
    }
    return parsed;
}
async function uploadApk(options) {
    const url = new node_url_1.URL(options.uploadUrl);
    const client = clientFor(url);
    const boundary = `drebin451-${(0, node_crypto_1.randomBytes)(16).toString("hex")}`;
    const multipart = multipartParts(boundary, options.apkPath, options.note);
    const contentLength = multipart.note.length + multipart.fileHeader.length + options.apkSizeBytes + multipart.fileFooter.length;
    return new Promise((resolve, reject) => {
        const request = client.request(url, {
            method: "POST",
            timeout: options.timeoutSeconds * 1000,
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Content-Length": String(contentLength),
                "X-API-Key": options.apiKey,
                "User-Agent": "drebin451-release-action",
            },
        }, (response) => {
            const chunks = [];
            response.on("data", (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            response.on("end", () => {
                resolve({
                    statusCode: response.statusCode ?? 0,
                    statusMessage: response.statusMessage ?? "",
                    body: Buffer.concat(chunks).toString("utf8"),
                });
            });
        });
        request.setTimeout(options.timeoutSeconds * 1000, () => {
            request.destroy(new Error(`Drebin451 upload timed out after ${options.timeoutSeconds} seconds.`));
        });
        request.on("error", reject);
        void writeMultipartBody(request, options.apkPath, multipart).catch((error) => {
            request.destroy(error instanceof Error ? error : new Error(String(error)));
        });
    });
}
function clientFor(url) {
    if (url.protocol === "http:")
        return http;
    if (url.protocol === "https:")
        return https;
    throw new Error(`Unsupported upload-url protocol: ${url.protocol}`);
}
function multipartParts(boundary, apkPath, note) {
    const safeFileName = escapeContentDispositionValue((0, node_path_1.basename)(apkPath) || "app.apk");
    const notePart = note
        ? Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\n${note}\r\n`, "utf8")
        : Buffer.alloc(0);
    const fileHeader = Buffer.from([
        `--${boundary}`,
        `Content-Disposition: form-data; name="apk"; filename="${safeFileName}"`,
        `Content-Type: ${APK_CONTENT_TYPE}`,
        "",
        "",
    ].join("\r\n"), "utf8");
    const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    return { note: notePart, fileHeader, fileFooter };
}
function escapeContentDispositionValue(value) {
    return value.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
async function writeMultipartBody(request, apkPath, multipart) {
    await writeBuffer(request, multipart.note);
    await writeBuffer(request, multipart.fileHeader);
    await pipeFile(request, apkPath);
    await writeBuffer(request, multipart.fileFooter);
    request.end();
}
function writeBuffer(request, buffer) {
    if (buffer.length === 0)
        return Promise.resolve();
    return new Promise((resolve, reject) => {
        request.write(buffer, (error) => {
            if (error) {
                reject(error);
            }
            else {
                resolve();
            }
        });
    });
}
function pipeFile(request, apkPath) {
    return new Promise((resolve, reject) => {
        const stream = (0, node_fs_1.createReadStream)(apkPath);
        const fail = (error) => {
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
async function writeOutputs(responseBody) {
    github.setOutput("response-json", responseBody);
    let json;
    try {
        json = JSON.parse(responseBody);
    }
    catch (error) {
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
function setOutputIfPresent(name, value) {
    if (value === undefined || value === null)
        return;
    github.setOutput(name, String(value));
}
function stringValue(value) {
    if (value === undefined || value === null)
        return "";
    return String(value);
}
function truncate(value, maxLength = 4096) {
    if (value.length <= maxLength)
        return value;
    return `${value.slice(0, maxLength)}\n...truncated...`;
}
void run();


/***/ }),

/***/ 598:
/***/ ((module) => {

module.exports = require("node:crypto");

/***/ }),

/***/ 24:
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ 455:
/***/ ((module) => {

module.exports = require("node:fs/promises");

/***/ }),

/***/ 67:
/***/ ((module) => {

module.exports = require("node:http");

/***/ }),

/***/ 708:
/***/ ((module) => {

module.exports = require("node:https");

/***/ }),

/***/ 161:
/***/ ((module) => {

module.exports = require("node:os");

/***/ }),

/***/ 760:
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ 136:
/***/ ((module) => {

module.exports = require("node:url");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(730);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map