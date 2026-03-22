interface NavItemProps {
  icon: string;
  text: string;
  active?: boolean;
}

export const NavItem = ({ icon, text, active = false }: NavItemProps) => (
  <a
    href="#"
    className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all group ${
      active
        ? "bg-primary text-white shadow-lg shadow-green-500/20"
        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-surface"
    }`}
  >
    <span className={`material-symbols-outlined ${!active && "group-hover:text-primary transition-colors"}`} style={{ fontVariationSettings: '"FILL" 1' }}>
      {icon}
    </span>
    <span className="font-medium">{text}</span>
  </a>
);
