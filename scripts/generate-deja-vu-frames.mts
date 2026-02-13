import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const promptsPath = path.join(repoRoot, "content", "deja-vu", "image-prompts.json");
const outDir = path.join(repoRoot, "ui", "deja-vu", "frames");

type PromptFrame = {
  id: string;
  imageKey: string;
  prompt: string;
};

type PromptManifest = {
  storyId: string;
  model?: string;
  quality?: "low" | "medium" | "high";
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  format?: "png" | "jpeg" | "webp";
  referenceImagePath?: string;
  referenceImageMimeType?: string;
  identityInstruction?: string;
  styleGuide?: string;
  frames: PromptFrame[];
};

type ImageGenerationResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`${label} failed (attempt ${attempt}/${attempts}): ${message}`);
      if (attempt < attempts) {
        await delay(1200 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseArgs(args: string[]) {
  return {
    force: args.includes("--force"),
  };
}

async function readManifest(): Promise<PromptManifest> {
  const raw = await fs.readFile(promptsPath, "utf8");
  const manifest = JSON.parse(raw) as PromptManifest;

  if (!Array.isArray(manifest.frames) || manifest.frames.length === 0) {
    throw new Error("No frames found in image-prompts.json");
  }

  return manifest;
}

async function generateWithModel(args: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  format: string;
}): Promise<Buffer> {
  const response = await withRetry(
    () =>
      fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiKey}`,
        },
        body: JSON.stringify({
          model: args.model,
          prompt: args.prompt,
          size: args.size,
          quality: args.quality,
          output_format: args.format,
        }),
      }),
    `image generation request (${args.model})`,
  );

  const json = (await response.json()) as ImageGenerationResponse;

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Image generation failed (${response.status})`);
  }

  const first = json.data?.[0];

  if (!first) {
    throw new Error("No image payload returned by API");
  }

  if (first.b64_json) {
    return Buffer.from(first.b64_json, "base64");
  }

  if (first.url) {
    const imageResponse = await withRetry(
      () => fetch(first.url!),
      "image download request",
    );
    if (!imageResponse.ok) {
      throw new Error(`Failed to download generated image from URL (${imageResponse.status})`);
    }

    const data = await imageResponse.arrayBuffer();
    return Buffer.from(data);
  }

  throw new Error("API response did not include b64_json or url image output");
}

async function generateWithReferenceEdit(args: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  format: string;
  referenceImage: Buffer;
  referenceImageFilename: string;
  referenceImageMimeType: string;
}): Promise<Buffer> {
  const formData = new FormData();
  const imageBlob = new Blob([args.referenceImage], {
    type: args.referenceImageMimeType,
  });

  formData.append("model", args.model);
  formData.append("prompt", args.prompt);
  formData.append("size", args.size);
  formData.append("quality", args.quality);
  formData.append("output_format", args.format);
  formData.append("image", imageBlob, args.referenceImageFilename);

  const response = await withRetry(
    () =>
      fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${args.apiKey}`,
        },
        body: formData,
      }),
    `image edit request (${args.model})`,
  );

  const json = (await response.json()) as ImageGenerationResponse;

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Image edit failed (${response.status})`);
  }

  const first = json.data?.[0];

  if (!first) {
    throw new Error("No image payload returned by edit API");
  }

  if (first.b64_json) {
    return Buffer.from(first.b64_json, "base64");
  }

  if (first.url) {
    const imageResponse = await withRetry(
      () => fetch(first.url!),
      "edited image download request",
    );
    if (!imageResponse.ok) {
      throw new Error(
        `Failed to download edited image from URL (${imageResponse.status})`,
      );
    }

    const data = await imageResponse.arrayBuffer();
    return Buffer.from(data);
  }

  throw new Error("Edit API response did not include b64_json or url image output");
}

async function main() {
  const { force } = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const manifest = await readManifest();
  await fs.mkdir(outDir, { recursive: true });

  const model = manifest.model ?? "gpt-image-1.5";
  const fallbackModel = "gpt-image-1";
  const quality = manifest.quality ?? "high";
  const size = manifest.size ?? "1536x1024";
  const format = manifest.format ?? "webp";
  const referenceImagePath = manifest.referenceImagePath
    ? path.resolve(repoRoot, manifest.referenceImagePath)
    : null;
  const referenceImageMimeType = manifest.referenceImageMimeType ?? "image/jpeg";
  const referenceImageFilename = referenceImagePath
    ? path.basename(referenceImagePath)
    : "reference.jpg";

  let referenceImage: Buffer | null = null;
  if (referenceImagePath) {
    referenceImage = await fs.readFile(referenceImagePath);
    console.log(`Loaded reference image: ${referenceImagePath}`);
  }

  for (const frame of manifest.frames) {
    const outFile = path.join(outDir, `${frame.imageKey}.${format}`);

    if (!force) {
      try {
        await fs.access(outFile);
        console.log(`Skipping ${frame.imageKey}: already exists`);
        continue;
      } catch {
        // File does not exist; continue.
      }
    }

    const composedPrompt = [
      manifest.identityInstruction,
      manifest.styleGuide,
      frame.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    console.log(`Generating ${frame.imageKey} with ${model}...`);

    let imageBuffer: Buffer | null = null;

    if (referenceImage) {
      try {
        imageBuffer = await generateWithReferenceEdit({
          apiKey,
          model,
          prompt: composedPrompt,
          size,
          quality,
          format,
          referenceImage,
          referenceImageFilename,
          referenceImageMimeType,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          `Reference edit with ${model} failed for ${frame.imageKey}: ${message}`,
        );

        if (model !== fallbackModel) {
          try {
            imageBuffer = await generateWithReferenceEdit({
              apiKey,
              model: fallbackModel,
              prompt: composedPrompt,
              size,
              quality,
              format,
              referenceImage,
              referenceImageFilename,
              referenceImageMimeType,
            });
          } catch (fallbackError) {
            const fallbackMessage =
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError);
            console.warn(
              `Reference edit fallback with ${fallbackModel} failed for ${frame.imageKey}: ${fallbackMessage}`,
            );
          }
        }
      }
    }

    try {
      if (!imageBuffer) {
        imageBuffer = await generateWithModel({
          apiKey,
          model,
          prompt: composedPrompt,
          size,
          quality,
          format,
        });
      }
    } catch (error) {
      if (model !== fallbackModel) {
        console.warn(`Primary generation ${model} failed for ${frame.imageKey}. Retrying with ${fallbackModel}.`);
        imageBuffer = await generateWithModel({
          apiKey,
          model: fallbackModel,
          prompt: composedPrompt,
          size,
          quality,
          format,
        });
      } else {
        throw error;
      }
    }

    if (!imageBuffer) {
      throw new Error(`No image buffer generated for frame ${frame.imageKey}`);
    }

    await fs.writeFile(outFile, imageBuffer);
    console.log(`Saved ${outFile}`);
  }

  console.log("All story frames generated.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
