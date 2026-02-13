import { z } from "zod/v3";
import storyGraphJson from "../content/anurag-story/story-graph.json";

const normalizedNumber = z.number().min(0).max(1);

const bboxSchema = z.object({
  x: normalizedNumber,
  y: normalizedNumber,
  w: normalizedNumber,
  h: normalizedNumber,
});

const hotspotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  bbox: bboxSchema,
  nextFrameId: z.string().min(1),
});

const frameSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  narration: z.string().min(1),
  imageKey: z.string().min(1),
  isEnding: z.boolean(),
  hotspots: z.array(hotspotSchema),
});

const storyGraphSchema = z.object({
  storyId: z.string().min(1),
  title: z.string().min(1),
  startFrameId: z.string().min(1),
  frames: z.array(frameSchema).min(1),
});

export type StoryHotspot = z.infer<typeof hotspotSchema>;
export type StoryFrame = z.infer<typeof frameSchema>;
export type StoryGraph = z.infer<typeof storyGraphSchema>;

function validateStoryGraph(graph: StoryGraph): StoryGraph {
  const frameIds = new Set<string>();

  for (const frame of graph.frames) {
    if (frameIds.has(frame.id)) {
      throw new Error(`Duplicate frame id found: ${frame.id}`);
    }

    frameIds.add(frame.id);

    if (frame.isEnding && frame.hotspots.length > 0) {
      throw new Error(`Ending frame ${frame.id} must not define hotspots.`);
    }

    for (const hotspot of frame.hotspots) {
      const maxX = hotspot.bbox.x + hotspot.bbox.w;
      const maxY = hotspot.bbox.y + hotspot.bbox.h;

      if (maxX > 1 || maxY > 1) {
        throw new Error(
          `Hotspot ${hotspot.id} in frame ${frame.id} exceeds normalized bounds.`,
        );
      }
    }
  }

  if (!frameIds.has(graph.startFrameId)) {
    throw new Error(`startFrameId ${graph.startFrameId} does not exist.`);
  }

  for (const frame of graph.frames) {
    for (const hotspot of frame.hotspots) {
      if (!frameIds.has(hotspot.nextFrameId)) {
        throw new Error(
          `Hotspot ${hotspot.id} in frame ${frame.id} points to unknown frame ${hotspot.nextFrameId}.`,
        );
      }
    }
  }

  return graph;
}

const parsedStoryGraph = validateStoryGraph(storyGraphSchema.parse(storyGraphJson));
const framesById = new Map<string, StoryFrame>();
const frameOrderById = new Map<string, number>();

parsedStoryGraph.frames.forEach((frame, index) => {
  framesById.set(frame.id, frame);
  frameOrderById.set(frame.id, index + 1);
});

export const anuragStoryGraph: StoryGraph = parsedStoryGraph;

export function getStory(storyId?: string): StoryGraph {
  if (!storyId || storyId === parsedStoryGraph.storyId) {
    return parsedStoryGraph;
  }

  return parsedStoryGraph;
}

export function getFrame(frameId: string): StoryFrame | undefined {
  return framesById.get(frameId);
}

export function getFrameStep(frameId: string): number {
  return frameOrderById.get(frameId) ?? 1;
}

export function getFrameCount(): number {
  return parsedStoryGraph.frames.length;
}
