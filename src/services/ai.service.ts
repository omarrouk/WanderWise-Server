import axios from "axios";
import { AppError } from "../middleware/errorMiddleware";
import { IActivity } from "../types/itinerary.type";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export interface StructuredItinerary {
  summary: string;
  dayActivities: IActivity[][];
  tips: string;
}

/**
 * Parse AI response and structure it into activities
 */
const parseAIResponse = (
  response: string,
  numberOfDays: number,
  destination: string
): StructuredItinerary => {
  const lines = response.split("\n");
  const dayActivities: IActivity[][] = Array(numberOfDays)
    .fill(null)
    .map(() => []);

  let currentDay = 0;
  let summary = "";
  let tips = "";
  let collectingSummary = true;
  let collectingTips = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Extract summary (before first day)
    if (collectingSummary && !trimmedLine.includes("Day")) {
      if (trimmedLine.length > 0) {
        summary += trimmedLine + " ";
      }
    }

    // Detect day markers (Day 1, Day 2, etc.)
    const dayMatch = trimmedLine.match(/[Dd]ay\s+(\d+)/);
    if (dayMatch) {
      collectingSummary = false;
      currentDay = parseInt(dayMatch[1]) - 1;
      if (currentDay >= numberOfDays) currentDay = numberOfDays - 1;
      continue;
    }

    // Collect tips section
    if (trimmedLine.toLowerCase().includes("tip") || collectingTips) {
      collectingTips = true;
      if (trimmedLine.length > 0 && !trimmedLine.toLowerCase().includes("overall")) {
        tips += trimmedLine + " ";
      }
    }

    // Parse activity lines (look for time indicators and descriptions)
    if (currentDay >= 0 && currentDay < numberOfDays && trimmedLine.length > 0) {
      // Skip headers and section markers
      if (
        trimmedLine.toLowerCase().includes("day") ||
        trimmedLine.toLowerCase().includes("activities") ||
        trimmedLine.toLowerCase().includes("dining") ||
        trimmedLine.toLowerCase().includes("recommended") ||
        trimmedLine.toLowerCase().includes("overall")
      ) {
        continue;
      }

      // Match activity patterns
      const timePattern = /(\d{1,2}):?(\d{2})?\s*(?:am|pm|AM|PM)?/;
      const timeMatch = trimmedLine.match(timePattern);

      if (timeMatch || (trimmedLine.length > 10 && !trimmedLine.startsWith("•"))) {
        const activity: IActivity = {
          id: `activity-${currentDay}-${dayActivities[currentDay].length}`,
          name: trimmedLine.replace(/^[-•*]\s*/, "").split("-")[0].trim(),
          description: trimmedLine.replace(/^[-•*]\s*/, ""),
          time: timeMatch ? `${timeMatch[1]}:${timeMatch[2] || "00"}` : "09:00",
          duration: 120, // Default 2 hours
          location: {
            name: destination,
            latitude: 0,
            longitude: 0,
          },
          category: categorizeActivity(trimmedLine),
          estimatedCost: estimateCost(trimmedLine),
          notes: "",
        };

        dayActivities[currentDay].push(activity);
      }
    }
  }

  return {
    summary: summary.trim(),
    dayActivities,
    tips: tips.trim(),
  };
};

/**
 * Categorize activity based on keywords
 */
const categorizeActivity = (
  text: string
): "attraction" | "dining" | "accommodation" | "transport" | "shopping" | "activity" => {
  const lower = text.toLowerCase();

  if (lower.includes("restaurant") || lower.includes("dinner") || lower.includes("lunch") || lower.includes("breakfast") || lower.includes("cafe")) {
    return "dining";
  }
  if (lower.includes("hotel") || lower.includes("accommodation") || lower.includes("stay")) {
    return "accommodation";
  }
  if (lower.includes("tour") || lower.includes("hike") || lower.includes("adventure") || lower.includes("activity")) {
    return "activity";
  }
  if (lower.includes("shop") || lower.includes("market") || lower.includes("store")) {
    return "shopping";
  }
  if (lower.includes("transport") || lower.includes("taxi") || lower.includes("train") || lower.includes("bus")) {
    return "transport";
  }

  return "attraction";
};

/**
 * Estimate cost based on activity type
 */
const estimateCost = (text: string): number => {
  const lower = text.toLowerCase();

  if (lower.includes("luxury") || lower.includes("fine dining")) return 150;
  if (lower.includes("restaurant") || lower.includes("dinner")) return 60;
  if (lower.includes("cafe") || lower.includes("lunch")) return 30;
  if (lower.includes("museum") || lower.includes("tour")) return 25;
  if (lower.includes("hike") || lower.includes("walk")) return 0;
  if (lower.includes("activity")) return 50;

  return 0;
};

export const generateTravelItinerary = async (
  destination: string,
  startDate: string,
  endDate: string,
  travelStyle: string,
  budget?: number,
  preferences?: string[],
  numberOfDays?: number
): Promise<StructuredItinerary> => {
  try {
    if (!OPENROUTER_API_KEY) {
      throw new AppError(
        "OpenRouter API key not configured",
        500,
        "CONFIG_ERROR"
      );
    }

    const preferencesText =
      preferences && preferences.length > 0
        ? preferences.join(", ")
        : "General sightseeing and local experiences";

    const prompt = `You are an expert travel planner for the AI trip planner app "WanderWise". Create a detailed ${numberOfDays}-day travel itinerary for a trip to ${destination}.

Trip Details:
- Dates: ${startDate} to ${endDate}
- Travel Style: ${travelStyle}
- Budget: $${budget || "flexible"}
- Interests: ${preferencesText}

Please provide:
1. A brief summary of the trip
2. For each day:
   - Recommended activities with estimated times
   - Local restaurants or dining recommendations
   - Estimated costs
   - Travel tips specific to that location
3. Overall tips for the destination
4. Best areas to stay
5. Transportation recommendations

Format your response in a structured way that can be parsed. Use clear day-by-day breakdown.`;

    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": process.env.CLIENT_URL || "http://localhost:3000",
          "X-Title": "WanderWise",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (!response.data.choices || !response.data.choices[0]?.message?.content) {
      throw new AppError(
        "Invalid response format from AI service",
        500,
        "AI_SERVICE_ERROR"
      );
    }

    const aiText = response.data.choices[0].message.content;
    const structuredItinerary = parseAIResponse(aiText, numberOfDays || 1, destination);

    return structuredItinerary;
  } catch (error) {
    console.error("AI Service Error:", error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;

      if (status === 405) {
        throw new AppError(
          `OpenRouter API Error: ${status} ${statusText}. Please check the API endpoint and credentials.`,
          500,
          "AI_SERVICE_ERROR"
        );
      }

      if (status === 401 || status === 403) {
        throw new AppError(
          "OpenRouter API authentication failed. Invalid API key.",
          500,
          "AI_SERVICE_ERROR"
        );
      }

      if (status === 429) {
        throw new AppError(
          "OpenRouter API rate limit exceeded. Please try again later.",
          429,
          "RATE_LIMIT_ERROR"
        );
      }

      throw new AppError(
        `OpenRouter API Error: ${error.message}`,
        500,
        "AI_SERVICE_ERROR"
      );
    }

    throw new AppError(
      "Failed to generate itinerary with AI",
      500,
      "AI_SERVICE_ERROR"
    );
  }
};
