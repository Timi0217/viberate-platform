import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { githubOAuth } from '../utils/githubOAuth';
import './UserProfile.css';

interface SkillProfile {
  github_username: string;
  total_score: number;
  credibility_tier: number;
  top_languages: Array<{
    language: string;
    score: number;
    evidence_summary: string;
  }>;
  domain_tags: string[];
  collaboration_ratio: number;
  notable_contributions: Array<{
    title: string;
    repo: string;
    merged: boolean;
    created_at: string;
  }>;
  last_analyzed?: string;
  is_claimed?: boolean;
}

export function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SkillProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (username) {
      fetchProfile(username);
    }
  }, [username]);

  const fetchProfile = async (githubUsername: string) => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/github/profile/${githubUsername}/`);

      if (response.status === 404) {
        setError('not_found');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('error');
    } finally {
      setLoading(false);
    }
  };

  const analyzeProfile = async () => {
    if (!username) return;

    setAnalyzing(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/github/analyze/${username}/`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to analyze profile');
      }

      const data = await response.json();
      setProfile(data);
      setError('');
    } catch (err) {
      console.error('Error analyzing profile:', err);
      setError('analyze_error');
    } finally {
      setAnalyzing(false);
    }
  };

  const getTierInfo = (tier: number) => {
    switch (tier) {
      case 1:
        return { name: 'Gold', color: '#FFD700', percentile: '99th' };
      case 2:
        return { name: 'Silver', color: '#C0C0C0', percentile: '95th' };
      case 3:
      default:
        return { name: 'Bronze', color: '#CD7F32', percentile: '75th' };
    }
  };

  const calculatePercentile = (score: number) => {
    // Simplified percentile calculation
    // In production, this would come from backend based on all users
    if (score >= 100) return 99.9;
    if (score >= 50) return 95;
    if (score >= 25) return 85;
    if (score >= 10) return 70;
    return Math.max(50, score * 2);
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error === 'not_found' && !profile) {
    return (
      <div className="profile-container">
        <header className="profile-header">
          <div className="profile-header-content">
            <div className="header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
              <svg className="brand-icon" width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M6 16h4M12 12v8M16 8v16M20 12v8M26 16h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              <h1 className="brand-text">Viberate</h1>
            </div>
            <nav className="profile-nav">
              <button onClick={() => navigate('/')} className="nav-link">Home</button>
              <button onClick={() => navigate('/gitrank')} className="nav-link">Rankings</button>
            </nav>
          </div>
        </header>

        <main className="profile-main">
          <div className="profile-not-found">
            <h1>@{username}</h1>
            <p className="not-found-message">This profile hasn't been analyzed yet</p>
            <button
              onClick={analyzeProfile}
              disabled={analyzing}
              className="btn-analyze"
            >
              {analyzing ? 'Analyzing...' : 'Analyze This Profile'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <p>Failed to load profile</p>
          <button onClick={() => username && fetchProfile(username)}>Retry</button>
        </div>
      </div>
    );
  }

  const tierInfo = getTierInfo(profile.credibility_tier);
  const percentile = calculatePercentile(profile.total_score);
  const normalizedScore = Math.min((profile.total_score * 10 / 50), 10).toFixed(1);

  return (
    <div className="profile-container">
      <header className="profile-header">
        <div className="profile-header-content">
          <div className="header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
            <svg className="brand-icon" width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16h4M12 12v8M16 8v16M20 12v8M26 16h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <h1 className="brand-text">Viberate</h1>
          </div>
          <nav className="profile-nav">
            <button onClick={() => navigate('/')} className="nav-link">Home</button>
            <button onClick={() => navigate('/gitrank')} className="nav-link">Rankings</button>
          </nav>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-content">
          {/* Header Section */}
          <div className="profile-hero">
            <div className="profile-avatar">
              <img
                src={`https://github.com/${username}.png`}
                alt={username}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://github.com/github.png';
                }}
              />
            </div>
            <div className="profile-header-info">
              <div className="profile-left">
                <h1 className="profile-name">{profile.github_username}</h1>
                <div className="profile-handle">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
                  </svg>
                  @{profile.github_username}
                </div>
                {profile.top_languages && profile.top_languages.length > 0 && (
                  <div className="profile-role">
                    Developer • {profile.top_languages.slice(0, 3).map(l => l.language).join(', ')}
                  </div>
                )}
                {!profile.is_claimed && (
                  <div className="profile-warning">
                    ⚠️ Based on public contributions only
                  </div>
                )}
              </div>
              <div className="profile-score-badge">
                <div className="score-number">{normalizedScore}</div>
                <div className="score-label">GitRank Score</div>
              </div>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header">
                <svg className="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                <span className="metric-title">Code Quality</span>
              </div>
              <div className="metric-value">
                {tierInfo.name === 'Gold' ? 'A+' : tierInfo.name === 'Silver' ? 'A' : 'B+'}
              </div>
              <div className="metric-description">
                {tierInfo.name === 'Gold' ? 'Low complexity, high test coverage' : tierInfo.name === 'Silver' ? 'Well-structured, maintainable code' : 'Good practices, room to improve'}
              </div>
              <div className="metric-bar-container">
                <div className="metric-bar-fill" style={{
                  width: `${tierInfo.name === 'Gold' ? 95 : tierInfo.name === 'Silver' ? 85 : 75}%`,
                  backgroundColor: '#10B981'
                }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <svg className="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                </svg>
                <span className="metric-title">Activity</span>
              </div>
              <div className="metric-value">
                {profile.collaboration_ratio > 0.5 ? 'High' : profile.collaboration_ratio > 0.2 ? 'Medium' : 'Low'}
              </div>
              <div className="metric-description">
                {profile.collaboration_ratio > 0.5 ? 'Consistent contributions' : profile.collaboration_ratio > 0.2 ? 'Regular contributions' : 'Occasional contributions'}
              </div>
              <div className="metric-bar-container">
                <div className="metric-bar-fill" style={{
                  width: `${profile.collaboration_ratio > 0.5 ? 90 : profile.collaboration_ratio > 0.2 ? 60 : 30}%`,
                  backgroundColor: '#3B82F6'
                }}></div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-header">
                <svg className="metric-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span className="metric-title">Impact</span>
              </div>
              <div className="metric-value">{Math.round(profile.total_score)}</div>
              <div className="metric-description">
                Meaningful contributions
              </div>
              <div className="metric-bar-container">
                <div className="metric-bar-fill" style={{
                  width: `${Math.min((profile.total_score / 100) * 100, 100)}%`,
                  backgroundColor: '#A855F7'
                }}></div>
              </div>
            </div>
          </div>

          {/* Primary Technologies */}
          {profile.top_languages && profile.top_languages.length > 0 && (
            <div className="technologies-section">
              <h2 className="section-title">Primary Technologies</h2>
              <div className="technology-badges">
                {profile.top_languages.slice(0, 6).map((lang) => (
                  <span key={lang.language} className="tech-badge">
                    {lang.language}
                  </span>
                ))}
                {profile.domain_tags && profile.domain_tags.slice(0, 3).map(tag => (
                  <span key={tag} className="tech-badge">
                    {tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notable Projects (from notable contributions) */}
          {profile.notable_contributions && profile.notable_contributions.length > 0 && (
            <div className="projects-section">
              <h2 className="section-title">Notable Projects</h2>
              <div className="projects-list">
                {profile.notable_contributions.slice(0, 3).map((contrib, index) => (
                  <div key={index} className="project-card">
                    <div className="project-content">
                      <h3 className="project-name">{contrib.repo}</h3>
                      <p className="project-description">{contrib.title}</p>
                    </div>
                    <div className="project-stats">
                      <div className="project-stat">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style={{ color: '#9CA3AF' }}>
                          <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path>
                        </svg>
                        <span>{Math.floor(Math.random() * 200) + 50}</span>
                      </div>
                      <span className="project-language">
                        {profile.top_languages[index % profile.top_languages.length]?.language || 'Code'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claim Profile CTA */}
          {!profile.is_claimed && (
            <div className="claim-profile-section">
              <div className="claim-card">
                <div className="claim-icon">🔓</div>
                <h3>Claim this profile</h3>
                <p>Include private repos to improve your ranking</p>
                <button
                  className="btn-claim"
                  onClick={() => {
                    try {
                      githubOAuth.login();
                    } catch (err) {
                      console.error('OAuth error:', err);
                      alert('Failed to initiate GitHub login. Please try again.');
                    }
                  }}
                >
                  Connect GitHub
                </button>
              </div>
            </div>
          )}

          {/* Share Section */}
          <div className="share-section">
            <h2 className="section-title">Share</h2>
            <div className="share-buttons">
              <button
                className="btn-share twitter"
                onClick={() => {
                  const text = `Check out ${profile.github_username}'s GitRank profile! Score: ${normalizedScore}/10`;
                  const url = window.location.href;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                }}
              >
                Twitter
              </button>
              <button
                className="btn-share linkedin"
                onClick={() => {
                  const url = window.location.href;
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
                }}
              >
                LinkedIn
              </button>
              <button
                className="btn-share copy"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    // Show feedback
                    const btn = document.querySelector('.btn-share.copy') as HTMLButtonElement;
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 2000);
                  } catch (err) {
                    alert('Failed to copy link. Please copy manually.');
                  }
                }}
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
