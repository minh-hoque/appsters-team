import type { ToolDefinition } from "../utils/define-tool";
import pizzaAlbumsTool from "./pizza-albums";
import pizzaCarouselTool from "./pizza-carousel";
import pizzaListTool from "./pizza-list";
import pizzaMapTool from "./pizza-map";
import pizzaShopTool from "./pizza-shop";
import sparkAcceptMatchTool from "./spark-accept-match";
import sparkFindMatchesTool from "./spark-find-matches";

export const toolDefinitions: ToolDefinition[] = [
  pizzaMapTool,
  pizzaCarouselTool,
  pizzaAlbumsTool,
  pizzaListTool,
  pizzaShopTool,
  sparkFindMatchesTool,
  sparkAcceptMatchTool,
];
