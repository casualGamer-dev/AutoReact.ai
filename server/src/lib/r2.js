const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function makeClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

// Returns a short-lived URL the mobile app can PUT the image/code file to directly,
// so uploads never pass through this server.
async function presignUpload(key, contentType) {
  const client = makeClient();
  const command = new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  const publicUrl = `${process.env.R2_PUBLIC_BASE_URL}/${key}`;
  return { uploadUrl, publicUrl };
}

async function deleteObject(key) {
  const client = makeClient();
  await client.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}

function keyFromUrl(url) {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!url || !base || !url.startsWith(base)) return null;
  return url.slice(base.length + 1);
}

module.exports = { presignUpload, deleteObject, keyFromUrl };
