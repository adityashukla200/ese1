import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const API_BASE = 'http://localhost:5000';

  const [candidates, setCandidates] = useState([]);
  const [shortlisted, setShortlisted] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newCandidate, setNewCandidate] = useState({
    name: '', email: '', skills: '', experience: '', bio: ''
  });

  const [job, setJob] = useState({
    requiredSkills: '',
    minExperience: 0,
    preferredSkills: ''
  });

  const fetchCandidates = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/candidates`);
      setCandidates(res.data);
    } catch (err) {
      console.error("Error fetching candidates:", err);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const addCandidate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newCandidate,
        experience: Number(newCandidate.experience),
        skills: newCandidate.skills.split(',').map(s => s.trim()).filter(s => s)
      };
      await axios.post(`${API_BASE}/api/candidates`, payload);
      alert('✅ Candidate Added Successfully!');
      setNewCandidate({ name: '', email: '', skills: '', experience: '', bio: '' });
      fetchCandidates();
    } catch (err) {
      alert('❌ Error adding candidate');
    }
  };

  const basicMatch = async () => {
    setLoading(true);
    try {
      const payload = {
        requiredSkills: job.requiredSkills.split(',').map(s => s.trim()).filter(s => s),
        minExperience: Number(job.minExperience)
      };
      const res = await axios.post(`${API_BASE}/api/match`, payload);
      setShortlisted(res.data);
      setAiResult(null);
    } catch (err) {
      alert('Error in basic matching');
    }
    setLoading(false);
  };

  const aiShortlist = async () => {
    setLoading(true);
    try {
      const payload = {
        requiredSkills: job.requiredSkills.split(',').map(s => s.trim()).filter(s => s),
        minExperience: Number(job.minExperience),
        preferredSkills: job.preferredSkills.split(',').map(s => s.trim()).filter(s => s)
      };
      const res = await axios.post(`${API_BASE}/api/ai/shortlist`, payload);
      setShortlisted(res.data.candidates || []);
      setAiResult(res.data.aiRecommendation);
    } catch (err) {
      alert('AI Service Error - Make sure backend is running');
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header>
        <h1>🎯 Candidate Shortlisting System</h1>
      </header>

      <div className="container">
        {/* Add Candidate */}
        <div className="card">
          <h2>Add New Candidate</h2>
          <form onSubmit={addCandidate}>
            <input type="text" placeholder="Full Name" value={newCandidate.name} onChange={(e) => setNewCandidate({...newCandidate, name: e.target.value})} required />
            <input type="email" placeholder="Email" value={newCandidate.email} onChange={(e) => setNewCandidate({...newCandidate, email: e.target.value})} required />
            <input type="text" placeholder="Skills (React, Node.js, MongoDB)" value={newCandidate.skills} onChange={(e) => setNewCandidate({...newCandidate, skills: e.target.value})} required />
            <input type="number" placeholder="Experience (years)" value={newCandidate.experience} onChange={(e) => setNewCandidate({...newCandidate, experience: e.target.value})} required />
            <textarea placeholder="Bio / Projects" value={newCandidate.bio} onChange={(e) => setNewCandidate({...newCandidate, bio: e.target.value})} />
            <button type="submit">Add Candidate</button>
          </form>
        </div>

        {/* Job Form */}
        <div className="card">
          <h2>Job Requirements</h2>
          <input type="text" placeholder="Required Skills (comma separated)" value={job.requiredSkills} onChange={(e) => setJob({...job, requiredSkills: e.target.value})} />
          <input type="number" placeholder="Minimum Experience" value={job.minExperience} onChange={(e) => setJob({...job, minExperience: e.target.value})} />
          <input type="text" placeholder="Preferred Skills (optional)" value={job.preferredSkills} onChange={(e) => setJob({...job, preferredSkills: e.target.value})} />

          <div className="btn-group">
            <button onClick={basicMatch} disabled={loading}>Basic Match</button>
            <button onClick={aiShortlist} disabled={loading} className="ai-btn">🤖 AI Smart Shortlist</button>
          </div>
        </div>

        {/* Results */}
        {shortlisted.length > 0 && (
          <div className="card">
            <h2>Shortlisted Candidates {aiResult && "(AI Recommended)"}</h2>
            {shortlisted.map((c, i) => (
              <div key={i} className="candidate-card">
                <h3>{c.name}</h3>
                <p><strong>Exp:</strong> {c.experience} years</p>
                <p><strong>Skills:</strong> {c.skills?.join(', ')}</p>
                {c.matchScore && <p><strong>Match Score:</strong> <span className="score">{c.matchScore}%</span></p>}
              </div>
            ))}
          </div>
        )}

        {aiResult && (
          <div className="card ai-result">
            <h2>🤖 AI Recommendation</h2>
            <pre>{aiResult}</pre>
          </div>
        )}

        <div className="card">
          <h2>All Candidates ({candidates.length})</h2>
          {candidates.map(c => (
            <div key={c._id} className="candidate-card">
              <h3>{c.name}</h3>
              <p>{c.email}</p>
              <p><strong>Skills:</strong> {c.skills?.join(', ')}</p>
              <p><strong>Experience:</strong> {c.experience} years</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;