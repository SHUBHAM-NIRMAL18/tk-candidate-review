import React from 'react';
import { Sparkles } from 'lucide-react';
import type { SkillMetric } from '../../types/analytics';

interface AnalyticsSkillsCloudProps {
  topSkills: SkillMetric[];
}

export const AnalyticsSkillsCloud: React.FC<AnalyticsSkillsCloudProps> = ({ topSkills }) => {
  return (
    <section className="analytics-section-card">
      <div className="section-title-row">
        <div className="section-title">
          <div className="section-icon-wrap emerald">
            <Sparkles size={18} />
          </div>
          <div>
            <h2 className="section-heading">Top In-Demand Skills</h2>
            <p className="section-subtitle">Frequency of technical tags across candidate pool</p>
          </div>
        </div>
      </div>

      {topSkills.length === 0 ? (
        <div className="empty-analytics-msg">No skill tags extracted yet.</div>
      ) : (
        <div className="skills-cloud-wrap">
          {topSkills.map((sk) => (
            <div key={sk.skill} className="skill-tag-pill">
              <span className="skill-name">{sk.skill}</span>
              <span className="skill-count-badge">{sk.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
