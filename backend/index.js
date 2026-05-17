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
    console.log('\n💡 Tips:');
    console.log('1. Check your password in .env file');
    console.log('2. Make sure IP is whitelisted in MongoDB Atlas');
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

// Add Candidate
app.post('/api/candidates', async (req, res) => {
  try {
    const candidate = new Candidate(req.body);
    await candidate.save();
    res.status(201).json({ message: 'Candidate added successfully', candidate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get All Candidates
app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Basic Match
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

// AI Shortlist
app.post('/api/ai/shortlist', async (req, res) => {
  try {
    const { requiredSkills, minExperience = 0, preferredSkills = [] } = req.body;
    const candidates = await Candidate.find();

    const filteredCandidates = candidates.filter(c => c.experience >= minExperience);

    if (filteredCandidates.length === 0) {
      return res.json({ message: "No candidates meet minimum experience." });
    }

    const candidatesList = filteredCandidates
      .map((c, i) => `${i+1}. ${c.name} | Skills: ${c.skills.join(', ')} | Exp: ${c.experience} years`)
      .join('\n');

    const prompt = `
Job Requirements: ${requiredSkills.join(', ')} | Min Experience: ${minExperience} years
Candidates:
${candidatesList}

Rank them from best to worst with match percentage and short reason.
`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "openai/gpt-4o",
        messages: [{ role: "user", content: prompt }]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      candidates: filteredCandidates,
      aiRecommendation: response.data.choices[0].message.content
    });

  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});