import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";
import {
  getFrame,
  getFrameCount,
  getFrameStep,
  getStory,
  type StoryFrame,
  type StoryHotspot,
} from "./deja-vu-data";

const clickSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const dejaVuInput = z
  .object({
    action: z.enum(["start", "click"]),
    storyId: z
      .string()
      .default("deja-vu-v1")
      .describe("Optional in demo mode. Defaults to deja-vu-v1."),
    currentFrameId: z.string().optional(),
    click: clickSchema.optional(),
    hotspotId: z.string().optional(),
  })
  .superRefine((input, ctx) => {
    if (input.action === "click") {
      if (!input.currentFrameId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "currentFrameId is required when action=click.",
          path: ["currentFrameId"],
        });
      }

      if (!input.click) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "click is required when action=click.",
          path: ["click"],
        });
      }
    }
  });

type StoryInput = z.infer<typeof dejaVuInput>;

type StoryFramePayload = {
  id: string;
  title: string;
  narration: string;
  imageKey: string;
  hotspots: StoryHotspot[];
  isEnding: boolean;
};

type StoryTransitionPayload = {
  fromFrameId: string;
  toFrameId: string;
  hotspotId: string | null;
  missedClick: boolean;
};

type StoryProgressPayload = {
  step: number;
  total: number;
};

function toFramePayload(frame: StoryFrame): StoryFramePayload {
  return {
    id: frame.id,
    title: frame.title,
    narration: frame.narration,
    imageKey: frame.imageKey,
    hotspots: frame.hotspots,
    isEnding: frame.isEnding,
  };
}

function containsPoint(
  hotspot: StoryHotspot,
  point: NonNullable<StoryInput["click"]>,
): boolean {
  const { x, y, w, h } = hotspot.bbox;

  return (
    point.x >= x &&
    point.x <= x + w &&
    point.y >= y &&
    point.y <= y + h
  );
}

function resolveHotspot(
  frame: StoryFrame,
  click: NonNullable<StoryInput["click"]>,
  hotspotId?: string,
): StoryHotspot | null {
  if (hotspotId) {
    const exactHotspot = frame.hotspots.find((candidate) => candidate.id === hotspotId);
    if (exactHotspot) {
      return exactHotspot;
    }
  }

  for (const hotspot of frame.hotspots) {
    if (containsPoint(hotspot, click)) {
      return hotspot;
    }
  }

  return null;
}

function buildSuccessResponse(
  storyId: string,
  frame: StoryFrame,
  transition: StoryTransitionPayload,
  text: string,
) {
  const structuredContent = {
    storyId,
    frame: toFramePayload(frame),
    transition,
    progress: {
      step: getFrameStep(frame.id),
      total: getFrameCount(),
    } satisfies StoryProgressPayload,
  };

  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

export default defineTool({
  name: "deja-vu",
  title: "Play Deja Vu",
  description:
    "Run the pre-authored Deja Vu interactive story and resolve next frames from click coordinates. Start with {\"action\":\"start\"}.",
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: dejaVuInput,
  ui: "deja-vu",
  invoking: "Opening the story",
  invoked: "Story is live",
  async handler(input) {
    const story = getStory(input.storyId);
    const startFrame = getFrame(story.startFrameId);

    if (!startFrame) {
      throw new Error("Story graph misconfigured: start frame is missing.");
    }

    if (input.action === "start") {
      return buildSuccessResponse(
        story.storyId,
        startFrame,
        {
          fromFrameId: "start",
          toFrameId: startFrame.id,
          hotspotId: null,
          missedClick: false,
        },
        `Starting ${story.title}.`,
      );
    }

    const currentFrame = getFrame(input.currentFrameId ?? "");

    if (!currentFrame) {
      return buildSuccessResponse(
        story.storyId,
        startFrame,
        {
          fromFrameId: input.currentFrameId ?? "unknown",
          toFrameId: startFrame.id,
          hotspotId: null,
          missedClick: false,
        },
        "Frame was out of sync, so the story safely restarted from the beginning.",
      );
    }

    if (currentFrame.isEnding || currentFrame.hotspots.length === 0) {
      return buildSuccessResponse(
        story.storyId,
        currentFrame,
        {
          fromFrameId: currentFrame.id,
          toFrameId: currentFrame.id,
          hotspotId: null,
          missedClick: true,
        },
        `${currentFrame.title} is an ending. Restart to explore a different path.`,
      );
    }

    const chosenHotspot = resolveHotspot(currentFrame, input.click!, input.hotspotId);

    if (!chosenHotspot) {
      return buildSuccessResponse(
        story.storyId,
        currentFrame,
        {
          fromFrameId: currentFrame.id,
          toFrameId: currentFrame.id,
          hotspotId: null,
          missedClick: true,
        },
        "No story hotspot was clicked. Try another area to continue.",
      );
    }

    const nextFrame = getFrame(chosenHotspot.nextFrameId);

    if (!nextFrame) {
      return buildSuccessResponse(
        story.storyId,
        startFrame,
        {
          fromFrameId: currentFrame.id,
          toFrameId: startFrame.id,
          hotspotId: chosenHotspot.id,
          missedClick: false,
        },
        "The destination frame was missing, so the story restarted safely.",
      );
    }

    return buildSuccessResponse(
      story.storyId,
      nextFrame,
      {
        fromFrameId: currentFrame.id,
        toFrameId: nextFrame.id,
        hotspotId: chosenHotspot.id,
        missedClick: false,
      },
      `Transitioned to ${nextFrame.title}.`,
    );
  },
});
