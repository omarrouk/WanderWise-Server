import axios from "axios";

interface WeatherData {
  date: string;
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

export class WeatherService {
  private apiKey: string;
  private baseUrl = "https://api.openweathermap.org/data/2.5";

  constructor() {
    this.apiKey = process.env.OPENWEATHER_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("OPENWEATHER_API_KEY is not defined");
    }
  }

  async getCoordinates(
    destination: string
  ): Promise<{ lat: number; lon: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          q: destination,
          appid: this.apiKey,
        },
      });

      return {
        lat: response.data.coord.lat,
        lon: response.data.coord.lon,
      };
    } catch (error: any) {
      throw new Error(
        `Failed to get coordinates for ${destination}: ${error.message}`
      );
    }
  }

  async getWeatherForecast(
    destination: string,
    startDate: Date,
    endDate: Date
  ): Promise<WeatherData[]> {
    try {
      // Get coordinates first
      const { lat, lon } = await this.getCoordinates(destination);

      // Get 5-day forecast (free tier)
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: "metric",
        },
      });

      const forecastData = response.data.list;
      const weatherByDay: Map<string, any> = new Map();

      // Group by date and get midday forecast
      forecastData.forEach((item: any) => {
        const date = new Date(item.dt * 1000).toISOString().split("T")[0];
        const hour = new Date(item.dt * 1000).getHours();

        // Get midday forecast (around 12:00)
        if (
          !weatherByDay.has(date) ||
          Math.abs(hour - 12) < Math.abs(weatherByDay.get(date).hour - 12)
        ) {
          weatherByDay.set(date, {
            date,
            temp: Math.round(item.main.temp),
            feelsLike: Math.round(item.main.feels_like),
            description: item.weather[0].description,
            humidity: item.main.humidity,
            windSpeed: Math.round(item.wind.speed * 3.6), // Convert m/s to km/h
            icon: item.weather[0].icon,
            hour,
          });
        }
      });

      // Convert to array and filter by date range
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();

      const weatherArray = Array.from(weatherByDay.values())
        .filter((weather) => {
          const weatherTime = new Date(weather.date).getTime();
          return weatherTime >= startTime && weatherTime <= endTime;
        })
        .map(({ hour, ...weather }) => weather);

      return weatherArray;
    } catch (error: any) {
      console.error("Weather API Error:", error.message);
      // Return mock data if API fails
      return this.getMockWeather(startDate, endDate);
    }
  }

  private getMockWeather(startDate: Date, endDate: Date): WeatherData[] {
    const days =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
    const mockWeather: WeatherData[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      mockWeather.push({
        date: date.toISOString().split("T")[0],
        temp: Math.round(20 + Math.random() * 10),
        feelsLike: Math.round(20 + Math.random() * 10),
        description: "Partly cloudy",
        humidity: Math.round(50 + Math.random() * 30),
        windSpeed: Math.round(10 + Math.random() * 10),
        icon: "04d",
      });
    }

    return mockWeather;
  }
}
