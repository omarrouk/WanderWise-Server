import mongoose, { Schema, Document } from "mongoose";

export interface IDayItinerary {
  day: number;
  date: string;
  morning: string;
  afternoon: string;
  evening: string;
  notes?: string;
}

export interface IWeather {
  date: string;
  temp: number;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
}

export interface IMapLocation {
  name: string;
  lat: number;
  lng: number;
  type: "attraction" | "restaurant" | "hotel";
  description?: string;
}

export interface IItinerary extends Document {
  destination: string;
  startDate: Date;
  endDate: Date;
  preferences: {
    budget?: "low" | "medium" | "high";
    tripStyle?: "adventure" | "relaxing" | "cultural" | "nightlife" | "family";
    numberOfTravelers?: number;
    interests?: string[];
  };
  weather: IWeather[];
  itinerary: IDayItinerary[];
  mapLocations: IMapLocation[];
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItinerarySchema: Schema = new Schema(
  {
    destination: {
      type: String,
      required: [true, "Destination is required"],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    preferences: {
      budget: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      tripStyle: {
        type: String,
        enum: ["adventure", "relaxing", "cultural", "nightlife", "family"],
      },
      numberOfTravelers: {
        type: Number,
        default: 1,
        min: 1,
      },
      interests: [String],
    },
    weather: [
      {
        date: String,
        temp: Number,
        feelsLike: Number,
        description: String,
        humidity: Number,
        windSpeed: Number,
        icon: String,
      },
    ],
    itinerary: [
      {
        day: Number,
        date: String,
        morning: String,
        afternoon: String,
        evening: String,
        notes: String,
      },
    ],
    mapLocations: [
      {
        name: String,
        lat: Number,
        lng: Number,
        type: {
          type: String,
          enum: ["attraction", "restaurant", "hotel"],
        },
        description: String,
      },
    ],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
ItinerarySchema.index({ destination: 1, createdAt: -1 });
ItinerarySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IItinerary>("Itinerary", ItinerarySchema);
