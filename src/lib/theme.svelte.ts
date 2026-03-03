let dark = $state(true);

export const theme = {
  get dark() {
    return dark;
  },
  init() {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
    dark = saved !== 'light';
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  },
  toggle() {
    dark = !dark;
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
};
