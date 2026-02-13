import { Button } from "@openai/apps-sdk-ui/components/Button";
import { z } from "zod/v3";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useWidgetProps } from "../hooks/use-widget-props";
import { useWidgetState } from "../hooks/use-widget-state";

import frameF01 from "./frames/f01.webp";
import frameF02 from "./frames/f02.webp";
import frameF03 from "./frames/f03.webp";
import frameF04 from "./frames/f04.webp";
import frameF05 from "./frames/f05.webp";
import frameF06 from "./frames/f06.webp";
import frameF07 from "./frames/f07.webp";
import frameF08 from "./frames/f08.webp";
import frameF09 from "./frames/f09.webp";
import frameF10 from "./frames/f10.webp";

const frameMap = {
  f01: frameF01,
  f02: frameF02,
  f03: frameF03,
  f04: frameF04,
  f05: frameF05,
  f06: frameF06,
  f07: frameF07,
  f08: frameF08,
  f09: frameF09,
  f10: frameF10,
} as const;

const clickSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const hotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
  nextFrameId: z.string(),
});

const storyOutputSchema = z.object({
  storyId: z.string(),
  frame: z.object({
    id: z.string(),
    title: z.string(),
    narration: z.string(),
    imageKey: z.string(),
    hotspots: z.array(hotspotSchema),
    isEnding: z.boolean(),
  }),
  transition: z.object({
    fromFrameId: z.string(),
    toFrameId: z.string(),
    hotspotId: z.string().nullable(),
    missedClick: z.boolean(),
  }),
  progress: z.object({
    step: z.number(),
    total: z.number(),
  }),
});

type StoryOutput = z.infer<typeof storyOutputSchema>;
type StoryHotspot = z.infer<typeof hotspotSchema>;

type StoryWidgetState = {
  storyId: string;
  currentFrameId: string | null;
  progress: StoryOutput["progress"] | null;
  frame: StoryOutput["frame"] | null;
  transition: StoryOutput["transition"] | null;
};

type StoryToolInput = {
  action: "start" | "click";
  storyId?: string;
  currentFrameId?: string;
  click?: z.infer<typeof clickSchema>;
  hotspotId?: string;
};

function getImageUrl(imageKey: string): string {
  const candidate = frameMap[imageKey as keyof typeof frameMap];
  if (candidate) {
    return candidate;
  }

  return frameF01;
}

function normalizeToolOutput(input: unknown): StoryOutput | null {
  const direct = storyOutputSchema.safeParse(input);
  if (direct.success) {
    return direct.data;
  }

  if (input && typeof input === "object" && "structuredContent" in input) {
    const maybeStructured = storyOutputSchema.safeParse(
      (input as { structuredContent?: unknown }).structuredContent,
    );

    if (maybeStructured.success) {
      return maybeStructured.data;
    }
  }

  return null;
}

async function callStoryTool(payload: StoryToolInput): Promise<StoryOutput> {
  if (typeof window === "undefined" || !window.openai?.callTool) {
    throw new Error("window.openai.callTool is unavailable in this runtime.");
  }

  const rawResponse = await window.openai.callTool("deja-vu", payload);
  const normalized = normalizeToolOutput(rawResponse);

  if (!normalized) {
    throw new Error("Tool response had an unexpected shape.");
  }

  return normalized;
}

function App() {
  const [widgetState, setWidgetState] = useWidgetState<StoryWidgetState>(() => ({
    storyId: "deja-vu-v1",
    currentFrameId: null,
    progress: null,
    frame: null,
    transition: null,
  }));
  const rawToolOutput = useWidgetProps<Record<string, unknown>>({});

  const [storyOutput, setStoryOutput] = useState<StoryOutput | null>(() =>
    normalizeToolOutput(rawToolOutput),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initializedRef = useRef(false);

  const persistWidgetState = useCallback(
    (output: StoryOutput) => {
      setWidgetState({
        storyId: output.storyId,
        currentFrameId: output.frame.id,
        progress: output.progress,
        frame: output.frame,
        transition: output.transition,
      });
    },
    [setWidgetState],
  );

  const runTransition = useCallback(
    async (payload: StoryToolInput) => {
      if (isLoading) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const output = await callStoryTool(payload);
        setStoryOutput(output);
        persistWidgetState(output);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load story frame.");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, persistWidgetState],
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    const fromTool = normalizeToolOutput(rawToolOutput);
    if (fromTool) {
      setStoryOutput(fromTool);
      persistWidgetState(fromTool);
      initializedRef.current = true;
      return;
    }

    if (widgetState?.frame && widgetState.progress && widgetState.transition) {
      setStoryOutput({
        storyId: widgetState.storyId,
        frame: widgetState.frame,
        progress: widgetState.progress,
        transition: widgetState.transition,
      });
      initializedRef.current = true;
      return;
    }

    initializedRef.current = true;
    void runTransition({ action: "start" });
  }, [persistWidgetState, rawToolOutput, runTransition, widgetState]);

  const canInteract = !isLoading && !!storyOutput;
  const frameImageUrl = storyOutput ? getImageUrl(storyOutput.frame.imageKey) : frameF01;

  const onImageClick = useCallback(
    async (event: MouseEvent<HTMLImageElement>) => {
      if (!storyOutput || storyOutput.frame.isEnding || !canInteract) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const rawX = (event.clientX - rect.left) / rect.width;
      const rawY = (event.clientY - rect.top) / rect.height;
      const click = clickSchema.parse({
        x: Math.max(0, Math.min(1, rawX)),
        y: Math.max(0, Math.min(1, rawY)),
      });

      await runTransition({
        action: "click",
        storyId: storyOutput.storyId,
        currentFrameId: storyOutput.frame.id,
        click,
      });
    },
    [canInteract, runTransition, storyOutput],
  );

  const onHotspotClick = useCallback(
    async (hotspot: StoryHotspot, event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (!storyOutput || !canInteract) {
        return;
      }

      const click = clickSchema.parse({
        x: hotspot.bbox.x + hotspot.bbox.w / 2,
        y: hotspot.bbox.y + hotspot.bbox.h / 2,
      });

      await runTransition({
        action: "click",
        storyId: storyOutput.storyId,
        currentFrameId: storyOutput.frame.id,
        click,
        hotspotId: hotspot.id,
      });
    },
    [canInteract, runTransition, storyOutput],
  );

  const onRestart = useCallback(async () => {
    await runTransition({ action: "start" });
  }, [runTransition]);

  const transitionHint = useMemo(() => {
    if (!storyOutput) {
      return "Loading story...";
    }

    if (storyOutput.transition.missedClick && !storyOutput.frame.isEnding) {
      return "That area was not interactive. Try a highlighted region.";
    }

    if (storyOutput.frame.isEnding) {
      return "Ending reached. Restart to explore a different branch.";
    }

    return "";
  }, [storyOutput]);

  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-4">
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-black/10 bg-[#faf7f2] px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-black">Deja Vu Interactive Story</h1>
          </div>
          <Button
            color="secondary"
            variant="soft"
            size="sm"
            onClick={onRestart}
            disabled={isLoading}
          >
            Restart
          </Button>
        </div>

        <div className="relative select-none">
          <img
            src={frameImageUrl}
            alt={storyOutput?.frame.title ?? "Story frame"}
            className="block h-auto w-full cursor-pointer"
            onClick={(event) => {
              void onImageClick(event);
            }}
          />

          {storyOutput?.frame.hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              type="button"
              onClick={(event) => {
                void onHotspotClick(hotspot, event);
              }}
                  className="absolute rounded-lg border border-amber-400/40 bg-[rgba(245,158,11,0.08)] shadow-[0_0_0_1px_rgba(251,191,36,0.14),0_4px_14px_rgba(0,0,0,0.18)] backdrop-blur-[1px] transition duration-200 hover:border-amber-300/55 hover:bg-[rgba(245,158,11,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/45"
              style={{
                left: `${hotspot.bbox.x * 100}%`,
                top: `${hotspot.bbox.y * 100}%`,
                width: `${hotspot.bbox.w * 100}%`,
                height: `${hotspot.bbox.h * 100}%`,
              }}
              aria-label={hotspot.label}
              title={hotspot.label}
              disabled={isLoading}
            />
          ))}

          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium text-white">
              Loading next frame...
            </div>
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <h2 className="text-lg font-semibold text-black">{storyOutput?.frame.title ?? "Preparing story"}</h2>
          <p className="text-sm leading-6 text-black/80">
            {storyOutput?.frame.narration ?? "Preparing the first story frame..."}
          </p>
          {transitionHint ? <p className="text-xs text-black/60">{transitionHint}</p> : null}

          {errorMessage ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {storyOutput?.frame.isEnding ? (
            <div className="pt-1">
              <Button
                color="primary"
                variant="solid"
                size="sm"
                onClick={onRestart}
                disabled={isLoading}
              >
                Restart story
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("deja-vu-root");
if (root) {
  createRoot(root).render(<App />);
}
