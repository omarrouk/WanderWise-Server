import axios from "axios";

interface ItineraryPreferences {
  budget?: string;
  tripStyle?: string;
  numberOfTravelers?: number;
  interests?: string[];
}

interface WeatherData {
  date: string;
  temp: number;
  description: string;
}

interface DayItinerary {
  day: number;
  date: string;
  morning: string;
  afternoon: string;
  evening: string;
  notes?: string;
}

export class AIService {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not defined");
    }
  }

  async generateItinerary(
    destination: string,
    startDate: Date,
    endDate: Date,
    preferences: ItineraryPreferences,
    weather: WeatherData[]
  ): Promise<DayItinerary[]> {
    try {
      const days =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

      const prompt = this.buildPrompt(destination, days, preferences, weather);

      const response = await axios.post(
        this.baseUrl,
        {
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a professional travel planner. Create detailed, practical itineraries.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0].message.content;
      return this.parseItinerary(content, startDate, days);
    } catch (error: any) {
      console.error("AI API Error:", error.response?.data || error.message);
      throw new Error("Failed to generate itinerary");
    }
  }

  private buildPrompt(
    destination: string,
    days: number,
    preferences: ItineraryPreferences,
    weather: WeatherData[]
  ): string {
    let prompt = `Create a ${days}-day travel itinerary for ${destination}.\n\n`;

    // Add preferences
    if (preferences.budget) {
      prompt += `Budget: ${preferences.budget}\n`;
    }
    if (preferences.tripStyle) {
      prompt += `Trip Style: ${preferences.tripStyle}\n`;
    }
    if (preferences.numberOfTravelers) {
      prompt += `Number of Travelers: ${preferences.numberOfTravelers}\n`;
    }
    if (preferences.interests && preferences.interests.length > 0) {
      prompt += `Interests: ${preferences.interests.join(", ")}\n`;
    }

    // Add weather info
    if (weather.length > 0) {
      prompt += `\nWeather Forecast:\n`;
      weather.forEach((w) => {
        prompt += `- ${w.date}: ${w.temp}°C, ${w.description}\n`;
      });
    }

    prompt += `\nFor each day, provide:
1. Morning activity (9 AM - 12 PM)
2. Afternoon activity (12 PM - 5 PM)
3. Evening activity (5 PM onwards)
4. Brief notes or tips

Format your response as JSON array with this structure:
[
  {
    "day": 1,
    "morning": "activity description",
    "afternoon": "activity description",
    "evening": "activity description",
    "notes": "helpful tips"
  }
]

Be specific with attraction names, restaurants, and locations. Consider the weather in your recommendations.`;

    return prompt;
  }

  private parseItinerary(
    content: string,
    startDate: Date,
    days: number
  ): DayItinerary[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return parsed.map((day: any, index: number) => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + index);

          return {
            day: index + 1,
            date: date.toISOString().split("T")[0],
            morning: day.morning || "Free time",
            afternoon: day.afternoon || "Free time",
            evening: day.evening || "Free time",
            notes: day.notes || "",
          };
        });
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
    }

    // Fallback: create basic itinerary
    return this.createFallbackItinerary(startDate, days);
  }

  private createFallbackItinerary(
    startDate: Date,
    days: number
  ): DayItinerary[] {
    const itinerary: DayItinerary[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      itinerary.push({
        day: i + 1,
        date: date.toISOString().split("T")[0],
        morning: "Explore local attractions and landmarks",
        afternoon: "Visit museums or cultural sites",
        evening: "Dinner at local restaurant",
        notes: "Adjust based on your preferences",
      });
    }

    return itinerary;
  }

  async regenerateDay(
    destination: string,
    dayNumber: number,
    date: string,
    preferences: ItineraryPreferences,
    weather?: WeatherData
  ): Promise<DayItinerary> {
    try {
      let prompt = `Create a single day itinerary for day ${dayNumber} in ${destination} on ${date}.\n\n`;

      if (preferences.budget) prompt += `Budget: ${preferences.budget}\n`;
      if (preferences.tripStyle)
        prompt += `Trip Style: ${preferences.tripStyle}\n`;
      if (weather) {
        prompt += `Weather: ${weather.temp}°C, ${weather.description}\n`;
      }

      prompt += `\nProvide:
- Morning activity (9 AM - 12 PM)
- Afternoon activity (12 PM - 5 PM)
- Evening activity (5 PM onwards)
- Brief notes

Format as JSON:
{
  "morning": "activity",
  "afternoon": "activity",
  "evening": "activity",
  "notes": "tips"
}`;

      const response = await axios.post(
        this.baseUrl,
        {
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a travel planner. Provide detailed day plans.",
            },
            { role: "user", content: prompt },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          day: dayNumber,
          date,
          morning: parsed.morning || "Free time",
          afternoon: parsed.afternoon || "Free time",
          evening: parsed.evening || "Free time",
          notes: parsed.notes || "",
        };
      }

      throw new Error("Failed to parse response");
    } catch (error) {
      return {
        day: dayNumber,
        date,
        morning: "Explore local area",
        afternoon: "Visit popular attractions",
        evening: "Enjoy local cuisine",
        notes: "Adjust based on preferences",
      };
    }
  }
}
