import { ChantContext, Gabc } from "@vagdur/exsurge";
import {
  normalizeNotationWidth,
  type GabcNotationRenderer,
} from "./notation";

export class ExsurgeGabcNotationRenderer implements GabcNotationRenderer {
  async render(source: string, width: number): Promise<string> {
    const context = new ChantContext();
    context.drawDebuggingBounds = false;
    context.setRubricColor("#7c3028");

    const score = Gabc.createScoreFromSource(context, source, true);

    await new Promise<void>((resolve, reject) => {
      score.performLayoutAsync(context, resolve, reject);
    });

    score.layoutChantLines(context, normalizeNotationWidth(width));
    return score.createSvg(context);
  }
}
