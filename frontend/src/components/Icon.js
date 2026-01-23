import React from 'react';

const Icon = ({ name, size = 16, color = 'currentColor', strokeWidth = 1.8 }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const icons = {
    user: <><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" /></>,
    team: <><circle cx="16" cy="9" r="3" /><circle cx="8" cy="9" r="3" /><path d="M3 20v-1.5C3 16.6 5.2 15 8 15c1.2 0 2.4.3 3.3.9" /><path d="M21 20v-1.5C21 16.6 18.8 15 16 15c-1.2 0-2.4.3-3.3.9" /></>,
    clipboard: <><path d="M16 4h-2l-.5-1h-3L10 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
    building: <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M8 10h.01" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 14h.01" /><path d="M16 14h.01" /><path d="M12 14h.01" /></>,
    lightbulb: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /><path d="M12 3v2" /><path d="M12 11v7" /></>,
    check: <path d="M5 13l4 4 10-10" />,
    checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" /><path d="M9 14h2" /><path d="M13 14h2" /><path d="M9 17h2" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .2-1l-1-1.7a7 7 0 0 0 0-1.6l1-1.7a1.7 1.7 0 0 0-.2-1l-1.1-1.1a1.7 1.7 0 0 0-1-.2l-1.7 1a7 7 0 0 0-1.6 0l-1.7-1a1.7 1.7 0 0 0-1 .2L8 6a1.7 1.7 0 0 0-.2 1l1 1.7a7 7 0 0 0 0 1.6l-1 1.7a1.7 1.7 0 0 0 .2 1l1.1 1.1a1.7 1.7 0 0 0 1 .2l1.7-1a7 7 0 0 0 1.6 0l1.7 1a1.7 1.7 0 0 0 1-.2Z" /></>,
    crown: <><path d="M3 17l2-8 5 5 4-5 3 8H3z" /><path d="M3 17h18" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M6 7l1-3h10l1 3" /><path d="M5 7v13h14V7" /></>,
    x: <><path d="M6 6l12 12" /><path d="M6 18L18 6" /></>
  };
  return <svg {...common}>{icons[name]}</svg>;
};

export default Icon;
