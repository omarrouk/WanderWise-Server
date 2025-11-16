import express from "express";
import {
  generateItinerary,
  saveItinerary,
  getItineraries,
  getItinerary,
  updateItinerary,
  deleteItinerary,
  regenerateDay,
} from "../controllers/itineraryController";
import { protect, optionalAuth } from "../middleware/authMiddleware";

const router = express.Router();

// Generate itinerary (doesn't save to DB) - optional auth
router.post("/generate", optionalAuth, generateItinerary);

// Regenerate a single day - optional auth
router.post("/regenerate-day", optionalAuth, regenerateDay);

// CRUD operations - require authentication
router.route("/")
  .get(protect, getItineraries)
  .post(protect, saveItinerary);

router.route("/:id")
  .get(protect, getItinerary)
  .put(protect, updateItinerary)
  .delete(protect, deleteItinerary);

export default router;