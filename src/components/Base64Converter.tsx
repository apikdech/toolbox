import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";

const Base64Converter = () => {
  const [rawText, setRawText] = useState("");
  const [base64Text, setBase64Text] = useState("");

  const handleRawTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    try {
      const encoded = btoa(text);
      setBase64Text(encoded);
    } catch (error) {
      setBase64Text("Invalid input for base64 encoding");
    }
  };

  const handleBase64TextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const text = e.target.value;
    setBase64Text(text);
    try {
      const decoded = atob(text);
      setRawText(decoded);
    } catch (error) {
      setRawText("Invalid base64 string");
    }
  };

  const handleCopy = async (text: string, type: "raw" | "base64") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        `${type === "raw" ? "Raw" : "Base64"} text copied to clipboard!`,
        {
          duration: 2000,
          position: "bottom-right",
          style: {
            background: "#4B5563",
            color: "#fff",
          },
          icon: "📋",
        }
      );
    } catch (error) {
      toast.error("Failed to copy text", {
        duration: 2000,
        position: "bottom-right",
      });
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <Toaster />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <label
            htmlFor="raw-text"
            className="text-lg font-semibold text-gray-700"
          >
            Raw Text
          </label>
          <span className="text-sm text-gray-500">
            {rawText.length} characters
          </span>
        </div>
        <div className="relative group">
          <textarea
            id="raw-text"
            className="w-full h-[400px] p-4 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none font-mono scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400"
            value={rawText}
            onChange={handleRawTextChange}
            placeholder="Enter text to encode to base64..."
            spellCheck={false}
          />
          <button
            onClick={() => handleCopy(rawText, "raw")}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
            title="Copy to clipboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </div>

      <div className="hidden md:flex items-center">
        <div className="w-px h-[400px] bg-gray-200 relative">
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white p-2 rounded-full border border-gray-200 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <label
            htmlFor="base64-text"
            className="text-lg font-semibold text-gray-700"
          >
            Base64 Text
          </label>
          <span className="text-sm text-gray-500">
            {base64Text.length} characters
          </span>
        </div>
        <div className="relative group">
          <textarea
            id="base64-text"
            className="w-full h-[400px] p-4 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none font-mono scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400"
            value={base64Text}
            onChange={handleBase64TextChange}
            placeholder="Enter base64 text to decode..."
            spellCheck={false}
          />
          <button
            onClick={() => handleCopy(base64Text, "base64")}
            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
            title="Copy to clipboard"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Base64Converter;
