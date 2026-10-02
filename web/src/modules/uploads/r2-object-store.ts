import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getR2Config } from "@/lib/config";

let client: S3Client | undefined;

function resources() {
  const config = getR2Config();
  client ??= new S3Client({
    endpoint: config.R2_ENDPOINT_PS1,
    region: config.R2_REGION,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID_PS1,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY_PS1,
    },
  });
  return { client, bucket: config.R2_BUCKET_NAME_PS1 };
}

export const r2ObjectStore = {
  async createUploadUrl(input: {
    key: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<string> {
    const { client: s3, bucket } = resources();
    return getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
      }),
      { expiresIn: 10 * 60 },
    );
  },
  async inspect(key: string): Promise<{
    sizeBytes: number;
    contentType: string | undefined;
    prefix: Uint8Array;
  }> {
    const { client: s3, bucket } = resources();
    const metadata = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const object = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15" }),
    );
    if (metadata.ContentLength === undefined || !object.Body) {
      throw new Error("R2 object metadata is incomplete.");
    }
    return {
      sizeBytes: metadata.ContentLength,
      contentType: metadata.ContentType,
      prefix: await object.Body.transformToByteArray(),
    };
  },
  async delete(key: string): Promise<void> {
    const { client: s3, bucket } = resources();
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  },
  async temporaryDownloadUrl(key: string): Promise<string> {
    const { client: s3, bucket } = resources();
    return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: 15 * 60,
    });
  },
};
