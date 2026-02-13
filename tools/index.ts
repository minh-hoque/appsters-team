import type { ToolDefinition } from "../utils/define-tool";
import anuragStoryTool from "./anurag-story";
import pizzaAlbumsTool from "./pizza-albums";
import pizzaCarouselTool from "./pizza-carousel";
import pizzaListTool from "./pizza-list";
import pizzaMapTool from "./pizza-map";
import pizzaShopTool from "./pizza-shop";

export const toolDefinitions: ToolDefinition[] = [
  anuragStoryTool,
  pizzaMapTool,
  pizzaCarouselTool,
  pizzaAlbumsTool,
  pizzaListTool,
  pizzaShopTool,
];
