import crypto from "crypto";
import fs from "fs";
import path from "path";

export interface GoogleDriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  md5Checksum?: string;
}

export interface GoogleDriveDownloadResult {
  fileBuffer: Buffer;
  fileName: string;
  fileSize: number;
  fileHashSha256: string;
  driveFileId: string;
  driveModifiedTime: string;
  source: "GOOGLE_DRIVE" | "LOCAL_FALLBACK";
}

export class GoogleDriveService {
  private static folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1TFRM84-ojZaRq61BBKM2vNhMaxoJYohs";
  private static targetFileName = "CFOP.CSV";

  /**
   * Generates a Google OAuth2 access token using Service Account JWT authentication
   * Native implementation using standard Node.js crypto (zero heavy external dependencies)
   */
  private static async getAccessToken(): Promise<string> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    // Optional base64 encoded private key or whole JSON credentials
    if (!privateKey && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64) {
      try {
        const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf-8");
        if (decoded.trim().startsWith("{")) {
          const parsed = JSON.parse(decoded);
          privateKey = parsed.private_key;
        } else {
          privateKey = decoded;
        }
      } catch (err) {
        console.warn("[GoogleDriveService] Error decoding GOOGLE_SERVICE_ACCOUNT_KEY_BASE64:", err);
      }
    }

    if (!clientEmail || !privateKey) {
      throw new Error(
        "Credenciais do Google Drive Service Account não configuradas. Verifique as variáveis GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
      );
    }

    // Format private key (replace escaped newlines if any)
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const claimSet = {
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const encodeBase64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const headerEncoded = encodeBase64Url(header);
    const claimSetEncoded = encodeBase64Url(claimSet);
    const unsignedToken = `${headerEncoded}.${claimSetEncoded}`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(unsignedToken);
    const signature = signer
      .sign(formattedPrivateKey, "base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${unsignedToken}.${signature}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha na autenticação com Google Drive API (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Finds the CFOP.CSV file in the target folder and validates its metadata
   */
  static async locateTargetFile(targetFolderId: string = this.folderId): Promise<GoogleDriveFileMetadata> {
    const accessToken = await this.getAccessToken();

    const query = `'${targetFolderId}' in parents and trashed = false and (name = 'CFOP.CSV' or name = 'CFOP.csv' or name = 'cfop.csv')`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,size,modifiedTime,md5Checksum)&orderBy=modifiedTime desc`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao listar arquivos da pasta do Google Drive (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const files = data.files || [];

    if (files.length === 0) {
      throw new Error(`Arquivo '${this.targetFileName}' não encontrado na pasta do Google Drive (Folder ID: ${targetFolderId}).`);
    }

    const targetFile = files[0];
    const fileSize = parseInt(targetFile.size || "0", 10);

    if (fileSize === 0) {
      throw new Error(`Arquivo '${targetFile.name}' encontrado no Google Drive possui tamanho ZERO (0 bytes). Importação bloqueada.`);
    }

    // Check if the file is currently being modified (modified less than 45s ago)
    const modifiedTimeMs = new Date(targetFile.modifiedTime).getTime();
    const ageSeconds = (Date.now() - modifiedTimeMs) / 1000;
    if (ageSeconds < 45) {
      throw new Error(
        `Arquivo '${targetFile.name}' foi modificado há menos de ${Math.round(
          ageSeconds
        )}s e pode estar em processo de upload. Aguardando estabilização.`
      );
    }

    return {
      id: targetFile.id,
      name: targetFile.name,
      mimeType: targetFile.mimeType,
      size: fileSize,
      modifiedTime: targetFile.modifiedTime,
      md5Checksum: targetFile.md5Checksum,
    };
  }

  /**
   * Downloads the binary stream of the file from Google Drive
   */
  static async downloadFileFromDrive(fileId: string): Promise<Buffer> {
    const accessToken = await this.getAccessToken();
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao baixar arquivo do Google Drive (${response.status}): ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Main entry point to fetch CFOP.CSV from Google Drive or Local Fallback (for dry-run & offline tests)
   */
  static async fetchCfopCsv(options: {
    folderId?: string;
    allowLocalFallback?: boolean;
    localFallbackPath?: string;
  } = {}): Promise<GoogleDriveDownloadResult> {
    const folderId = options.folderId || this.folderId;

    // 1. Try Google Drive API first if service account credentials exist
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64)) {
      try {
        const metadata = await this.locateTargetFile(folderId);
        const fileBuffer = await this.downloadFileFromDrive(metadata.id);
        const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

        return {
          fileBuffer,
          fileName: metadata.name,
          fileSize: metadata.size,
          fileHashSha256: sha256,
          driveFileId: metadata.id,
          driveModifiedTime: metadata.modifiedTime,
          source: "GOOGLE_DRIVE",
        };
      } catch (err: any) {
        if (!options.allowLocalFallback) {
          throw err;
        }
        console.warn("[GoogleDriveService] Google Drive download failed, attempting local fallback:", err.message);
      }
    }

    // 2. Local Fallback (Downloads folder or configured path) for testing / dry-run
    if (options.allowLocalFallback !== false) {
      const fallbackPaths = [
        options.localFallbackPath,
        "/Users/cristiano/Downloads/CFOP.csv",
        "/Users/cristiano/Downloads/CFOP.CSV",
        path.join(process.cwd(), "CFOP.csv"),
        path.join(process.cwd(), "CFOP.CSV"),
      ].filter(Boolean) as string[];

      for (const p of fallbackPaths) {
        if (fs.existsSync(p)) {
          const stats = fs.statSync(p);
          if (stats.size > 0) {
            const fileBuffer = fs.readFileSync(p);
            const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");
            return {
              fileBuffer,
              fileName: path.basename(p),
              fileSize: stats.size,
              fileHashSha256: sha256,
              driveFileId: "LOCAL_SIMULATED_DRIVE_ID",
              driveModifiedTime: stats.mtime.toISOString(),
              source: "LOCAL_FALLBACK",
            };
          }
        }
      }
    }

    throw new Error(
      "Não foi possível obter o arquivo CFOP.CSV: Credenciais do Google Drive ausentes e nenhum arquivo local de contingência encontrado."
    );
  }
}
