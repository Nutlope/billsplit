import Together from "together-ai";

export const togetherBaseClient = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});
