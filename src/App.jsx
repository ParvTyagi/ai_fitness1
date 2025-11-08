import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Dumbbell, UtensilsCrossed, Volume2, Download, Moon, Sun, Sparkles,
  RefreshCw, Camera, Loader2, X, Quote, Save, ChevronDown, ChevronUp, Play, Pause
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";

/* ===========================
   Reusable UI
=========================== */
const Card = React.memo(({ children, darkMode, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`rounded-2xl shadow-lg p-6 ${
      darkMode ? "bg-gray-800 text-white" : "bg-white text-gray-900"
    } ${className}`}
  >
    {children}
  </motion.div>
));

const Input = React.memo(({ label, name, value, onChange, type = "text", darkMode, placeholder }) => (
  <div>
    <label className="block text-sm mb-1 font-medium">{label}</label>
    <input
      name={name}
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      className={`w-full px-4 py-2 rounded-lg border ${
        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
      } focus:ring-2 focus:ring-purple-500 focus:outline-none transition`}
    />
  </div>
));

const Select = React.memo(({ label, name, value, onChange, options, darkMode }) => (
  <div>
    <label className="block text-sm mb-1 font-medium">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-2 rounded-lg border ${
        darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
      } focus:ring-2 focus:ring-purple-500 focus:outline-none transition`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
));

/* ===========================
   App
=========================== */
export default function App() {
  /* Theme & App State */
  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "dark");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);

  const [plan, setPlan] = useState(() => {
    try {
      const cached = localStorage.getItem("fitness_plan");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [currentStep, setCurrentStep] = useState(plan ? "plan" : "form");
  const [expandedDay, setExpandedDay] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);

  const [dailyQuote, setDailyQuote] = useState(localStorage.getItem("daily_quote") || "Stay strong and consistent!");
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null); // { name, dataUrl }
  const [apiKey, setApiKey] = useState(localStorage.getItem("gemini_api") || "");

  // Optional TTS provider (fallback to browser speech)
  const [elevenKey, setElevenKey] = useState(localStorage.getItem("eleven_key") || "");
  const [elevenVoiceId, setElevenVoiceId] = useState(localStorage.getItem("eleven_voice") || "21m00Tcm4TlvDq8ikWAM");
  const audioRef = useRef(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "male",
    height: "",
    weight: "",
    fitnessGoal: "weight_loss",
    fitnessLevel: "beginner",
    workoutLocation: "gym",
    dietaryPreference: "non_veg",
    medicalHistory: "",
    stressLevel: "moderate",
  });

  /* Effects */
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const today = new Date().toLocaleDateString();
    if (localStorage.getItem("daily_quote_date") !== today && apiKey) {
      generateDailyQuote();
    }
  }, [apiKey]);

  /* Handlers */
  const onChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const saveKeys = () => {
    localStorage.setItem("gemini_api", apiKey.trim());
    localStorage.setItem("eleven_key", elevenKey.trim());
    localStorage.setItem("eleven_voice", elevenVoiceId.trim());
    alert("✅ API keys saved locally.");
  };

  /* Gemini helpers */
  const getGemini = () => {
    if (!apiKey) throw new Error("Please enter your Gemini API key first!");
    return new GoogleGenAI({ apiKey });
  };

  /* ============ AI: Plan Generation (Text) ============ */
  const generatePlan = async () => {
    if (!apiKey) return alert("Enter your Gemini API key first!");
    setLoading(true);
    try {
      const ai = getGemini();
      const prompt = `
You are an expert AI fitness coach. Create a personalized fitness plan based on the following user data:

${JSON.stringify(formData, null, 2)}

Return ONLY valid JSON with this exact structure (no markdown, no extra text):
{
  "motivationalQuote": "A powerful motivational quote",
  "workoutPlan": {
    "overview": "Brief overview of the workout philosophy",
    "days": [
      {
        "day": "Day 1",
        "focus": "Chest & Triceps",
        "exercises": [
          { "name": "Bench Press", "sets": "3", "reps": "12", "rest": "60s" }
        ]
      }
    ]
  },
  "dietPlan": {
    "overview": "Diet philosophy and calorie target",
    "meals": {
      "breakfast": ["Oatmeal with fruits", "Protein shake"],
      "lunch": ["Grilled chicken breast", "Brown rice", "Vegetables"],
      "dinner": ["Salmon", "Sweet potato", "Salad"],
      "snacks": ["Greek yogurt", "Nuts"]
    }
  },
  "lifestyleTips": ["Tip 1", "Tip 2", "Tip 3"]
}`;
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      // Response text may or may not be wrapped in codefences
      const raw = res?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      const clean = raw.replace(/^```json\s*|\s*```$/g, "");
      const json = JSON.parse(clean);
      setPlan(json);
      localStorage.setItem("fitness_plan", JSON.stringify(json));
      setCurrentStep("plan");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to generate plan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ============ AI: Daily Quote ============ */
  const generateDailyQuote = async () => {
    if (!apiKey) return;
    setQuoteLoading(true);
    try {
      const ai = getGemini();
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Give one short motivational fitness quote under 15 words. Return only the quote, no quotation marks.",
      });
      const quote = res?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Stay consistent!";
      setDailyQuote(quote);
      localStorage.setItem("daily_quote", quote);
      localStorage.setItem("daily_quote_date", new Date().toLocaleDateString());
    } catch (err) {
      console.error(err);
    } finally {
      setQuoteLoading(false);
    }
  };

  /* ============ AI: Image Generation ============ */
  const generateImage = async (name, type = "exercise") => {
    if (!apiKey) return alert("Enter your Gemini API key first!");
    setImageLoading(true);
    try {
      const ai = getGemini();
      const basePrompt =
        type === "exercise"
          ? `Create a realistic high-quality photo of "${name}" being performed in a modern gym. Dynamic lighting, crisp details, 4k.`
          : `Create a realistic high-quality food photo of "${name}" plated beautifully, natural light, restaurant style, 4k.`;

      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: basePrompt,
      });

      let dataUrl = null;
      for (const part of res?.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          dataUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
      if (!dataUrl) throw new Error("No image data returned.");
      setSelectedImage({ name, dataUrl });
    } catch (err) {
      alert("❌ Image generation failed: " + err.message);
    } finally {
      setImageLoading(false);
    }
  };

  /* ============ Voice (TTS) ============ */
  const speakSection = async (section) => {
    if (!plan) return;
    const text =
      section === "workout"
        ? plan?.workoutPlan?.overview || "Workout details."
        : plan?.dietPlan?.overview || "Diet details.";

    // ElevenLabs if configured
    if (elevenKey) {
      try {
        setTtsLoading(true);
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}/stream`,
          {
            method: "POST",
            headers: {
              "xi-api-key": elevenKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({ text }),
          }
        );
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioBlobUrl(url);
        setTimeout(() => {
          audioRef.current?.play();
          setIsPlaying(true);
        }, 200);
        return;
      } catch (e) {
        console.warn("ElevenLabs failed, using browser speech.", e);
      } finally {
        setTtsLoading(false);
      }
    }

    // Browser speech fallback
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setIsPlaying(false);
    speechSynthesis.speak(utter);
    setIsPlaying(true);
  };

  /* ============ Export as PDF ============ */
  const exportPDF = () => {
    if (!plan) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 40;
    let y = margin;

    const addLine = (txt, fontSize = 12, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(txt, 515);
      lines.forEach((line) => {
        if (y > 780) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += fontSize + 4;
      });
      y += 6;
    };

    addLine("AI FITNESS COACH - PERSONALIZED PLAN", 16, true);
    addLine(`Generated for: ${formData.name || "Anonymous"}`, 12);
    addLine(`Date: ${new Date().toLocaleDateString()}`, 12);
    addLine(" ");

    addLine("MOTIVATIONAL QUOTE", 14, true);
    addLine(plan.motivationalQuote);

    addLine("WORKOUT PLAN", 14, true);
    addLine(plan.workoutPlan.overview);
    plan.workoutPlan.days.forEach((day) => {
      addLine(`${day.day} - ${day.focus}`, 12, true);
      day.exercises.forEach((ex) => {
        addLine(`• ${ex.name}: ${ex.sets} sets × ${ex.reps} reps (Rest: ${ex.rest})`);
      });
    });

    addLine("DIET PLAN", 14, true);
    addLine(plan.dietPlan.overview);
    const m = plan.dietPlan.meals;
    const mealBlock = (title, arr) => {
      addLine(title, 12, true);
      arr.forEach((i) => addLine(`• ${i}`));
    };
    mealBlock("Breakfast", m.breakfast || []);
    mealBlock("Lunch", m.lunch || []);
    mealBlock("Dinner", m.dinner || []);
    mealBlock("Snacks", m.snacks || []);

    addLine("LIFESTYLE TIPS", 14, true);
    (plan.lifestyleTips || []).forEach((tip, i) => addLine(`${i + 1}. ${tip}`));

    doc.save("AI_Fitness_Plan.pdf");
  };

  /* ============ UI ============ */
  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"} min-h-screen transition-colors`}>
      {/* Header */}
      <header className={`${darkMode ? "bg-gray-800" : "bg-white"} sticky top-0 shadow-lg z-40`}>
        <div className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-2 rounded-lg">
              <Dumbbell className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Fitness Coach
            </h1>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"}`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-6 pb-20">
        {/* Daily Quote */}
        <Card
          darkMode={darkMode}
          className={`${darkMode ? "bg-gradient-to-r from-purple-900 to-blue-900" : "bg-gradient-to-r from-purple-500 to-blue-500 text-white"} text-center`}
        >
          <Quote className="w-9 h-9 mx-auto mb-2 opacity-90" />
          <p className="text-lg italic font-medium">
            {quoteLoading ? "Fetching inspiration..." : `“${dailyQuote}”`}
          </p>
          <button
            onClick={generateDailyQuote}
            disabled={quoteLoading || !apiKey}
            className="mt-3 px-4 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition"
          >
            {quoteLoading ? <Loader2 className="animate-spin inline w-4 h-4" /> : "New Quote"}
          </button>
        </Card>

        {/* API Keys */}
        <Card darkMode={darkMode}>
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Save className="w-5 h-5" />
            API Configuration
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Gemini API Key" name="gemini" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} type="password" darkMode={darkMode} placeholder="AIza..." />
            <Input label="ElevenLabs Key (Optional)" name="ekey" value={elevenKey} onChange={(e)=>setElevenKey(e.target.value)} type="password" darkMode={darkMode} />
            <Input label="ElevenLabs Voice ID" name="voice" value={elevenVoiceId} onChange={(e)=>setElevenVoiceId(e.target.value)} darkMode={darkMode} />
          </div>
          <button
            onClick={saveKeys}
            className={`mt-4 px-6 py-2 ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"} rounded-lg flex gap-2 items-center`}
          >
            <Save className="w-4 h-4" /> Save Keys
          </button>
        </Card>

        {/* Form */}
        {currentStep === "form" && (
          <Card darkMode={darkMode}>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="text-purple-600" />
              Tell Us About Yourself
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Name" name="name" value={formData.name} onChange={onChange} darkMode={darkMode} />
              <Input label="Age" name="age" value={formData.age} onChange={onChange} type="number" darkMode={darkMode} />
              <Select label="Gender" name="gender" value={formData.gender} onChange={onChange} darkMode={darkMode}
                options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }]} />
              <Input label="Height (cm)" name="height" value={formData.height} onChange={onChange} type="number" darkMode={darkMode} />
              <Input label="Weight (kg)" name="weight" value={formData.weight} onChange={onChange} type="number" darkMode={darkMode} />
              <Select label="Fitness Goal" name="fitnessGoal" value={formData.fitnessGoal} onChange={onChange} darkMode={darkMode}
                options={[
                  { value: "weight_loss", label: "Weight Loss" },
                  { value: "muscle_gain", label: "Muscle Gain" },
                  { value: "maintenance", label: "Maintenance" },
                  { value: "endurance", label: "Endurance" },
                ]} />
              <Select label="Fitness Level" name="fitnessLevel" value={formData.fitnessLevel} onChange={onChange} darkMode={darkMode}
                options={[
                  { value: "beginner", label: "Beginner" },
                  { value: "intermediate", label: "Intermediate" },
                  { value: "advanced", label: "Advanced" },
                ]} />
              <Select label="Workout Location" name="workoutLocation" value={formData.workoutLocation} onChange={onChange} darkMode={darkMode}
                options={[{ value: "gym", label: "Gym" }, { value: "home", label: "Home" }, { value: "outdoor", label: "Outdoor" }]} />
              <Select label="Dietary Preference" name="dietaryPreference" value={formData.dietaryPreference} onChange={onChange} darkMode={darkMode}
                options={[{ value: "non_veg", label: "Non-Vegetarian" }, { value: "veg", label: "Vegetarian" }, { value: "vegan", label: "Vegan" }, { value: "keto", label: "Keto" }]} />
              <Select label="Stress Level" name="stressLevel" value={formData.stressLevel} onChange={onChange} darkMode={darkMode}
                options={[{ value: "low", label: "Low" }, { value: "moderate", label: "Moderate" }, { value: "high", label: "High" }]} />
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 font-medium">Medical History (Optional)</label>
                <textarea
                  name="medicalHistory"
                  value={formData.medicalHistory}
                  onChange={onChange}
                  rows="3"
                  placeholder="Any injuries, conditions, or limitations..."
                  className={`w-full px-4 py-2 rounded-lg border ${
                    darkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300"
                  } focus:ring-2 focus:ring-purple-500 focus:outline-none transition`}
                />
              </div>
            </div>
            <button
              onClick={generatePlan}
              disabled={loading}
              className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg flex justify-center items-center gap-2 hover:shadow-xl transition-all duration-300 disabled:opacity-50 font-semibold text-lg"
            >
              {loading ? (<><Loader2 className="animate-spin" /> Generating Your Plan...</>) : (<><Sparkles /> Generate My AI Plan</>)}
            </button>
          </Card>
        )}

        {/* Generated Plan */}
        {currentStep === "plan" && plan && (
          <>
            <Card className="bg-gradient-to-r from-green-500 to-teal-500 text-white" darkMode={darkMode}>
              <Quote className="w-8 h-8 mb-2" />
              <p className="text-xl font-semibold italic">"{plan.motivationalQuote}"</p>
            </Card>

            {/* Actions */}
            <Card darkMode={darkMode} className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() => speakSection("workout")}
                disabled={ttsLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4" /> Read Workout
              </button>
              <button
                onClick={() => speakSection("diet")}
                disabled={ttsLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4" /> Read Diet
              </button>
              <button
                onClick={exportPDF}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export as PDF
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("fitness_plan");
                  setPlan(null);
                  setCurrentStep("form");
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Regenerate
              </button>

              {/* Optional audio controls if ElevenLabs used */}
              <AnimatePresence>
                {audioBlobUrl && (
                  <motion.audio
                    key="audio"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    ref={audioRef}
                    src={audioBlobUrl}
                    controls
                    className="mt-2 w-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                )}
              </AnimatePresence>
            </Card>

            {/* Workout Plan — LAG FIX: removed height animations */}
            <Card darkMode={darkMode}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Dumbbell className="text-purple-600" />
                Your Workout Plan
              </h2>
              <p className={`mb-6 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{plan.workoutPlan.overview}</p>
              <div className="space-y-3">
                {plan.workoutPlan.days.map((day, idx) => (
                  <div key={`${day.day}-${idx}`} className={`border rounded-lg overflow-hidden ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <button
                      onClick={() => setExpandedDay(expandedDay === idx ? null : idx)}
                      className={`w-full p-4 flex justify-between items-center ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} transition-colors`}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{day.day}</div>
                        <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{day.focus}</div>
                      </div>
                      {expandedDay === idx ? <ChevronUp /> : <ChevronDown />}
                    </button>

                    {/* No framer-motion here to avoid layout thrash */}
                    {expandedDay === idx && (
                      <div className="p-4 space-y-3 will-change-transform">
                        {day.exercises.map((ex, i) => (
                          <div key={`${ex.name}-${i}`} className={`p-3 rounded-lg ${darkMode ? "bg-gray-800" : "bg-gray-50"} flex justify-between items-start`}>
                            <div className="flex-1">
                              <div className="font-medium">{ex.name}</div>
                              <div className={`text-sm ${darkMode ? "text-gray-400" : "text-gray-600"}`}>
                                {ex.sets} sets × {ex.reps} reps • Rest: {ex.rest}
                              </div>
                            </div>
                            <button
                              onClick={() => generateImage(ex.name, "exercise")}
                              className="ml-2 p-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Diet Plan — LAG FIX: removed height animations */}
            <Card darkMode={darkMode}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <UtensilsCrossed className="text-green-600" />
                Your Diet Plan
              </h2>
              <p className={`mb-6 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>{plan.dietPlan.overview}</p>
              <div className="space-y-3">
                {Object.entries(plan.dietPlan.meals).map(([meal, items]) => (
                  <div key={meal} className={`border rounded-lg overflow-hidden ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                    <button
                      onClick={() => setExpandedMeal(expandedMeal === meal ? null : meal)}
                      className={`w-full p-4 flex justify-between items-center ${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} transition-colors`}
                    >
                      <div className="font-semibold capitalize">{meal}</div>
                      {expandedMeal === meal ? <ChevronUp /> : <ChevronDown />}
                    </button>

                    {/* No framer-motion here to avoid layout thrash */}
                    {expandedMeal === meal && (
                      <div className="p-4 space-y-2 will-change-transform">
                        {items.map((item, i) => (
                          <div key={`${meal}-${i}`} className={`p-3 rounded-lg ${darkMode ? "bg-gray-800" : "bg-gray-50"} flex justify-between items-center`}>
                            <span>{item}</span>
                            <button
                              onClick={() => generateImage(item, "food")}
                              className="ml-2 p-2 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Lifestyle Tips */}
            <Card darkMode={darkMode}>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Sparkles className="text-blue-600" />
                Lifestyle Tips
              </h2>
              <ul className="space-y-3">
                {plan.lifestyleTips.map((tip, i) => (
                  <li key={i} className={`${darkMode ? "bg-gray-800" : "bg-gray-50"} p-4 rounded-lg`}>{i + 1}. {tip}</li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </main>

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
            onClick={() => setSelectedImage(null)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className={`max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl ${darkMode ? "bg-gray-800" : "bg-white"}`}
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className={`flex justify-between items-center p-4 border-b ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                <h4 className="font-semibold text-lg">{selectedImage.name}</h4>
                <button className={`p-2 rounded-lg ${darkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`} onClick={() => setSelectedImage(null)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative bg-black">
                <img src={selectedImage.dataUrl} alt={selectedImage.name} className="w-full h-auto object-contain max-h-[70vh]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay for Images */}
      <AnimatePresence>
        {imageLoading && (
          <motion.div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className={`${darkMode ? "bg-gray-800" : "bg-white"} p-8 rounded-2xl text-center shadow-2xl`}>
              <Loader2 className="animate-spin text-purple-600 w-12 h-12 mx-auto mb-3" />
              <p className="text-lg font-medium">Generating image...</p>
              <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>Please wait</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
