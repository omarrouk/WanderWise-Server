import { Request, Response, NextFunction } from "express";
import Itinerary from "../models/Itinerary";
import { WeatherService } from "../services/weatherService";
import { AIService } from "../services/aiService";
import { asyncHandler, AppError } from "../middleware/errorMiddleware";

const weatherService = new WeatherService();
const aiService = new AIService();

// @desc    Generate new itinerary
// @route   POST /api/itineraries/generate
// @access  Public
export const generateItinerary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { destination, startDate, endDate, preferences } = req.body;

    // Validation
    if (!destination || !startDate || !endDate) {
      throw new AppError(
        "Destination, start date, and end date are required",
        400
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      throw new AppError("End date must be after start date", 400);
    }

    const daysDiff = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 14) {
      throw new AppError("Maximum trip duration is 14 days", 400);
    }

    // Fetch weather data
    const weather = await weatherService.getWeatherForecast(
      destination,
      start,
      end
    );

    // Generate AI itinerary
    const itinerary = await aiService.generateItinerary(
      destination,
      start,
      end,
      preferences || {},
      weather
    );

    // Extract locations for map (simple extraction from itinerary text)
    const mapLocations = extractLocations(itinerary, destination);

    res.status(200).json({
      success: true,
      data: {
        destination,
        startDate: start,
        endDate: end,
        preferences: preferences || {},
        weather,
        itinerary,
        mapLocations,
      },
    });
  }
);

// @desc    Save itinerary to database
// @route   POST /api/itineraries
// @access  Public
export const saveItinerary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const itineraryData = req.body;

    if (
      !itineraryData.destination ||
      !itineraryData.startDate ||
      !itineraryData.endDate
    ) {
      throw new AppError("Missing required fields", 400);
    }

    const itinerary = await Itinerary.create(itineraryData);

    res.status(201).json({
      success: true,
      data: itinerary,
      message: "Itinerary saved successfully",
    });
  }
);

// @desc    Get all itineraries
// @route   GET /api/itineraries
// @access  Public
export const getItineraries = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId, limit = 20, page = 1 } = req.query;

    const query: any = {};
    if (userId) {
      query.userId = userId;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [itineraries, total] = await Promise.all([
      Itinerary.find(query)
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip(skip)
        .lean(),
      Itinerary.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: itineraries,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  }
);

// @desc    Get single itinerary
// @route   GET /api/itineraries/:id
// @access  Public
export const getItinerary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const itinerary = await Itinerary.findById(req.params.id);

    if (!itinerary) {
      throw new AppError("Itinerary not found", 404);
    }

    res.status(200).json({
      success: true,
      data: itinerary,
    });
  }
);

// @desc    Update itinerary
// @route   PUT /api/itineraries/:id
// @access  Public
export const updateItinerary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    let itinerary = await Itinerary.findById(req.params.id);

    if (!itinerary) {
      throw new AppError("Itinerary not found", 404);
    }

    itinerary = await Itinerary.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: itinerary,
      message: "Itinerary updated successfully",
    });
  }
);

// @desc    Delete itinerary
// @route   DELETE /api/itineraries/:id
// @access  Public
export const deleteItinerary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const itinerary = await Itinerary.findById(req.params.id);

    if (!itinerary) {
      throw new AppError("Itinerary not found", 404);
    }

    await itinerary.deleteOne();

    res.status(200).json({
      success: true,
      message: "Itinerary deleted successfully",
    });
  }
);

// @desc    Regenerate a single day
// @route   POST /api/itineraries/regenerate-day
// @access  Public
export const regenerateDay = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { destination, dayNumber, date, preferences, weather } = req.body;

    if (!destination || !dayNumber || !date) {
      throw new AppError("Missing required fields", 400);
    }

    const newDay = await aiService.regenerateDay(
      destination,
      dayNumber,
      date,
      preferences || {},
      weather
    );

    res.status(200).json({
      success: true,
      data: newDay,
    });
  }
);

// Helper function to extract locations from itinerary
function extractLocations(itinerary: any[], destination: string): any[] {
  // This is a simple implementation
  // In production, you'd want to use a geocoding API or NLP
  const locations = [
    {
      name: `${destination} City Center`,
      lat: 0,
      lng: 0,
      type: "attraction",
      description: "Main city area",
    },
  ];

  return locations;
}
