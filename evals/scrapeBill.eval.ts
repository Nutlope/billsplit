import { evalite } from "evalite";
import { JSONDiff } from "autoevals";
import {
  DEFAULT_VISION_MODEL,
  scrapeBill,
} from "../src/lib/scrapeBill";
import { billEvals } from "./billsEvals";
import { billScorer } from "./billScorer";

const visionModels = [
  DEFAULT_VISION_MODEL,
  "google/gemma-4-31B-it",
  "MiniMaxAI/MiniMax-M3",
  "moonshotai/Kimi-K2.6",
];

visionModels.map((model) => {
  evalite(`Bill Scraping with: ${model}`, {
    data: async () =>
      billEvals.map((item) => ({
        input: item.input,
        expected: JSON.stringify(item.expected),
      })),
    task: async (input) =>
      JSON.stringify(
        await scrapeBill({
          billUrl: input,
          model: model,
        }),
      ),
    scorers: [billScorer],
  });
});
