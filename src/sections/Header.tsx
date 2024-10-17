export const Header = () => {
  return (
    <header className="flex justify-center items-center fixed top-3 w-full z-10">
      <nav className="flex gap-1 p-0.5 border border-white/15 rounded-full bg-white/10 backdrop-blur">
        <a href="#hero" className="nav-item font-light">
          Home
        </a>
        <a href="#projects" className="nav-item font-light">
          Projects
        </a>
        <a href="#about" className="nav-item font-light">
          About
        </a>
        <a
          href="#contact"
          className="nav-item bg-white text-gray-900 hover:bg-white/70 hover:text-gray-900"
        >
          Contact
        </a>
      </nav>
    </header>
  );
};
