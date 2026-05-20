import { Injectable } from "@nestjs/common";

export type StorageDriver = "local" | "s3";

@Injectable()
export class StorageService {
  getDriver(): StorageDriver {
    return (process.env.STORAGE_DRIVER as StorageDriver | undefined) ?? "local";
  }

  getConfig() {
    if (this.getDriver() === "local") {
      return {
        driver: "local",
        rootPath: process.env.LOCAL_STORAGE_PATH ?? "./storage",
      };
    }

    return {
      driver: "s3",
      bucket: process.env.STORAGE_BUCKET,
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION,
    };
  }
}

