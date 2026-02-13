import type { FC } from 'react';
import type { PageId } from '../types';

interface SidebarProps {
    currentPage: PageId;
    onPageChange: (page: PageId) => void;
}

const navItems: { id: PageId; icon: string; label: string }[] = [
    { id: 'character', icon: '👤', label: 'Character Editor' },
    { id: 'arts', icon: '🎨', label: 'ARTS / Prompts' },
    { id: 'autonomous', icon: '🤖', label: 'Autonomous Mode' },
    { id: 'lorebook', icon: '📚', label: 'Lorebook Editor' },
    { id: 'file_manager', icon: '📂', label: 'File Manager' },
    { id: 'cleaner', icon: '🧹', label: 'Lore Cleaner' },
    { id: 'history', icon: '📜', label: 'History & Backups' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
];

export const Sidebar: FC<SidebarProps> = ({ currentPage, onPageChange }) => {
    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">✨</div>
                    <div>
                        <span className="sidebar-logo-text">Character Creator</span>
                        <span className="sidebar-logo-version">v2.0</span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    <div className="nav-section-title">Creation Tools</div>
                    {navItems.slice(0, 4).map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => onPageChange(item.id)}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="nav-section">
                    <div className="nav-section-title">Utilities</div>
                    {navItems.slice(4, 5).map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => onPageChange(item.id)}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="nav-section" style={{ marginTop: 'auto' }}>
                    <div className="nav-section-title">System</div>
                    {navItems.slice(5).map((item) => (
                        <button
                            key={item.id}
                            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                            onClick={() => onPageChange(item.id)}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            <div className="sidebar-footer">
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Standalone Edition
                </div>
            </div>
        </aside>
    );
};
