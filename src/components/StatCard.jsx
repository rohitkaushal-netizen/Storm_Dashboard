export default function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div
      className="stat-card"
      style={{ borderTop: `4px solid ${color || '#6366f1'}` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-value" style={{ color: color || '#1e293b' }}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
