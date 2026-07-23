import React from 'react';
import { Mail, Briefcase, Calendar } from 'lucide-react';
import type { CandidateDetail } from '../types/candidate';

interface CandidateProfileCardProps {
  candidate: CandidateDetail;
}

export const CandidateProfileCard: React.FC<CandidateProfileCardProps> = ({ candidate }) => {
  return (
    <div className="detail-card profile-card">
      <div className="card-header">
        <h3>Candidate Profile</h3>
      </div>
      <div className="profile-grid">
        <div className="profile-item">
          <Mail size={16} className="profile-icon" />
          <div>
            <span className="profile-label">Email</span>
            <p className="profile-value">{candidate.email}</p>
          </div>
        </div>

        <div className="profile-item">
          <Briefcase size={16} className="profile-icon" />
          <div>
            <span className="profile-label">Role Applied</span>
            <p className="profile-value">{candidate.role_applied}</p>
          </div>
        </div>

        <div className="profile-item">
          <Calendar size={16} className="profile-icon" />
          <div>
            <span className="profile-label">Application Date</span>
            <p className="profile-value">
              {new Date(candidate.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="skills-section">
        <span className="profile-label">Skills & Tech Stack</span>
        <div className="skill-pills-list">
          {candidate.skills ? (
            candidate.skills.split(',').map((skill, idx) => (
              <span key={idx} className="skill-pill">
                {skill.trim()}
              </span>
            ))
          ) : (
            <span className="no-skills">No skills specified</span>
          )}
        </div>
      </div>
    </div>
  );
};
