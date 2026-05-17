// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');
const dns = require('dns');

// DNS Fix for MongoDB Atlas
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

console.log("MONGO_URI Loaded:", process.env.MONGO_URI ? "✅ Yes" : "❌ Not Found");

// ==================== MongoDB Connection ====================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}

console.log("🔗 Trying to connect to MongoDB Atlas...");

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected Successfully'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('\n💡 Tips: Check your .env file password and IP Whitelist');
  });

// Candidate Schema
const CandidateSchema = new mongoose.Schema({
  name: String,
  email: String,
  skills: [String],
  experience: Number,
  bio: String,
  createdAt: { type: Date, default: Date.now }
});

const Candidate = mongoose.model('Candidate', CandidateSchema);

// ==================== ROUTES ====================

// 1. Add Candidate
app.post('/api/candidates', async (req, res) => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    res.status(201).json({ message: 'Candidate added successfully', candidate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get All Candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Basic Match
app.post('/api/match', async (req, res) => {
  try {
    const { requiredSkills, minExperience = 0 } = req.body;
    const candidates = await Candidate.find();

    const result = candidates
      .map(candidate => {
        const matchedSkills = candidate.skills.filter(skill => 
          requiredSkills.includes(skill)
        );
        const matchScore = requiredSkills.length 
          ? Math.round((matchedSkills.length / requiredSkills.length) * 100) 
          : 0;

        return {
          ...candidate.toObject(),
          matchScore,
          matchedSkills,
          experienceMatch: candidate.experience >= minExperience
        };
      })
      .filter(c => c.experienceMatch)
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. AI Smart Shortlist (Improved)
app.post('/api/ai/shortlist', async (req, res) => {
  try {
    const { requiredSkills, minExperience = 0, preferredSkills = [] } = req.body;

    if (!requiredSkills || !Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return res.status(400).json({ error: "Required skills are mandatory" });
    }

    const candidates = await Candidate.find();
    const filteredCandidates = candidates.filter(c => c.experience >= Number(minExperience));

    if (filteredCandidates.length === 0) {
      return res.json({ 
        message: "No candidates meet the minimum experience requirement.",
        candidates: []
      });
    }

    const candidatesList = filteredCandidates
      .map((c, i) => `${i+1}. ${c.name} | Skills: ${c.skills.join(', ')} | Exp: ${c.experience} years`)
      .join('\n');

    const prompt = `
You are an expert technical recruiter.

Job Requirements:
- Required Skills: ${requiredSkills.join(', ')}
- Minimum Experience: ${minExperience} years
- Preferred Skills: ${preferredSkills.length ? preferredSkills.join(', ') : 'None'}

Candidates:
${candidatesList}

Rank the candidates from best to worst. For each candidate provide:
- Estimated Match Percentage
- Strong points
- Weak points (if any)
- Final Recommendation (Strong / Good / Fair)

Be concise and professional.
`;

    console.log("🤖 Calling OpenRouter AI...");

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Candidate Shortlisting System'
        },
        timeout: 30000
      }
    );

    console.log("✅ AI Response Received");

    res.json({
      candidates: filteredCandidates,
      aiRecommendation: response.data.choices[0].message.content,
      totalCandidates: filteredCandidates.length
    });

  } catch (error) {
    console.error("🔥 AI Error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "AI request failed",
      details: error.response?.data?.error || error.message 
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});