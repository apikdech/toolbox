import type { Tool } from "../types";

export const tools: Tool[] = [
  {
    id: "base64",
    name: "Base64 Converter",
    path: "/tools/base64",
    description: "Convert text to base64 and vice versa",
  },
  {
    id: "bill-split",
    name: "Bill Splitter",
    path: "/tools/bill-split",
    description: "Split bills among friends with discounts and additional fees",
  },
];
