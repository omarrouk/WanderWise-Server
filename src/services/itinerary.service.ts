import { Itinerary } from "../models/itinerary.model";
import { AppError } from "../middleware/errorMiddleware";
import { generateTravelItinerary } from "./ai.service";
import { getCoordinatesByDestination, getWeatherForecast } from "./weather.service";
import {
  CreateItineraryDTO,
  UpdateItineraryDTO,
  GenerateItineraryDTO,
} from "../dtos/itinerary.dto";
import { IActivity, IDayItinerary } from "../types/itinerary.type";

/**
 * Create a basic itinerary (user-created, not AI-generated)
 */
export const createItineraryService = async (
  userId: string,
  data: CreateItineraryDTO
) => {
  const { destination, startDate, endDate, budget, travelStyle, preferences } = data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new AppError("End date must be after start date", 400, "INVALID_DATE_RANGE");
  }

  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Get coordinates for destination
  const { latitude, longitude } = await getCoordinatesByDestination(destination);

  // Initialize empty day itineraries
  const dayItineraries: IDayItinerary[] = [];
  for (let i = 1; i <= duration; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + i - 1);

    dayItineraries.push({
      day: i,
      date: dayDate,
      activities: [],
    });
  }

  const itinerary = await Itinerary.create({
    userId,
    destination,
    coordinates: { latitude, longitude },
    startDate: start,
    endDate: end,
    duration,
    dayItineraries,
    budget,
    travelStyle: travelStyle || "comfort",
    preferences: preferences || [],
    aiGenerated: false,
  });

  return {
    success: true,
    message: "Itinerary created successfully",
    itinerary,
  };
};

/**
 * Generate AI-powered itinerary
 */
export const generateAIItineraryService = async (
  userId: string,
  data: GenerateItineraryDTO
) => {
  const { destination, startDate, endDate, budget, travelStyle, preferences } = data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start >= end) {
    throw new AppError("End date must be after start date", 400, "INVALID_DATE_RANGE");
  }

  const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  // Get coordinates for destination
  const { latitude, longitude } = await getCoordinatesByDestination(destination);

  // Get weather forecast
  const weatherForecast = await getWeatherForecast(latitude, longitude, duration);

  // Generate itinerary with AI
  const aiResponse = await generateTravelItinerary(
    destination,
    startDate,
    endDate,
    travelStyle || "comfort",
    budget,
    preferences,
    duration
  );

  // Initialize day itineraries with weather and AI-generated activities
  const dayItineraries: IDayItinerary[] = [];
  for (let i = 0; i < duration; i++) {
    const dayDate = new Date(start);
    dayDate.setDate(dayDate.getDate() + i);

    // Get AI activities for this day
    const dailyActivities = aiResponse.dayActivities[i] || [];

    dayItineraries.push({
      day: i + 1,
      date: dayDate,
      weather: weatherForecast[i] || {
        temp: 20,
        condition: "Clear",
        humidity: 50,
        windSpeed: 5,
        icon: "01d",
      },
      activities: dailyActivities,
      summary: dailyActivities.map((a) => a.name).join(" • ") || "",
    });
  }

  const itinerary = await Itinerary.create({
    userId,
    destination,
    coordinates: { latitude, longitude },
    startDate: start,
    endDate: end,
    duration,
    dayItineraries,
    budget,
    travelStyle: travelStyle || "comfort",
    preferences: preferences || [],
    aiGenerated: true,
    aiNotes: aiResponse.summary || aiResponse.tips,
  });

  return {
    success: true,
    message: "AI itinerary generated successfully",
    itinerary,
    aiSuggestions: aiResponse.summary,
  };
};

/**
 * Get all itineraries for a user
 */
export const getUserItinerariesService = async (userId: string) => {
  const itineraries = await Itinerary.find({ userId }).sort({ createdAt: -1 });

  return {
    success: true,
    count: itineraries.length,
    itineraries,
  };
};

/**
 * Get a specific itinerary
 */
export const getItineraryService = async (userId: string, itineraryId: string) => {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    userId,
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  return {
    success: true,
    itinerary,
  };
};

/**
 * Update itinerary
 */
export const updateItineraryService = async (
  userId: string,
  itineraryId: string,
  data: UpdateItineraryDTO
) => {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    userId,
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  // Handle date updates
  if (data.startDate || data.endDate) {
    const start = new Date(data.startDate || itinerary.startDate);
    const end = new Date(data.endDate || itinerary.endDate);

    if (start >= end) {
      throw new AppError("End date must be after start date", 400, "INVALID_DATE_RANGE");
    }

    itinerary.startDate = start;
    itinerary.endDate = end;
    itinerary.duration = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Update other fields
  if (data.destination) itinerary.destination = data.destination;
  if (data.budget !== undefined) itinerary.budget = data.budget;
  if (data.travelStyle) itinerary.travelStyle = data.travelStyle;
  if (data.preferences) itinerary.preferences = data.preferences;
  if (data.dayItineraries) itinerary.dayItineraries = data.dayItineraries;
  if (data.aiNotes) itinerary.aiNotes = data.aiNotes;

  await itinerary.save();

  return {
    success: true,
    message: "Itinerary updated successfully",
    itinerary,
  };
};

/**
 * Add activity to a day
 */
export const addActivityService = async (
  userId: string,
  itineraryId: string,
  dayNumber: number,
  activity: IActivity
) => {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    userId,
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  const dayItinerary = itinerary.dayItineraries.find((d) => d.day === dayNumber);
  if (!dayItinerary) {
    throw new AppError("Day not found in itinerary", 404, "DAY_NOT_FOUND");
  }

  dayItinerary.activities.push(activity);
  await itinerary.save();

  return {
    success: true,
    message: "Activity added successfully",
    itinerary,
  };
};

/**
 * Update activity in a day
 */
export const updateActivityService = async (
  userId: string,
  itineraryId: string,
  dayNumber: number,
  activityId: string,
  updatedActivity: Partial<IActivity>
) => {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    userId,
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  const dayItinerary = itinerary.dayItineraries.find((d) => d.day === dayNumber);
  if (!dayItinerary) {
    throw new AppError("Day not found in itinerary", 404, "DAY_NOT_FOUND");
  }

  const activity = dayItinerary.activities.find((a) => a.id === activityId);
  if (!activity) {
    throw new AppError("Activity not found", 404, "ACTIVITY_NOT_FOUND");
  }

  Object.assign(activity, updatedActivity);
  await itinerary.save();

  return {
    success: true,
    message: "Activity updated successfully",
    itinerary,
  };
};

/**
 * Delete activity from a day
 */
export const deleteActivityService = async (
  userId: string,
  itineraryId: string,
  dayNumber: number,
  activityId: string
) => {
  const itinerary = await Itinerary.findOne({
    _id: itineraryId,
    userId,
  });

  if (!itinerary) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  const dayItinerary = itinerary.dayItineraries.find((d) => d.day === dayNumber);
  if (!dayItinerary) {
    throw new AppError("Day not found in itinerary", 404, "DAY_NOT_FOUND");
  }

  const activityIndex = dayItinerary.activities.findIndex((a) => a.id === activityId);
  if (activityIndex === -1) {
    throw new AppError("Activity not found", 404, "ACTIVITY_NOT_FOUND");
  }

  dayItinerary.activities.splice(activityIndex, 1);
  await itinerary.save();

  return {
    success: true,
    message: "Activity deleted successfully",
    itinerary,
  };
};

/**
 * Delete itinerary
 */
export const deleteItineraryService = async (userId: string, itineraryId: string) => {
  const result = await Itinerary.findOneAndDelete({
    _id: itineraryId,
    userId,
  });

  if (!result) {
    throw new AppError("Itinerary not found", 404, "NOT_FOUND");
  }

  return {
    success: true,
    message: "Itinerary deleted successfully",
  };
};
