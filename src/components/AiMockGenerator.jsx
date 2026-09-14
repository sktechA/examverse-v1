import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  Eye,
  Info
} from 'lucide-react';

const BLUEPRINTS = {
  'ibps_rrb_po_prelims': {
    title: 'IBPS RRB PO (Officer Scale-I) Prelims',
    total_questions: 80,
    duration_minutes: 45,
    marks_per_question: 1,
    negative_marking: 0.25,
    sections: [
      { name: 'Reasoning Ability', subject: 'Reasoning', count: 40, marks: 40 },
      { name: 'Quantitative Aptitude', subject: 'Mathematics', count: 40, marks: 40 }
    ]
  },
  'ibps_rrb_clerk_prelims': {
    title: 'IBPS RRB Clerk (Office Assistant) Prelims',
    total_questions: 80,
    duration_minutes: 45,
    marks_per_question: 1,
    negative_marking: 0.25,
    sections: [
      { name: 'Reasoning Ability', subject: 'Reasoning', count: 40, marks: 40 },
      { name: 'Numerical Ability', subject: 'Mathematics', count: 40, marks: 40 }
    ]
  },
  'ssc_cgl_tier1': {
    title: 'SSC CGL Tier 1 Full Mock',
    total_questions: 100,
    duration_minutes: 60,
    marks_per_question: 2,
    negative_marking: 0.5,
    sections: [
      { name: 'General Intelligence & Reasoning', subject: 'Reasoning', count: 25, marks: 50 },
      { name: 'General Awareness', subject: 'General Awareness', count: 25, marks: 50 },
      { name: 'Quantitative Aptitude', subject: 'Mathematics', count: 25, marks: 50 },
      { name: 'English Comprehension', subject: 'English', count: 25, marks: 50 }
    ]
  },
  'mppsc_prelims_paper1': {
    title: 'MPPSC State Service Prelims Paper 1 (General Studies)',
    total_questions: 100,
    duration_minutes: 120,
    marks_per_question: 2,
    negative_marking: 0,
    sections: [
      { name: 'MP General Knowledge & History', subject: 'MP GK', count: 35, marks: 70 },
      { name: 'General Studies & Science', subject: 'General Awareness', count: 45, marks: 90 },
      { name: 'Current Affairs', subject: 'Current Affairs', count: 20, marks: 40 }
    ]
  },
  'mp_sub_engineer': {
    title: 'MPESB Sub Engineer (Civil / Electrical / Mechanical)',
    total_questions: 200,
    duration_minutes: 180,
    marks_per_question: 1,
    negative_marking: 0,
    sections: [
      { name: 'Non-Technical (General Knowledge & Reasoning)', subject: 'General Awareness', count: 100, marks: 100 },
      { name: 'Technical Engineering Section', subject: 'Civil Engineering', count: 100, marks: 100 }
    ]
  }
};

export default function AiMockGenerator({ supabase, onExamCreated }) {
  const [selectedBlueprintKey, setSelectedBlueprintKey] = useState('ibps_rrb_po_prelims');
  const [mockCount, setMockCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(false);
  const [inventory, setInventory] = useState({});
  const [msg, setMsg] = useState('');
  const [generationLog, setGenerationLog] = useState(null);

  const currentBp = BLUEPRINTS[selectedBlueprintKey];

  // Check inventory of approved questions for each section in the blueprint
  const checkInventory = async () => {
    if (!supabase || !currentBp) return;
    setCheckingInventory(true);
    setMsg('');
    const status = {};

    try {
      for (const sec of currentBp.sections) {
        const { count, error } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .eq('subject', sec.subject);

        status[sec.subject] = {
          needed: sec.count * mockCount,
          available: count || 0,
          shortage: Math.max(0, sec.count * mockCount - (count || 0))
        };
      }
      setInventory(status);
    } catch (e) {
      console.warn('Inventory check error:', e);
    } finally {
      setCheckingInventory(false);
    }
  };

  useEffect(() => {
    checkInventory();
  }, [selectedBlueprintKey, mockCount]);

  const hasShortage = Object.values(inventory).some(s => s.shortage > 0);

  const generateMocks = async () => {
    if (hasShortage) {
      if (
        !window.confirm(
          'Notice: There is a shortage of approved questions in the bank for some sections. ' +
            'Mocks will be created with available approved questions rotated. Do you want to proceed?'
        )
      ) {
        return;
      }
    }

    setLoading(true);
    setMsg('Generating blueprint-aligned mock tests from approved question bank...');
    setGenerationLog(null);

    try {
      const token = (await supabase?.auth?.getSession())?.data?.session?.access_token || '';
      const res = await fetch('/api/mock-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          blueprintKey: selectedBlueprintKey,
          mockCount: Number(mockCount),
          publishNow: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate mock');

      setGenerationLog(data);
      setMsg(`Successfully created ${data.mocks?.length || 0} mock exams from approved questions!`);
      if (onExamCreated) onExamCreated();
    } catch (e) {
      setMsg(`Generation Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="blueprint-card" style={{ marginTop: '20px' }}>
      <div className="blueprint-header">
        <div>
          <b style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#5b61df" />
            Blueprint-Driven AI Mock Generator
          </b>
          <small style={{ color: '#64748b' }}>
            Assembles authentic CBT exams exclusively from existing approved questions using official syllabus blueprints and question rotation.
          </small>
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: '14px' }}>
        <label>
          Target Exam Pattern Blueprint
          <select
            value={selectedBlueprintKey}
            onChange={e => setSelectedBlueprintKey(e.target.value)}
          >
            {Object.entries(BLUEPRINTS).map(([k, bp]) => (
              <option key={k} value={k}>
                {bp.title} ({bp.total_questions} Questions · {bp.duration_minutes} min)
              </option>
            ))}
          </select>
        </label>

        <label>
          Number of Mocks to Generate
          <select value={mockCount} onChange={e => setMockCount(Number(e.target.value))}>
            <option value={1}>1 Mock Test (Mock 1)</option>
            <option value={2}>2 Mock Tests (Mock 1 & 2 - Rotated)</option>
            <option value={3}>3 Mock Tests (Mock 1, 2, 3 - Zero overlap where pool allows)</option>
            <option value={5}>5 Full Mock Series</option>
          </select>
        </label>
      </div>

      {/* Blueprint Details & Section Inventory */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: '13px' }}>Pattern Structure & Question Bank Availability:</b>
          <button className="text-btn" onClick={checkInventory} disabled={checkingInventory}>
            <RotateCw size={12} /> {checkingInventory ? 'Checking...' : 'Refresh Inventory'}
          </button>
        </div>

        <table className="blueprint-table">
          <thead>
            <tr>
              <th>Section Name</th>
              <th>Required Subject</th>
              <th>Pattern Qs</th>
              <th>Needed (for {mockCount} mocks)</th>
              <th>Approved in Bank</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {currentBp.sections.map(sec => {
              const inv = inventory[sec.subject] || { needed: sec.count * mockCount, available: 0, shortage: 0 };
              return (
                <tr key={sec.name}>
                  <td><b>{sec.name}</b></td>
                  <td><span className="tag">{sec.subject}</span></td>
                  <td>{sec.count} Qs ({sec.marks} Marks)</td>
                  <td>{inv.needed} Qs</td>
                  <td><b>{inv.available}</b> available</td>
                  <td>
                    {inv.shortage > 0 ? (
                      <span className="shortage-badge">
                        <AlertTriangle size={12} /> Shortage: {inv.shortage} Qs
                      </span>
                    ) : (
                      <span style={{ color: '#16a16b', fontWeight: '700', fontSize: '11px' }}>
                        ✓ Ready ({inv.available >= inv.needed ? 'Full Pool' : 'Partial'})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Shortage Warning if applicable */}
      {hasShortage && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px 14px',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={16} />
          <div>
            <b>Question Pool Shortage Warning:</b> The bank does not have enough distinct approved questions for all {mockCount} mock(s).
            Import additional questions via TXT/CSV or generate fewer mocks to avoid duplicate questions across the series.
          </div>
        </div>
      )}

      {msg && (
        <div
          className={msg.includes('Error') ? 'error-badge' : 'file-selected'}
          style={{ marginTop: '14px' }}
        >
          {msg}
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          className="btn primary"
          disabled={loading || checkingInventory}
          onClick={generateMocks}
        >
          <Play size={16} />
          {loading ? 'Building Mocks from Approved Bank...' : `Assemble & Publish ${mockCount} Mock Test(s)`}
        </button>

        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Exact values (duration: {currentBp.duration_minutes}m, marks: {currentBp.marks_per_question}, negative: -{currentBp.negative_marking}) are strictly preserved.
        </span>
      </div>

      {/* Generation Report */}
      {generationLog && (
        <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '10px' }}>
          <b style={{ fontSize: '12px', color: '#1e293b' }}>Generation Summary:</b>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
            {generationLog.mocks?.map(m => (
              <div
                key={m.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12px'
                }}
              >
                <b>{m.title}</b>
                <div style={{ color: '#64748b', fontSize: '11px' }}>
                  {m.questions_mapped} questions assigned · {m.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
