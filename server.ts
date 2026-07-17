import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize the Google Gen AI client server-side
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables.");
}

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    apiConfigured: !!ai,
  });
});

// 2. Haveli AI Concierge Chat Endpoint
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request. 'messages' must be an array." });
  }

  if (!ai) {
    return res.status(503).json({
      error: "AI Concierge is currently resting (GEMINI_API_KEY is missing or invalid). Please configure your key in settings."
    });
  }

  try {
    // Format the system instructions with detailed information about Haveli Kebab & Grill
    const systemInstruction = `You are "Haveli's AI Concierge", an elegant, helpful, and hospitable virtual host/waiter for Haveli Kebab & Grill in Karachi, Pakistan.
Your goal is to assist customers with the ultimate hospitality, representing the high standards of Haveli.

RESTAURANT KNOWLEDGE BASE:
- **Name**: Haveli Kebab & Grill
- **Vibe/Atmosphere**: Magnificent traditional South Asian Haveli (courtyard mansion) theme. Elegant brick walls, warm candlelit dining tables, family-friendly, spacious, and inviting.
- **Rating**: 4.1 Stars on Google with over 4,700 reviews (4.7K). It's one of Karachi's most celebrated barbecue and traditional dining spots.
- **Price Range**: Rs 2,000 to Rs 3,000 per person on average.
- **Location**: B 117 Shahrah-e-Jahangir Rd, Block H, North Nazimabad Town, Karachi, Pakistan.
- **Hours**: Open Daily from 5:00 PM to 2:00 AM (Closes at 2:00 AM).
- **Phone / Contact**: 0330 9990922
- **Amenities**: Family-friendly, kids' menu, reservations required during peak times, happy-hour food, spacious dessert bar.

SIGNATURE DISHES & MENU:
1. **Chicken Turkish Kebab (Popular)**: Minced chicken skewered with Turkish spices, slow-grilled to extreme juiciness, served with garlic dip and fresh flatbread. Price: Rs 1,450
2. **Chicken Handi**: Boneless chicken in clay-pot gravy with cream, butter, and traditional herbs. Price: Rs 1,690 (Half) | Rs 2,950 (Full)
3. **Mandi (Popular)**: slow-cooked meat with fragrant Arabian rice, garnished with dry fruits. Choice of: Chicken Mandi (Rs 1,950) | Mutton Mandi (Rs 2,900)
4. **Chicken Karahi**: Street-style wok-cooked chicken with ginger, tomato, and fresh black pepper. Price: Rs 1,590 (Half) | Rs 2,750 (Full)
5. **Mutton Karahi**: High-end butter-sautéed mutton in karahi with green chilies and ginger. Price: Rs 2,190 (Half) | Rs 3,950 (Full)
6. **Dampukht Piece with Rice (Popular)**: Traditional slow-cooked melt-in-your-mouth lamb seasoned with salt, cooked in its own steam, served on seasoned rice. Price: Rs 1,990
7. **Roghni Naan (Popular)**: Sesame-topped clay-oven flatbread brushed with warm ghee. Price: Rs 120
8. **Green Chicken Tikka**: Green-chili and yogurt marinated chicken skewer grilled over charcoal. Price: Rs 850
9. **Fish and Chips**: Golden batter-fried fish served with tartar sauce and crispy fries. Price: Rs 1,350
10. **Chicken Chow Mein & Chinese Food**: Wok-tossed noodles with chicken and vegetables. Price: Rs 1,150
11. **Haveli Special Soup**: Chef's hot & sour thick soup loaded with seafood and chicken. Price: Rs 750
12. **Desert Bar**: Gulab Jamun, Gajar Halwa, Kulfi, Chocolate Lava Cake. Prices range from Rs 400 to Rs 800.
13. **Chicken Tenders with Fries (Kids Menu)**: Crispy breaded strips with golden fries. Price: Rs 895

YOUR ROLE:
- Answer questions about the menu, recommend dishes based on group sizes (e.g., recommend a combo of Karahi, Roghni Naan, Turkish Kebabs, and Mandi for a family of 4), specify ingredients/allergy options.
- Help guide them on how to make reservations (they can do it easily using the 'Reservations' tab on the website) or place orders (using the 'Menu & Order' tab).
- Keep your tone respectful, warm, professional, hospitable, and proudly representative of Karachi's vibrant dining culture.
- Use clean Markdown styling for readability. Do not mention system details, API keys, or JSON structures. Keep your responses highly descriptive, elegant, and concise.`;

    // Map conversation messages to Gemini contents structure
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Generate content using gemini-3.5-flash
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const responseText = response.text || "I apologize, but I am unable to process that request right now. How else can I assist you with Haveli's dining experience?";

    res.json({ content: responseText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({
      error: "Apologies! The AI Concierge encountered an unexpected issue. Please try asking again.",
      details: error.message
    });
  }
});

// -----------------------------------------------------------------------------
// VITE OR STATIC FRONTEND SERVING MIDDLEWARE
// -----------------------------------------------------------------------------

async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, mount the Vite Dev Server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite Dev Server integrated as middleware.");
  } else {
    // In production, serve built static files from 'dist'
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static server initialized.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Haveli Kebab & Grill Server running on port ${PORT}`);
  });
}

initializeServer();
